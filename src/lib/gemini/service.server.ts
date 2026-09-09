import { GEMINI_CONFIG, GROQ_CONFIG, OPENROUTER_CONFIG } from "./config.server";
import { SYSTEM_PROMPTS } from "./prompts.server";
import { InterpretedContentsSchema, type InterpretedContentsResponse } from "./schema";

type MediaFile = { mimeType: string; data: string };
export type AIResult = InterpretedContentsResponse & {
  modelUsed: string;
  provider: "openrouter" | "gemini" | "groq";
};

const GROQ_MAX_CONTENT_CHARS = 8000;
const GROQ_MAX_TRANSCRIPT_CHARS = 2500;
const OPENROUTER_MAX_CONTENT_CHARS = 12000;
const PROVIDER_TIMEOUT_MS = 8000;
const COMPLEMENT_TIMEOUT_MS = 5000;

function compactText(value: string, maxChars: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}\n\n[conteúdo truncado automaticamente para respeitar o limite do provedor]`;
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = PROVIDER_TIMEOUT_MS) {
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

async function processWithOpenRouter(content: string, mediaFiles: MediaFile[]): Promise<AIResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY não está configurada.");

  if (
    mediaFiles.some(
      (file) => file.mimeType.startsWith("audio/") || file.mimeType.startsWith("video/"),
    )
  ) {
    throw new Error("OpenRouter primário não recebe áudio/vídeo diretamente neste fluxo.");
  }

  const compactContent = compactText(content, OPENROUTER_MAX_CONTENT_CHARS);
  const useImages = compactContent.length < 300;
  const visual = useImages
    ? mediaFiles.filter((file) => file.mimeType.startsWith("image/")).slice(0, 2)
    : [];
  const userContent: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `${getDateContext()}\n\nConteúdo para análise:\n${compactContent}`,
    },
    ...visual.map((file) => ({
      type: "image_url",
      image_url: { url: `data:${file.mimeType};base64,${file.data}` },
    })),
  ];

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
        { role: "user", content: userContent },
      ],
      temperature: GEMINI_CONFIG.TEMPERATURE,
      max_tokens: OPENROUTER_CONFIG.MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok)
    throw new Error(`OpenRouter falhou (${response.status}): ${(await response.text()).slice(0, 300)}`);

  const payload = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error("Resposta vazia do OpenRouter.");

  return {
    ...InterpretedContentsSchema.parse(JSON.parse(text)),
    modelUsed: payload.model || OPENROUTER_CONFIG.MODEL_NAME,
    provider: "openrouter",
  };
}

async function processWithGroq(content: string, mediaFiles: MediaFile[]): Promise<AIResult> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("GROQ_API_KEY não está configurada.");
  const compactContent = compactText(content, GROQ_MAX_CONTENT_CHARS);
  const visual = compactContent.length < 300
    ? mediaFiles.filter((file) => file.mimeType.startsWith("image/")).slice(0, 1)
    : [];
  const audible = mediaFiles.filter(
    (file) => file.mimeType.startsWith("audio/") || file.mimeType.startsWith("video/"),
  );
  const transcripts: string[] = [];
  for (const file of audible)
    transcripts.push(await withTimeout(transcribeWithGroq(file, apiKey), "Transcrição Groq", 10000));
  const compactTranscripts = compactText(
    transcripts.filter(Boolean).join("\n\n"),
    GROQ_MAX_TRANSCRIPT_CHARS,
  );
  const userContent: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `${getDateContext()}\n\nConteúdo para análise:\n${compactContent}\n\nTRANSCRIÇÕES DE ÁUDIO/VÍDEO:\n${compactTranscripts || "Nenhuma"}`,
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
      max_completion_tokens: GROQ_CONFIG.MAX_OUTPUT_TOKENS,
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
  const compactContent = compactText(content, 12000);
  const useImages = compactContent.length < 300;
  const selectedMedia = mediaFiles.filter(
    (file) => !file.mimeType.startsWith("image/") || useImages,
  );
  const parts: Array<Record<string, unknown>> = [
    { text: `${getDateContext()}\n\nConteúdo para análise:\n\n${compactContent}` },
    ...selectedMedia.map((file) => ({ inlineData: { mimeType: file.mimeType, data: file.data } })),
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
  const hasAudioOrVideo = mediaFiles.some(
    (file) => file.mimeType.startsWith("audio/") || file.mimeType.startsWith("video/"),
  );

  if (!hasAudioOrVideo) {
    try {
      return await withTimeout(processWithOpenRouter(content, mediaFiles), "OpenRouter");
    } catch (openRouterError) {
      try {
        return await withTimeout(processWithGemini(content, mediaFiles), "Gemini");
      } catch (geminiError) {
        try {
          return await withTimeout(processWithGroq(content, mediaFiles), "Groq");
        } catch (groqError) {
          throw new Error(
            `OpenRouter: ${openRouterError instanceof Error ? openRouterError.message : "falha"}. Contingência Gemini: ${geminiError instanceof Error ? geminiError.message : "falha"}. Contingência Groq: ${groqError instanceof Error ? groqError.message : "falha"}.`,
          );
        }
      }
    }
  }

  try {
    return await withTimeout(processWithGemini(content, mediaFiles), "Gemini multimídia", 12000);
  } catch (geminiError) {
    try {
      return await withTimeout(processWithGroq(content, mediaFiles), "Groq multimídia", 12000);
    } catch (groqError) {
      throw new Error(
        `Gemini multimídia: ${geminiError instanceof Error ? geminiError.message : "falha"}. Contingência Groq: ${groqError instanceof Error ? groqError.message : "falha"}.`,
      );
    }
  }
}

export async function areMessagesComplementary(previous: string, current: string) {
  const prompt = `Determine se a segunda mensagem complementa a primeira sobre o MESMO evento. Responda JSON {"complementary":true|false}.\nMENSAGEM 1:\n${compactText(previous, 4000)}\nMENSAGEM 2:\n${compactText(current, 4000)}`;

  const openRouterKey = process.env["OPENROUTER_API_KEY"];
  if (openRouterKey) {
    try {
      const response = await withTimeout(
        fetch(`${OPENROUTER_CONFIG.API_URL}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${openRouterKey}`,
            "content-type": "application/json",
            "HTTP-Referer": "https://agenda-cultural-inimigos-do-fim.lovable.app",
            "X-Title": "Agenda Cultural Inimigos do Fim",
          },
          body: JSON.stringify({
            model: OPENROUTER_CONFIG.MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
            max_tokens: 40,
            response_format: { type: "json_object" },
          }),
        }),
        "OpenRouter complementaridade",
        COMPLEMENT_TIMEOUT_MS,
      );
      if (response.ok) {
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        return Boolean(JSON.parse(payload.choices?.[0]?.message?.content || "{}").complementary);
      }
    } catch {
      // Fall through to Groq only if the primary provider cannot answer.
    }
  }

  const groqKey = process.env["GROQ_API_KEY"];
  if (!groqKey) return false;
  try {
    const response = await withTimeout(
      fetch(`${GROQ_CONFIG.API_URL}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${groqKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: GROQ_CONFIG.MODEL_NAME,
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          max_completion_tokens: 40,
          response_format: { type: "json_object" },
        }),
      }),
      "Groq complementaridade",
      COMPLEMENT_TIMEOUT_MS,
    );
    if (!response.ok) return false;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return Boolean(JSON.parse(payload.choices?.[0]?.message?.content || "{}").complementary);
  } catch {
    return false;
  }
}
