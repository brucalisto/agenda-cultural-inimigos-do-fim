import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseBaileysWebhook } from "@/lib/adapters/baileys.server";
import { processBaileysMessage } from "@/lib/processing.server";

function validSignature(body:string,signature:string|null,secret:string){if(!signature?.startsWith("sha256="))return false;const expected=Buffer.from(createHmac("sha256",secret).update(body).digest("hex"));const received=Buffer.from(signature.slice(7));return expected.length===received.length&&timingSafeEqual(expected,received);}

export const Route=createFileRoute("/api/public/whatsapp-webhook")({server:{handlers:{POST:async({request})=>{
  const started=Date.now();const body=await request.text();if(body.length>2_000_000)return new Response("Payload too large",{status:413});
  const secret=process.env["WHATSAPP_WEBHOOK_SECRET"];if(!secret)return new Response("Webhook secret missing",{status:500});
  if(!validSignature(body,request.headers.get("x-baileys-signature"),secret))return new Response("Unauthorized",{status:401});
  let payload;try{payload=parseBaileysWebhook(JSON.parse(body));}catch{return new Response("Invalid Baileys payload",{status:400});}
  const db=supabaseAdmin as any;const {data:event}=await db.from("webhook_events").insert({provider:"baileys",event_type:"messages.upsert",external_event_id:payload.eventId,payload,processing_status:"received",received_at:new Date().toISOString()}).select().single();
  try{
    let {data:group}=await db.from("whatsapp_groups").select("*").eq("external_group_id",payload.groupId).maybeSingle();
    if(!group){const inserted=await db.from("whatsapp_groups").insert({external_group_id:payload.groupId,nome:payload.groupName,ativo:false,autorizado:false}).select().single();group=inserted.data;}
    else if(group.nome!==payload.groupName)await db.from("whatsapp_groups").update({nome:payload.groupName,updated_at:new Date().toISOString()}).eq("id",group.id);
    if(!group?.ativo||!group?.autorizado){await db.from("webhook_events").update({processing_status:"ignored",error_message:"Grupo detectado, mas não autorizado",processed_at:new Date().toISOString(),http_status:200}).eq("id",event?.id);return Response.json({ok:true,ignored:true});}
    const result=await processBaileysMessage(payload,group.id);await db.from("webhook_events").update({processing_status:"processed",processed_at:new Date().toISOString(),processing_duration_ms:Date.now()-started,http_status:200}).eq("id",event?.id);return Response.json({ok:true,...result});
  }catch(cause){const message=cause instanceof Error?cause.message:"Falha";await db.from("webhook_events").update({processing_status:"error",error_message:message,processed_at:new Date().toISOString(),http_status:500}).eq("id",event?.id);return Response.json({ok:false,error:"Processing failed"},{status:500});}
}}}});
