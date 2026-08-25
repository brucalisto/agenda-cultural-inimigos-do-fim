import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Database, ExternalLink, Loader2, Plus, RefreshCw, Rss, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteFeedSource,
  legacyNotionImportStatus,
  listFeedSources,
  saveFeedSource,
  syncFeedSource,
} from "@/lib/feed-sources.functions";
import { importLegacyNotionAgenda } from "@/lib/feed.functions";

export const Route = createFileRoute("/feeds")({ component: FeedsPage });

type FeedSource = {
  id: string;
  name: string;
  url: string;
  source_type: string;
  active: boolean;
  trusted: boolean;
  auto_publish: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_result: unknown;
};

type LegacyStatus = { total: number; published: number; review: number };

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
  return data.session.access_token;
}

function FeedsPage() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [status, setStatus] = useState<LegacyStatus>({ total: 0, published: 0, review: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [trusted, setTrusted] = useState(false);
  const [autoPublish, setAutoPublish] = useState(false);

  const refresh = useCallback(async () => {
    const token = await accessToken();
    const [nextSources, nextStatus] = await Promise.all([
      listFeedSources({ data: { accessToken: token } }),
      legacyNotionImportStatus({ data: { accessToken: token } }),
    ]);
    setSources(nextSources as FeedSource[]);
    setStatus(nextStatus as LegacyStatus);
  }, []);

  useEffect(() => {
    void refresh()
      .catch((cause) => toast.error(cause instanceof Error ? cause.message : "Falha ao carregar fontes."))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function importNotion() {
    setImporting(true);
    try {
      const token = await accessToken();
      const result = await importLegacyNotionAgenda({ data: { accessToken: token } });
      toast.success(
        `Notion processado: ${result.published} publicados e ${result.duplicates} possíveis duplicidades.`,
      );
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Falha ao importar a agenda do Notion.");
    } finally {
      setImporting(false);
    }
  }

  async function addSource() {
    setSaving(true);
    try {
      const token = await accessToken();
      await saveFeedSource({
        data: {
          accessToken: token,
          name,
          url,
          active: true,
          trusted,
          autoPublish: trusted && autoPublish,
        },
      });
      setName("");
      setUrl("");
      setTrusted(false);
      setAutoPublish(false);
      toast.success("Fonte adicionada.");
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Falha ao adicionar fonte.");
    } finally {
      setSaving(false);
    }
  }

  async function updateSource(source: FeedSource, changes: Partial<FeedSource>) {
    try {
      const token = await accessToken();
      const next = { ...source, ...changes };
      await saveFeedSource({
        data: {
          accessToken: token,
          id: source.id,
          name: next.name,
          url: next.url,
          active: next.active,
          trusted: next.trusted,
          autoPublish: next.trusted && next.auto_publish,
        },
      });
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Falha ao atualizar fonte.");
    }
  }

  async function sync(source: FeedSource) {
    setSyncingId(source.id);
    try {
      const token = await accessToken();
      const result = await syncFeedSource({ data: { accessToken: token, id: source.id } });
      toast.success(
        `${source.name}: ${result.imported} eventos processados, ${result.duplicates} duplicidades.`,
      );
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Falha ao sincronizar fonte.");
    } finally {
      setSyncingId(null);
    }
  }

  async function remove(source: FeedSource) {
    try {
      const token = await accessToken();
      await deleteFeedSource({ data: { accessToken: token, id: source.id } });
      toast.success("Fonte removida.");
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Falha ao remover fonte.");
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Fontes / Feeds</h1>
          <p className="text-muted-foreground">
            Cadastre portais e páginas que alimentam a agenda, acompanhe as sincronizações e controle o fluxo de publicação.
          </p>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle>Base exportada do Notion</CardTitle>
                </div>
                <CardDescription>
                  Carga inicial revisada da Agenda Cultural Inimigos do Fim. Registros sem duplicidade são publicados automaticamente.
                </CardDescription>
              </div>
              <Button onClick={() => void importNotion()} disabled={importing}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {status.total ? "Reprocessar importação" : "Importar 93 eventos"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-4"><p className="text-2xl font-bold">{status.total}</p><p className="text-sm text-muted-foreground">registros importados</p></div>
              <div className="rounded-lg border p-4"><p className="text-2xl font-bold text-emerald-600">{status.published}</p><p className="text-sm text-muted-foreground">publicados</p></div>
              <div className="rounded-lg border p-4"><p className="text-2xl font-bold text-amber-600">{status.review}</p><p className="text-sm text-muted-foreground">em revisão por duplicidade</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Plus className="h-5 w-5" /><CardTitle>Adicionar portal ou página</CardTitle></div>
            <CardDescription>
              Cole a URL de uma página que divulga eventos. Fontes novas entram em revisão por padrão.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_1.6fr_auto]">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome da fonte (ex.: FUNDACC)" />
              <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://portal.com.br/agenda" />
              <Button onClick={() => void addSource()} disabled={saving || !name.trim() || !url.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={trusted} onChange={(event) => { setTrusted(event.target.checked); if (!event.target.checked) setAutoPublish(false); }} /> Fonte confiável</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={autoPublish} disabled={!trusted} onChange={(event) => setAutoPublish(event.target.checked)} /> Publicar automaticamente quando não houver duplicidade</label>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Fontes cadastradas</h2><Badge variant="secondary">{sources.length}</Badge></div>
          {loading ? (
            <Card><CardContent className="flex items-center gap-2 p-5 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando fontes...</CardContent></Card>
          ) : sources.length === 0 ? (
            <Card><CardContent className="p-5 text-sm text-muted-foreground">Nenhuma fonte cadastrada.</CardContent></Card>
          ) : sources.map((source) => (
            <Card key={source.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Rss className="h-4 w-4 text-primary" />
                      <p className="font-semibold">{source.name}</p>
                      <Badge variant={source.active ? "default" : "outline"}>{source.active ? "Ativa" : "Pausada"}</Badge>
                      {source.trusted && <Badge variant="secondary">Confiável</Badge>}
                      {source.auto_publish && <Badge className="bg-emerald-600 hover:bg-emerald-600">Auto-publicação</Badge>}
                    </div>
                    <a href={source.url} target="_blank" rel="noreferrer" className="mt-1 flex max-w-3xl items-center gap-1 break-all text-xs text-muted-foreground hover:text-primary">
                      {source.url}<ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Última sincronização: {source.last_synced_at ? new Date(source.last_synced_at).toLocaleString("pt-BR") : "ainda não executada"}
                      {source.last_sync_status ? ` · ${source.last_sync_status}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void updateSource(source, { active: !source.active })}>{source.active ? "Pausar" : "Ativar"}</Button>
                    <Button variant="outline" size="sm" onClick={() => void sync(source)} disabled={!source.active || syncingId === source.id}>
                      {syncingId === source.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Sincronizar
                    </Button>
                    {source.source_type !== "notion" && <Button variant="outline" size="sm" className="text-destructive" onClick={() => void remove(source)}><Trash2 className="mr-2 h-4 w-4" />Remover</Button>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-5 border-t pt-3 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={source.trusted} onChange={(event) => void updateSource(source, { trusted: event.target.checked, auto_publish: event.target.checked ? source.auto_publish : false })} /> Fonte confiável</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={source.auto_publish} disabled={!source.trusted} onChange={(event) => void updateSource(source, { auto_publish: event.target.checked })} /> Publicar automaticamente</label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
