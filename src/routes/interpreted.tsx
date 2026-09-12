import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BrainCircuit,
  CalendarRange,
  CopyCheck,
  ExternalLink,
  Eye,
  Layers3,
  RotateCcw,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { InterpretedDetails } from "@/components/interpreted/InterpretedDetails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { reprocessMessages } from "@/lib/gemini.functions";
import { getInterpretedContents, type InterpretedContent } from "@/lib/interpreted";

export const Route = createFileRoute("/interpreted")({ component: ReviewWorkspace });

const INIMIGOS_COMMUNITY_URL = "https://chat.whatsapp.com/GiE4WfxQk4O4aPDOzHM8eJ";
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

type ReviewGroup = {
  key: string;
  items: InterpretedContent[];
};

type RecurrenceView = {
  weekdays: number[];
  time: string | null;
  startDate: string | null;
  endDate: string | null;
  endDateSource: string | null;
};

function extractedRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recurrenceView(item: InterpretedContent): RecurrenceView | null {
  const raw = extractedRecord(extractedRecord(item.extracted_data).recurrence);
  if (raw.frequency !== "weekly") return null;
  return {
    weekdays: Array.isArray(raw.weekdays)
      ? raw.weekdays.map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
      : [],
    time: typeof raw.time === "string" ? raw.time : null,
    startDate: typeof raw.startDate === "string" ? raw.startDate : null,
    endDate: typeof raw.endDate === "string" ? raw.endDate : null,
    endDateSource: typeof raw.endDateSource === "string" ? raw.endDateSource : null,
  };
}

function recurrenceKey(item: InterpretedContent) {
  const recurrence = recurrenceView(item);
  if (!recurrence) return null;
  return `${item.title || ""}|${item.location || ""}|${recurrence.weekdays.join(",")}|${recurrence.time || ""}|${recurrence.startDate || ""}|${recurrence.endDate || ""}`;
}

function recurrenceLabel(item: InterpretedContent) {
  const recurrence = recurrenceView(item);
  if (!recurrence) return null;
  const days = recurrence.weekdays.map((index) => WEEKDAYS[index]).filter(Boolean).join(" e ");
  const period = [
    recurrence.startDate ? new Date(`${recurrence.startDate}T12:00:00`).toLocaleDateString("pt-BR") : null,
    recurrence.endDate ? new Date(`${recurrence.endDate}T12:00:00`).toLocaleDateString("pt-BR") : null,
  ].filter(Boolean);
  const semester = recurrence.endDateSource === "fundacc-semester" ? " · limite automático do semestre" : "";
  return `${days || "dias a confirmar"}${recurrence.time ? ` às ${recurrence.time}` : " · horário a confirmar"}${period.length ? ` · ${period.join(" a ")}` : ""}${semester}`;
}

function duplicateInfo(extractedData: unknown) {
  const record = extractedRecord(extractedData);
  const value = record.possibleDuplicate;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const duplicate = value as { id?: string; title?: string | null; score?: number; reasons?: string[] };
  if (!duplicate.id) return null;
  return duplicate;
}

function sourceKind(item: InterpretedContent) {
  if (item.whatsapp_messages) return "whatsapp";
  const extracted = extractedRecord(item.extracted_data);
  const sourceType = typeof extracted.sourceType === "string" ? extracted.sourceType : "";
  if (sourceType === "notion" || sourceType === "notion_export" || item.source_url?.includes("notion")) return "notion";
  if (sourceType || item.source_url) return "feed";
  return "unknown";
}

