import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ImageIcon, Loader2, MapPin, Sparkles, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/people/$profileId")({ component: PublicProfilePage });

type Profile = Pick<
  Tables<"community_profiles">,
  | "id"
  | "display_name"
  | "artistic_name"
  | "profile_type"
  | "short_bio"
  | "full_bio"
  | "city"
  | "avatar_url"
  | "collaboration_interests"
>;
type PortfolioItem = Tables<"portfolio_items">;

function PublicProfilePage() {
  const { profileId } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const currentUserId = auth.user?.id ?? null;
      const [profileResult, portfolioResult, followersResult, followingResult, relationResult] =
        await Promise.all([
          supabase
            .from("community_profiles")
            .select(
              "id,display_name,artistic_name,profile_type,short_bio,full_bio,city,avatar_url,collaboration_interests",
            )
            .eq("id", profileId)
            .eq("visibility", "public")
            .maybeSingle(),
          supabase
            .from("portfolio_items")
            .select("*")
            .eq("profile_id", profileId)
            .eq("is_public", true)
            .order("sort_order", { ascending: true }),
          supabase
            .from("community_profile_follows")
            .select("follower_id", { count: "exact", head: true })
            .eq("followed_id", profileId),
          supabase
            .from("community_profile_follows")
            .select("followed_id", { count: "exact", head: true })
            .eq("follower_id", profileId),
          currentUserId && currentUserId !== profileId
            ? supabase
                .from("community_profile_follows")
                .select("followed_id")
                .eq("follower_id", currentUserId)
                .eq("followed_id", profileId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
      if (!active) return;
      setProfile(profileResult.data);
      setPortfolio(portfolioResult.data ?? []);
      setUserId(currentUserId);
      setFollowers(followersResult.count ?? 0);
      setFollowingCount(followingResult.count ?? 0);
      setFollowing(Boolean(relationResult.data));
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [profileId]);

  async function toggleFollow() {
    if (!userId) {
      toast.info("Entre na comunidade para acompanhar perfis culturais.");
      return;
    }
    if (userId === profileId || followBusy) return;
    const wasFollowing = following;
    setFollowBusy(true);
    setFollowing(!wasFollowing);
    setFollowers((current) => Math.max(0, current + (wasFollowing ? -1 : 1)));
    const result = wasFollowing
      ? await supabase
          .from("community_profile_follows")
          .delete()
          .eq("follower_id", userId)
          .eq("followed_id", profileId)
      : await supabase
          .from("community_profile_follows")
          .insert({ follower_id: userId, followed_id: profileId });
    if (result.error) {
      setFollowing(wasFollowing);
      setFollowers((current) => Math.max(0, current + (wasFollowing ? 1 : -1)));
      toast.error("Não foi possível atualizar esta conexão.");
    }
    setFollowBusy(false);
  }

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#fffaf3] text-[#9f3d25]">
        <Loader2 className="size-8 animate-spin" aria-label="Carregando perfil" />
      </div>
    );

  if (!profile)
    return (
      <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
        <EcosystemHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Sparkles className="mx-auto size-10 text-[#9f3d25]" />
          <h1 className="mt-4 text-3xl font-black">Perfil não encontrado</h1>
          <Link
            to="/people"
            className="mt-6 inline-flex items-center gap-2 font-bold text-[#9f3d25]"
          >
            <ArrowLeft className="size-4" />
            Voltar para a comunidade
          </Link>
        </main>
      </div>
    );

  const name = profile.artistic_name || profile.display_name || "Perfil cultural";

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main>
        <section className="bg-[#351810] px-4 py-10 text-white">
          <div className="mx-auto max-w-6xl">
            <Link
              to="/people"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#ffc857]"
            >
              <ArrowLeft className="size-4" />
              Voltar para pessoas
            </Link>
            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="grid size-36 shrink-0 place-items-center overflow-hidden rounded-[2rem] bg-[#f4e6d7] text-5xl font-black text-[#9f3d25]">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={`Foto de ${name}`}
                    className="size-full object-cover"
                  />
                ) : (
                  name[0]
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold uppercase tracking-widest text-[#ffc857]">
                  {profile.profile_type}
                </p>
                <h1 className="mt-2 text-4xl font-black md:text-6xl">{name}</h1>
                {profile.city ? (
                  <p className="mt-4 flex items-center gap-2 text-orange-100">
                    <MapPin className="size-5" />
                    {profile.city}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-orange-100">
                  <span>
                    <strong className="text-white">{followers}</strong> seguidores
                  </span>
                  <span>
                    <strong className="text-white">{followingCount}</strong> acompanhando
                  </span>
                  {userId !== profile.id ? (
                    <button
                      type="button"
                      onClick={() => void toggleFollow()}
                      disabled={followBusy}
                      aria-pressed={following}
                      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-bold transition disabled:opacity-60 ${following ? "bg-white/15 text-white" : "bg-[#ffc857] text-[#351810]"}`}
                    >
                      {following ? <Check className="size-4" /> : <UserPlus className="size-4" />}
                      {following ? "Acompanhando" : "Acompanhar perfil"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[.8fr_1.2fr]">
          <article className="rounded-3xl border border-[#ead9ca] bg-white p-7 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-widest text-[#9f3d25]">Sobre</p>
            <h2 className="mt-2 text-2xl font-black">Trajetória e trabalho</h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-[#755348]">
              {profile.full_bio ||
                profile.short_bio ||
                "Este perfil ainda está construindo sua apresentação."}
            </p>
            {profile.collaboration_interests.length ? (
              <div className="mt-6">
                <h3 className="font-bold">Interesses e conexões</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.collaboration_interests.map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full bg-[#f4e6d7] px-3 py-1 text-sm text-[#6d2418]"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </article>

          <article>
            <p className="text-sm font-bold uppercase tracking-widest text-[#9f3d25]">Portfólio</p>
            <h2 className="mt-2 text-3xl font-black">Conheça esse trabalho</h2>
            {portfolio.length ? (
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
                {portfolio.map((item) => (
                  <figure
                    key={item.id}
                    className="overflow-hidden rounded-3xl border border-[#ead9ca] bg-white shadow-sm"
                  >
                    <img
                      src={item.media_url}
                      alt={item.alt_text ?? item.title ?? `Trabalho de ${name}`}
                      className="aspect-square w-full object-cover"
                    />
                    {item.title ? (
                      <figcaption className="p-4 text-sm font-bold">{item.title}</figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border-2 border-dashed border-[#ead9ca] p-10 text-center text-[#755348]">
                <ImageIcon className="mx-auto size-9 text-[#9f3d25]" />
                <p className="mt-3">Este portfólio ainda não tem imagens publicadas.</p>
              </div>
            )}
          </article>
        </section>
      </main>
      <EcosystemFooter />
    </div>
  );
}
