import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveAdminAccess } from "@/lib/admin-auth.server";
import { needsEventImagePersistence } from "@/lib/event-images.server";

type Severity = "critical" | "warning" | "info";

type HealthIssue = {
  id: string;
  severity: Severity;
  kind:
    | "missing_date"
    | "missing_location"
    | "missing_image"
    | "unstable_image"
    | "possible_duplicate"
    | "low_confidence"
    | "review_stale"
    | "message_stuck"
    | "message_error"
    | "feed_stale"
    | "feed_error"
    | "ai_failed";
  title: string;
  detail: string;
  actionPath: string;
  occurredAt: string | null;
};

type AiAttemptRow = {
  id: string;
  correlation_id: string;
  operation: string;
  source_mode: string;
  provider: string;
  model: string | null;
  label: string;
  attempt_order: number;
  status: "success" | "error";
  duration_ms: number;
  fallback_used: boolean;
  retry_used: boolean;
  error_message: string | null;
  created_at: string;
};

type AiQueryResult = {
  data: AiAttemptRow[] | null;
  error: { message: string } | null;
};

type FeedSourceRow = {
  id: string;
  name: string;
  url: string;
  source_type: string;
  active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_result: unknown;
};

type FeedQueryResult = {
  data: FeedSourceRow[] | null;
  error: { message: string } | null;
};

type FeedSourcesDb = {
  from: (table: "feed_sources") => {
    select: (columns: string) => {
      eq: (column: "active", value: boolean) => {
        order: (column: "name") => PromiseLike<FeedQueryResult>;
      };
    };
  };
};

type AiObservabilityDb = {
  from: (table: "ai_provider_attempts") => {
    select: (columns: string) => {
      gte: (column: "created_at", value: string) => {
        order: (
          column: "created_at",
          options: { ascending: boolean },
        ) => {
          limit: (count: number) => PromiseLike<AiQueryResult>;
        };
      };
    };
  };
};

type FeedSourceRow = {
  id: string;
  name: string;
  url: string;
  source_type: string;
  active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_result: unknown;
};

type FeedQueryResult = {
  data: FeedSourceRow[] | null;
  error: { message: string } | null;
};

type FeedSourcesDb = {
  from: (table: "feed_sources") => {
    select: (columns: string) => {
      eq: (column: "active", value: boolean) => {
        order: (column: "name") => PromiseLike<FeedQueryResult>;
      };
    };
  };
};

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasRecurrence(value: unknown) {
  const record = jsonObject(value);
  return Boolean(record && jsonObject(record.recurrence));
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isIgnoredStatus(value: string | null) {
  return value === "ignorado" || value === "desativado";
}

function ageInHours(value: string | null | undefined, now = Date.now()) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now - parsed) / 3_600_000);
}

function severityWeight(value: Severity) {
  if (value === "critical") return 0;
  if (value === "warning") return 1;
  return 2;
}

function compactError(value: string | null | undefined) {
  if (!value) return "Falha sem mensagem detalhada.";
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}

