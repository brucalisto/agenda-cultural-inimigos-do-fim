import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  Flag,
  Loader2,
  RefreshCw,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/community-moderation")({ component: CommunityModeration });
type EventSubmission = Tables<"community_event_submissions">;
type Listing = Tables<"marketplace_listings">;
type Report = Tables<"community_reports">;

function CommunityModeration() {
  const [events, setEvents] = useState<EventSubmission[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      supabase
        .from("community_event_submissions")
        .select("*")
        .in("status", ["pending_review", "changes_requested"])
        .order("created_at", { ascending: true }),
      supabase
        .from("marketplace_listings")
        .select("*")
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: true }),
      supabase
        .from("community_reports")
        .select("*")
        .in("status", ["pending", "reviewing"])
        .order("created_at", { ascending: true }),
    ]);
    setEvents(a.data ?? []);
    setListings(b.data ?? []);
    setReports(c.data ?? []);
    setLoading(false);
    if (a.error || b.error || c.error)
      toast.error(a.error?.message || b.error?.message || c.error?.message);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function eventDecision(id: string, approve: boolean) {
    setBusy(id);
    if (approve) {
      const { data, error } = await supabase.rpc("publish_community_event", { submission_id: id });
      if (error) toast.error(error.message);
      else if (!data) toast.warning("O envio foi marcado como possível duplicidade.");
      else toast.success("Evento publicado na agenda.");
    } else {
      const { error } = await supabase
        .from("community_event_submissions")
        .update({
          status: "rejected",
          moderation_notes: "Conteúdo não aprovado pela moderação.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) toast.error(error.message);
      else toast.success("Evento recusado.");
    }
    setBusy("");
    await load();
  }

  async function listingDecision(id: string, decision: "published" | "rejected") {
    setBusy(id);
    const { error } = await supabase.rpc("moderate_marketplace_listing", {
      listing_id: id,
      decision,
      notes:
        decision === "published" ? "Anúncio aprovado." : "Anúncio não aprovado pela moderação.",
    });
    if (error) toast.error(error.message);
    else toast.success(decision === "published" ? "Anúncio publicado." : "Anúncio recusado.");
    setBusy("");
    await load();
  }

  async function reportDecision(id: string, decision: "dismissed" | "remove_content") {
    setBusy(id);
    const { error } = await supabase.rpc("moderate_community_report", {
      report_id: id,
      decision,
      notes:
        decision === "remove_content"
          ? "Conteúdo removido após análise."
          : "Denúncia analisada sem violação confirmada.",
    });
    if (error) toast.error(error.message);
    else
      toast.success(
        decision === "remove_content"
          ? "Conteúdo removido e denúncia resolvida."
          : "Denúncia encerrada.",
      );
    setBusy("");
    await load();
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Moderação da comunidade</h1>
            <p className="text-muted-foreground">
              Revise denúncias, eventos enviados e anúncios do marketplace.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border p-2"
            aria-label="Atualizar fila"
          >
            <RefreshCw className={`size-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Flag className="size-5 text-rose-600" />
            <h2 className="text-xl font-bold">Denúncias pendentes</h2>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
              {reports.length}
            </span>
          </div>
          <div className="grid gap-4">
            {reports.map((item) => (
              <article key={item.id} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 md:flex-row">
                  <div>
                    <span className="text-xs font-bold uppercase text-rose-700">
                      {item.entity_type === "post" ? "Publicação" : "Comentário"} •{" "}
                      {item.reason.replaceAll("_", " ")}
                    </span>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Recebida em {new Date(item.created_at).toLocaleString("pt-BR")}
                    </p>
                    {item.details ? <p className="mt-3 text-sm">{item.details}</p> : null}
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      Conteúdo: {item.entity_id}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => void reportDecision(item.id, "dismissed")}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold"
                    >
                      <Check className="size-4" />
                      Encerrar
                    </button>
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => void reportDecision(item.id, "remove_content")}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-700 px-3 text-sm font-semibold text-white"
                    >
                      {busy === item.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      Remover conteúdo
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!loading && !reports.length ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                Nenhuma denúncia aguardando análise.
              </p>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="size-5 text-orange-600" />
            <h2 className="text-xl font-bold">Eventos pendentes</h2>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-800">
              {events.length}
            </span>
          </div>
          <div className="grid gap-4">
            {events.map((item) => (
              <article key={item.id} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 md:flex-row">
                  <div>
                    <span className="text-xs font-bold uppercase text-orange-700">
                      {item.status === "changes_requested"
                        ? "Possível duplicidade"
                        : "Aguardando revisão"}
                    </span>
                    <h3 className="mt-1 text-lg font-bold">{item.title || "Evento sem título"}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[item.event_date, item.start_time, item.venue_name, item.city]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                    <p className="mt-3 max-w-3xl text-sm">
                      {item.description || item.source_text || "Sem descrição."}
                    </p>
                    {item.price_info ? (
                      <p className="mt-2 text-sm font-semibold">{item.price_info}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => void eventDecision(item.id, false)}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700"
                    >
                      <X className="size-4" />
                      Recusar
                    </button>
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => void eventDecision(item.id, true)}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white"
                    >
                      {busy === item.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Aprovar
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!loading && !events.length ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                Nenhum evento aguardando revisão.
              </p>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <ShoppingBag className="size-5 text-purple-600" />
            <h2 className="text-xl font-bold">Anúncios pendentes</h2>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">
              {listings.length}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {listings.map((item) => (
              <article key={item.id} className="rounded-xl border bg-card p-5 shadow-sm">
                <span className="text-xs font-bold uppercase text-purple-700">
                  {item.listing_type} • {item.category}
                </span>
                <h3 className="mt-2 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                <p className="mt-3 text-sm">
                  {[item.price_label, item.city].filter(Boolean).join(" • ")}
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void listingDecision(item.id, "rejected")}
                    className="flex-1 rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-700"
                  >
                    Recusar
                  </button>
                  <button
                    type="button"
                    onClick={() => void listingDecision(item.id, "published")}
                    className="flex-1 rounded-lg bg-emerald-700 py-2 text-sm font-semibold text-white"
                  >
                    Publicar
                  </button>
                </div>
              </article>
            ))}
            {!loading && !listings.length ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground md:col-span-2">
                Nenhum anúncio aguardando revisão.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
