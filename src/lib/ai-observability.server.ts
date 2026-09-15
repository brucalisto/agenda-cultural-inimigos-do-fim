import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AiOperation = "interpretation" | "complementary" | "transcription";
export type AiSourceMode = "text" | "vision" | "audio";
export type AiAttemptStatus = "success" | "error";

export type AiProviderAttempt = {
  correlationId: string;
  operation: AiOperation;
  sourceMode: AiSourceMode;
  provider: string;
  model: string | null;
  label: string;
  attemptOrder: number;
  status: AiAttemptStatus;
  durationMs: number;
  fallbackUsed: boolean;
  retryUsed: boolean;
  errorMessage?: string | null;
  contentChars?: number | null;
  mediaCount?: number | null;
};

type ObservabilityInsert = {
  correlation_id: string;
  operation: AiOperation;
  source_mode: AiSourceMode;
  provider: string;
  model: string | null;
  label: string;
  attempt_order: number;
  status: AiAttemptStatus;
  duration_ms: number;
  fallback_used: boolean;
  retry_used: boolean;
  error_message: string | null;
  content_chars: number | null;
  media_count: number | null;
};

type ObservabilityDb = {
  from: (table: "ai_provider_attempts") => {
    insert: (rows: ObservabilityInsert[]) => Promise<{ error: { message: string } | null }>;
  };
};

export function createAiCorrelationId() {
  return crypto.randomUUID();
}

function sanitizeError(value: string | null | undefined) {
  if (!value) return null;
  return value.replace(/\s+/g, " ").trim().slice(0, 700);
}

export async function persistAiProviderAttempts(attempts: AiProviderAttempt[]) {
  if (!attempts.length) return;

  const rows: ObservabilityInsert[] = attempts.map((attempt) => ({
    correlation_id: attempt.correlationId,
    operation: attempt.operation,
    source_mode: attempt.sourceMode,
    provider: attempt.provider,
    model: attempt.model,
    label: attempt.label,
    attempt_order: attempt.attemptOrder,
    status: attempt.status,
    duration_ms: Math.max(0, Math.round(attempt.durationMs)),
    fallback_used: attempt.fallbackUsed,
    retry_used: attempt.retryUsed,
    error_message: sanitizeError(attempt.errorMessage),
    content_chars: attempt.contentChars ?? null,
    media_count: attempt.mediaCount ?? null,
  }));

  try {
    const db = supabaseAdmin as unknown as ObservabilityDb;
    const { error } = await db.from("ai_provider_attempts").insert(rows);
    if (error) console.warn("[ai-observability] Falha ao persistir tentativas:", error.message);
  } catch (error) {
    console.warn(
      "[ai-observability] Observabilidade indisponível; o processamento principal continuará:",
      error instanceof Error ? error.message : error,
    );
  }
}
