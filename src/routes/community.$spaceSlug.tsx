import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ImagePlus, Loader2, Lock, MessageCircle, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/community/$spaceSlug")({ component: CommunitySpacePage });

type Space = Tables<"community_spaces">;
type Post = Tables<"community_posts">;
type Author = Pick<
  Tables<"community_profiles">,
  "id" | "display_name" | "artistic_name" | "avatar_url"
>;

function CommunitySpacePage() {
  const { spaceSlug } = Route.useParams();
  const [space, setSpace] = useState<Space | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<File[]>([]);

  const loadPosts = useCallback(async (spaceId: string) => {
    const { data } = await supabase
      .from("community_posts")
      .select("*")
      .eq("space_id", spaceId)
      .eq("status", "published")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    const loadedPosts = data ?? [];
    setPosts(loadedPosts);
    const authorIds = [...new Set(loadedPosts.map((post) => post.author_id))];
    if (!authorIds.length) {
      setAuthors({});
      return;
    }
    const { data: profiles } = await supabase
      .from("community_profiles")
      .select("id,display_name,artistic_name,avatar_url")
      .in("id", authorIds);
    setAuthors(Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile])));
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    async function load() {
      const [{ data: authData }, { data: loadedSpace }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("community_spaces")
          .select("*")
          .eq("slug", spaceSlug)
          .eq("active", true)
          .maybeSingle(),
      ]);
      setUserId(authData.user?.id ?? null);
      setSpace(loadedSpace);
      if (loadedSpace) {
        await loadPosts(loadedSpace.id);
        channel = supabase
          .channel(`community-space-${loadedSpace.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "community_posts",
              filter: `space_id=eq.${loadedSpace.id}`,
            },
            () => {
              void loadPosts(loadedSpace.id);
            },
          )
          .subscribe();
      }
      setLoading(false);
    }
    void load();
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadPosts, spaceSlug]);

  async function publishPost() {
    if (!space || !userId || !body.trim()) return;
    setSending(true);
    const postId = crypto.randomUUID();
    const uploadedPaths: string[] = [];
    const mediaUrls: string[] = [];
    for (const image of images) {
      const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/posts/${postId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("community-public-images")
        .upload(path, image, { contentType: image.type, upsert: false });
      if (uploadError) {
        if (uploadedPaths.length)
          await supabase.storage.from("community-public-images").remove(uploadedPaths);
        setSending(false);
        toast.error(uploadError.message);
        return;
      }
      uploadedPaths.push(path);
      mediaUrls.push(
        supabase.storage.from("community-public-images").getPublicUrl(path).data.publicUrl,
      );
    }
    const { error } = await supabase.from("community_posts").insert({
      id: postId,
      space_id: space.id,
      author_id: userId,
      title: title.trim() || null,
      body: body.trim(),
      media_urls: mediaUrls,
      status: "published",
    });
    setSending(false);
    if (error) {
      if (uploadedPaths.length)
        await supabase.storage.from("community-public-images").remove(uploadedPaths);
      toast.error(error.message);
      return;
    }
    setTitle("");
    setBody("");
    setImages([]);
    toast.success("Publicação enviada.");
    await loadPosts(space.id);
  }

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#fffaf3] text-[#9f3d25]">
        <Loader2 className="size-8 animate-spin" aria-label="Carregando espaço" />
      </div>
    );
  if (!space)
    return (
      <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
        <EcosystemHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Lock className="mx-auto size-10 text-[#9f3d25]" />
          <h1 className="mt-4 text-3xl font-black">Espaço indisponível</h1>
          <p className="mt-3 text-[#755348]">Este espaço não existe ou exige acesso de membro.</p>
          <Link
            to="/community"
            className="mt-6 inline-flex items-center gap-2 font-bold text-[#9f3d25]"
          >
            <ArrowLeft className="size-4" />
            Voltar para a comunidade
          </Link>
        </main>
      </div>
    );

  const canPost = Boolean(userId && space.posting_policy === "members");

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Link
          to="/community"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#9f3d25]"
        >
          <ArrowLeft className="size-4" />
          Todos os espaços
        </Link>
        <section className="mt-6 rounded-[2rem] bg-[#351810] p-7 text-white md:p-10">
          <p className="text-sm font-bold uppercase tracking-widest text-[#ffc857]">
            {space.posting_policy === "admin" ? "Canal oficial" : "Conversa aberta"}
          </p>
          <h1 className="mt-2 text-4xl font-black">{space.name}</h1>
          <p className="mt-3 max-w-2xl text-[#f1d5c7]">{space.description}</p>
        </section>

        {canPost ? (
          <section className="mt-6 rounded-3xl border border-[#ead9ca] bg-white p-5 shadow-sm">
            <h2 className="font-black">Compartilhe com a comunidade</h2>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título (opcional)"
              className="mt-4 w-full rounded-xl border border-[#ead9ca] px-4 py-3 outline-none focus:border-[#9f3d25]"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Escreva sua mensagem..."
              rows={4}
              className="mt-3 w-full resize-y rounded-xl border border-[#ead9ca] px-4 py-3 outline-none focus:border-[#9f3d25]"
            />
            {images.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {images.map((image, index) => (
                  <span
                    key={`${image.name}-${image.lastModified}`}
                    className="inline-flex items-center gap-2 rounded-full bg-[#f4e6d7] px-3 py-2 text-sm"
                  >
                    {image.name}
                    <button
                      type="button"
                      onClick={() =>
                        setImages((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      aria-label={`Remover ${image.name}`}
                    >
                      <X className="size-4" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#d8bca8] px-4 py-3 text-sm font-bold text-[#8d321f]">
                <ImagePlus className="size-4" /> Adicionar imagens
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    const selected = Array.from(event.target.files ?? []);
                    if (selected.some((file) => file.size > 8 * 1024 * 1024)) {
                      toast.error("Cada imagem pode ter no máximo 8 MB.");
                      return;
                    }
                    setImages((current) => [...current, ...selected].slice(0, 4));
                    event.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                disabled={sending || !body.trim()}
                onClick={() => void publishPost()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white disabled:opacity-40"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Publicar
              </button>
            </div>
          </section>
        ) : !userId && space.posting_policy === "members" ? (
          <div className="mt-6 rounded-2xl bg-[#f4e6d7] p-5 text-center">
            <Link to="/join" className="font-bold text-[#9f3d25]">
              Entre ou crie seu perfil para participar da conversa.
            </Link>
          </div>
        ) : null}

        <section className="mt-8 space-y-4" aria-label="Publicações">
          {posts.map((post) => {
            const author = authors[post.author_id];
            return <CommunityPostCard key={post.id} post={post} author={author} userId={userId} />;
          })}
          {!posts.length ? (
            <div className="rounded-3xl border-2 border-dashed border-[#ead9ca] p-10 text-center text-[#755348]">
              <MessageCircle className="mx-auto size-9 text-[#9f3d25]" />
              <p className="mt-3">Ainda não há publicações neste espaço.</p>
            </div>
          ) : null}
        </section>
      </main>
      <EcosystemFooter />
    </div>
  );
}