export async function getAgendaHealthForAdmin(accessToken: string) {
  const access = await resolveAdminAccess(accessToken);
  if (!access.isAdmin) throw new Error("Acesso restrito a administradores.");

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const aiDb = supabaseAdmin as unknown as AiObservabilityDb;
  const feedDb = supabaseAdmin as unknown as FeedSourcesDb;

  const [eventsResult, messagesResult, feedsResult, aiResult] = await Promise.all([
    supabaseAdmin
      .from("interpreted_contents")
      .select(
        "id,title,event_date,location,city,image_url,review_status,warnings,missing_fields,updated_at,extracted_data,confidence_score,source_url",
      )
      .order("updated_at", { ascending: false })
      .limit(1200),
    supabaseAdmin
      .from("whatsapp_messages")
      .select("id,processing_status,error_message,received_at,occurred_at")
      .order("received_at", { ascending: false })
      .limit(500),
    feedDb
      .from("feed_sources")
      .select(
        "id,name,url,source_type,active,last_synced_at,last_sync_status,last_sync_result",
      )
      .eq("active", true)
      .order("name"),
    aiDb
      .from("ai_provider_attempts")
      .select(
        "id,correlation_id,operation,source_mode,provider,model,label,attempt_order,status,duration_ms,fallback_used,retry_used,error_message,created_at",
      )
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(1500),
  ]);

  if (eventsResult.error) throw new Error(`Falha ao analisar eventos: ${eventsResult.error.message}`);
  if (messagesResult.error) throw new Error(`Falha ao analisar mensagens: ${messagesResult.error.message}`);
  if (feedsResult.error) throw new Error(`Falha ao analisar fontes: ${feedsResult.error.message}`);

  const issues: HealthIssue[] = [];
  const activeEvents = (eventsResult.data ?? []).filter((event) => !isIgnoredStatus(event.review_status));

  for (const event of activeEvents) {
    const title = event.title?.trim() || "Evento sem título";
    const recurrence = hasRecurrence(event.extracted_data);
    const warnings = stringList(event.warnings);
    const missingFields = stringList(event.missing_fields);
    const isPublished = event.review_status === "publicado";

    if (!event.event_date && !recurrence) {
      issues.push({
        id: `event-date:${event.id}`,
        severity: isPublished ? "critical" : "warning",
        kind: "missing_date",
        title,
        detail: isPublished
          ? "Evento publicado sem data identificada."
          : "Evento em revisão sem data identificada.",
        actionPath: isPublished ? "/published" : "/review",
        occurredAt: event.updated_at,
      });
    }

    if (!event.location?.trim() && !missingFields.includes("online")) {
      issues.push({
        id: `event-location:${event.id}`,
        severity: isPublished ? "warning" : "info",
        kind: "missing_location",
        title,
        detail: "Local do evento não está preenchido.",
        actionPath: isPublished ? "/published" : "/review",
        occurredAt: event.updated_at,
      });
    }

    if (!event.image_url?.trim()) {
      issues.push({
        id: `event-image:${event.id}`,
        severity: isPublished ? "warning" : "info",
        kind: "missing_image",
        title,
        detail: "Evento sem imagem de capa.",
        actionPath: isPublished ? "/published" : "/review",
        occurredAt: event.updated_at,
      });
    } else if (needsEventImagePersistence(event.image_url)) {
      issues.push({
        id: `event-image-risk:${event.id}`,
        severity: "warning",
        kind: "unstable_image",
        title,
        detail: "A imagem ainda depende de uma URL externa/temporária e pode expirar.",
        actionPath: "/published",
        occurredAt: event.updated_at,
      });
    }

    const duplicateWarning = warnings.find((warning) => /duplic|evento parecido|semelhante/i.test(warning));
    if (duplicateWarning) {
      issues.push({
        id: `event-duplicate:${event.id}`,
        severity: "warning",
        kind: "possible_duplicate",
        title,
        detail: duplicateWarning.slice(0, 220),
        actionPath: "/review",
        occurredAt: event.updated_at,
      });
    }

    if (typeof event.confidence_score === "number" && event.confidence_score < 0.65) {
      issues.push({
        id: `event-confidence:${event.id}`,
        severity: "warning",
        kind: "low_confidence",
        title,
        detail: `Confiança da interpretação: ${Math.round(event.confidence_score * 100)}%.`,
        actionPath: "/review",
        occurredAt: event.updated_at,
      });
    }

    if (
      (event.review_status === "pendente" || event.review_status === "necessita_revisao") &&
      ageInHours(event.updated_at, now) >= 48
    ) {
      issues.push({
        id: `event-review-stale:${event.id}`,
        severity: "warning",
        kind: "review_stale",
        title,
        detail: "Está aguardando revisão há mais de 48 horas.",
        actionPath: "/review",
        occurredAt: event.updated_at,
      });
    }
  }

  for (const message of messagesResult.data ?? []) {
    const age = ageInHours(message.received_at, now);
    if (message.processing_status === "processando" && age >= 0.5) {
      issues.push({
        id: `message-stuck:${message.id}`,
        severity: "critical",
        kind: "message_stuck",
        title: "Mensagem presa em processamento",
        detail: `Recebida há ${Math.max(1, Math.round(age * 60))} minutos e ainda está como “processando”.`,
        actionPath: "/logs",
        occurredAt: message.received_at,
      });
    }

    if (message.processing_status === "erro" || (message.error_message && message.processing_status !== "ignorado")) {
      issues.push({
        id: `message-error:${message.id}`,
        severity: "critical",
        kind: "message_error",
        title: "Falha no processamento do WhatsApp",
        detail: compactError(message.error_message),
        actionPath: "/logs",
        occurredAt: message.received_at,
      });
    }
  }

  const feedHealth = (feedsResult.data ?? []).map((feed) => {
    const age = ageInHours(feed.last_synced_at, now);
    const explicitError = /erro|error|falha|failed/i.test(feed.last_sync_status || "");
    const stale = !feed.last_synced_at || age >= 6;
    const criticalStale = !feed.last_synced_at || age >= 12;
    const state = explicitError ? "error" : criticalStale ? "stale" : stale ? "attention" : "ok";

    if (explicitError) {
      issues.push({
        id: `feed-error:${feed.id}`,
        severity: "critical",
        kind: "feed_error",
        title: feed.name,
        detail: `A última sincronização terminou com status “${feed.last_sync_status || "erro"}”.`,
        actionPath: "/feeds",
        occurredAt: feed.last_synced_at,
      });
    } else if (stale) {
      issues.push({
        id: `feed-stale:${feed.id}`,
        severity: criticalStale ? "critical" : "warning",
        kind: "feed_stale",
        title: feed.name,
        detail: feed.last_synced_at
          ? `Sem sincronização há cerca de ${Math.round(age)} horas.`
          : "A fonte ainda não possui sincronização registrada.",
        actionPath: "/feeds",
        occurredAt: feed.last_synced_at,
      });
    }

    return {
      id: feed.id,
      name: feed.name,
      sourceType: feed.source_type,
      url: feed.url,
      lastSyncedAt: feed.last_synced_at,
      lastSyncStatus: feed.last_sync_status,
      state,
    };
  });

  const aiAttempts = aiResult.data ?? [];
  const correlations = new Map<string, AiAttemptRow[]>();
  for (const attempt of aiAttempts) {
    const rows = correlations.get(attempt.correlation_id) ?? [];
    rows.push(attempt);
    correlations.set(attempt.correlation_id, rows);
  }

  const completedAiRuns = [...correlations.values()];
  const successfulRuns = completedAiRuns.filter((run) => run.some((attempt) => attempt.status === "success"));
  const failedRuns = completedAiRuns.filter((run) => !run.some((attempt) => attempt.status === "success"));

  if (failedRuns.length) {
    issues.push({
      id: "ai-failed-runs",
      severity: "critical",
      kind: "ai_failed",
      title: "Processamentos de IA sem resposta válida",
      detail: `${failedRuns.length} processamento(s) terminaram sem sucesso nas últimas 24 horas.`,
      actionPath: "/health",
      occurredAt: failedRuns[0]?.[0]?.created_at ?? null,
    });
  }

  const providerMap = new Map<
    string,
    { provider: string; attempts: number; successes: number; errors: number; duration: number; fallback: number; retries: number }
  >();
  for (const attempt of aiAttempts) {
    const current = providerMap.get(attempt.provider) ?? {
      provider: attempt.provider,
      attempts: 0,
      successes: 0,
      errors: 0,
      duration: 0,
      fallback: 0,
      retries: 0,
    };
    current.attempts += 1;
    current.successes += attempt.status === "success" ? 1 : 0;
    current.errors += attempt.status === "error" ? 1 : 0;
    current.duration += attempt.duration_ms || 0;
    current.fallback += attempt.fallback_used ? 1 : 0;
    current.retries += attempt.retry_used ? 1 : 0;
    providerMap.set(attempt.provider, current);
  }

  const providers = [...providerMap.values()]
    .map((item) => ({
      provider: item.provider,
      attempts: item.attempts,
      successes: item.successes,
      errors: item.errors,
      successRate: item.attempts ? Math.round((item.successes / item.attempts) * 100) : 0,
      averageDurationMs: item.attempts ? Math.round(item.duration / item.attempts) : 0,
      fallbackAttempts: item.fallback,
      retryAttempts: item.retries,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const recentAiFailures = aiAttempts
    .filter((attempt) => attempt.status === "error")
    .slice(0, 12)
    .map((attempt) => ({
      id: attempt.id,
      provider: attempt.provider,
      model: attempt.model,
      label: attempt.label,
      sourceMode: attempt.source_mode,
      durationMs: attempt.duration_ms,
      retryUsed: attempt.retry_used,
      errorMessage: compactError(attempt.error_message),
      createdAt: attempt.created_at,
    }));

  issues.sort((a, b) => {
    const severity = severityWeight(a.severity) - severityWeight(b.severity);
    if (severity !== 0) return severity;
    const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
    const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
    return bTime - aTime;
  });

  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const aiRunSuccessRate = completedAiRuns.length
    ? Math.round((successfulRuns.length / completedAiRuns.length) * 100)
    : null;
  const feedAttentionCount = feedHealth.filter((feed) => feed.state !== "ok").length;

  const overallStatus = criticalCount > 0
    ? "critical"
    : warningCount > 0 || (aiRunSuccessRate !== null && aiRunSuccessRate < 90)
      ? "attention"
      : "healthy";

  return {
    generatedAt: new Date(now).toISOString(),
    overallStatus,
    summary: {
      criticalCount,
      warningCount,
      infoCount: issues.filter((issue) => issue.severity === "info").length,
      totalIssues: issues.length,
      activeEventsChecked: activeEvents.length,
      aiRuns24h: completedAiRuns.length,
      aiSuccessfulRuns24h: successfulRuns.length,
      aiFailedRuns24h: failedRuns.length,
      aiRunSuccessRate,
      activeFeeds: feedHealth.length,
      feedsNeedingAttention: feedAttentionCount,
      stuckMessages: issues.filter((issue) => issue.kind === "message_stuck").length,
    },
    telemetry: {
      available: !aiResult.error,
      error: aiResult.error?.message ?? null,
      providers,
      recentFailures: recentAiFailures,
    },
    feeds: feedHealth,
    issues: issues.slice(0, 120),
  };
}
