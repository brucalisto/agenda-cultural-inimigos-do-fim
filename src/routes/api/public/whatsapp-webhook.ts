import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { adaptEvolutionPayload } from '@/lib/adapters/evolution'

export const Route = createFileRoute('/api/public/whatsapp-webhook')({
  component: () => null,
  loader: () => ({}),
})

export const APIRoute = {
  POST: async ({ request }: { request: Request }) => {
    const startTime = Date.now();
    
    // 1. Basic security & size checks
    const signature = request.headers.get('x-webhook-secret');
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    
    // Max 5MB
    if (contentLength > 5 * 1024 * 1024) {
      return new Response('Payload too large', { status: 413 });
    }

    let payload: any;
    try {
      payload = await request.json();
    } catch (e) {
      return new Response('Invalid JSON', { status: 400 });
    }

    // 2. Sanitize headers for logging
    const headers: Record<string, string> = {};
    request.headers.forEach((value: string, key: string) => {
      if (!['authorization', 'x-webhook-secret', 'cookie'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });

    // 3. Register incoming event (initial log)
    const { data: eventLog, error: logError } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        provider: 'evolution',
        event_type: payload.event || 'unknown',
        external_event_id: payload.instanceId || null,
        headers_sanitized: headers,
        payload: payload,
        processing_status: 'received',
        received_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to log webhook event:", logError);
    }

    // 4. Validate Secret
    const secret = process.env['WHATSAPP_WEBHOOK_SECRET'];
    if (!secret) {
      console.error("WHATSAPP_WEBHOOK_SECRET is not configured in environment variables.");
      await updateLog(eventLog?.id, { 
        processing_status: 'error', 
        error_message: 'Server configuration error: missing secret',
        http_status: 500 
      });
      return new Response('Internal Server Error', { status: 500 });
    }

    if (signature !== secret) {
      await updateLog(eventLog?.id, { 
        processing_status: 'error', 
        error_message: 'Invalid signature',
        http_status: 401 
      });
      return new Response('Unauthorized', { status: 401 });
    }

    // 5. Process Message
    try {
      if (['MESSAGES_UPSERT', 'MESSAGES_SET'].includes(payload.event)) {
        const standardized = adaptEvolutionPayload(payload);
        
        if (standardized && standardized.external_group_id) {
          const { data: group } = await supabaseAdmin
            .from('whatsapp_groups')
            .select('id, autorizado, ativo')
            .eq('external_group_id', standardized.external_group_id)
            .single();

          if (group && group.ativo && group.autorizado) {
            const { error: msgError } = await supabaseAdmin
              .from('whatsapp_messages')
              .upsert({
                external_message_id: standardized.external_message_id,
                group_id: group.id,
                sender_external_id: standardized.sender_external_id,
                sender_name: standardized.sender_name,
                message_type: standardized.message_type,
                text_content: standardized.text_content,
                caption: standardized.caption,
                quoted_message_id: standardized.quoted_message_id,
                occurred_at: standardized.occurred_at.toISOString(),
                received_at: new Date().toISOString(),
                raw_payload: payload,
                processing_status: 'recebido'
              }, { onConflict: 'external_message_id' });

            if (msgError) {
              throw new Error(`Message registration error: ${msgError.message}`);
            }
          } else {
            await updateLog(eventLog?.id, { 
               processing_status: 'ignored',
               error_message: group ? 'Group not authorized' : 'Group not registered'
            });
          }
        }
      }

      await updateLog(eventLog?.id, {
        processing_status: 'processed',
        http_status: 200,
        processing_duration_ms: Date.now() - startTime,
        processed_at: new Date().toISOString()
      });

      return new Response('OK', { status: 200 });

    } catch (error: any) {
      console.error("Webhook processing error:", error);
      await updateLog(eventLog?.id, { 
        processing_status: 'error', 
        error_message: error.message,
        http_status: 200 
      });
      return new Response('OK', { status: 200 }); 
    }
  }
}

async function updateLog(id: string | undefined, updates: any) {
  if (!id) return;
  try {
    await supabaseAdmin.from('webhook_events').update(updates).eq('id', id);
  } catch (e) {
    console.error("Failed to update webhook log:", e);
  }
}
