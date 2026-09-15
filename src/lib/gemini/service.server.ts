import {
  CLOUDFLARE_CONFIG,
  GEMINI_CONFIG,
  GROQ_CONFIG,
  MISTRAL_CONFIG,
  OPENROUTER_CONFIG,
} from "./config.server";
import { SYSTEM_PROMPTS } from "./prompts.server";
import { InterpretedContentsSchema, type InterpretedContentsResponse } from "./schema";
import {
  createAiCorrelationId,
  persistAiProviderAttempts,
  type AiProviderAttempt,
} from "@/lib/ai-observability.server";

type MediaFile = { mimeType: string; data: string };
type Provider = "mistral" | "groq" | "cloudflare" | "gemini" | "openrouter";

export type AIResult = InterpretedContentsResponse & {
  modelUsed: string;
  provider: Provider;
};

const MAX_CONTENT_CHARS = 12_000;
const MAX_TRANSCRIPT_CHARS = 3_000;
const MAX_VISUAL_IMAGES = 10;
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

async function runWithOneRetry<T>(run: () => Promise<T>, onRetry?: () => void) {
  try {
    return await run();
  } catch (error) {
    if (!retryableError(error)) throw error;
    onRetry?.();
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
  return mediaFiles.filter((file) => file.mimeType.startsWith("image/")).slice(0, MAX_VISUAL_IMAGES);
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

function shouldForceVision(content: string, mediaFiles: MediaFile[]) {
  if (!visualMedia(mediaFiles).length) return false;
  if (/\bFORCE_VISION\s*=\s*1\b/i.test(content)) return true;
  if (visualMedia(mediaFiles).length <= 1) return false;
  return /\b(?:carrossel|programação|programacao|agenda completa|confira a programação|oficinas?|grade|cronograma|mostra|festival)\b/i.test(
    content,
  );
}

function shouldUseVision(content: string, mediaFiles: MediaFile[]) {
  const images = visualMedia(mediaFiles);
  if (!images.length) return false;
  if (shouldForceVision(content, mediaFiles)) return true;
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

  const correlationId = createAiCorrelationId();
  const observations: AiProviderAttempt[] = [];
  const transcripts: string[] = [];
  for (const [index, file] of audible.slice(0, 3).entries()) {
    const startedAt = Date.now();
    try {
      const transcript = await withTimeout(transcribeWithGroq(file, apiKey), "Transcrição Groq", 10_000);
      observations.push({
        correlationId,
        operation: "transcription",
        sourceMode: "audio",
        provider: "groq",
        model: GROQ_CONFIG.AUDIO_MODEL_NAME,
        label: "Transcrição Groq",
        attemptOrder: index + 1,
        status: "success",
        durationMs: Date.now() - startedAt,
        fallbackUsed: false,
        retryUsed: false,
        contentChars: null,
        mediaCount: 1,
      });
      if (transcript) transcripts.push(transcript);
    } catch (error) {
      observations.push({
        correlationId,
        operation: "transcription",
        sourceMode: "audio",
        provider: "groq",
        model: GROQ_CONFIG.AUDIO_MODEL_NAME,
        label: "Transcrição Groq",
        attemptOrder: index + 1,
        status: "error",
        durationMs: Date.now() - startedAt,
        fallbackUsed: false,
        retryUsed: false,
        errorMessage: error instanceof Error ? error.message : "Falha na transcrição Groq",
        contentChars: null,
        mediaCount: 1,
      });
      // Se a transcrição falhar, o Gemini ainda poderá receber a mídia original como contingência.
    }
  }
  await persistAiProviderAttempts(observations);
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
    ...mediaFiles.slice(0, MAX_VISUAL_IMAGES).map((file) => ({
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
  provider: Provider;
  model: string;
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
        { label: "Groq Qwen 3.8 Vision", provider: "groq", model: GROQ_CONFIG.MODEL_NAME, timeoutMs: VISION_TIMEOUT_MS, run: () => processWithGroq(enrichedContent, images) },
        { label: "Cloudflare Qwen 3.8 Vision", provider: "cloudflare", model: CLOUDFLARE_CONFIG.PRIMARY_MODEL_NAME, timeoutMs: VISION_TIMEOUT_MS, run: () => processWithCloudflareModel(enrichedContent, images, CLOUDFLARE_CONFIG.PRIMARY_MODEL_NAME) },
        { label: "Cloudflare Llama 4 Scout", provider: "cloudflare", model: CLOUDFLARE_CONFIG.FALLBACK_MODEL_NAME, timeoutMs: VISION_TIMEOUT_MS, run: () => processWithCloudflareModel(enrichedContent, images, CLOUDFLARE_CONFIG.FALLBACK_MODEL_NAME) },
        { label: "Mistral Vision", provider: "mistral", model: MISTRAL_CONFIG.MODEL_NAME, timeoutMs: VISION_TIMEOUT_MS, run: () => processWithMistral(enrichedContent, images) },
        { label: "Gemini Flash-Lite Vision", provider: "gemini", model: GEMINI_CONFIG.MODEL_NAME, timeoutMs: VISION_TIMEOUT_MS, run: () => processWithGemini(enrichedContent, geminiMedia) },
        { label: "OpenRouter Free", provider: "openrouter", model: OPENROUTER_CONFIG.MODEL_NAME, timeoutMs: OPENROUTER_TIMEOUT_MS, run: () => processWithOpenRouter(enrichedContent, images) },
      ]
    : [
        { label: "Mistral", provider: "mistral", model: MISTRAL_CONFIG.MODEL_NAME, timeoutMs: TEXT_TIMEOUT_MS, run: () => processWithMistral(enrichedContent, []) },
        { label: "Groq Qwen 3.8", provider: "groq", model: GROQ_CONFIG.MODEL_NAME, timeoutMs: TEXT_TIMEOUT_MS, run: () => processWithGroq(enrichedContent, []) },
        { label: "Gemini Flash-Lite", provider: "gemini", model: GEMINI_CONFIG.MODEL_NAME, timeoutMs: TEXT_TIMEOUT_MS, run: () => processWithGemini(enrichedContent, geminiMedia) },
        { label: "Cloudflare Qwen 3.8", provider: "cloudflare", model: CLOUDFLARE_CONFIG.PRIMARY_MODEL_NAME, timeoutMs: TEXT_TIMEOUT_MS, run: () => processWithCloudflareModel(enrichedContent, [], CLOUDFLARE_CONFIG.PRIMARY_MODEL_NAME) },
        { label: "Cloudflare Llama 4 Scout", provider: "cloudflare", model: CLOUDFLARE_CONFIG.FALLBACK_MODEL_NAME, timeoutMs: TEXT_TIMEOUT_MS, run: () => processWithCloudflareModel(enrichedContent, [], CLOUDFLARE_CONFIG.FALLBACK_MODEL_NAME) },
        { label: "OpenRouter Free", provider: "openrouter", model: OPENROUTER_CONFIG.MODEL_NAME, timeoutMs: OPENROUTER_TIMEOUT_MS, run: () => processWithOpenRouter(enrichedContent, []) },
      ];

  const correlationId = createAiCorrelationId();
  const observations: AiProviderAttempt[] = [];
  const errors: string[] = [];
  for (const [index, attempt] of attempts.entries()) {
    const startedAt = Date.now();
    let retryUsed = false;
    try {
      const result = await withTimeout(
        runWithOneRetry(attempt.run, () => {
          retryUsed = true;
        }),
        attempt.label,
        attempt.timeoutMs,
      );
      observations.push({
        correlationId,
        operation: "interpretation",
        sourceMode: useVision ? "vision" : "text",
        provider: result.provider,
        model: result.modelUsed || attempt.model,
        label: attempt.label,
        attemptOrder: index + 1,
        status: "success",
        durationMs: Date.now() - startedAt,
        fallbackUsed: index > 0,
        retryUsed,
        contentChars: enrichedContent.length,
        mediaCount: useVision ? images.length : 0,
      });
      await persistAiProviderAttempts(observations);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha";
      observations.push({
        correlationId,
        operation: "interpretation",
        sourceMode: useVision ? "vision" : "text",
        provider: attempt.provider,
        model: attempt.model,
        label: attempt.label,
        attemptOrder: index + 1,
        status: "error",
        durationMs: Date.now() - startedAt,
        fallbackUsed: index > 0,
        retryUsed,
        errorMessage: message,
        contentChars: enrichedContent.length,
        mediaCount: useVision ? images.length : 0,
      });
      errors.push(`${attempt.label}: ${message}`);
    }
  }
  await persistAiProviderAttempts(observations);
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
  if (!response.ok) throw new Error(`Mistral complementar falhou (${response.status}).`);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const text = extractMessageText(payload.choices?.[0]?.message?.content);
  if (!text) throw new Error("Mistral complementar vazia.");
  return parseModelJson(text);
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
  if (!response.ok) throw new Error(`Groq complementar falhou (${response.status}).`);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const text = extractMessageText(payload.choices?.[0]?.message?.content);
  if (!text) throw new Error("Groq complementar vazia.");
  return parseModelJson(text);
}

export async function complementaryJson(prompt: string) {
  const attempts = [
    { label: "Mistral", provider: "mistral", model: MISTRAL_CONFIG.MODEL_NAME, run: () => complementaryWithMistral(prompt) },
    { label: "Groq", provider: "groq", model: GROQ_CONFIG.MODEL_NAME, run: () => complementaryWithGroq(prompt) },
  ] as const;
  const correlationId = createAiCorrelationId();
  const observations: AiProviderAttempt[] = [];
  const errors: string[] = [];
  for (const [index, attempt] of attempts.entries()) {
    const startedAt = Date.now();
    try {
      const result = await withTimeout(attempt.run(), attempt.label, COMPLEMENT_TIMEOUT_MS);
      observations.push({
        correlationId,
        operation: "complementary",
        sourceMode: "text",
        provider: attempt.provider,
        model: attempt.model,
        label: attempt.label,
        attemptOrder: index + 1,
        status: "success",
        durationMs: Date.now() - startedAt,
        fallbackUsed: index > 0,
        retryUsed: false,
        contentChars: prompt.length,
        mediaCount: 0,
      });
      await persistAiProviderAttempts(observations);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha";
      observations.push({
        correlationId,
        operation: "complementary",
        sourceMode: "text",
        provider: attempt.provider,
        model: attempt.model,
        label: attempt.label,
        attemptOrder: index + 1,
        status: "error",
        durationMs: Date.now() - startedAt,
        fallbackUsed: index > 0,
        retryUsed: false,
        errorMessage: message,
        contentChars: prompt.length,
        mediaCount: 0,
      });
      errors.push(`${attempt.label}: ${message}`);
    }
  }
  await persistAiProviderAttempts(observations);
  throw new Error(errors.join(". "));
}

export async function areMessagesComplementary(previous: string, current: string) {
  const prompt = [
    "Você analisa mensagens de WhatsApp sobre eventos culturais.",
    "Responda APENAS com JSON no formato {\"complementary\": true|false}.",
    "complementary = true quando as duas mensagens se referem ao MESMO evento (complemento, correção ou continuação).",
    "",
    "MENSAGEM ANTERIOR:",
    previous,
    "",
    "MENSAGEM ATUAL:",
    current,
  ].join("\n");

  try {
    const result = (await complementaryJson(prompt)) as { complementary?: unknown };
    return result?.complementary === true || result?.complementary === "true";
  } catch {
    return false;
  }
}
