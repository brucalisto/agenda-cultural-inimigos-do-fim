import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  Edit,
  ExternalLink,
  Eye,
  Layers3,
  Loader2,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { legacyNotionImportStatus } from "@/lib/feed-sources.functions";
import { importLegacyNotionAgenda } from "@/lib/feed.functions";
import { categoryIllustration } from "@/lib/category-illustrations";

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

type PublishedItem = {
  id: string;
  message_id: string | null;
  title: string | null;
  category: string | null;
  event_date: string | null;
  location: string | null;
  city: string | null;
  price: string | null;
  summary: string | null;
  full_description: string | null;
  contact_phone: string | null;
  contact_instagram: string | null;
  source_url: string | null;
  image_url: string | null;
  is_featured: boolean;
  featured_priority: number;
  featured_starts_at: string | null;
  featured_ends_at: string | null;
  extracted_data: unknown;
};

type PublishedGroup = {
  key: string;
  items: PublishedItem[];
};

type RecurrenceView = {
  weekdays: number[];
  time: string | null;
  startDate: string | null;
  endDate: string | null;
};

const BASE_COLUMNS =
  "id,message_id,title,category,event_date,location,city,price,summary,full_description,contact_phone,contact_instagram,source_url,extracted_data";
const CURATION_COLUMNS = `${BASE_COLUMNS},image_url,is_featured,featured_priority,featured_starts_at,featured_ends_at`;
export const Route = createFileRoute("/published")({ component: PublishedPage });
const dateKey = (value: string | null) => (value ? value.slice(0, 10) : "");
const normalize = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recurrence(item: PublishedItem): RecurrenceView | null {
  const raw = record(record(item.extracted_data).recurrence);
  if (raw.frequency !== "weekly") return null;
  return {
    weekdays: Array.isArray(raw.weekdays)
      ? raw.weekdays.map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
      : [],
    time: typeof raw.time === "string" ? raw.time : null,
    startDate: typeof raw.startDate === "string" ? raw.startDate : null,
    endDate: typeof raw.endDate === "string" ? raw.endDate : null,
  };
}

function recurrenceIdentity(item: PublishedItem) {
  const value = recurrence(item);
  if (!value) return null;
  return `${item.title || ""}|${item.location || ""}|${value.weekdays.join(",")}|${value.time || ""}|${value.startDate || ""}|${value.endDate || ""}`;
}

function recurrenceLabel(item: PublishedItem) {
  const value = recurrence(item);
  if (!value) return null;
  const days = value.weekdays.map((index) => WEEKDAYS[index]).filter(Boolean).join(" e ");
  const start = value.startDate ? new Date(`${value.startDate}T12:00:00`).toLocaleDateString("pt-BR") : null;
  const end = value.endDate ? new Date(`${value.endDate}T12:00:00`).toLocaleDateString("pt-BR") : null;
  return `${days || "dias a confirmar"}${value.time ? ` às ${value.time}` : ""}${start || end ? ` · ${[start, end].filter(Boolean).join(" a ")}` : ""}`;
}

function asPublishedItem(value: Record<string, unknown>): PublishedItem {
  return {
    ...(value as unknown as PublishedItem),
    message_id: typeof value.message_id === "string" ? value.message_id : null,
    image_url: typeof value.image_url === "string" ? value.image_url : null,
    is_featured: value.is_featured === true,
    featured_priority: typeof value.featured_priority === "number" ? value.featured_priority : 0,
    featured_starts_at:
      typeof value.featured_starts_at === "string" ? value.featured_starts_at : null,
    featured_ends_at: typeof value.featured_ends_at === "string" ? value.featured_ends_at : null,
    extracted_data: value.extracted_data ?? null,
  };
}

function groupKey(item: PublishedItem) {
  const extracted = record(item.extracted_data);
  const postKey = typeof extracted.instagramPostKey === "string" ? extracted.instagramPostKey : null;
  if (postKey) return `instagram:${postKey}`;
  if (item.message_id) return `whatsapp:${item.message_id}`;
  return `item:${item.id}`;
}

