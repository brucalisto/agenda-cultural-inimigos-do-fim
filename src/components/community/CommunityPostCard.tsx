import { Link } from "@tanstack/react-router";
import { Flag, Heart, Loader2, MessageCircle, Pin, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

type Post = Tables<"community_posts">;
type Comment = Tables<"community_post_comments">;
type Author = Pick<
  Tables<"community_profiles">,
  "id" | "display_name" | "artistic_name" | "avatar_url"
>;

interface Props {
  post: Post;
  author?: Author;
  userId: string | null;
}

const reportReasons = [
  ["spam", "Spam"],
  ["assédio", "Assédio"],
  ["discurso_de_ódio", "Discurso de ódio"],
  ["conteúdo_impróprio", "Conteúdo impróprio"],
  ["informação_falsa", "Informação falsa"],
  ["outro", "Outro"],
] as const;

function displayName(author?: Author) {
  return author?.artistic_name || author?.display_name || "Membro da comunidade";
}

export function CommunityPostCard({ post, author, userId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentAuthors, setCommentAuthors] = useState<Record<string, Author>>({});
  const [reactionCount, setReactionCount] = useState(0);
  const [reacted, setReacted] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("spam");

  const loadInteractions = useCallback(async () => {
    const [commentsResult, reactionsResult] = await Promise.all([
      supabase
        .from("community_post_comments")
        .select("*")
        .eq("post_id", post.id)
        .eq("status", "published")
        .order("created_at", { ascending: true }),
      supabase.from("community_post_reactions").select("profile_id").eq("post_id", post.id),
    ]);
    const nextComments = commentsResult.data ?? [];
    const reactions = reactionsResult.data ?? [];
    setComments(nextComments);
    setReactionCount(reactions.length);
    setReacted(Boolean(userId && reactions.some((item) => item.profile_id === userId)));

    const ids = [...new Set(nextComments.map((item) => item.author_id))];
    if (!ids.length) {
      setCommentAuthors({});
      return;
    }
    const { data } = await supabase
      .from("community_profiles")
      .select("id,display_name,artistic_name,avatar_url")
      .in("id", ids);
    setCommentAuthors(Object.fromEntries((data ?? []).map((profile) => [profile.id, profile])));
  }, [post.id, userId]);

  useEffect(() => {
    void loadInteractions();
  }, [loadInteractions]);

  async function toggleReaction() {
    if (!userId) {
      toast.info("Entre na comunidade para apoiar publicações.");
      return;
    }
    setReacted((current) => !current);
    setReactionCount((count) => count + (reacted ? -1 : 1));
    const result = reacted
      ? await supabase
          .from("community_post_reactions")
          .delete()
          .eq("post_id", post.id)
          .eq("profile_id", userId)
      : await supabase
          .from("community_post_reactions")
          .insert({ post_id: post.id, profile_id: userId });
    if (result.error) {
      toast.error(result.error.message);
      await loadInteractions();
    }
  }

  async function sendComment() {
    if (!userId || !commentBody.trim()) return;
    setSending(true);
    const { error } = await supabase.from("community_post_comments").insert({
      post_id: post.id,
      author_id: userId,
      body: commentBody.trim(),
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCommentBody("");
    await loadInteractions();
  }

  async function submitReport() {
    if (!userId) return;
    const { error } = await supabase.from("community_reports").insert({
      reporter_id: userId,
      entity_type: "post",
      entity_id: post.id,
      reason: reportReason,
    });
    if (error?.code === "23505") toast.info("Você já denunciou esta publicação.");
    else if (error) toast.error(error.message);
    else toast.success("Denúncia enviada para a moderação.");
    setReporting(false);
  }

  const authorName = displayName(author);

  return (
    <article className="rounded-3xl border border-[#ead9ca] bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        {author?.avatar_url ? (
          <img src={author.avatar_url} alt="" className="size-11 rounded-2xl object-cover" />
        ) : (
          <span className="grid size-11 place-items-center rounded-2xl bg-[#f4e6d7] font-black text-[#9f3d25]">
            {authorName[0]}
          </span>
        )}
        <div>
          {author ? (
            <Link
              to="/people/$profileId"
              params={{ profileId: author.id }}
              className="font-bold hover:underline"
            >
              {authorName}
            </Link>
          ) : (
            <strong>{authorName}</strong>
          )}
          <p className="text-xs text-[#8a5c4d]">
            {new Date(post.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
        {post.pinned ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            <Pin className="size-3" /> Fixado
          </span>
        ) : null}
      </div>
      {post.title ? <h2 className="mt-5 text-xl font-black">{post.title}</h2> : null}
      <p className="mt-3 whitespace-pre-wrap leading-relaxed text-[#5b392f]">{post.body}</p>
      {post.media_urls.length ? (
        <div
          className={`mt-4 grid gap-2 ${post.media_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {post.media_urls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-2xl bg-[#f4e6d7]"
            >
              <img
                src={url}
                alt="Imagem compartilhada na publicação"
                loading="lazy"
                className="max-h-[32rem] w-full object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-2 border-t border-[#f0e4da] pt-4">
        <button
          type="button"
          onClick={() => void toggleReaction()}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${reacted ? "bg-rose-100 text-rose-700" : "bg-[#f8efe6] text-[#755348]"}`}
          aria-pressed={reacted}
        >
          <Heart className={`size-4 ${reacted ? "fill-current" : ""}`} /> {reactionCount} apoio
          {reactionCount === 1 ? "" : "s"}
        </button>
        <span className="inline-flex items-center gap-2 px-2 text-sm text-[#755348]">
          <MessageCircle className="size-4" /> {comments.length}
        </span>
        {userId ? (
          <button
            type="button"
            onClick={() => setReporting((value) => !value)}
            className="ml-auto rounded-full p-2 text-[#8a5c4d] hover:bg-[#f8efe6]"
            aria-label="Denunciar publicação"
          >
            <Flag className="size-4" />
          </button>
        ) : null}
      </div>

      {reporting ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-rose-50 p-3">
          <label htmlFor={`report-${post.id}`} className="text-sm font-bold text-rose-900">
            Motivo
          </label>
          <select
            id={`report-${post.id}`}
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
            className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm"
          >
            {reportReasons.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void submitReport()}
            className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-bold text-white"
          >
            Enviar denúncia
          </button>
        </div>
      ) : null}

      {comments.length ? (
        <div className="mt-4 space-y-3 border-t border-[#f0e4da] pt-4">
          {comments.map((comment) => {
            const commentAuthor = commentAuthors[comment.author_id];
            return (
              <div key={comment.id} className="rounded-2xl bg-[#fffaf3] px-4 py-3">
                <strong className="text-sm">{displayName(commentAuthor)}</strong>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#5b392f]">{comment.body}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {userId ? (
        <div className="mt-4 flex gap-2">
          <label htmlFor={`comment-${post.id}`} className="sr-only">
            Comentar
          </label>
          <input
            id={`comment-${post.id}`}
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendComment();
              }
            }}
            maxLength={2000}
            placeholder="Escreva um comentário..."
            className="min-w-0 flex-1 rounded-xl border border-[#ead9ca] px-4 py-2 outline-none focus:border-[#9f3d25]"
          />
          <button
            type="button"
            disabled={sending || !commentBody.trim()}
            onClick={() => void sendComment()}
            className="grid size-11 place-items-center rounded-xl bg-[#9f3d25] text-white disabled:opacity-40"
            aria-label="Enviar comentário"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      ) : null}
    </article>
  );
}
