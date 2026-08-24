import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GEMINI_CONFIG } from "@/lib/gemini/config.server";

const ActionSchema = z.object({
  action: z.enum(["status", "qr", "groups", "logout", "gemini-status"]),
  accessToken: z.string().min(1),
});

async function requireAuthenticatedUser(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error("Sessão expirada. Entre novamente para gerenciar as integrações.");
  }

  return data.user;
}

function getBaileysConfig() {
  const baseUrl = process.env["BAILEYS_API_URL"]?.replace(/\/$/, "");
  const apiKey = process.env["BAILEYS_API_KEY"];

  if (!baseUrl || !apiKey) {
    throw new Error("Integração Baileys ainda não configurada no backend.");
  }

  return { baseUrl, apiKey };
}

async function parseError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `Baileys respondeu com HTTP ${response.status}`;
  } catch {
    return `Baileys respondeu com HTTP ${response.status}`;
  }
}

export const manageWhatsAppIntegration = createServerFn({ method: "POST" })
  .inputValidator((input) => ActionSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAuthenticatedUser(data.accessToken);

    if (data.action === "gemini-status") {
      return {
        kind: "gemini-status" as const,
        configured: Boolean(process.env["GEMINI_API_KEY"]),
        model: GEMINI_CONFIG.MODEL_NAME,
      };
    }

    const { baseUrl, apiKey } = getBaileysConfig();
    const endpoint = data.action === "logout" ? "/logout" : `/${data.action}`;
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: data.action === "logout" ? "POST" : "GET",
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    if (data.action === "qr") {
      const image = Buffer.from(await response.arrayBuffer()).toString("base64");
      return { kind: "qr" as const, dataUrl: `data:image/png;base64,${image}` };
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return { kind: data.action, ...payload };
  });
