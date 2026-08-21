import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processWithGemini } from "@/lib/gemini/service.server";
import { extractPublicPage } from "@/lib/links.server";
import type { BaileysWebhook } from "@/lib/adapters/baileys.server";

async function loadMedia(media: NonNullable<BaileysWebhook["media"]>) {
  const base=process.env["BAILEYS_API_URL"]?.replace(/\/$/,""); const key=process.env["BAILEYS_API_KEY"];
  if (!base || !key) throw new Error("Baileys não configurado.");
  if (media.size > 20*1024*1024) throw new Error("Mídia maior que 20 MB; exige revisão.");
  const path=media.relativePath.split("/").map(encodeURIComponent).join("/");
  const response=await fetch(`${base}/media/${path}`,{headers:{"x-api-key":key}}); if(!response.ok) throw new Error(`Mídia indisponível (${response.status}).`);
  return {mimeType:media.mimeType,data:Buffer.from(await response.arrayBuffer()).toString("base64")};
}
export async function processBaileysMessage(payload: BaileysWebhook, groupId: string) {
  const db=supabaseAdmin as any;
  const timestamp=Number(payload.messageTimestamp);
  const occurred=Number.isFinite(timestamp)
    ? new Date(timestamp*(String(payload.messageTimestamp).length<=10?1000:1)).toISOString()
    : new Date(payload.receivedAt).toISOString();
  const {data:message,error}=await db.from("whatsapp_messages").upsert({external_message_id:payload.messageId,group_id:groupId,sender_external_id:payload.senderId,sender_name:payload.senderName,message_type:payload.contentType,text_content:payload.text,caption:payload.caption,occurred_at:occurred,received_at:payload.receivedAt,raw_payload:payload,processing_status:"processando"},{onConflict:"external_message_id"}).select().single();
  if(error) throw error;
  await db.from("extracted_links").delete().eq("message_id",message.id);
  await db.from("message_media").delete().eq("message_id",message.id);
  const contexts:string[]=[];
  for(const url of payload.links.slice(0,3)) try { const page=await extractPublicPage(url); contexts.push(`LINK ${url}\n${page.title||""}\n${page.description||""}\n${page.text}`); await db.from("extracted_links").insert({message_id:message.id,original_url:url,normalized_url:url,page_title:page.title,page_description:page.description,extracted_text:page.text,extraction_status:"extraido"}); } catch(cause) { await db.from("extracted_links").insert({message_id:message.id,original_url:url,normalized_url:url,extraction_status:"erro",failure_reason:cause instanceof Error?cause.message:"Falha"}); }
  const mediaFiles:Array<{mimeType:string;data:string}>=[]; const extraWarnings:string[]=[];
  if(payload.media){ await db.from("message_media").insert({message_id:message.id,media_type:payload.contentType,original_filename:payload.media.fileName,mime_type:payload.media.mimeType,file_size:payload.media.size,storage_path:payload.media.relativePath}); try{mediaFiles.push(await loadMedia(payload.media));}catch(cause){extraWarnings.push(cause instanceof Error?cause.message:"Mídia indisponível");} }
  const context=[payload.text,payload.caption,...contexts].filter(Boolean).join("\n\n");
  if(!context&&!mediaFiles.length){await db.from("whatsapp_messages").update({processing_status:"ignorado",error_message:"Sem conteúdo interpretável"}).eq("id",message.id);return{ignored:true};}
  const interpreted=await processWithGemini(context||"Analise a mídia anexada.",mediaFiles); const reviewStatus=interpreted.confidence_score>=.75&&interpreted.missing_fields.length===0?"pendente":"necessita_revisao";
  const {error:interpretError}=await db.from("interpreted_contents").upsert({message_id:message.id,...interpreted,price:interpreted.price==null?null:String(interpreted.price),warnings:[...interpreted.warnings,...extraWarnings],extracted_data:{groupId:payload.groupId,groupName:payload.groupName,links:payload.links,media:payload.media},model_used:"gemini-2.5-flash",prompt_version:"v1",review_status:reviewStatus,updated_at:new Date().toISOString()},{onConflict:"message_id"});
  if(interpretError) throw interpretError; await db.from("whatsapp_messages").update({processing_status:reviewStatus==="necessita_revisao"?"necessita_revisao":"interpretado",error_message:null}).eq("id",message.id); return{ignored:false,reviewStatus};
}
