import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Newspaper, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/following")({ component: FollowingPage });

type Post = Tables<"community_posts">;
type Author = Pick<
  Tables<"community_profiles">,
  "id" | "display_name" | "artistic_name" | "avatar_url"
>;

function FollowingPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    const { data: auth } = await supabase.auth.getUser();
    const id = auth.user?.id ?? null;
    setUserId(id);
    if (!id) {
      setLoading(false);
      return;
    }

    const followsResult = await supabase
      .from("community_profile_follows")
      .select("followed_id")
      .eq("follower_id", id);

    if (followsResult.error) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    const followedIds = [...new Set((followsResult.data ?? []).map((item) => item.followed_id))];
    setFollowingCount(followedIds.length);

    if (!followedIds.length) {
      setPosts([]);
      setAuthors({});
      setLoading(false);
      return;
    }

    const [profilesResult, postsResult] = await Promise.all([
      supabase
        .from("community_profiles")
        .select("id,display_name,artistic_name,avatar_url")
        .in("id", followedIds),
      supabase
        .from("community_posts")
        .select("*")
        .in("author_id", followedIds)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (profilesResult.error || postsResult.error) {
      setLoadError(true);
    } else {
      setAuthors(
        Object.fromEntries((profilesResult.data ?? []).map((profile) => [profile.id, profile])),
      );
      setPosts(postsResult.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main>
        <section className="bg-[#351810] px-4 py-10 text-white">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-3 text-[#ffc857]">
              <Newspaper className="size-6" />
              <span className="font-bold uppercase tracking-widest">Acompanhando</span>
            </div>
            <h1 className="mt-3 text-4xl font-black md:text-5xl">Novidades de quem você segue</h1>
            <p className="mt-3 max-w-2xl text-[#f1d5c7]">
              Veja em um só lugar as publicações mais recentes dos perfis culturais que você
              acompanha.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-10" aria-live="polite">
          {loading ? (
            <div className="grid min-h-64 place-items-center text-[#9f3d25]">
              <Loader2 className="size-9 animate-spin" aria-label="Carregando publicações" />
            </div>
          ) : !userId ? (
            <EmptyState
              icon={Users}
              title="Entre para montar seu feed"
              description="Ao entrar, você pode acompanhar perfis e receber as novidades deles aqui."
              actionLabel="Entrar ou criar perfil"
              actionTo="/join"
            />
          ) : loadError ? (
            <div className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-2xl font-black">Não foi possível carregar seu feed</h2>
              <p className="mt-2 text-[#755348]">Tente novamente em alguns instantes.</p>
              <button
                type="button"
                onClick={() => void loadFeed()}
                className="mt-5 rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white"
              >
                Tentar novamente
              </button>
            </div>
          ) : followingCount === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="Encontre pessoas para acompanhar"
              description="Conheça artistas, produtores, espaços e outros perfis da comunidade."
              actionLabel="Explorar perfis"
              actionTo="/people"
            />
          ) : posts.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="Seu feed está pronto"
              description={`Você acompanha ${followingCount} perfil${followingCount === 1 ? "" : "s"}, mas ainda não há publicações recentes.`}
              actionLabel="Ir para a comunidade"
              actionTo="/community"
            />
          ) : (
            <>
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="text-sm text-[#755348]">
                  Novidades de {followingCount} perfil{followingCount === 1 ? "" : "s"}
                </p>
                <Link to="/people" className="text-sm font-bold text-[#9f3d25] hover:underline">
                  Encontrar mais perfis
                </Link>
              </div>
              <div className="grid gap-5">
                {posts.map((post) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    author={authors[post.author_id]}
                    userId={userId}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </main>
      <EcosystemFooter />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  actionLabel: string;
  actionTo: "/join" | "/people" | "/community";
}) {
  return (
    <div className="rounded-3xl border border-[#ead9ca] bg-white p-8 text-center shadow-sm">
      <Icon className="mx-auto size-12 text-[#9f3d25]" />
      <h2 className="mt-4 text-2xl font-black">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-[#755348]">{description}</p>
      <Link
        to={actionTo}
        className="mt-6 inline-block rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
