import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Heart,
  Loader2,
  Plus,
  ImagePlus,
  Mic,
  Send,
  X,
  Store,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { VoiceTextarea } from "@/components/community/VoiceTextarea";
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
  const [spaces, setSpaces] = useState<Tables<"community_spaces">[]>([]);
  const [postSpaceId, setPostSpaceId] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postImages, setPostImages] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);

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
        spacesResult,
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
        supabase
          .from("community_spaces")
          .select("*")
          .eq("active", true)
          .eq("posting_policy", "members")
          .order("created_at"),
      ]);

      const availableSpaces = spacesResult.data ?? [];
      setSpaces(availableSpaces);
      setPostSpaceId((current) => current || availableSpaces[0]?.id || "");
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

  async function publishCommunityPost() {
    if (!userId || !postSpaceId || !postBody.trim() || posting) return;
    setPosting(true);
    const postId = crypto.randomUUID();
    const uploadedPaths: string[] = [];
    const mediaUrls: string[] = [];
    try {
      for (const image of postImages) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(image.type) || image.size > 8 * 1024 * 1024) {
          throw new Error("Use imagens JPG, PNG ou WebP de até 8 MB.");
        }
        const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
        const path = `${userId}/posts/${postId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("community-public-images")
          .upload(path, image, { contentType: image.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        mediaUrls.push(supabase.storage.from("community-public-images").getPublicUrl(path).data.publicUrl);
      }
      const { error } = await supabase.from("community_posts").insert({
        id: postId,
        space_id: postSpaceId,
        author_id: userId,
        title: postTitle.trim() || null,
        body: postBody.trim(),
        media_urls: mediaUrls,
        status: "published",
      });
      if (error) throw error;
      setPostTitle("");
      setPostBody("");
      setPostImages([]);
      toast.success("Publicação enviada para a comunidade.");
    } catch (cause) {
      if (uploadedPaths.length) await supabase.storage.from("community-public-images").remove(uploadedPaths);
      toast.error(cause instanceof Error ? cause.message : "Não foi possível publicar.");
    } finally {
      setPosting(false);
    }
  }

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

          <section className="mt-6 rounded-3xl border border-[#ead9ca] bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f4e6d7] text-[#9f3d25]"><Send className="size-5" /></span>
              <div>
                <h2 className="text-xl font-black">Publicar na comunidade</h2>
                <p className="mt-1 text-sm text-[#755348]">Escolha um espaço, escreva ou dite sua mensagem, confira a prévia e publique.</p>
              </div>
            </div>
            {spaces.length ? (
              <>
                <label className="mt-5 grid gap-2 text-sm font-bold">
                  Espaço
                  <select value={postSpaceId} onChange={(event) => setPostSpaceId(event.target.value)} className="rounded-xl border border-[#ead9ca] bg-white px-4 py-3 font-normal">
                    {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
                  </select>
                </label>
                <input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} placeholder="Título (opcional)" className="mt-3 w-full rounded-xl border border-[#ead9ca] px-4 py-3 outline-none focus:border-[#9f3d25]" />
                <div className="mt-3">
                  <VoiceTextarea value={postBody} onChange={setPostBody} placeholder="Escreva aqui ou use o microfone..." rows={5} />
                </div>
                {postImages.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {postImages.map((image, index) => (
                      <span key={`${image.name}-${image.lastModified}`} className="inline-flex items-center gap-2 rounded-full bg-[#f4e6d7] px-3 py-2 text-sm">
                        {image.name}
                        <button type="button" onClick={() => setPostImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover ${image.name}`}><X className="size-4" /></button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {postBody.trim() ? (
                  <div className="mt-4 rounded-2xl bg-[#fffaf3] p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#9f3d25]">Prévia</p>
                    {postTitle.trim() ? <strong className="mt-2 block">{postTitle.trim()}</strong> : null}
                    <p className="mt-2 whitespace-pre-line text-sm text-[#755348]">{postBody.trim()}</p>
                    {postImages.length ? <p className="mt-2 text-xs font-bold text-[#9f3d25]">{postImages.length} imagem(ns) anexada(s)</p> : null}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#d8bca8] px-4 py-3 text-sm font-bold text-[#8d321f]">
                    <ImagePlus className="size-4" /> Adicionar imagens
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={posting} onChange={(event) => {
                      const selected = Array.from(event.target.files ?? []);
                      if (selected.some((file) => file.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
                        toast.error("Use imagens JPG, PNG ou WebP de até 8 MB.");
                        event.target.value = "";
                        return;
                      }
                      setPostImages((current) => [...current, ...selected].slice(0, 4));
                      event.target.value = "";
                    }} />
                  </label>
                  <span className="inline-flex items-center gap-2 text-xs text-[#755348]"><Mic className="size-4" /> Texto ou voz</span>
                  <button type="button" disabled={posting || !postSpaceId || !postBody.trim()} onClick={() => void publishCommunityPost()} className="inline-flex items-center gap-2 rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white disabled:opacity-40">
                    {posting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Publicar
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-5 rounded-2xl bg-[#f4e6d7] p-4 text-sm text-[#755348]">Não há espaços abertos para publicação neste momento.</p>
            )}
          </section>

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
