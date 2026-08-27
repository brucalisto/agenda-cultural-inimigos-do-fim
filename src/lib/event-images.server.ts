import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminAccess } from "@/lib/feed-sources.server";

type ImagePart = { inlineData?: { mimeType?: string; data?: string } };

export async function generateEventImage(accessToken: string, eventId: string) {
  await requireAdminAccess(accessToken);
  const { data: event, error } = await supabaseAdmin
    .from("interpreted_contents")
    .select("id,title,category,summary,full_description,location,city,event_date")
    .eq("id", eventId)
    .single();
  if (error) throw error;
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY não está configurada.");
  const model = process.env["GEMINI_IMAGE_MODEL"] || "gemini-3.1-flash-image";
  const prompt = [
    "Crie uma imagem editorial horizontal 4:3 para ilustrar um evento de uma agenda cultural brasileira.",
    "A imagem deve ser simples, clean, expressiva e adequada a um card pequeno.",
    "Não escreva palavras, letras, números, datas, logotipos, cartazes ou marcas na imagem.",
    "Valorize diversidade, cultura, território e atmosfera do evento sem inventar pessoas públicas específicas.",
    `Evento: ${event.title || "evento cultural"}`,
    `Categoria: ${event.category || "cultura"}`,
    `Contexto: ${event.summary || event.full_description || "não informado"}`,
    `Localidade: ${event.location || event.city || "Brasil"}`,
  ].join("\n");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "4:3" },
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      `Gemini imagem falhou (${response.status}): ${(await response.text()).slice(0, 240)}`,
    );
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: ImagePart[] } }>;
  };
  const image = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts || [])
    .find((part) => part.inlineData?.data)?.inlineData;
  if (!image?.data) throw new Error("O Gemini não retornou uma imagem.");
  const mimeType = image.mimeType || "image/png";
  const extension = mimeType.includes("webp") ? "webp" : mimeType.includes("jpeg") ? "jpg" : "png";
  const path = `${event.id}/${Date.now()}.${extension}`;
  const bytes = Uint8Array.from(atob(image.data), (character) => character.charCodeAt(0));
  const { error: uploadError } = await supabaseAdmin.storage
    .from("event-images")
    .upload(path, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;
  const { data: publicUrl } = supabaseAdmin.storage.from("event-images").getPublicUrl(path);
  const { error: updateError } = await supabaseAdmin
    .from("interpreted_contents")
    .update({ image_url: publicUrl.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", event.id);
  if (updateError) throw updateError;
  return { imageUrl: publicUrl.publicUrl, model };
}
