import { createFileRoute } from "@tanstack/react-router";
import {
  MessageSquare,
  Brain,
  Clock,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Zap,
  Bot,
  Webhook,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const statDefinitions = [
  { label: "Mensagens hoje", key: "today", icon: MessageSquare, color: "text-blue-500" },
  { label: "Conteúdos processados", key: "processed", icon: Brain, color: "text-purple-500" },
  { label: "Pendentes de revisão", key: "pending", icon: Clock, color: "text-amber-500" },
  { label: "Publicados", key: "published", icon: CheckCircle2, color: "text-emerald-500" },
  { label: "Ignorados", key: "ignored", icon: ShieldAlert, color: "text-slate-500" },
  { label: "Erros nas últimas 24h", key: "errors", icon: AlertTriangle, color: "text-red-500" },
] as const;

type RecentMessage = {
  received_at: string | null;
  message_type: string | null;
};

const messageTypeColors: Record<string, string> = {
  Texto: "oklch(0.646 0.222 41.116)",
  Imagem: "oklch(0.6 0.118 184.704)",
  Áudio: "oklch(0.398 0.07 227.392)",
  Vídeo: "oklch(0.828 0.189 84.429)",
  Outros: "oklch(0.769 0.188 70.08)",
};

function readableMessageType(value: string | null) {
  if (/image/i.test(value || "")) return "Imagem";
  if (/audio/i.test(value || "")) return "Áudio";
  if (/video/i.test(value || "")) return "Vídeo";
  if (/text|conversation|extended/i.test(value || "")) return "Texto";
  return "Outros";
}

function formatTimestamp(value: string | null) {
  return value
    ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "Ainda não registrado";
}

function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [lastWebhook, setLastWebhook] = useState<string | null>(null);
  const [lastInterpretation, setLastInterpretation] = useState<string | null>(null);
  const [lastFeedSync, setLastFeedSync] = useState<string | null>(null);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);

  const activityData = useMemo(() => {
    const now = Date.now();
    const bucketSize = 3 * 60 * 60 * 1000;
    return Array.from({ length: 8 }, (_, index) => {
      const start = now - (8 - index) * bucketSize;
      const end = start + bucketSize;
      return {
        time: new Date(start).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        count: recentMessages.filter((message) => {
          const received = message.received_at ? new Date(message.received_at).getTime() : 0;
          return received >= start && received < end;
        }).length,
      };
    });
  }, [recentMessages]);

  const distributionData = useMemo(() => {
    const countsByType = new Map<string, number>();
    for (const message of recentMessages) {
      const type = readableMessageType(message.message_type);
      countsByType.set(type, (countsByType.get(type) || 0) + 1);
    }
    return [...countsByType].map(([name, value]) => ({
      name,
      value,
      color: messageTypeColors[name] || messageTypeColors.Outros,
    }));
  }, [recentMessages]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session) {
        window.location.href = "/auth";
      } else {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        Promise.all([
          supabase
            .from("whatsapp_messages")
            .select("*", { count: "exact", head: true })
            .neq("message_type", "reactionMessage")
            .gte("received_at", start.toISOString()),
          supabase
            .from("whatsapp_messages")
            .select("*", { count: "exact", head: true })
            .neq("message_type", "reactionMessage")
            .in("processing_status", ["interpretado", "necessita_revisao"]),
          supabase
            .from("interpreted_contents")
            .select("*", { count: "exact", head: true })
            .in("review_status", ["pendente", "necessita_revisao"]),
          supabase
            .from("interpreted_contents")
            .select("*", { count: "exact", head: true })
            .eq("review_status", "publicado"),
          supabase
            .from("whatsapp_messages")
            .select("*", { count: "exact", head: true })
            .neq("message_type", "reactionMessage")
            .eq("processing_status", "ignorado"),
          supabase
            .from("whatsapp_messages")
            .select("*", { count: "exact", head: true })
            .neq("message_type", "reactionMessage")
            .eq("processing_status", "erro")
            .gte("received_at", last24Hours),
          supabase
            .from("webhook_events")
            .select("received_at")
            .order("received_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("whatsapp_messages")
            .select("received_at,message_type")
            .neq("message_type", "reactionMessage")
            .gte("received_at", last24Hours)
            .order("received_at", { ascending: true }),
          supabase
            .from("interpreted_contents")
            .select("updated_at")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("publication_destinations")
            .select("field_mapping")
            .eq("provider", "feed_source"),
        ]).then(
          ([
            today,
            processed,
            pending,
            published,
            ignored,
            errors,
            last,
            recent,
            interpreted,
            feeds,
          ]) => {
            setCounts({
              today: today.count ?? 0,
              processed: processed.count ?? 0,
              pending: pending.count ?? 0,
              published: published.count ?? 0,
              ignored: ignored.count ?? 0,
              errors: errors.count ?? 0,
            });
            setLastWebhook(last.data?.received_at ?? null);
            setRecentMessages((recent.data || []) as RecentMessage[]);
            setLastInterpretation(interpreted.data?.updated_at ?? null);
            const feedDates = (feeds.data || [])
              .map((feed) => {
                const metadata = feed.field_mapping;
                if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
                const value = (metadata as { lastSyncedAt?: unknown }).lastSyncedAt;
                return typeof value === "string" ? value : null;
              })
              .filter((value): value is string => Boolean(value))
              .sort((a, b) => b.localeCompare(a));
            setLastFeedSync(feedDates[0] || null);
          },
        );
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        window.location.href = "/auth";
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;
  if (!session) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground">
            Monitoramento em tempo real dos seus grupos do WhatsApp.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statDefinitions.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <h3 className="mt-1 text-2xl font-bold">{counts[stat.key] ?? "—"}</h3>
                </div>
                <div className={`rounded-lg bg-secondary p-2 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm md:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Última mensagem recebida
            </p>
            <p className="mt-1 font-semibold">{formatTimestamp(lastWebhook)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Último evento interpretado
            </p>
            <p className="mt-1 font-semibold">{formatTimestamp(lastInterpretation)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Última sincronização de feed
            </p>
            <p className="mt-1 font-semibold">{formatTimestamp(lastFeedSync)}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Activity Chart */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Mensagens nas últimas 24 horas</h3>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="oklch(0.929 0.013 255.508 / 0.5)"
                  />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(1 0 0)",
                      borderRadius: "8px",
                      border: "1px solid oklch(0.929 0.013 255.508)",
                    }}
                  />
                  <Bar dataKey="count" fill="oklch(0.208 0.042 265.755)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Content Type Distribution */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Tipos recebidos nas últimas 24 horas</h3>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="h-[300px] w-full">
              {distributionData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {distributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhuma mensagem recebida nesse período.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* API Status Section */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold">Baileys</h3>
              </div>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                Estado
              </p>
              <p className="text-sm">Monitorado pela integração</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-purple-500" />
                <h3 className="font-semibold">Interpretação por IA</h3>
              </div>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                Estado
              </p>
              <p className="text-sm">Groq principal · Gemini em contingência</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Webhook className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold">Último Webhook</h3>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                Recebido em
              </p>
              <p className="text-sm font-mono text-muted-foreground">
                {lastWebhook ? new Date(lastWebhook).toLocaleString("pt-BR") : "Nenhum recebido"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
