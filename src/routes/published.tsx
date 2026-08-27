import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Edit,
  ExternalLink,
  ImageIcon,
  Loader2,
  Search,
  Sparkles,
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
import { createEventImage } from "@/lib/event-images.functions";

type PublishedItem = {
  id: string;
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
};

const BASE_COLUMNS =
  "id,title,category,event_date,location,city,price,summary,full_description,contact_phone,contact_instagram,source_url";
const CURATION_COLUMNS = `${BASE_COLUMNS},image_url,is_featured,featured_priority,featured_starts_at,featured_ends_at`;
export const Route = createFileRoute("/published")({ component: PublishedPage });
const dateKey = (value: string | null) => (value ? value.slice(0, 10) : "");
const normalize = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function asPublishedItem(value: Record<string, unknown>): PublishedItem {
  return {
    ...(value as unknown as PublishedItem),
    image_url: typeof value.image_url === "string" ? value.image_url : null,
    is_featured: value.is_featured === true,
    featured_priority: typeof value.featured_priority === "number" ? value.featured_priority : 0,
    featured_starts_at:
      typeof value.featured_starts_at === "string" ? value.featured_starts_at : null,
    featured_ends_at: typeof value.featured_ends_at === "string" ? value.featured_ends_at : null,
  };
}

function EventRow({
  item,
  onEdit,
  onDelete,
}: {
  item: PublishedItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="grid h-20 w-full shrink-0 place-items-center overflow-hidden rounded-lg bg-muted sm:w-28">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{item.title || "Sem título"}</p>
            {item.is_featured ? (
              <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                <Star className="h-3 w-3 fill-current" />
                Destaque
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {item.category || "Cultura"} · {item.location || item.city || "Local a confirmar"}
          </p>
          <p className="mt-1 text-sm">
            {item.event_date ? new Date(item.event_date).toLocaleString("pt-BR") : "Sem data"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PublishedPage() {
  const [items, setItems] = useState<PublishedItem[]>([]);
  const [editing, setEditing] = useState<PublishedItem | null>(null);
  const [deleting, setDeleting] = useState<PublishedItem | null>(null);
  const [initializingNotion, setInitializingNotion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [generatingImage, setGeneratingImage] = useState(false);

  const load = async () => {
    const curated = await supabase
      .from("interpreted_contents")
      .select(CURATION_COLUMNS)
      .in("review_status", ["publicado", "aprovado"])
      .order("event_date", { ascending: true });
    if (!curated.error) {
      setItems(((curated.data || []) as unknown as Record<string, unknown>[]).map(asPublishedItem));
      setLoading(false);
      return;
    }
    const fallback = await supabase
      .from("interpreted_contents")
      .select(BASE_COLUMNS)
      .in("review_status", ["publicado", "aprovado"])
      .order("event_date", { ascending: true });
    if (fallback.error) toast.error(fallback.error.message);
    else
      setItems(
        ((fallback.data || []) as unknown as Record<string, unknown>[]).map(asPublishedItem),
      );
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
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Não foi possível concluir a carga inicial do Notion.",
        );
      } finally {
        setInitializingNotion(false);
        await load();
      }
    })();
    const channel = supabase
      .channel("published-events-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interpreted_contents" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const haystack = normalize(`${item.title} ${item.category} ${item.location} ${item.city}`);
        return haystack.includes(normalize(query)) && (!date || dateKey(item.event_date) === date);
      }),
    [items, query, date],
  );
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = filtered.filter((item) => !item.event_date || dateKey(item.event_date) >= today);
  const past = filtered
    .filter((item) => item.event_date && dateKey(item.event_date) < today)
    .reverse();

  const save = async () => {
    if (!editing) return;
    const { id, ...event } = editing;
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
    const { error } = await supabase.from("interpreted_contents").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Evento removido da agenda.");
      setDeleting(null);
      await load();
    }
  };
  const generateImage = async () => {
    if (!editing) return;
    setGeneratingImage(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("Sua sessão expirou.");
      const result = await createEventImage({
        data: { accessToken: data.session.access_token, eventId: editing.id },
      });
      setEditing({ ...editing, image_url: result.imageUrl });
      toast.success("Imagem criada e vinculada ao evento.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível gerar a imagem.");
    } finally {
      setGeneratingImage(false);
    }
  };

  const eventList = (list: PublishedItem[], empty: string) =>
    list.length ? (
      list.map((item) => (
        <EventRow
          key={item.id}
          item={item}
          onEdit={() => setEditing({ ...item })}
          onDelete={() => setDeleting(item)}
        />
      ))
    ) : (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">{empty}</CardContent>
      </Card>
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Publicados</h1>
            <p className="text-muted-foreground">
              Encontre, edite, destaque ou retire eventos da agenda pública.
            </p>
          </div>
          <Button asChild>
            <a href="/agenda" target="_blank" rel="noreferrer">
              Abrir agenda
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_240px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por evento, artista ou local"
                className="pl-9"
              />
            </div>
            <Input
              type="date"
              value={date}
              onClick={(event) => event.currentTarget.showPicker?.()}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Filtrar eventos por data"
            />
            <Button
              variant="outline"
              disabled={!query && !date}
              onClick={() => {
                setQuery("");
                setDate("");
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          </CardContent>
        </Card>
        {initializingNotion ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-3 p-5 text-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
              Importando a base revisada do Notion.
            </CardContent>
          </Card>
        ) : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando eventos...
          </div>
        ) : null}
        {!loading ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CalendarDays className="h-5 w-5 text-emerald-600" />
                Próximos e atuais
              </h2>
              <Badge variant="secondary">{upcoming.length}</Badge>
            </div>
            {eventList(upcoming, "Nenhum evento futuro encontrado.")}
          </section>
        ) : null}
        {!loading && past.length ? (
          <section className="space-y-3 border-t pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Eventos que já aconteceram</h2>
                <p className="text-sm text-muted-foreground">
                  Histórico separado da programação atual.
                </p>
              </div>
              <Badge variant="outline">{past.length}</Badge>
            </div>
            {eventList(past, "")}
          </section>
        ) : null}
      </div>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar evento publicado</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={editing.title || ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Título"
              />
              <Input
                value={editing.category || ""}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                placeholder="Categoria"
              />
              <Input
                type="datetime-local"
                value={editing.event_date?.slice(0, 16) || ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    event_date: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
              <Input
                value={editing.price || ""}
                onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                placeholder="Preço"
              />
              <Input
                value={editing.location || ""}
                onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                placeholder="Local/endereço"
              />
              <Input
                value={editing.city || ""}
                onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                placeholder="Cidade"
              />
              <Input
                value={editing.contact_phone || ""}
                onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })}
                placeholder="Telefone"
              />
              <Input
                value={editing.contact_instagram || ""}
                onChange={(e) => setEditing({ ...editing, contact_instagram: e.target.value })}
                placeholder="Instagram"
              />
              <Input
                value={editing.source_url || ""}
                onChange={(e) => setEditing({ ...editing, source_url: e.target.value })}
                placeholder="Link oficial"
              />
              <div className="flex gap-2">
                <Input
                  value={editing.image_url || ""}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="URL da imagem"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={generatingImage}
                  onClick={() => void generateImage()}
                  aria-label="Gerar imagem do evento com inteligência artificial"
                >
                  {generatingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                className="md:col-span-2"
                value={editing.summary || ""}
                onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                placeholder="Resumo"
              />
              <Textarea
                className="md:col-span-2"
                value={editing.full_description || ""}
                onChange={(e) => setEditing({ ...editing, full_description: e.target.value })}
                placeholder="Descrição completa"
              />
              <div className="md:col-span-2 rounded-lg border p-4">
                <label className="flex items-center gap-3 font-medium">
                  <input
                    type="checkbox"
                    checked={editing.is_featured}
                    onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })}
                  />
                  Destacar na Agenda
                </label>
                {editing.is_featured ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <Input
                      type="number"
                      min="0"
                      value={editing.featured_priority}
                      onChange={(e) =>
                        setEditing({ ...editing, featured_priority: Number(e.target.value) || 0 })
                      }
                      placeholder="Prioridade"
                    />
                    <Input
                      type="datetime-local"
                      value={editing.featured_starts_at?.slice(0, 16) || ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          featured_starts_at: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        })
                      }
                      aria-label="Início do destaque"
                    />
                    <Input
                      type="datetime-local"
                      value={editing.featured_ends_at?.slice(0, 16) || ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          featured_ends_at: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        })
                      }
                      aria-label="Fim do destaque"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover evento publicado?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” deixará de aparecer imediatamente na Agenda. Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir evento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
