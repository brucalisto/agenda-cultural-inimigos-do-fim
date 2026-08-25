import { GEMINI_CONFIG, GROQ_CONFIG } from "./config.server";
import { SYSTEM_PROMPTS } from "./prompts.server";
import { InterpretedContentsSchema, type InterpretedContentsResponse } from "./schema";

type MediaFile = { mimeType: string; data: string };
export type AIResult = InterpretedContentsResponse & {
  modelUsed: string;
  provider: "groq" | "gemini";
};

function getDateContext() {
  const timeZone = "America/Sao_Paulo";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const localDate = new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
  const sunday = new Date(localDate);
  sunday.setUTCDate(localDate.getUTCDate() - localDate.getUTCDay());
  const saturday = new Date(sunday);
  saturday.setUTCDate(sunday.getUTCDate() + 6);
  const format = (date: Date) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(date);
  return `Data atual em São Paulo: ${format(localDate)}. Ano vigente: ${value("year")}. Semana vigente, de domingo a sábado: ${format(sunday)} até ${format(saturday)}.`;
}

async function transcribeWithGroq(file: MediaFile, apiKey: string) {
  const form = new FormData();
  const extension = file.mimeType.includes("webm")
    ? "webm"
    : file.mimeType.includes("mp4")
      ? "mp4"
      : "mp3";
  form.append(
    "file",
    new Blob([Buffer.from(file.data, "base64")], { type: file.mimeType }),
    `midia.${extension}`,
  );
  form.append("model", GROQ_CONFIG.AUDIO_MODEL_NAME);
  form.append("language", "pt");
  form.append("response_format", "json");
  const response = await fetch(`${GROQ_CONFIG.API_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok)
    throw new Error(
      `Transcrição Groq falhou (${response.status}): ${(await response.text()).slice(0, 240)}`,
    );
  const payload = (await response.json()) as { text?: string };
  return payload.text || "";
}

async function processWithGroq(content: string, mediaFiles: MediaFile[]): Promise<AIResult> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("GROQ_API_KEY não está configurada.");
  const visual = mediaFiles.filter((file) => file.mimeType.startsWith("image/")).slice(0, 5);
  const audible = mediaFiles.filter(
    (file) => file.mimeType.startsWith("audio/") || file.mimeType.startsWith("video/"),
  );
  const transcripts: string[] = [];
  for (const file of audible) transcripts.push(await transcribeWithGroq(file, apiKey));
  const userContent: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `${getDateContext()}\n\nConteúdo para análise:\n${content}\n\nTRANSCRIÇÕES DE ÁUDIO/VÍDEO:\n${transcripts.filter(Boolean).join("\n\n") || "Nenhuma"}`,
    },
    ...visual.map((file) => ({
      type: "image_url",
      image_url: { url: `data:${file.mimeType};base64,${file.data}` },
    })),
  ];
  const response = await fetch(`${GROQ_CONFIG.API_URL}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: GROQ_CONFIG.MODEL_NAME,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.v1 },
        { role: "user", content: userContent },
      ],
      temperature: GEMINI_CONFIG.TEMPERATURE,
      max_completion_tokens: GEMINI_CONFIG.MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok)
    throw new Error(`Groq falhou (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error("Resposta vazia da Groq.");
  return {
    ...InterpretedContentsSchema.parse(JSON.parse(text)),
    modelUsed: GROQ_CONFIG.MODEL_NAME,
    provider: "groq",
  };
}

async function processWithGemini(content: string, mediaFiles: MediaFile[]): Promise<AIResult> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY não está configurada.");
  const parts: Array<Record<string, unknown>> = [
    { text: `${getDateContext()}\n\nConteúdo para análise:\n\n${content}` },
    ...mediaFiles.map((file) => ({ inlineData: { mimeType: file.mimeType, data: file.data } })),
  ];
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPTS.v1 }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          maxOutputTokens: GEMINI_CONFIG.MAX_OUTPUT_TOKENS,
          temperature: GEMINI_CONFIG.TEMPERATURE,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(`Gemini falhou (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Resposta vazia do Gemini.");
  return {
    ...InterpretedContentsSchema.parse(JSON.parse(text)),
    modelUsed: GEMINI_CONFIG.MODEL_NAME,
    provider: "gemini",
  };
}

export async function processWithAI(content: string, mediaFiles: MediaFile[] = []) {
  if (mediaFiles.some((file) => file.mimeType.startsWith("video/"))) {
    try {
      return await processWithGemini(content, mediaFiles);
    } catch {
      return processWithGroq(content, mediaFiles);
    }
  }
  try {
    return await processWithGroq(content, mediaFiles);
  } catch (groqError) {
    try {
      return await processWithGemini(content, mediaFiles);
    } catch (geminiError) {
      throw new Error(
        `Groq: ${groqError instanceof Error ? groqError.message : "falha"}. Contingência Gemini: ${geminiError instanceof Error ? geminiError.message : "falha"}.`,
      );
    }
  }
}

export async function areMessagesComplementary(previous: string, current: string) {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) return false;
  const response = await fetch(`${GROQ_CONFIG.API_URL}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: GROQ_CONFIG.MODEL_NAME,
      messages: [
        {
          role: "user",
          content: `Determine se a segunda mensagem complementa a primeira sobre o MESMO evento. Responda JSON {"complementary":true|false}.\nMENSAGEM 1:\n${previous}\nMENSAGEM 2:\n${current}`,
        },
      ],
      temperature: 0,
      max_completion_tokens: 40,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) return false;
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    return Boolean(JSON.parse(payload.choices?.[0]?.message?.content || "{}").complementary);
  } catch {
    return false;
  }
}
