import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_CONFIG } from "./config.server";
import { SYSTEM_PROMPTS } from "./prompts.server";
import { InterpretedContentSchema, type InterpretedContentResponse } from "./schema";

export async function processWithGemini(
  content: string,
  mediaFiles: Array<{ mimeType: string; data: string }> = []
): Promise<InterpretedContentResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: GEMINI_CONFIG.MODEL_NAME,
    systemInstruction: SYSTEM_PROMPTS.v1,
  });

  const parts = [
    { text: `Conteúdo para análise:\n\n${content}` },
    ...mediaFiles.map(file => ({
      inlineData: {
        mimeType: file.mimeType,
        data: file.data
      }
    }))
  ];

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        maxOutputTokens: GEMINI_CONFIG.MAX_OUTPUT_TOKENS,
        temperature: GEMINI_CONFIG.TEMPERATURE,
        responseMimeType: "application/json",
      },
    });

    const response = await result.response;
    const text = response.text();
    
    // Parse and validate
    const rawJson = JSON.parse(text);
    return InterpretedContentSchema.parse(rawJson);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
