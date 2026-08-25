import { GEMINI_CONFIG } from "./config.server";
import { SYSTEM_PROMPTS } from "./prompts.server";
import { InterpretedContentSchema, type InterpretedContentResponse } from "./schema";

export async function processWithGemini(
  content: string,
  mediaFiles: Array<{ mimeType: string; data: string }> = [],
): Promise<InterpretedContentResponse> {
  const apiKey = process.env["GEMINI_API_KEY"];

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não está configurada no backend.");
  }

  const parts: Array<Record<string, unknown>> = [
    { text: `Conteúdo para análise:\n\n${content}` },
    ...mediaFiles.map((file) => ({
      inlineData: { mimeType: file.mimeType, data: file.data },
    })),
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
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
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Falha na API do Gemini (${res.status}): ${detail.slice(0, 300)}`);
  }

  const payload = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Resposta vazia do Gemini.");
  }

  return InterpretedContentSchema.parse(JSON.parse(text));
}

export async function areMessagesComplementary(previous: string, current: string) {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return false;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `As duas mensagens abaixo foram enviadas pela mesma pessoa, no mesmo grupo, com menos de 3 minutos de diferença. Determine se a segunda complementa a primeira para divulgar o MESMO evento ou conteúdo. Exemplos positivos: cartaz seguido de legenda; texto seguido de link; imagem seguida de endereço/telefone; continuação evidente de uma frase. Exemplo negativo: dois eventos diferentes enviados em sequência. Responda somente JSON: {"complementary": true|false}.

MENSAGEM 1:
${previous}

MENSAGEM 2:
${current}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 40,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!response.ok) return false;
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return false;
  try {
    return Boolean((JSON.parse(text) as { complementary?: boolean }).complementary);
  } catch {
    return false;
  }
}