function sourcePresentation(item: InterpretedContent) {
  const extracted = extractedRecord(item.extracted_data);
  const kind = sourceKind(item);
  const feedName = typeof extracted.feedSourceName === "string" ? extracted.feedSourceName : null;
  const sourceType = typeof extracted.sourceType === "string" ? extracted.sourceType : null;
  const instagramPostUrl = typeof extracted.instagramPostUrl === "string" ? extracted.instagramPostUrl : null;
  const feedSourceUrl = typeof extracted.feedSourceUrl === "string" ? extracted.feedSourceUrl : null;

  if (kind === "whatsapp") {
    const groupName = item.whatsapp_messages?.whatsapp_groups?.nome || null;
    const isInimigos = /inimigos do fim/i.test(groupName || "");
    return {
      kind,
      label: "Grupo",
      name: groupName || item.whatsapp_messages?.sender_name || "WhatsApp",
      url: isInimigos ? INIMIGOS_COMMUNITY_URL : null,
      linkLabel: isInimigos ? "Comunidade" : null,
    };
  }

  if (sourceType === "instagram" || /instagram\.com/i.test(feedSourceUrl || item.source_url || "")) {
    return {
      kind: "feed",
      label: "Instagram",
      name: feedName || "Instagram",
      url: instagramPostUrl || item.source_url || feedSourceUrl,
      linkLabel: "Ver postagem",
    };
  }

  if (kind === "notion") {
    return {
      kind,
      label: "Notion",
      name: feedName || "Agenda Cultural Inimigos do Fim",
      url: item.source_url || feedSourceUrl,
      linkLabel: "Ver fonte",
    };
  }

  if (kind === "feed") {
    const label = sourceType === "rss" ? "RSS" : sourceType === "web" ? "Site" : "Fonte externa";
    return {
      kind,
      label,
      name: feedName || "Fonte externa",
      url: item.source_url || feedSourceUrl,
      linkLabel: "Ver fonte",
    };
  }

  return { kind, label: "Desconhecida", name: "", url: null, linkLabel: null };
}

function reviewGroupKey(item: InterpretedContent) {
  const extracted = extractedRecord(item.extracted_data);
  const instagramPostKey = typeof extracted.instagramPostKey === "string" ? extracted.instagramPostKey : null;
  if (instagramPostKey) return `instagram:${instagramPostKey}`;
  if (item.message_id) return `whatsapp:${item.message_id}`;
  return `item:${item.id}`;
}

function buildGroups(items: InterpretedContent[]) {
  const groups = new Map<string, InterpretedContent[]>();
  for (const item of items) {
    const key = reviewGroupKey(item);
    const current = groups.get(key) || [];
    current.push(item);
    groups.set(key, current);
  }
  return [...groups.entries()].map(([key, groupItems]) => ({
    key,
    items: [...groupItems].sort((a, b) => a.event_sequence - b.event_sequence),
  }));
}

