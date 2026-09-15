import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  HeartPulse,
  Loader2,
  RefreshCw,
  Rss,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { getAgendaHealth } from "@/lib/health.functions";

export const Route = createFileRoute("/health")({ component: AgendaHealthPage });

type Severity = "critical" | "warning" | "info";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(value: number) {
  if (value < 1_000) return `${value} ms`;
  return `${(value / 1_000).toFixed(1)} s`;
}

function statusBadge(status: string) {
  if (status === "healthy") {
    return <Badge className="bg-emerald-600 text-white">Saudável</Badge>;
  }
  if (status === "attention") {
    return <Badge className="bg-amber-500 text-white">Atenção</Badge>;
  }
  return <Badge variant="destructive">Crítico</Badge>;
}

function severityBadge(severity: Severity) {
  if (severity === "critical") return <Badge variant="destructive">Crítico</Badge>;
  if (severity === "warning") return <Badge className="bg-amber-500 text-white">Atenção</Badge>;
  return <Badge variant="secondary">Informativo</Badge>;
}

function feedBadge(state: string) {
  if (state === "ok") return <Badge className="bg-emerald-600 text-white">Em dia</Badge>;
  if (state === "attention") return <Badge className="bg-amber-500 text-white">Atenção</Badge>;
  if (state === "stale") return <Badge variant="destructive">Atrasada</Badge>;
  return <Badge variant="destructive">Erro</Badge>;
}

