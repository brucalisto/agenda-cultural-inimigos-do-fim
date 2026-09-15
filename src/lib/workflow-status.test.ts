import { describe, expect, test } from "bun:test";

import {
  MESSAGE_PROCESSING_STATUS,
  REVIEW_STATUS,
  canonicalReviewStatus,
  isPublishedReviewStatus,
  isReviewAwaitingAction,
  isReviewTerminal,
  normalizeReviewStatus,
} from "@/lib/workflow-status";

describe("contrato de estados do fluxo", () => {
  test("mantém os estados de processamento compatíveis com o enum do banco", () => {
    expect(Object.values(MESSAGE_PROCESSING_STATUS)).toEqual([
      "recebido",
      "pendente",
      "processando",
      "interpretado",
      "necessita_revisao",
      "aprovado",
      "publicado",
      "ignorado",
      "erro",
    ]);
  });

  test("normaliza aliases legados de revisão", () => {
    expect(normalizeReviewStatus("revisao")).toBe(REVIEW_STATUS.NEEDS_REVIEW);
    expect(normalizeReviewStatus("reprocessar")).toBe(REVIEW_STATUS.NEEDS_REVIEW);
    expect(normalizeReviewStatus("aprovado")).toBe(REVIEW_STATUS.PUBLISHED);
    expect(normalizeReviewStatus(null)).toBe(REVIEW_STATUS.PENDING);
  });

  test("recusa um estado desconhecido na escrita", () => {
    expect(canonicalReviewStatus("qualquer_coisa")).toBeNull();
  });

  test("classifica estados por etapa do fluxo", () => {
    expect(isReviewAwaitingAction("pendente")).toBe(true);
    expect(isReviewAwaitingAction("necessita_revisao")).toBe(true);
    expect(isReviewTerminal("publicado")).toBe(true);
    expect(isReviewTerminal("ignorado")).toBe(true);
    expect(isReviewTerminal("desativado")).toBe(true);
    expect(isPublishedReviewStatus("aprovado")).toBe(true);
  });
});
