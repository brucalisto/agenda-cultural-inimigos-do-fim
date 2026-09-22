import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CheckCheck, Heart, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/notifications")({ component: NotificationsPage });

type Notification = Tables<"community_notifications">;

const icons = {
  comment: MessageCircle,
  reaction: Heart,
  report_resolved: ShieldCheck,
} as const;

function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const id = authData.user?.id ?? null;
    setUserId(id);
    if (!id) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("community_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAllRead() {
    const { error } = await supabase.rpc("mark_community_notifications_read");
    if (error) toast.error(error.message);
    else
      setItems((current) =>
        current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })),
      );
  }

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-[#9f3d25]">
              Comunidade
            </p>
            <h1 className="mt-1 text-4xl font-black">Notificações</h1>
          </div>
          {userId && items.some((item) => !item.read_at) ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#9f3d25] px-4 py-2 text-sm font-bold text-[#9f3d25]"
            >
              <CheckCheck className="size-4" /> Marcar tudo como lido
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <Loader2 className="size-8 animate-spin text-[#9f3d25]" />
          </div>
        ) : !userId ? (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm">
            <Bell className="mx-auto size-9 text-[#9f3d25]" />
            <p className="mt-3">Entre na sua conta para ver suas notificações.</p>
            <Link to="/join" className="mt-4 inline-block font-bold text-[#9f3d25]">
              Entrar na comunidade
            </Link>
          </div>
        ) : items.length ? (
          <section className="mt-8 space-y-3" aria-label="Suas notificações">
            {items.map((item) => {
              const Icon = icons[item.kind as keyof typeof icons] ?? Bell;
              return (
                <article
                  key={item.id}
                  className={`flex gap-4 rounded-2xl border p-4 ${item.read_at ? "border-[#ead9ca] bg-white" : "border-[#d8a88f] bg-[#fff0e6]"}`}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f4e6d7] text-[#9f3d25]">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-bold">{item.message}</p>
                    <p className="mt-1 text-xs text-[#8a5c4d]">
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="mt-8 rounded-3xl border-2 border-dashed border-[#ead9ca] p-10 text-center text-[#755348]">
            <Bell className="mx-auto size-9 text-[#9f3d25]" />
            <p className="mt-3">Nenhuma notificação por enquanto.</p>
          </div>
        )}
      </main>
      <EcosystemFooter />
    </div>
  );
}
