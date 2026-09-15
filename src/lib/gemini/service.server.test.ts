import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { processWithAI } from "@/lib/gemini/service.server";

const originalFetch = globalThis.fetch;
const originalMistralKey = process.env.MISTRAL_API_KEY;
const originalGroqKey = process.env.GROQ_API_KEY;

function validProviderPayload() {
  return JSON.stringify({
    items: [
      {
        title: "Show de teste",
        category: "Música",
        summary: "Evento de teste",
        full_description: "Descrição do evento",
        event_date: "2026-09-27T19:00:00-03:00",
        location: "Teatro Mario Covas",
        city: "Caraguatatuba",
        price: null,
        contact_name: null,
        contact_phone: null,
        contact_instagram: null,
        source_url: null,
        keywords: [],
        missing_fields: [],
        warnings: [],
        confidence_score: 0.95,
      },
    ],
  });
}

beforeEach(() => {
  process.env.MISTRAL_API_KEY = "test-mistral";
  process.env.GROQ_API_KEY = "test-groq";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalMistralKey === undefined) delete process.env.MISTRAL_API_KEY;
  else process.env.MISTRAL_API_KEY = originalMistralKey;
  if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqKey;
});

describe("cadeia de fallback das IAs", () => {
  test("repete uma vez em erro temporário e depois usa o próximo provedor", async () => {
    let mistralCalls = 0;
    let groqCalls = 0;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("mistral")) {
        mistralCalls += 1;
        return new Response("temporarily unavailable", { status: 500 });
      }
      if (url.includes("groq")) {
        groqCalls += 1;
        return Response.json({
          model: "qwen-test",
          choices: [{ message: { content: validProviderPayload() } }],
        });
      }
      throw new Error(`URL inesperada no teste: ${url}`);
    }) as typeof fetch;

    const result = await processWithAI("Show em 27/09 às 19h no Teatro Mario Covas.");

    expect(mistralCalls).toBe(2);
    expect(groqCalls).toBe(1);
    expect(result.provider).toBe("groq");
    expect(result.items[0]?.event_date).toBe("2026-09-27T19:00:00-03:00");
  });

  test("não repete erro não temporário antes de seguir para o fallback", async () => {
    let mistralCalls = 0;
    let groqCalls = 0;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("mistral")) {
        mistralCalls += 1;
        return new Response("unauthorized", { status: 401 });
      }
      if (url.includes("groq")) {
        groqCalls += 1;
        return Response.json({
          model: "qwen-test",
          choices: [{ message: { content: validProviderPayload() } }],
        });
      }
      throw new Error(`URL inesperada no teste: ${url}`);
    }) as typeof fetch;

    const result = await processWithAI("Show em 27/09 às 19h no Teatro Mario Covas.");

    expect(mistralCalls).toBe(1);
    expect(groqCalls).toBe(1);
    expect(result.provider).toBe("groq");
  });
});