function buildGroups(items: PublishedItem[]) {
  const map = new Map<string, PublishedItem[]>();
  for (const item of items) {
    const key = groupKey(item);
    const current = map.get(key) || [];
    current.push(item);
    map.set(key, current);
  }
  return [...map.entries()].map(([key, groupItems]) => ({ key, items: groupItems }));
}

function displayItems(group: PublishedGroup) {
  const seen = new Set<string>();
  return group.items.filter((item) => {
    const series = recurrenceIdentity(item);
    const key = series || `event:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceName(item: PublishedItem) {
  const extracted = record(item.extracted_data);
  return typeof extracted.feedSourceName === "string" ? extracted.feedSourceName : null;
}

function sourceUrl(item: PublishedItem) {
  const extracted = record(item.extracted_data);
  return typeof extracted.instagramPostUrl === "string"
    ? extracted.instagramPostUrl
    : item.source_url;
}

function groupTitle(group: PublishedGroup) {
  const visible = displayItems(group);
  const titles = [...new Set(visible.map((item) => item.title).filter(Boolean))] as string[];
  if (titles.length === 1) return titles[0];
  const source = sourceName(group.items[0]);
  return `${source || "Publicação"} · ${visible.length} eventos`;
}

function groupDateLabel(group: PublishedGroup) {
  const visible = displayItems(group);
  const recurring = visible.map(recurrenceLabel).filter(Boolean) as string[];
  if (recurring.length) return recurring[0];
  const dates = visible.map((item) => dateKey(item.event_date)).filter(Boolean).sort();
  if (!dates.length) return "Sem data";
  const first = new Date(`${dates[0]}T12:00:00`).toLocaleDateString("pt-BR");
  const last = new Date(`${dates.at(-1)}T12:00:00`).toLocaleDateString("pt-BR");
  return first === last ? first : `${first} a ${last}`;
}

function groupMatchesDate(group: PublishedGroup, date: string) {
  if (!date) return true;
  const target = new Date(`${date}T12:00:00`);
  return displayItems(group).some((item) => {
    if (dateKey(item.event_date) === date) return true;
    const value = recurrence(item);
    if (!value?.startDate || !value.endDate || !value.weekdays.length) return false;
    return date >= value.startDate && date <= value.endDate && value.weekdays.includes(target.getDay());
  });
}

function groupIsUpcoming(group: PublishedGroup, today: string) {
  return displayItems(group).some((item) => {
    const value = recurrence(item);
    if (value?.endDate) return value.endDate >= today;
    return !item.event_date || dateKey(item.event_date) >= today;
  });
}

function PublishedGroupRow({
  group,
  onView,
  onDelete,
}: {
  group: PublishedGroup;
  onView: () => void;
  onDelete: () => void;
}) {
  const visible = displayItems(group);
  const representative = visible[0];
  const recurringCount = visible.filter((item) => recurrence(item)).length;
  const image = representative?.image_url || categoryIllustration(representative?.category);
  const source = representative ? sourceName(representative) : null;
  const url = representative ? sourceUrl(representative) : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="grid h-24 w-full shrink-0 place-items-center overflow-hidden rounded-lg bg-muted sm:w-32">
          <img src={image} alt="Imagem da publicação" className="h-full w-full object-cover" loading="lazy" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{groupTitle(group)}</p>
            <Badge variant="outline"><Layers3 className="mr-1 h-3 w-3" /> {visible.length} evento(s)</Badge>
            {recurringCount ? <Badge variant="outline"><CalendarRange className="mr-1 h-3 w-3" /> {recurringCount} recorrente(s)</Badge> : null}
            {visible.some((item) => item.is_featured) ? (
              <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500"><Star className="h-3 w-3 fill-current" /> Destaque</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {source || representative?.category || "Cultura"} · {groupDateLabel(group)}
          </p>
          {url ? <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">Ver fonte original <ExternalLink className="h-3 w-3" /></a> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onView}><Eye className="mr-2 h-4 w-4" /> Ver eventos</Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" /> Excluir grupo</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PublishedPage() {
  const [items, setItems] = useState<PublishedItem[]>([]);
  const [viewing, setViewing] = useState<PublishedGroup | null>(null);
  const [editing, setEditing] = useState<PublishedItem | null>(null);
  const [deleting, setDeleting] = useState<PublishedGroup | null>(null);
  const [initializingNotion, setInitializingNotion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");

  const load = async () => {
    const curated = await supabase
      .from("interpreted_contents")
      .select(CURATION_COLUMNS)
      .in("review_status", ["publicado", "aprovado"])
      .order("event_date", { ascending: true, nullsFirst: false });
    if (!curated.error) {
      setItems(((curated.data || []) as unknown as Record<string, unknown>[]).map(asPublishedItem));
      setLoading(false);
      return;
    }
    const fallback = await supabase
      .from("interpreted_contents")
      .select(BASE_COLUMNS)
      .in("review_status", ["publicado", "aprovado"])
      .order("event_date", { ascending: true, nullsFirst: false });
    if (fallback.error) toast.error(fallback.error.message);
    else setItems(((fallback.data || []) as unknown as Record<string, unknown>[]).map(asPublishedItem));
    setLoading(false);
  };

  useEffect(() => {
    void (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (token) {
          const status = await legacyNotionImportStatus({ data: { accessToken: token } });
          if (status.total === 0) {
            setInitializingNotion(true);
            await importLegacyNotionAgenda({ data: { accessToken: token } });
          }
        }
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "Não foi possível concluir a carga inicial do Notion.");
      } finally {
        setInitializingNotion(false);
        await load();
      }
    })();
    const channel = supabase
      .channel("published-events-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "interpreted_contents" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const groups = useMemo(() => buildGroups(items), [items]);
  const filtered = useMemo(
    () =>
      groups.filter((group) => {
        const haystack = normalize(
          `${sourceName(group.items[0]) || ""} ${group.items.map((item) => `${item.title} ${item.category} ${item.location} ${item.city}`).join(" ")}`,
        );
        return haystack.includes(normalize(query)) && groupMatchesDate(group, date);
      }),
    [groups, query, date],
  );
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = filtered.filter((group) => groupIsUpcoming(group, today));
  const past = filtered.filter((group) => !groupIsUpcoming(group, today)).reverse();

  const save = async () => {
    if (!editing) return;
    const { id, message_id: _messageId, extracted_data: _extractedData, ...event } = editing;
    const { error } = await supabase
      .from("interpreted_contents")
      .update({ ...event, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Evento publicado atualizado.");
      setEditing(null);
      await load();
    }
  };

  const remove = async () => {
    if (!deleting) return;
    const ids = deleting.items.map((item) => item.id);
    const { error } = await supabase.from("interpreted_contents").delete().in("id", ids);
    if (error) toast.error(error.message);
    else {
      toast.success(`Publicação removida com ${ids.length} registro(s) agrupados.`);
      setDeleting(null);
      if (viewing?.key === deleting.key) setViewing(null);
      await load();
    }
  };

  const groupList = (list: PublishedGroup[], empty: string) =>
    list.length ? (
      list.map((group) => (
        <PublishedGroupRow key={group.key} group={group} onView={() => setViewing(group)} onDelete={() => setDeleting(group)} />
      ))
    ) : (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">{empty}</CardContent></Card>
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Publicados</h1>
            <p className="text-muted-foreground">
              Publicações com vários eventos ou recorrências aparecem agrupadas no painel; a agenda pública continua exibindo cada data separadamente.
            </p>
          </div>
          <Button asChild><a href="/agenda" target="_blank" rel="noreferrer">Abrir agenda <ExternalLink className="ml-2 h-4 w-4" /></a></Button>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_240px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por publicação, evento, artista ou local" className="pl-9" />
            </div>
            <Input type="date" value={date} onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => setDate(event.target.value)} aria-label="Filtrar eventos por data" />
            <Button variant="outline" disabled={!query && !date} onClick={() => { setQuery(""); setDate(""); }}><X className="mr-2 h-4 w-4" /> Limpar</Button>
          </CardContent>
        </Card>

        {initializingNotion ? <Card className="border-primary/30 bg-primary/5"><CardContent className="flex items-center gap-3 p-5 text-sm"><Loader2 className="h-5 w-5 animate-spin" /> Importando a base revisada do Notion.</CardContent></Card> : null}
        {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos...</div> : null}

        {!loading ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5 text-emerald-600" /> Próximos e atuais</h2>
              <Badge variant="secondary">{upcoming.length} publicação(ões)</Badge>
            </div>
            {groupList(upcoming, "Nenhuma publicação futura encontrada.")}
          </section>
        ) : null}

        {!loading && past.length ? (
          <section className="space-y-3 border-t pt-6">
            <div className="flex items-center justify-between">
              <div><h2 className="text-lg font-semibold">Publicações que já aconteceram</h2><p className="text-sm text-muted-foreground">Histórico agrupado pela origem.</p></div>
              <Badge variant="outline">{past.length}</Badge>
            </div>
            {groupList(past, "")}
          </section>
        ) : null}
      </div>

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>{viewing ? groupTitle(viewing) : "Publicação"}</DialogTitle></DialogHeader>
          {viewing ? (
            <div className="space-y-3">
              {sourceUrl(viewing.items[0]) ? <a href={sourceUrl(viewing.items[0]) || undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">Ver fonte original <ExternalLink className="h-4 w-4" /></a> : null}
              {displayItems(viewing).map((item, index) => (
                <Card key={item.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold uppercase text-muted-foreground">Evento {index + 1}</span>
                        <h3 className="font-semibold">{item.title || "Sem título"}</h3>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setEditing({ ...item })}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
                    </div>
                    <p className="text-sm"><strong>Quando:</strong> {recurrenceLabel(item) || (item.event_date ? new Date(item.event_date).toLocaleString("pt-BR") : "Sem data")}</p>
                    <p className="text-sm"><strong>Onde:</strong> {item.location || item.city || "Local a confirmar"}</p>
                    {item.summary ? <p className="text-sm text-muted-foreground">{item.summary}</p> : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Editar evento publicado</DialogTitle></DialogHeader>
          {editing ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Título" />
              <Input value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Categoria" />
              <Input type="datetime-local" value={editing.event_date?.slice(0, 16) || ""} onChange={(e) => setEditing({ ...editing, event_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              <Input value={editing.price || ""} onChange={(e) => setEditing({ ...editing, price: e.target.value })} placeholder="Preço" />
              <Input value={editing.location || ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} placeholder="Local/endereço" />
              <Input value={editing.city || ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} placeholder="Cidade" />
              <Input value={editing.contact_phone || ""} onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })} placeholder="Telefone" />
              <Input value={editing.contact_instagram || ""} onChange={(e) => setEditing({ ...editing, contact_instagram: e.target.value })} placeholder="Instagram" />
              <Input value={editing.source_url || ""} onChange={(e) => setEditing({ ...editing, source_url: e.target.value })} placeholder="Link oficial" />
              <Input value={editing.image_url || ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} placeholder="URL da imagem original do evento" />
              <Textarea className="md:col-span-2" value={editing.summary || ""} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} placeholder="Resumo" />
              <Textarea className="md:col-span-2" value={editing.full_description || ""} onChange={(e) => setEditing({ ...editing, full_description: e.target.value })} placeholder="Descrição completa" />
              <div className="md:col-span-2 rounded-lg border p-4">
                <label className="flex items-center gap-3 font-medium">
                  <input type="checkbox" checked={editing.is_featured} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} /> Destacar na Agenda
                </label>
                {editing.is_featured ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <Input type="number" min="0" value={editing.featured_priority} onChange={(e) => setEditing({ ...editing, featured_priority: Number(e.target.value) || 0 })} placeholder="Prioridade" />
                    <Input type="datetime-local" value={editing.featured_starts_at?.slice(0, 16) || ""} onChange={(e) => setEditing({ ...editing, featured_starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} aria-label="Início do destaque" />
                    <Input type="datetime-local" value={editing.featured_ends_at?.slice(0, 16) || ""} onChange={(e) => setEditing({ ...editing, featured_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} aria-label="Fim do destaque" />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={save}>Salvar alterações</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover publicação agrupada?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting ? groupTitle(deleting) : "Publicação"}” deixará de aparecer na Agenda com todos os eventos e recorrências relacionados a essa origem. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground">Excluir grupo</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
