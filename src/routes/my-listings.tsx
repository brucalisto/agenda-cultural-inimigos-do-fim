import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Eye, Loader2, Pause, Pencil, Plus, RefreshCw, Store } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/my-listings")({ component: MyListingsPage });
type Listing = Tables<"marketplace_listings">;

const statusLabels: Record<string, { label: string; className: string; explanation: string }> = {
  draft: {
    label: "Rascunho",
    className: "bg-slate-100 text-slate-700",
    explanation: "Ainda não foi enviado para revisão.",
  },
  pending: {
    label: "Em revisão",
    className: "bg-amber-100 text-amber-800",
    explanation: "A equipe está analisando este anúncio.",
  },
  published: {
    label: "Publicado",
    className: "bg-emerald-100 text-emerald-800",
    explanation: "Já está visível no marketplace.",
  },
  rejected: {
    label: "Ajustes necessários",
    className: "bg-rose-100 text-rose-800",
    explanation: "Confira a observação, edite e envie novamente.",
  },
  paused: {
    label: "Pausado",
    className: "bg-slate-100 text-slate-700",
    explanation: "Não aparece publicamente e pode ser editado.",
  },
};

function MyListingsPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const id = authData.user?.id ?? null;
    setUserId(id);
    if (!id) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("marketplace_listings")
      .select("*")
      .eq("owner_id", id)
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(id: string, operation: "pause" | "submit") {
    setBusy(id);
    const { error } = await supabase.rpc("manage_own_marketplace_listing", {
      target_listing_id: id,
      operation,
    });
    if (error) toast.error(error.message);
    else
      toast.success(operation === "pause" ? "Anúncio pausado." : "Anúncio reenviado para revisão.");
    setBusy("");
    await load();
  }

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-[#9f3d25]">
              Marketplace
            </p>
            <h1 className="mt-1 text-4xl font-black">Meus anúncios</h1>
            <p className="mt-2 text-[#755348]">
              Acompanhe a revisão e mantenha sua vitrine atualizada.
            </p>
          </div>
          <Link
            to="/marketplace-new"
            className="inline-flex items-center gap-2 rounded-xl bg-[#9f3d25] px-4 py-3 font-bold text-white"
          >
            <Plus className="size-4" />
            Novo anúncio
          </Link>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <Loader2 className="size-8 animate-spin text-[#9f3d25]" />
          </div>
        ) : !userId ? (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm">
            <Store className="mx-auto size-9 text-[#9f3d25]" />
            <p className="mt-3">Entre na comunidade para administrar seus anúncios.</p>
            <Link to="/join" className="mt-4 inline-block font-bold text-[#9f3d25]">
              Entrar na comunidade
            </Link>
          </div>
        ) : items.length ? (
          <section className="mt-8 grid gap-5" aria-label="Seus anúncios">
            {items.map((item) => {
              const status = statusLabels[item.status] ?? {
                label: item.status,
                className: "bg-slate-100",
                explanation: "",
              };
              const canEdit = ["draft", "pending", "rejected", "paused"].includes(item.status);
              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-[#ead9ca] bg-white shadow-sm"
                >
                  <div className="grid md:grid-cols-[13rem_1fr]">
                    {item.cover_url ? (
                      <img
                        src={item.cover_url}
                        alt=""
                        className="h-full min-h-48 w-full object-cover"
                      />
                    ) : (
                      <div className="grid min-h-48 place-items-center bg-[#f4e6d7]">
                        <Store className="size-9 text-[#9f3d25]" />
                      </div>
                    )}
                    <div className="p-5 md:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-black ${status.className}`}
                          >
                            {status.label}
                          </span>
                          <h2 className="mt-3 text-2xl font-black">{item.title}</h2>
                          <p className="mt-1 text-sm text-[#755348]">{status.explanation}</p>
                        </div>
                        <span className="text-xs text-[#8a5c4d]">
                          Atualizado em {new Date(item.updated_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      {item.moderation_notes ? (
                        <div className="mt-4 flex gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">
                          <AlertCircle className="mt-0.5 size-5 shrink-0" />
                          <div>
                            <strong>Observação da moderação</strong>
                            <p className="mt-1">{item.moderation_notes}</p>
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-5 flex flex-wrap gap-2">
                        {item.status === "published" ? (
                          <>
                            <Link
                              to="/marketplace/$listingId"
                              params={{ listingId: item.id }}
                              className="inline-flex items-center gap-2 rounded-xl border border-[#d8bca8] px-4 py-2 text-sm font-bold"
                            >
                              <Eye className="size-4" />
                              Ver publicado
                            </Link>
                            <button
                              type="button"
                              disabled={busy === item.id}
                              onClick={() => void changeStatus(item.id, "pause")}
                              className="inline-flex items-center gap-2 rounded-xl border border-[#9f3d25] px-4 py-2 text-sm font-bold text-[#9f3d25]"
                            >
                              <Pause className="size-4" />
                              Pausar
                            </button>
                          </>
                        ) : null}
                        {canEdit ? (
                          <Link
                            to="/marketplace-edit/$listingId"
                            params={{ listingId: item.id }}
                            className="inline-flex items-center gap-2 rounded-xl border border-[#d8bca8] px-4 py-2 text-sm font-bold"
                          >
                            <Pencil className="size-4" />
                            Editar
                          </Link>
                        ) : null}
                        {["draft", "rejected", "paused"].includes(item.status) ? (
                          <button
                            type="button"
                            disabled={busy === item.id}
                            onClick={() => void changeStatus(item.id, "submit")}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#9f3d25] px-4 py-2 text-sm font-bold text-white"
                          >
                            {busy === item.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <RefreshCw className="size-4" />
                            )}
                            Enviar para revisão
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="mt-8 rounded-3xl border-2 border-dashed border-[#ead9ca] p-10 text-center">
            <Store className="mx-auto size-9 text-[#9f3d25]" />
            <h2 className="mt-3 text-2xl font-black">Sua vitrine começa aqui</h2>
            <p className="mt-2 text-[#755348]">
              Cadastre seu trabalho, serviço, aula ou experiência.
            </p>
            <Link
              to="/marketplace-new"
              className="mt-5 inline-block rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white"
            >
              Criar primeiro anúncio
            </Link>
          </div>
        )}
      </main>
      <EcosystemFooter />
    </div>
  );
}
