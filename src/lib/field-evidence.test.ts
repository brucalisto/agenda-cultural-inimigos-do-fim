import { describe, expect, test } from "bun:test";

import {
  evidenceFromExtractedData,
  mergeFieldEvidence,
  normalizeFieldEvidence,
} from "@/lib/field-evidence";

const dateEvidence = {
  field: "event_date",
  source: "caption",
  source_ref: "MENSAGEM 1 / Legenda",
  excerpt: "27/09 às 19h",
};

describe("proveniência de campos", () => {
  test("normaliza, limita trechos e ignora entradas inválidas", () => {
    const result = normalizeFieldEvidence([
      dateEvidence,
      { ...dateEvidence },
      { field: "campo_inexistente", source: "caption", source_ref: "x", excerpt: "x" },
      {
        field: "location",
        source: "image",
        source_ref: "IMAGEM 3",
        excerpt: `  ${"Teatro Mario Covas ".repeat(20)}  `,
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(dateEvidence);
    expect(result[1]?.excerpt?.length).toBeLessThanOrEqual(180);
  });

  test("lê evidência direta de feeds", () => {
    expect(evidenceFromExtractedData({ fieldEvidence: [dateEvidence] })).toEqual([dateEvidence]);
  });

  test("lê evidência aninhada do diagnóstico do WhatsApp", () => {
    expect(
      evidenceFromExtractedData({
        interpretationQuality: {
          evidence: { fieldEvidence: [dateEvidence] },
        },
      }),
    ).toEqual([dateEvidence]);
  });

  test("mescla evidências sem duplicar", () => {
    expect(mergeFieldEvidence([dateEvidence], [dateEvidence])).toEqual([dateEvidence]);
  });
});