function displayGroupItems(group: ReviewGroup) {
  const seen = new Set<string>();
  return group.items.filter((item) => {
    const recurring = recurrenceKey(item);
    const key = recurring || `event:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isLikelyEvent(item: InterpretedContent) {
  const category = (item.category || "").trim().toLowerCase();
  if (["outro", "outros", "n/a", "nao informado", "não informado"].includes(category)) return false;
  return Boolean(item.event_date || item.location || item.city || item.title || recurrenceView(item));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Não informado";
  return parsed.toLocaleString("pt-BR");
}

function groupDateLabel(group: ReviewGroup) {
  const items = displayGroupItems(group);
  const recurring = items.map(recurrenceLabel).filter(Boolean) as string[];
  if (recurring.length) return recurring[0];
  const dates = items
    .map((item) => item.event_date?.slice(0, 10) || null)
    .filter((value): value is string => Boolean(value))
    .sort();
  if (!dates.length) return "Data a confirmar";
  const first = new Date(`${dates[0]}T12:00:00`).toLocaleDateString("pt-BR");
  const last = new Date(`${dates.at(-1)}T12:00:00`).toLocaleDateString("pt-BR");
  return dates.length > 1 && first !== last ? `${first} a ${last}` : first;
}

function groupTitle(group: ReviewGroup) {
  const items = displayGroupItems(group);
  const distinctTitles = [...new Set(items.map((item) => item.title).filter(Boolean))] as string[];
  if (items.length === 1) return distinctTitles[0] || "Sem título";
  if (distinctTitles.length === 1) return distinctTitles[0];
  return `Publicação com ${items.length} eventos`;
}

function groupCategory(group: ReviewGroup) {
  const categories = [...new Set(displayGroupItems(group).map((item) => item.category).filter(Boolean))] as string[];
  if (categories.length === 1) return categories[0];
  return categories.length > 1 ? "Programação" : "N/A";
}

function groupStatus(group: ReviewGroup) {
  const statuses = [...new Set(group.items.map((item) => item.review_status))];
  return statuses.length === 1 ? statuses[0] : "misto";
}

function GroupDetails({
  group,
  busy,
  onOpenItem,
  onPublish,
  onIgnore,
}: {
  group: ReviewGroup;
  busy: boolean;
  onOpenItem: (id: string) => void;
  onPublish: () => void;
  onIgnore: () => void;
}) {
  const source = sourcePresentation(group.items[0]);
  const items = displayGroupItems(group);
  const recurrenceSeries = items.filter((item) => recurrenceView(item)).length;

  return (
    <div className="space-y-5 p-6">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{source.label}</Badge>
            {source.name ? <span className="font-semibold">{source.name}</span> : null}
            <Badge variant="outline">
              <Layers3 className="mr-1 h-3 w-3" /> {items.length} evento(s)
            </Badge>
            {recurrenceSeries ? (
              <Badge variant="outline">
                <CalendarRange className="mr-1 h-3 w-3" /> {recurrenceSeries} recorrência(s)
              </Badge>
            ) : null}
          </div>
          {source.url && source.linkLabel ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            >
              {source.linkLabel} <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Revise a publicação uma única vez. Ao publicar, todos os eventos deste grupo são aprovados juntos; recorrências só serão expandidas na agenda pública.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {items.map((item, index) => {
          const recurrence = recurrenceLabel(item);
          const duplicate = duplicateInfo(item.extracted_data);
          return (
            <Card key={item.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">Evento {index + 1}</span>
                      <Badge variant="outline">{item.category || "N/A"}</Badge>
                      <Badge variant="secondary">{Math.round((item.confidence_score || 0) * 100)}%</Badge>
                    </div>
                    <h3 className="mt-2 text-base font-semibold">{item.title || "Sem título"}</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => onOpenItem(item.id)}>
                    <Eye className="mr-2 h-4 w-4" /> Ver / editar
                  </Button>
                </div>
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p><strong>Quando:</strong> {recurrence || (item.event_date ? formatDateTime(item.event_date) : "Não informado")}</p>
                  <p><strong>Onde:</strong> {item.location || item.city || "Não informado"}</p>
                  <p><strong>Preço:</strong> {item.price ?? "Não informado"}</p>
                  <p><strong>Contato:</strong> {[item.contact_phone, item.contact_instagram].filter(Boolean).join(" · ") || "Não informado"}</p>
                </div>
                {item.summary ? <p className="text-sm text-muted-foreground">{item.summary}</p> : null}
                {duplicate ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                    Possível duplicidade {duplicate.score ? `(${Math.round(duplicate.score * 100)}%)` : ""}: {duplicate.title || "evento existente"}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background py-4">
        <Button variant="outline" disabled={busy} onClick={onIgnore}>Ignorar grupo</Button>
        <Button disabled={busy} onClick={onPublish}>
          <Send className="mr-2 h-4 w-4" /> Publicar grupo
        </Button>
      </div>
    </div>
  );
}

export function ReviewWorkspace() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [origin, setOrigin] = useState("all");
  const [status, setStatus] = useState("all");
  const [showNonEvents, setShowNonEvents] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [detailsGroupKey, setDetailsGroupKey] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"selected" | "category" | null>(null);
  const [busy, setBusy] = useState(false);
  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery({ queryKey: ["interpreted-contents"], queryFn: getInterpretedContents });

  const reviewData = useMemo(
    () => data.filter((item) => !["publicado", "aprovado", "ignorado"].includes(item.review_status)),
    [data],
  );
  const groups = useMemo(() => buildGroups(reviewData), [reviewData]);
  const categories = useMemo(
    () => [...new Set(reviewData.map((item) => item.category).filter(Boolean))] as string[],
    [reviewData],
  );
  const statuses = useMemo(
    () => [...new Set(reviewData.map((item) => item.review_status).filter(Boolean))] as string[],
    [reviewData],
  );
  const lastInterpretation = data[0]?.created_at ?? null;

  const filteredGroups = useMemo(
    () =>
      groups.filter((group) => {
        const source = sourcePresentation(group.items[0]);
        const term = search.toLowerCase();
        const itemSource = sourceKind(group.items[0]);
        const searchable = `${source.name} ${group.items.map((item) => `${item.title || ""} ${item.whatsapp_messages?.text_content || ""}`).join(" ")}`.toLowerCase();
        return (
          (showNonEvents || group.items.some(isLikelyEvent)) &&
          (category === "all" || group.items.some((item) => item.category === category)) &&
          (origin === "all" || itemSource === origin) &&
          (status === "all" || group.items.some((item) => item.review_status === status)) &&
          (!term || searchable.includes(term))
        );
      }),
    [category, groups, origin, search, showNonEvents, status],
  );

  const selectedGroups = useMemo(
    () => groups.filter((group) => selected.has(group.key)),
    [groups, selected],
  );
  const selectedGroup = groups.find((group) => group.key === detailsGroupKey) || null;
  const allSelected = filteredGroups.length > 0 && filteredGroups.every((group) => selected.has(group.key));

  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current);
      filteredGroups.forEach((group) => (allSelected ? next.delete(group.key) : next.add(group.key)));
      return next;
    });

  const updateGroupStatus = async (group: ReviewGroup, reviewStatus: string) => {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("interpreted_contents")
        .update({ review_status: reviewStatus, reviewed_at: now, updated_at: now })
        .in("id", group.items.map((item) => item.id));
      if (error) throw error;
      toast.success(reviewStatus === "publicado" ? "Publicação aprovada e enviada para a agenda." : "Publicação ignorada.");
      setDetailsGroupKey(null);
      setDetailsId(null);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar o grupo.");
    } finally {
      setBusy(false);
    }
  };

  const reprocess = async () => {
    const messageIds = [
      ...new Set(
        selectedGroups
          .flatMap((group) => group.items)
          .map((item) => item.message_id)
          .filter(Boolean),
      ),
    ];
    if (!messageIds.length) {
      toast.info("O reprocessamento direto desta seleção não é de WhatsApp. Para uma publicação do Instagram, exclua o grupo e sincronize a fonte novamente.");
      return;
    }
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
      const result = await reprocessMessages({
        data: { messageIds, accessToken: sessionData.session.access_token },
      });
      if (result.failures.length) toast.warning(`${result.processed} processadas; ${result.failures.length} falharam.`);
      else toast.success(`${result.processed} mensagens reprocessadas com as regras atuais.`);
      setSelected(new Set());
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao reprocessar.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const targetGroups = confirm === "category" ? filteredGroups : selectedGroups;
    const ids = [...new Set(targetGroups.flatMap((group) => group.items.map((item) => item.id)))];
    setBusy(true);
    try {
      const { error } = await supabase.from("interpreted_contents").delete().in("id", ids);
      if (error) throw error;
      toast.success(`${targetGroups.length} publicação(ões) e ${ids.length} evento(s) excluídos.`);
      setSelected(new Set());
      setConfirm(null);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BrainCircuit className="h-6 w-6" /> Revisão
          </h1>
          <p className="text-muted-foreground">
            A revisão é agrupada por publicação ou mensagem original. Um único aceite publica todos os eventos daquele conteúdo.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Última interpretação registrada: <span className="font-medium text-foreground">{formatDateTime(lastInterpretation)}</span>
          </p>
        </div>

        <div className="grid gap-3 rounded-lg border bg-card p-4 lg:grid-cols-[1fr_200px_180px_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por evento, publicação ou fonte..." />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categories.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={origin} onValueChange={setOrigin}>
            <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              <SelectItem value="whatsapp">Grupos WhatsApp</SelectItem>
              <SelectItem value="notion">Notion</SelectItem>
              <SelectItem value="feed">Instagram / sites / feeds</SelectItem>
              <SelectItem value="unknown">Desconhecida</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os status</SelectItem>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span><strong>{filteredGroups.length}</strong> publicação(ões) para revisar</span>
            <span className="text-muted-foreground">{filteredGroups.reduce((total, group) => total + displayGroupItems(group).length, 0)} evento(s) agrupados</span>
            <label className="flex items-center gap-2 text-muted-foreground">
              <Checkbox checked={showNonEvents} onCheckedChange={(value) => setShowNonEvents(Boolean(value))} /> Mostrar conteúdos não classificados como evento
            </label>
          </div>
          <span className="text-xs text-muted-foreground">Recorrências aparecem uma única vez nesta tela.</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{selected.size} publicação(ões) selecionada(s)</span>
          <Button variant="outline" size="sm" disabled={!selected.size || busy} onClick={reprocess}><RotateCcw className="mr-2 h-4 w-4" /> Reprocessar selecionados</Button>
          <Button variant="outline" size="sm" disabled={!selected.size || busy} onClick={() => setConfirm("selected")}><Trash2 className="mr-2 h-4 w-4" /> Excluir selecionados</Button>
          <Button variant="destructive" size="sm" disabled={category === "all" || !filteredGroups.length || busy} onClick={() => setConfirm("category")}>Excluir categoria filtrada</Button>
        </div>

        <div className="overflow-x-auto rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Selecionar publicações filtradas" /></TableHead>
                <TableHead>Publicação / evento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Origem / fonte</TableHead>
                <TableHead>Recebido em</TableHead>
                <TableHead>Programação</TableHead>
                <TableHead>Confiança</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center">Carregando...</TableCell></TableRow>
              ) : filteredGroups.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Nenhuma publicação encontrada com os filtros atuais.</TableCell></TableRow>
              ) : (
                filteredGroups.map((group) => {
                  const visibleItems = displayGroupItems(group);
                  const duplicate = visibleItems.map((item) => duplicateInfo(item.extracted_data)).find(Boolean);
                  const source = sourcePresentation(group.items[0]);
                  const confidence = Math.min(...visibleItems.map((item) => item.confidence_score ?? 0));
                  const hasRecurrence = visibleItems.some((item) => recurrenceView(item));
                  return (
                    <TableRow key={group.key} className={duplicate ? "bg-amber-50/50 dark:bg-amber-950/10" : undefined}>
                      <TableCell><Checkbox checked={selected.has(group.key)} onCheckedChange={() => setSelected((current) => { const next = new Set(current); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next; })} aria-label={`Selecionar ${groupTitle(group)}`} /></TableCell>
                      <TableCell className="font-medium">
                        <div className="flex max-w-[360px] flex-col gap-1">
                          <span>{groupTitle(group)}</span>
                          {visibleItems.length > 1 ? <span className="text-xs font-normal text-muted-foreground">{visibleItems.length} eventos nesta publicação</span> : null}
                          {hasRecurrence ? <Badge variant="outline" className="w-fit"><CalendarRange className="mr-1 h-3 w-3" /> Recorrente</Badge> : null}
                          {duplicate ? <span className="flex w-fit items-center gap-1 text-xs font-normal text-amber-700 dark:text-amber-400"><CopyCheck className="h-3 w-3" /> Possível duplicidade no grupo</span> : null}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{groupCategory(group)}</Badge></TableCell>
                      <TableCell>
                        <div className="flex max-w-[220px] flex-col items-start gap-1">
                          <Badge variant="secondary">{source.label}</Badge>
                          {source.name ? <span className="text-xs font-medium text-foreground">{source.name}</span> : null}
                          {source.url && source.linkLabel ? <a href={source.url} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">{source.linkLabel} <ExternalLink className="h-3 w-3" /></a> : null}
                        </div>
                      </TableCell>
                      <TableCell>{formatDateTime(group.items[0].created_at)}</TableCell>
                      <TableCell><span className="text-sm">{groupDateLabel(group)}</span></TableCell>
                      <TableCell>{Math.round(confidence * 100)}%</TableCell>
                      <TableCell><Badge variant="secondary">{groupStatus(group)}</Badge></TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => { setDetailsGroupKey(group.key); setDetailsId(null); }}><Eye className="mr-2 h-4 w-4" /> Revisar</Button></TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Sheet open={Boolean(detailsGroupKey)} onOpenChange={(open) => { if (!open) { setDetailsGroupKey(null); setDetailsId(null); } }}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-5xl">
          <SheetHeader className="sticky top-0 z-10 border-b bg-background p-6">
            <div className="flex items-center gap-3">
              {detailsId ? <Button variant="ghost" size="icon" onClick={() => setDetailsId(null)} aria-label="Voltar para a publicação"><ArrowLeft className="h-4 w-4" /></Button> : null}
              <div>
                <SheetTitle>{detailsId ? "Detalhes do evento" : "Revisar publicação agrupada"}</SheetTitle>
                <SheetDescription>{detailsId ? "Edite um evento específico e depois volte para aprovar o grupo." : "Confira todos os eventos extraídos desta mesma publicação ou mensagem."}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          {detailsId ? <InterpretedDetails id={detailsId} onClose={() => setDetailsId(null)} /> : selectedGroup ? <GroupDetails group={selectedGroup} busy={busy} onOpenItem={setDetailsId} onPublish={() => updateGroupStatus(selectedGroup, "publicado")} onIgnore={() => updateGroupStatus(selectedGroup, "ignorado")} /> : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "category" ? `As ${filteredGroups.length} publicações visíveis da categoria “${category}” serão excluídas com todos os eventos agrupados.` : `${selected.size} publicação(ões) serão excluídas com todos os seus eventos.`} Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={remove} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
