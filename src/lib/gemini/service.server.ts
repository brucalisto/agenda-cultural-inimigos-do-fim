import {
  CLOUDFLARE_CONFIG,
  GEMINI_CONFIG,
  GROQ_CONFIG,
  MISTRAL_CONFIG,
  OPENROUTER_CONFIG,
} from "./config.server";
import { SYSTEM_PROMPTS } from "./prompts.server";
import { InterpretedContentsSchema, type InterpretedContentsResponse } from "./schema";

type MediaFile = { mimeType: string; data: string };
type Provider = "mistral" | "groq" | "cloudflare" | "gemini" | "openrouter";

export type AIResult = InterpretedContentsResponse & {
  modelUsed: string;
  provider: Provider;
};

const MAX_CONTENT_CHARS = 12_000;
const MAX_TRANSCRIPT_CHARS = 3_000;
const TEXT_TIMEOUT_MS = 12_000;
const VISION_TIMEOUT_MS = 18_000;
const OPENROUTER_TIMEOUT_MS = 15_000;
const COMPLEMENT_TIMEOUT_MS = 7_000;

const INTERPRETED_CONTENTS_JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          title: { type: ["string", "null"] },
          category: { type: ["string", "null"] },
          summary: { type: ["string", "null"] },
          full_description: { type: ["string", "null"] },
          event_date: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          city: { type: ["string", "null"] },
          price: { type: ["number", "null"] },
          contact_name: { type: ["string", "null"] },
          contact_phone: { type: ["string", "null"] },
          contact_instagram: { type: ["string", "null"] },
          source_url: { type: ["string", "null"] },
          keywords: { type: "array", items: { type: "string" } },
          missing_fields: { type: "array", items: { type: "string" } },
          warnings: { type: "array", items: { type: "string" } },
          confidence_score: { type: "number", minimum: 0, maximum: 1 },
        },
        required: [
          "title",
          "category",
          "summary",
          "full_description",
          "event_date",
          "location",
          "city",
          "price",
          "contact_name",
          "contact_phone",
          "contact_instagram",
          "source_url",
          "keywords",
          "missing_fields",
          "warnings",
          "confidence_score",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

function compactText(value: string, maxChars = MAX_CONTENT_CHARS) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}\n\n[conteúdo truncado automaticamente para respeitar o limite do provedor]`;
}

function parseModelJson(text: string) {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("A IA respondeu, mas não retornou um JSON válido.");
  }
}

function extractMessageText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((chunk) => {
        if (!chunk || typeof chunk !== "object") return "";
        const record = chunk as Record<string, unknown>;
        return typeof record.text === "string" ? record.text : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} excedeu ${Math.round(timeoutMs / 1000)}s e foi interrompido.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function retryableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(?:429|500|502|503|504)\b|temporar|rate.?limit|overloaded/i.test(message);
}

async function runWithOneRetry<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    if (!retryableError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 800));
    return run();
  }
}

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

function visualMedia(mediaFiles: MediaFile[]) {
  return mediaFiles.filter((file) => file.mimeType.startsWith("image/")).slice(0, 3);
}

function audibleMedia(mediaFiles: MediaFile[]) {
  return mediaFiles.filter(
    (file) => file.mimeType.startsWith("audio/") || file.mimeType.startsWith("video/"),
  );
}

function textLooksSufficientForExtraction(content: string) {
  const text = content.toLowerCase();
  const hasDate =
    /\b\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?\b/.test(text) ||
    /\b(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)\b/.test(text) ||
    /\b(?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/.test(text);
  const hasTime = /\b\d{1,2}(?::\d{2})?\s*h(?:oras?)?\b|\bàs\s+\d{1,2}/i.test(text);
  const hasPlace = /\b(?:local|endereço|endereco|teatro|praça|praca|museu|centro cultural|auditório|auditorio|sítio|sitio|parque|biblioteca|cinema)\b/.test(text);
  const hasEventCue = /\b(?:show|apresentação|apresentacao|espetáculo|espetaculo|oficina|festival|feira|cinema|cineclube|teatro|dança|danca|concerto|sarau|exposição|exposicao|evento|roda de conversa|curso|vivência|vivencia|capoeira|literatura|lançamento|lancamento)\b/.test(text);
  return hasDate && hasEventCue && (hasTime || hasPlace);
}

function shouldUseVision(content: string, mediaFiles: MediaFile[]) {
  const images = visualMedia(mediaFiles);
  if (!images.length) return false;
  return !textLooksSufficientForExtraction(content);
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
  if (!response.ok) {
    throw new Error(`Transcrição Groq falhou (${response.status}): ${(await response.text()).slice(0, 240)}`);
  }
  const payload = (await response.json()) as { text?: string };
  return payload.text || "";
}

async function enrichWithTranscripts(content: string, mediaFiles: MediaFile[]) {
  const audible = audibleMedia(mediaFiles);
  const apiKey = process.env["GROQ_API_KEY"];
  if (!audible.length || !apiKey) return content;

  const transcripts: string[] = [];
  for (const file of audible.slice(0, 3)) {
    try {
      const transcript = await withTimeout(transcribeWithGroq(file, apiKey), "Transcrição Groq", 10_000);
      if (transcript) transcripts.push(transcript);
    } catch {
      // Se a transcrição falhar, o Gemini ainda poderá receber a mídia original como contingência.
    }
  }
  const joined = compactText(transcripts.join("\n\n"), MAX_TRANSCRIPT_CHARS);
  return joined ? `${content}\n\nTRANSCRIÇÕES DE ÁUDIO/VÍDEO:\n${joined}` : content;
}

function openAIUserContent(content: string, images: MediaFile[]) {
  return [
    {
      type: "text",
      text: `${getDateContext()}\n\nConteúdo para análise:\n${compactText(content)}\n\nRetorne somente JSON válido conforme o formato solicitado.`,
    },
    ...images.map((file) => ({
      type: "image_url",
      image_url: { url: `data:${file.mimeType};base64,${file.data}` },
    })),
  ];
}

function mistralUserContent(content: string, images: MediaFile[]) {
  return [
    {
      type: "text",
      text: `${getDateContext()}\n\nConteúdo para análise:\n${compactText(content)}\n\nRetorne somente JSON válido conforme o formato solicitado.`,
    },
    ...images.map((file) => ({
      type: "image_url",
      image_url: `data:${file.mimeType};base64,${file.data}`,
    })),
  ];
}

function parseAndValidate(text: string) {
  return InterpretedContentsSchema.parse(parseModelJson(text));
}

async function processWithMistral(content: string, mediaFiles: MediaFile[]): Promise<AIResult> {
  const apiKey = process.env["MISTRAL_API_KEY"];
  if (!apiKey) throw new Error("MISTRAL_API_KEY não está configurada.");
  const images = visualMedia(mediaFiles);
  const response = await fetch(`${MISTRAL_CONFIG.API_URL}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MISTRAL_CONFIG.MODEL_NAME,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.v1 },
        { role: "user", content: mistralUserContent(content, images) },
      ],
      response_format: { type: "json_object" },
      temperature: GEMINI_CONFIG.TEMPERATURE,
      max_tokens: MISTRAL_CONFIG.MAX_OUTPUT_TOKENS,
    }),
  });
  if (!response.ok) {
    throw new Error(`Mistral falhou (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  const payload = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const text = extractMessageText(payload.choices?.[0]?.message?.content);
  if (!text) throw new Error("Resposta vazia da Mistral.");
  return {
    ...parseAndValidate(text),
    modelUsed: payload.model || MISTRAL_CONFIG.MODEL_NAME,
    provider: "mistral",
  };
}

async function processWithGroq(content: string, mediaFiles: MediaFile[]): Promise<AIResult> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("GROQ_API_KEY não está configurada.");
  const images = visualMedia(mediaFiles);
  const response = await fetch(`${GROQ_CONFIG.API_URL}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: GROQ_CONFIG.MODEL_NAME,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.v1 },
        { role: "user", content: openAIUserContent(content, images) },
      ],
      reasoning_effort: "none",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "interpreted_contents",
          strict: true,
          schema: INTERPRETED_CONTENTS_JSON_SCHEMA,
        },
      },
      temperature: GEMINI_CONFIG.TEMPERATURE,
      max_completion_tokens: GROQ_CONFIG.MAX_OUTPUT_TOKENS,
    }),
  });
  if (!response.ok) {
    throw new Error(`Groq falhou (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  const payload = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const text = extractMessageText(payload.choices?.[0]?.message?.content);
  if (!text) throw new Error("Resposta vazia da Groq.");
  return {
    ...parseAndValidate(text),
    modelUsed: payload.model || GROQ_CONFIG.MODEL_NAME,
    provider: "groq",
  };
}

async function processWithCloudflareModel(
  content: string,
  mediaFiles: MediaFile[],
  model: string,
): Promise<AIResult> {
  const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
  const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
  if (!accountId || !apiToken) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID ou CLOUDFLARE_API_TOKEN não está configurado.");
  }
  const images = visualMedia(mediaFiles);
  const response = await fetch(`${CLOUDFLARE_CONFIG.API_URL}/${accountId}/ai/v1/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.v1 },
        { role: "user", content: openAIUserContent(content, images) },
      ],
      response_format: { type: "json_object" },
      temperature: GEMINI_CONFIG.TEMPERATURE,
      max_tokens: CLOUDFLARE_CONFIG.MAX_OUTPUT_TOKENS,
    }),
  });
  if (!response.ok) {
    throw new Error(`Cloudflare ${model} falhou (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  const payload = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const text = extractMessageText(payload.choices?.[0]?.message?.content);
  if (!text) throw new Error(`Resposta vazia da Cloudflare (${model}).`);
  return {
    ...parseAndValidate(text),
    modelUsed: payload.model || model,
    provider: "cloudflare",
  };
}

async function processWithGemini(content: string, mediaFiles: MediaFile[]): Promise<AIResult> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY não está configurada.");
  const parts: Array<Record<string, unknown>> = [
    { text: `${getDateContext()}\n\nConteúdo para análise:\n${compactText(content)}` },
    ...mediaFiles.slice(0, 4).map((file) => ({
      inlineData: { mimeType: file.mimeType, data: file.data },
    })),
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
  if (!response.ok) {
    throw new Error(`Gemini falhou (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n");
  if (!text) throw new Error("Resposta vazia do Gemini.");
  return {
    ...parseAndValidate(text),
    modelUsed: GEMINI_CONFIG.MODEL_NAME,
    provider: "gemini",
  };
}

async function processWithOpenRouter(content: string, mediaFiles: MediaFile[]): Promise<AIResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY não está configurada.");
  const images = visualMedia(mediaFiles).slice(0, 2);
  const response = await fetch(`${OPENROUTER_CONFIG.API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://agenda-cultural-inimigos-do-fim.lovable.app",
      "X-Title": "Agenda Cultural Inimigos do Fim",
    },
    body: JSON.stringify({
      model: OPENROUTER_CONFIG.MODEL_NAME,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.v1 },
        { role: "user", content: openAIUserContent(content, images) },
      ],
      temperature: GEMINI_CONFIG.TEMPERATURE,
      max_tokens: OPENROUTER_CONFIG.MAX_OUTPUT_TOKENS,
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenRouter falhou (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  const payload = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const text = extractMessageText(payload.choices?.[0]?.message?.content);
  if (!text) throw new Error("Resposta vazia do OpenRouter.");
  return {
    ...parseAndValidate(text),
    modelUsed: payload.model || OPENROUTER_CONFIG.MODEL_NAME,
    provider: "openrouter",
  };
}

type Attempt = {
  label: string;
  timeoutMs: number;
  run: () => Promise<AIResult>;
};

export async function processWithAI(content: string, mediaFiles: MediaFile[] = []) {
  const enrichedContent = await enrichWithTranscripts(content, mediaFiles);
  const useVision = shouldUseVision(enrichedContent, mediaFiles);
  const images = useVision ? visualMedia(mediaFiles) : [];
  const geminiMedia = useVision
    ? [...images, ...audibleMedia(mediaFiles).slice(0, 1)]
    : audibleMedia(mediaFiles).slice(0, 1);

  const attempts: Attempt[] = useVision
    ? [
        { label: "Groq Qwen 3.8 Vision", timeoutMs: VISION_TIMEOUT_MS, run: () => processWithGroq(enrichedContent, images) },
        { label: "Cloudflare Qwen 3.8 Vision", timeoutMs: VISION_TIMEOUT_MS, run: () => processWithCloudflareModel(enrichedContent, images, CLOUDFLARE_CONFIG.PRIMARY_MODEL_NAME) },
        { label: "Cloudflare Llama 4 Scout", timeoutMs: VISION_TIMEOUT_MS, run: () => processWithCloudflareModel(enrichedContent, images, CLOUDFLARE_CONFIG.FALLBACK_MODEL_NAME) },
        { label: "Mistral Vision", timeoutMs: VISION_TIMEOUT_MS, run: () => processWithMistral(enrichedContent, images) },
        { label: "Gemini Flash-Lite Vision", timeoutMs: VISION_TIMEOUT_MS, run: () => processWithGemini(enrichedContent, geminiMedia) },
        { label: "OpenRouter Free", timeoutMs: OPENROUTER_TIMEOUT_MS, run: () => processWithOpenRouter(enrichedContent, images) },
      ]
    : [
        { label: "Mistral", timeoutMs: TEXT_TIMEOUT_MS, run: () => processWithMistral(enrichedContent, []) },
        { label: "Groq Qwen 3.8", timeoutMs: TEXT_TIMEOUT_MS, run: () => processWithGroq(enrichedContent, []) },
        { label: "Gemini Flash-Lite", timeoutMs: TEXT_TIMEOUT_MS, run: () => processWithGemini(enrichedContent, geminiMedia) },
        { label: "Cloudflare Qwen 3.8", timeoutMs: TEXT_TIMEOUT_MS, run: () => processWithCloudflareModel(enrichedContent, [], CLOUDFLARE_CONFIG.PRIMARY_MODEL_NAME) },
        { label: "Cloudflare Llama 4 Scout", timeoutMs: TEXT_TIMEOUT_MS, run: () => processWithCloudflareModel(enrichedContent, [], CLOUDFLARE_CONFIG.FALLBACK_MODEL_NAME) },
        { label: "OpenRouter Free", timeoutMs: OPENROUTER_TIMEOUT_MS, run: () => processWithOpenRouter(enrichedContent, []) },
      ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      return await withTimeout(runWithOneRetry(attempt.run), attempt.label, attempt.timeoutMs);
    } catch (error) {
      errors.push(`${attempt.label}: ${error instanceof Error ? error.message : "falha"}`);
    }
  }
  throw new Error(errors.join(". "));
}

async function complementaryWithMistral(prompt: string) {
  const apiKey = process.env["MISTRAL_API_KEY"];
  if (!apiKey) throw new Error("sem Mistral");
  const response = await fetch(`${MISTRAL_CONFIG.API_URL}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MISTRAL_CONFIG.MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 80,
    }),
  });
  if (!response.ok) throw new Error("Mistral indisponível");
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  return parseModelJson(extractMessageText(payload.choices?.[0]?.message?.content) || "{}").complementary;
}

