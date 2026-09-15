import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { scoreDuplicatePair } from "@/lib/duplicate-score";

type Candidate = {
  id: string;
  title: string | null;
  event_date: string | null;
  location: string | null;
  city: string | null;
  source_url: string | null;
  review_status: string | null;
  extracted_data: unknown;
};

type EventLike = {
  id?: string;
  title?: string | null;
  event_date?: string | null;
  location?: string | null;
  city?: string | null;
  source_url?: string | null;
  extracted_data?: unknown;
};

function feedSourceId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>).feedSourceId;
  return typeof candidate === "string" && candidate ? candidate : null;
}

function feedExternalKey(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>).feedExternalKey;
  return typeof candidate === "string" && candidate ? candidate : null;
}

export async function findPossibleDuplicate(event: EventLike) {
  if (!event.title && !event.event_date) return null;

  let query = supabaseAdmin
    .from("interpreted_contents")
    .select("id,title,event_date,location,city,source_url,review_status,extracted_data")
    .in("review_status", ["pendente", "necessita_revisao", "aprovado", "publicado"])
    .limit(150);

  if (event.id) query = query.neq("id", event.id);
  if (event.event_date) {
    const base = new Date(event.event_date);
    if (!Number.isNaN(base.getTime())) {
      const start = new Date(base.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const end = new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("event_date", start).lte("event_date", end);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  const currentFeedSourceId = feedSourceId(event.extracted_data);
  const currentExternalKey = feedExternalKey(event.extracted_data);
  const ranked = ((data || []) as Candidate[])
    .filter((candidate) => {
      const candidateFeedSourceId = feedSourceId(candidate.extracted_data);
      const candidateExternalKey = feedExternalKey(candidate.extracted_data);
      return (
        !currentExternalKey ||
        currentExternalKey !== candidateExternalKey ||
        currentFeedSourceId !== candidateFeedSourceId
      );
    })
    .map((candidate) => ({ candidate, ...scoreDuplicatePair(event, candidate) }))
    .filter((item) => item.total >= 0.72)
    .sort((a, b) => b.total - a.total);

  const best = ranked[0];
  if (!best) return null;

  return {
    id: best.candidate.id,
    title: best.candidate.title,
    event_date: best.candidate.event_date,
    location: best.candidate.location,
    city: best.candidate.city,
    review_status: best.candidate.review_status,
    score: Number(best.total.toFixed(2)),
    reasons: best.reasons,
  };
}

export async function enrichWithDuplicateWarning<
  T extends EventLike & {
    warnings?: string[] | null;
    review_status?: string | null;
    extracted_data?: unknown;
  },
>(event: T) {
  const duplicate = await findPossibleDuplicate(event);
  if (!duplicate) return event;

  const existingWarnings = Array.isArray(event.warnings) ? event.warnings : [];
  const duplicateWarning = `Possível duplicidade (${Math.round(duplicate.score * 100)}%): ${duplicate.title || "evento existente"} — ${duplicate.reasons.join(", ")}.`;
  const extracted =
    event.extracted_data &&
    typeof event.extracted_data === "object" &&
    !Array.isArray(event.extracted_data)
      ? (event.extracted_data as Record<string, unknown>)
      : {};

  return {
    ...event,
    review_status: "necessita_revisao",
    warnings: [...existingWarnings, duplicateWarning],
    extracted_data: {
      ...extracted,
      possibleDuplicate: duplicate,
    },
  };
}
