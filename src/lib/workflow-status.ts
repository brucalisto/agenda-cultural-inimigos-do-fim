export const MESSAGE_PROCESSING_STATUS = {
  RECEIVED: "recebido",
  PENDING: "pendente",
  PROCESSING: "processando",
  INTERPRETED: "interpretado",
  NEEDS_REVIEW: "necessita_revisao",
  APPROVED: "aprovado",
  PUBLISHED: "publicado",
  IGNORED: "ignorado",
  ERROR: "erro",
} as const;

export type MessageProcessingStatus =
  (typeof MESSAGE_PROCESSING_STATUS)[keyof typeof MESSAGE_PROCESSING_STATUS];

export const REVIEW_STATUS = {
  PENDING: "pendente",
  NEEDS_REVIEW: "necessita_revisao",
  PUBLISHED: "publicado",
  IGNORED: "ignorado",
  DISABLED: "desativado",
} as const;

export type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];

const LEGACY_REVIEW_STATUS_ALIASES: Record<string, ReviewStatus> = {
  revisao: REVIEW_STATUS.NEEDS_REVIEW,
  "revisão": REVIEW_STATUS.NEEDS_REVIEW,
  em_revisao: REVIEW_STATUS.NEEDS_REVIEW,
  reprocessar: REVIEW_STATUS.NEEDS_REVIEW,
  aprovado: REVIEW_STATUS.PUBLISHED,
};

export const PUBLISHED_REVIEW_STATUSES = [REVIEW_STATUS.PUBLISHED, "aprovado"] as const;

export function normalizeReviewStatus(value: string | null | undefined): ReviewStatus {
  const normalized = value?.trim().toLowerCase() || "";
  if (!normalized) return REVIEW_STATUS.PENDING;

  const alias = LEGACY_REVIEW_STATUS_ALIASES[normalized];
  if (alias) return alias;

  if (Object.values(REVIEW_STATUS).includes(normalized as ReviewStatus)) {
    return normalized as ReviewStatus;
  }

  return REVIEW_STATUS.PENDING;
}

export function isPublishedReviewStatus(value: string | null | undefined) {
  return normalizeReviewStatus(value) === REVIEW_STATUS.PUBLISHED;
}

export function isReviewAwaitingAction(value: string | null | undefined) {
  const normalized = normalizeReviewStatus(value);
  return normalized === REVIEW_STATUS.PENDING || normalized === REVIEW_STATUS.NEEDS_REVIEW;
}

export function isReviewTerminal(value: string | null | undefined) {
  const normalized = normalizeReviewStatus(value);
  return (
    normalized === REVIEW_STATUS.PUBLISHED ||
    normalized === REVIEW_STATUS.IGNORED ||
    normalized === REVIEW_STATUS.DISABLED
  );
}

export function reviewStatusLabel(value: string | null | undefined) {
  switch (normalizeReviewStatus(value)) {
    case REVIEW_STATUS.PENDING:
      return "Pendente";
    case REVIEW_STATUS.NEEDS_REVIEW:
      return "Revisão";
    case REVIEW_STATUS.PUBLISHED:
      return "Publicado";
    case REVIEW_STATUS.IGNORED:
      return "Ignorado";
    case REVIEW_STATUS.DISABLED:
      return "Desativado";
  }
}
