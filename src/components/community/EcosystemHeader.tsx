import { Link } from "@tanstack/react-router";
import { Bell, CalendarDays, Menu, MessageCircle, Store, Users, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

const navigation = [
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/community", label: "Comunidade", icon: Users },
  { to: "/chats", label: "Conversas", icon: MessageCircle },
  { to: "/people", label: "Pessoas", icon: Users },
  { to: "/marketplace", label: "Marketplace", icon: Store },
  { to: "/tools", label: "Ferramentas", icon: Wrench },
] as const;

export function EcosystemHeader() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    async function load() {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      setUserId(id);
      if (!id) return;
      const refresh = async () => {
        const { count } = await supabase
          .from("community_notifications")
          .select("id", { count: "exact", head: true })
          .is("read_at", null);
        setUnread(count ?? 0);
      };
      await refresh();
      channel = supabase
        .channel(`community-notifications-${id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "community_notifications",
            filter: `recipient_id=eq.${id}`,
          },
          () => void refresh(),
        )
        .subscribe();
    }
    void load();
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[#fffaf3]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
        <Link to="/agenda" className="flex items-center gap-3" aria-label="Inimigos do Fim">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#9f3d25] text-lg font-black text-white">
            IF
          </span>
          <span>
            <strong className="block leading-tight text-[#351810]">Inimigos do Fim</strong>
            <small className="text-[#8a5c4d]">Cultura que aproxima</small>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#5b392f] transition hover:bg-[#f4e6d7] hover:text-[#8d321f]"
              activeProps={{ className: "bg-[#f4e6d7] text-[#8d321f]" }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {userId ? (
            <Link
              to="/notifications"
              className="relative grid size-10 place-items-center rounded-xl text-[#5b392f] hover:bg-[#f4e6d7]"
              aria-label={`${unread} notificações não lidas`}
            >
              <Bell className="size-5" />
              {unread ? (
                <span className="absolute right-0 top-0 min-w-5 rounded-full bg-[#9f3d25] px-1 text-center text-xs font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
          ) : null}
          <Link
            to="/submit-event"
            className="rounded-xl border border-[#9f3d25] px-4 py-2 text-sm font-semibold text-[#9f3d25]"
          >
            Divulgar evento
          </Link>
          <Link
            to="/join"
            className="rounded-xl bg-[#9f3d25] px-4 py-2 text-sm font-semibold text-white"
          >
            Entrar
          </Link>
        </div>
        <button
          className="rounded-xl p-2 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Abrir menu"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="border-t bg-[#fffaf3] px-4 py-4 lg:hidden">
          {navigation.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 font-medium text-[#5b392f]"
            >
              {label}
            </Link>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {userId ? (
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="col-span-2 flex items-center justify-between rounded-xl bg-[#f4e6d7] p-3 font-bold text-[#8d321f]"
              >
                <span className="inline-flex items-center gap-2">
                  <Bell className="size-4" /> Notificações
                </span>
                {unread ? (
                  <span className="rounded-full bg-[#9f3d25] px-2 py-0.5 text-xs text-white">
                    {unread}
                  </span>
                ) : null}
              </Link>
            ) : null}
            <Link
              to="/submit-event"
              className="rounded-xl border border-[#9f3d25] p-3 text-center text-sm font-semibold text-[#9f3d25]"
            >
              Divulgar evento
            </Link>
            <Link
              to="/join"
              className="rounded-xl bg-[#9f3d25] p-3 text-center text-sm font-semibold text-white"
            >
              Entrar
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function EcosystemFooter() {
  return (
    <footer className="border-t border-black/5 bg-[#351810] px-4 py-8 text-center text-sm text-[#f7ded1]">
      <strong>Inimigos do Fim</strong>
      <p className="mt-1">Agenda, encontros e economia criativa no mesmo lugar.</p>
    </footer>
  );
}
