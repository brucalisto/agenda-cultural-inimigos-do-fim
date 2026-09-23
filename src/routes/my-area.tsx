import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Heart,
  Loader2,
  Plus,
  Store,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";

import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/my-area")({ component: MyAreaPage });

type Profile = Tables<"community_profiles">;
type Submission = Tables<"community_event_submissions">;
type Listing = Tables<"marketplace_listings">;

type DashboardData = {
  profile: Profile | null;
  events: Submission[];
  listings: Listing[];
  favoriteCount: number;
  unreadCount: number;
  followingCount: number;
};

const emptyDashboard: DashboardData = {
  profile: null,
  events: [],
  listings: [],
  favoriteCount: 0,
  unreadCount: 0,
  followingCount: 0,
};

const eventLabels: Record<string, string> = {
  draft: "Rascunho",
  processing: "Organizando",
  pending_review: "Em revisão",
  needs_information: "Faltam informações",
  changes_requested: "Ajustes solicitados",
  approved: "Aprovado",
  published: "Publicado",
  rejected: "Não aprovado",
};

function getProfileProgress(profile: Profile | null) {
  if (!profile) return 0;
  const checks = [
    profile.display_name || profile.artistic_name,
    profile.avatar_url,
    profile.short_bio || profile.full_bio,
    profile.city,
    profile.categories.length || profile.skills.length,
    profile.instagram || profile.website,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function MyAreaPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);

  useEffect(() => {
    async function loadDashboard() {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth.user?.id ?? null;
      setUserId(id);
      if (!id) {
        setLoading(false);
        return;
      }

      const [
        profileResult,
        eventsResult,
        listingsResult,
        favoritesResult,
        notificationsResult,
        followingResult,
      ] = await Promise.all([
        supabase.from("community_profiles").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("community_event_submissions")
          .select("*")
          .eq("author_id", id)
          .order("updated_at", { ascending: false })
          .limit(3),
        supabase
          .from("marketplace_listings")
          .select("*")
          .eq("owner_id", id)
          .order("updated_at", { ascending: false })
          .limit(3),
        supabase
          .from("marketplace_favorites")
          .select("listing_id", { count: "exact", head: true })
          .eq("user_id", id),
        supabase
          .from("community_notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", id)
          .is("read_at", null),
        supabase
          .from("community_profile_follows")
          .select("followed_id", { count: "exact", head: true })
          .eq("follower_id", id),
      ]);

      setDashboard({
        profile: profileResult.data,
        events: eventsResult.data ?? [],
        listings: listingsResult.data ?? [],
        favoriteCount: favoritesResult.count ?? 0,
        unreadCount: notificationsResult.count ?? 0,
        followingCount: followingResult.count ?? 0,
      });
      setLoading(false);
    }

    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fffaf3] text-[#9f3d25]">
        <Loader2 className="size-9 animate-spin" aria-label="Carregando sua área" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
        <EcosystemHeader />
        <main className="mx-auto grid min-h-[65vh] max-w-2xl place-items-center px-4 py-12">
          <section className="rounded-3xl border border-[#ead9ca] bg-white p-8 text-center shadow-sm">
            <UserRound className="mx-auto size-12 text-[#9f3d25]" />
            <h1 className="mt-4 text-3xl font-black">Sua comunidade começa aqui</h1>
            <p className="mt-3 text-[#755348]">
              Entre para acompanhar eventos, trabalhos, favoritos e mensagens em um só lugar.
            </p>
            <Link
              to="/join"
              className="mt-6 inline-block rounded-xl bg-[#9f3d25] px-6 py-3 font-bold text-white"
            >
              Entrar ou criar perfil
            </Link>
          </section>
        </main>
        <EcosystemFooter />
      </div>
    );
  }

  const profileProgress = getProfileProgress(dashboard.profile);
  const displayName = dashboard.profile?.artistic_name || dashboard.profile?.display_name || "Olá!";
  const pendingEvents = dashboard.events.filter((item) =>
    ["pending_review", "needs_information", "changes_requested"].includes(item.status),
  ).length;
  const pendingListings = dashboard.listings.filter((item) =>
    ["pending", "rejected"].includes(item.status),
  ).length;

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main>
        <section className="bg-[#351810] px-4 py-10 text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {dashboard.profile?.avatar_url ? (
                <img
                  src={dashboard.profile.avatar_url}
                  alt=""
                  className="size-20 rounded-3xl border-2 border-white/20 object-cover"
                />
              ) : (
                <span className="grid size-20 place-items-center rounded-3xl bg-white/10">
                  <UserRound className="size-9" />
                </span>
              )}
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-[#ffc857]">
                  Minha área
                </p>
                <h1 className="mt-1 text-3xl font-black md:text-4xl">{displayName}</h1>
                <p className="mt-1 text-[#f1d5c7]">Tudo o que você movimenta na comunidade.</p>
              </div>
            </div>
            <Link
              to="/my-profile"
              className="rounded-xl border border-white/30 px-4 py-3 text-sm font-bold hover:bg-white/10"
            >
              Editar meu perfil
            </Link>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-10">
          {profileProgress < 100 ? (
            <section className="rounded-3xl border border-[#ead9ca] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">Complete seu perfil cultural</h2>
                  <p className="mt-1 text-sm text-[#755348]">
                    Um perfil completo ajuda outras pessoas a conhecerem e encontrarem seu trabalho.
                  </p>
                </div>
                <strong className="text-2xl text-[#9f3d25]">{profileProgress}%</strong>
              </div>
              <div
                className="mt-4 h-3 overflow-hidden rounded-full bg-[#f4e6d7]"
                role="progressbar"
                aria-label="Perfil preenchido"
                aria-valuenow={profileProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-[#d86132]"
                  style={{ width: `${profileProgress}%` }}
                />
              </div>
              <Link to="/my-profile" className="mt-4 inline-block font-bold text-[#9f3d25]">
                Continuar meu perfil →
              </Link>
            </section>
          ) : null}

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Resumo">
            <SummaryCard
              icon={CalendarDays}
              value={dashboard.events.length}
              label="Eventos recentes"
              to="/my-events"
            />
            <SummaryCard
              icon={Store}
              value={dashboard.listings.length}
              label="Anúncios recentes"
              to="/my-listings"
            />
            <SummaryCard
              icon={Heart}
              value={dashboard.favoriteCount}
              label="Favoritos salvos"
              to="/marketplace"
            />
            <SummaryCard
              icon={Bell}
              value={dashboard.unreadCount}
              label="Notificações novas"
              to="/notifications"
            />
            <SummaryCard
              icon={UserPlus}
              value={dashboard.followingCount}
              label="Perfis acompanhados"
              to="/following"
            />
          </section>

          {pendingEvents > 0 || pendingListings > 0 ? (
            <aside className="mt-6 rounded-2xl bg-[#fff0cf] p-5 text-[#68451c]">
              <strong>Atenção necessária</strong>
              <p className="mt-1 text-sm">
                {pendingEvents > 0
                  ? `${pendingEvents} evento(s) aguardando revisão ou ajustes. `
                  : ""}
                {pendingListings > 0
                  ? `${pendingListings} anúncio(s) aguardando revisão ou ajustes.`
                  : ""}
              </p>
            </aside>
          ) : null}

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <ActivityPanel
              title="Meus eventos"
              empty="Você ainda não enviou nenhum evento."
              actionLabel="Divulgar evento"
              actionTo="/submit-event"
              allTo="/my-events"
            >
              {dashboard.events.map((item) => (
                <Link
                  key={item.id}
                  to="/my-events"
                  className="flex items-center justify-between gap-4 border-t border-[#f0e3d7] py-4 first:border-0"
                >
                  <span className="min-w-0">
                    <strong className="block truncate">{item.title || "Evento sem título"}</strong>
                    <small className="text-[#755348]">
                      {item.event_date
                        ? new Date(`${item.event_date}T12:00:00`).toLocaleDateString("pt-BR")
                        : "Data não informada"}
                    </small>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#f4e6d7] px-3 py-1 text-xs font-bold text-[#755348]">
                    {eventLabels[item.status] || item.status}
                  </span>
                </Link>
              ))}
            </ActivityPanel>

            <ActivityPanel
              title="Meus anúncios"
              empty="Você ainda não divulgou nenhum trabalho."
              actionLabel="Criar anúncio"
              actionTo="/marketplace-new"
              allTo="/my-listings"
            >
              {dashboard.listings.map((item) => (
                <Link
                  key={item.id}
                  to="/my-listings"
                  className="flex items-center justify-between gap-4 border-t border-[#f0e3d7] py-4 first:border-0"
                >
                  <span className="min-w-0">
                    <strong className="block truncate">{item.title}</strong>
                    <small className="text-[#755348]">{item.category || "Sem categoria"}</small>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#f4e6d7] px-3 py-1 text-xs font-bold text-[#755348]">
                    {item.status === "published"
                      ? "Publicado"
                      : item.status === "pending"
                        ? "Em revisão"
                        : "Acompanhar"}
                  </span>
                </Link>
              ))}
            </ActivityPanel>
          </section>
        </div>
      </main>
      <EcosystemFooter />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  value,
  label,
  to,
}: {
  icon: typeof CalendarDays;
  value: number;
  label: string;
  to: "/my-events" | "/my-listings" | "/marketplace" | "/notifications" | "/following";
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-[#ead9ca] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <Icon className="size-6 text-[#9f3d25]" />
      <strong className="mt-4 block text-3xl">{value}</strong>
      <span className="text-sm text-[#755348]">{label}</span>
    </Link>
  );
}

function ActivityPanel({
  title,
  empty,
  actionLabel,
  actionTo,
  allTo,
  children,
}: {
  title: string;
  empty: string;
  actionLabel: string;
  actionTo: "/submit-event" | "/marketplace-new";
  allTo: "/my-events" | "/my-listings";
  children: React.ReactNode;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="rounded-3xl border border-[#ead9ca] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black">{title}</h2>
        <Link to={allTo} className="inline-flex items-center text-sm font-bold text-[#9f3d25]">
          Ver todos <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="mt-4">
        {hasItems ? children : <p className="py-6 text-sm text-[#755348]">{empty}</p>}
      </div>
      <Link
        to={actionTo}
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#9f3d25] px-4 py-2.5 text-sm font-bold text-white"
      >
        <Plus className="size-4" />
        {actionLabel}
      </Link>
    </div>
  );
}