async function complementaryWithGroq(prompt: string) {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("sem Groq");
  const response = await fetch(`${GROQ_CONFIG.API_URL}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: GROQ_CONFIG.MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      temperature: 0,
      max_completion_tokens: 80,
    }),
  });
  if (!response.ok) throw new Error("Groq indisponível");
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  return parseModelJson(extractMessageText(payload.choices?.[0]?.message?.content) || "{}").complementary;
}

async function complementaryWithGemini(prompt: string) {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("sem Gemini");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 80, temperature: 0, responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) throw new Error("Gemini indisponível");
  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "{}";
  return parseModelJson(text).complementary;
}

export async function areMessagesComplementary(previous: string, current: string) {
  const prompt = `Determine se a segunda mensagem complementa a primeira sobre o MESMO evento. Responda somente JSON {"complementary":true|false}.\nMENSAGEM 1:\n${compactText(previous, 4000)}\nMENSAGEM 2:\n${compactText(current, 4000)}`;
  const attempts = [
    () => complementaryWithMistral(prompt),
    () => complementaryWithGroq(prompt),
    () => complementaryWithGemini(prompt),
  ];
  for (const run of attempts) {
    try {
      const value = await withTimeout(run(), "Complementaridade", COMPLEMENT_TIMEOUT_MS);
      if (typeof value === "boolean") return value;
    } catch {
      // Tenta o próximo provedor gratuito.
    }
  }
  return false;
}
