import { FileCheck2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { evidenceFromExtractedData, type EvidenceField, type EvidenceSource } from "@/lib/field-evidence";

const FIELD_LABELS: Record<EvidenceField, string> = {
  title: "Título",
  category: "Categoria",
  summary: "Resumo",
  full_description: "Descrição",
  event_date: "Data e horário",
  location: "Local",
  city: "Cidade",
  price: "Preço",
  contact_name: "Contato",
  contact_phone: "Telefone",
  contact_instagram: "Instagram",
  source_url: "Link de origem",
};

const SOURCE_LABELS: Record<EvidenceSource, string> = {
  message_text: "Texto da mensagem",
  caption: "Legenda",
  image: "Imagem",
  audio_transcript: "Transcrição",
  link_page: "Página/link",
  metadata: "Metadado",
  structured_source: "Fonte estruturada",
};

export function FieldEvidencePanel({ extractedData }: { extractedData: unknown }) {
  const evidence = evidenceFromExtractedData(extractedData);
  if (!evidence.length) return null;

  return (
    <div className="border-t bg-emerald-50/40 p-4 dark:bg-emerald-950/10">
      <div className="mb-3 flex items-start gap-2">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Evidências da interpretação
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Origem usada pela IA para sustentar cada informação extraída.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {evidence.map((item, index) => (
          <div key={`${item.field}-${item.source_ref}-${index}`} className="rounded-md border bg-background p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{FIELD_LABELS[item.field]}</Badge>
              <span className="font-medium">{SOURCE_LABELS[item.source]}</span>
              <span className="text-muted-foreground">· {item.source_ref}</span>
            </div>
            {item.excerpt ? (
              <p className="mt-2 border-l-2 border-emerald-300 pl-2 text-muted-foreground">
                “{item.excerpt}”
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
