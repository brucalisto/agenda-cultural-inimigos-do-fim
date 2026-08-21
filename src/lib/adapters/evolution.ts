/**
 * Evolution API Payload Adapter
 * Transforms various versions of Evolution API payloads into a standardized internal object.
 */

export interface StandardizedMessage {
  external_message_id: string;
  external_group_id: string | null;
  group_name: string | null;
  sender_external_id: string;
  sender_name: string | null;
  message_type: string;
  text_content: string | null;
  caption: string | null;
  quoted_message_id: string | null;
  occurred_at: Date;
  media?: {
    media_type: string;
    original_filename: string;
    mime_type: string;
    file_size?: number;
    source_url?: string;
  } | null;
}

export function adaptEvolutionPayload(payload: any): StandardizedMessage | null {
  try {
    // The message structure often nested under 'data' or similar depending on the event type
    const data = payload.data || payload;
    const message = data.message || data;
    const key = message.key || {};
    
    // Identify if it's a group message
    const remoteJid = key.remoteJid || message.remoteJid || "";
    const isGroup = remoteJid.endsWith('@g.us');
    
    const external_message_id = key.id || message.id;
    if (!external_message_id) return null;

    // Extract content based on message type
    let text_content = null;
    let caption = null;
    let message_type = 'unknown';
    let media: StandardizedMessage['media'] = null;

    const m = message.message || message;
    
    if (m.conversation) {
      text_content = m.conversation;
      message_type = 'text';
    } else if (m.extendedTextMessage) {
      text_content = m.extendedTextMessage.text;
      message_type = 'text';
    } else if (m.imageMessage) {
      caption = m.imageMessage.caption;
      message_type = 'image';
      media = {
        media_type: 'image',
        original_filename: `image_${external_message_id}.jpg`,
        mime_type: m.imageMessage.mimetype || 'image/jpeg',
      };
    } else if (m.videoMessage) {
      caption = m.videoMessage.caption;
      message_type = 'video';
      media = {
        media_type: 'video',
        original_filename: `video_${external_message_id}.mp4`,
        mime_type: m.videoMessage.mimetype || 'video/mp4',
      };
    } else if (m.audioMessage) {
      message_type = 'audio';
      media = {
        media_type: 'audio',
        original_filename: `audio_${external_message_id}.mp3`,
        mime_type: m.audioMessage.mimetype || 'audio/mp4',
      };
    } else if (m.documentMessage) {
      caption = m.documentMessage.caption;
      message_type = 'document';
      media = {
        media_type: 'document',
        original_filename: m.documentMessage.fileName || 'document',
        mime_type: m.documentMessage.mimetype || 'application/octet-stream',
      };
    }

    return {
      external_message_id,
      external_group_id: isGroup ? remoteJid : null,
      group_name: data.groupName || null,
      sender_external_id: message.participant || remoteJid,
      sender_name: message.pushName || data.pushName || null,
      message_type,
      text_content,
      caption,
      quoted_message_id: m.extendedTextMessage?.contextInfo?.stanzaId || null,
      occurred_at: message.messageTimestamp ? new Date(message.messageTimestamp * 1000) : new Date(),
      media
    };
  } catch (e) {
    console.error("Error adapting Evolution payload:", e);
    return null;
  }
}
