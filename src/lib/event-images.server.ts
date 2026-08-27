import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminAccess } from "@/lib/feed-sources.server";

type GeneratedImage = {
  bytes: Uint8Array;
  mimeType: string;
  model: string;
  provider: "xai" | "gemini";
};

type GeminiImagePart = { inlineData?: { mimeType?: string; data?: string } };

function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function generateWithXai(prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env["XAI_API_KEY"];
  if (!apiKey) throw new Error("XAI_API_KEY não está configurada.");

  const model = process.env["XAI_IMAGE_MODEL"] || "grok-imagine-image-2.0";
  const response = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      aspect_ratio: "4:3",
      resolution: "1k",
      quality: "low",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Grok imagem falhou (${response.status}): ${(await response.text()).slice(0, 240)}`,
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; mime_type?: string }>;
  };
  const image = payload.data?.[0];
  if (!image?.b64_json) throw new Error("O Grok não retornou uma imagem.");

  return {
    bytes: decodeBase64(image.b64_json),
    mimeType: image.mime_type || "image/jpeg",
    model,
    provider: "xai",
  };
}

async function generateWithGemini(prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY não está configurada.");

  const model = process.env["GEMINI_IMAGE_MODEL"] || "gemini-3.1-flash-image";
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

  if (!response.ok) {
    throw new Error(
      `Gemini imagem falhou (${response.status}): ${(await response.text()).slice(0, 240)}`,
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: GeminiImagePart[] } }>;
  };
  const image = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts || [])
    .find((part) => part.inlineData?.data)?.inlineData;
  if (!image?.data) throw new Error("O Gemini não retornou uma imagem.");

  return {
    bytes: decodeBase64(image.data),
    mimeType: image.mimeType || "image/png",
    model,
    provider: "gemini",
  };
}

async function generateWithFallback(prompt: string) {
  try {
    return await generateWithXai(prompt);
  } catch (xaiCause) {
    try {
      return await generateWithGemini(prompt);
    } catch (geminiCause) {
      const xaiMessage = xaiCause instanceof Error ? xaiCause.message : "falha desconhecida";
      const geminiMessage =
        geminiCause instanceof Error ? geminiCause.message : "falha desconhecida";
      throw new Error(
        `Não foi possível criar a imagem. Grok: ${xaiMessage} Gemini: ${geminiMessage}`,
      );
    }
  }
}

export async function generateEventImage(accessToken: string, eventId: string) {
  await requireAdminAccess(accessToken);
  const { data: event, error } = await supabaseAdmin
    .from("interpreted_contents")
    .select("id,title,category,summary,full_description,location,city,event_date")
    .eq("id", eventId)
    .single();
  if (error) throw error;

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

  const image = await generateWithFallback(prompt);
  const extension = image.mimeType.includes("webp")
    ? "webp"
    : image.mimeType.includes("png")
      ? "png"
      : "jpg";
  const path = `${event.id}/${Date.now()}.${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("event-images")
    .upload(path, image.bytes, { contentType: image.mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabaseAdmin.storage.from("event-images").getPublicUrl(path);
  const { error: updateError } = await supabaseAdmin
    .from("interpreted_contents")
    .update({ image_url: publicUrl.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", event.id);
  if (updateError) throw updateError;

  return {
    imageUrl: publicUrl.publicUrl,
    model: image.model,
    provider: image.provider,
  };
}