function AgendaHealthPage() {
  const healthQuery = useQuery({
    queryKey: ["agenda-health"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente.");
      return getAgendaHealth({ data: { accessToken } });
    },
    refetchInterval: 5 * 60_000,
  });

  const health = healthQuery.data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <HeartPulse className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">Monitoramento</span>
            </div>
            <h1 className="text-3xl font-bold">Saúde da Agenda</h1>
            <p className="mt-1 max-w-3xl text-muted-foreground">
              Diagnóstico automático de eventos, WhatsApp, feeds e provedores de IA. A tela atualiza sozinha a cada 5 minutos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {health ? statusBadge(health.overallStatus) : null}
            <Button variant="outline" onClick={() => void healthQuery.refetch()} disabled={healthQuery.isFetching}>
              {healthQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Atualizar
            </Button>
          </div>
        </div>

        {healthQuery.isLoading ? (
          <Card>
            <CardContent className="flex min-h-52 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analisando a saúde da agenda...
            </CardContent>
          </Card>
        ) : healthQuery.isError ? (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" />Não foi possível gerar o diagnóstico</CardTitle>
              <CardDescription>{healthQuery.error instanceof Error ? healthQuery.error.message : "Falha desconhecida."}</CardDescription>
            </CardHeader>
          </Card>
        ) : health ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Estado geral</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    {health.overallStatus === "healthy" ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : health.overallStatus === "attention" ? <AlertTriangle className="h-6 w-6 text-amber-500" /> : <ShieldAlert className="h-6 w-6 text-destructive" />}
                    {health.overallStatus === "healthy" ? "Tudo certo" : health.overallStatus === "attention" ? "Requer atenção" : "Ação necessária"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{health.summary.activeEventsChecked} eventos ativos analisados</CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Alertas encontrados</CardDescription>
                  <CardTitle className="text-2xl">{health.summary.totalIssues}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{health.summary.criticalCount} críticos · {health.summary.warningCount} de atenção</CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>IA nas últimas 24h</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-2xl"><Bot className="h-6 w-6" />{health.summary.aiRunSuccessRate == null ? "—" : `${health.summary.aiRunSuccessRate}%`}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{health.summary.aiSuccessfulRuns24h}/{health.summary.aiRuns24h} processamentos concluídos com sucesso</CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Feeds ativos</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-2xl"><Rss className="h-6 w-6" />{health.summary.activeFeeds}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{health.summary.feedsNeedingAttention} precisam de atenção</CardContent>
              </Card>
            </div>

            {!health.telemetry.available ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                <strong>Telemetria de IA indisponível:</strong> {health.telemetry.error || "a tabela de observabilidade ainda não respondeu."} O restante do diagnóstico continua funcionando.
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Alertas encontrados</CardTitle>
                  <CardDescription>Prioridade automática para o que merece revisão primeiro.</CardDescription>
                </CardHeader>
                <CardContent>
                  {health.issues.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />Nenhuma anomalia detectada no recorte analisado.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {health.issues.slice(0, 24).map((issue) => (
                        <div key={issue.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {severityBadge(issue.severity as Severity)}
                              <span className="font-semibold">{issue.title}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{issue.detail}</p>
                            {issue.occurredAt ? <p className="text-xs text-muted-foreground"><Clock3 className="mr-1 inline h-3 w-3" />{formatDateTime(issue.occurredAt)}</p> : null}
                          </div>
                          <Button asChild variant="outline" size="sm" className="shrink-0">
                            <a href={issue.actionPath}>Ver origem</a>
                          </Button>
                        </div>
                      ))}
                      {health.issues.length > 24 ? <p className="pt-2 text-center text-xs text-muted-foreground">Mostrando os 24 alertas de maior prioridade entre {health.issues.length} retornados.</p> : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Atalhos de correção</CardTitle>
                    <CardDescription>Acesso direto às áreas que resolvem a maior parte dos alertas.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    <Button asChild variant="outline" className="justify-start"><a href="/review">Revisar interpretações</a></Button>
                    <Button asChild variant="outline" className="justify-start"><a href="/feeds">Conferir fontes e feeds</a></Button>
                    <Button asChild variant="outline" className="justify-start"><a href="/logs">Ver logs do WhatsApp</a></Button>
                    <Button asChild variant="outline" className="justify-start"><a href="/published">Conferir publicados</a></Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Resumo técnico</CardTitle>
                    <CardDescription>Último diagnóstico: {formatDateTime(health.generatedAt)}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Mensagens presas</span><strong>{health.summary.stuckMessages}</strong></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Falhas completas de IA</span><strong>{health.summary.aiFailedRuns24h}</strong></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Alertas informativos</span><strong>{health.summary.infoCount}</strong></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Feeds com atenção</span><strong>{health.summary.feedsNeedingAttention}</strong></div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Provedores de IA — últimas 24 horas</CardTitle>
                <CardDescription>Taxa de sucesso por tentativa, latência média, uso de fallback e retries.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Provedor</TableHead><TableHead>Tentativas</TableHead><TableHead>Sucesso</TableHead><TableHead>Erros</TableHead><TableHead>Latência média</TableHead><TableHead>Fallbacks</TableHead><TableHead>Retries</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {health.telemetry.providers.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Ainda não há tentativas registradas nas últimas 24 horas.</TableCell></TableRow>
                      ) : health.telemetry.providers.map((provider) => (
                        <TableRow key={provider.provider}>
                          <TableCell className="font-medium capitalize">{provider.provider}</TableCell>
                          <TableCell>{provider.attempts}</TableCell>
                          <TableCell><Badge variant={provider.successRate >= 80 ? "secondary" : "destructive"}>{provider.successRate}%</Badge></TableCell>
                          <TableCell>{provider.errors}</TableCell>
                          <TableCell>{formatDuration(provider.averageDurationMs)}</TableCell>
                          <TableCell>{provider.fallbackAttempts}</TableCell>
                          <TableCell>{provider.retryAttempts}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Rss className="h-5 w-5" />Saúde das fontes</CardTitle>
                <CardDescription>Como o cron roda a cada 3 horas, mais de 6 horas sem sincronização já merece atenção.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Fonte</TableHead><TableHead>Tipo</TableHead><TableHead>Estado</TableHead><TableHead>Última sincronização</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Origem</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {health.feeds.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhuma fonte ativa encontrada.</TableCell></TableRow>
                      ) : health.feeds.map((feed) => (
                        <TableRow key={feed.id}>
                          <TableCell className="font-medium">{feed.name}</TableCell>
                          <TableCell className="capitalize">{feed.sourceType}</TableCell>
                          <TableCell>{feedBadge(feed.state)}</TableCell>
                          <TableCell>{formatDateTime(feed.lastSyncedAt)}</TableCell>
                          <TableCell>{feed.lastSyncStatus || "—"}</TableCell>
                          <TableCell className="text-right"><Button asChild variant="ghost" size="sm"><a href={feed.url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Abrir</a></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {health.telemetry.recentFailures.length ? (
              <Card>
                <CardHeader>
                  <CardTitle>Falhas recentes dos provedores</CardTitle>
                  <CardDescription>Uma falha aqui não significa necessariamente falha do evento: o roteador pode ter seguido para outro provedor.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {health.telemetry.recentFailures.map((failure) => (
                    <div key={failure.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{failure.provider}</Badge><span className="font-medium">{failure.label}</span></div>
                        <span className="text-xs text-muted-foreground">{formatDateTime(failure.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{failure.errorMessage}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{failure.sourceMode} · {formatDuration(failure.durationMs)}{failure.retryUsed ? " · retry usado" : ""}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
