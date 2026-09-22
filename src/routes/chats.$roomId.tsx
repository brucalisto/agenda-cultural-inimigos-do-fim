import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Lock, Send, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/chats/$roomId")({ component: ChatRoomPage });

type Room = Tables<"chat_rooms">;
type Message = Tables<"chat_messages">;
type Member = Tables<"chat_room_members">;
type Profile = Pick<
  Tables<"community_profiles">,
  "id" | "display_name" | "artistic_name" | "avatar_url"
>;

function ChatRoomPage() {
  const { roomId } = Route.useParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadConversation = useCallback(async () => {
    const [roomResult, messagesResult, membersResult] = await Promise.all([
      supabase.from("chat_rooms").select("*").eq("id", roomId).maybeSingle(),
      supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true }),
      supabase.from("chat_room_members").select("*").eq("room_id", roomId),
    ]);
    setRoom(roomResult.data);
    setMessages(messagesResult.data ?? []);
    const loadedMembers = membersResult.data ?? [];
    setMembers(loadedMembers);
    const ids = [
      ...new Set([
        ...loadedMembers.map((member) => member.profile_id),
        ...(messagesResult.data ?? []).map((message) => message.sender_id),
      ]),
    ];
    if (ids.length) {
      const { data } = await supabase
        .from("community_profiles")
        .select("id,display_name,artistic_name,avatar_url")
        .in("id", ids);
      setProfiles(Object.fromEntries((data ?? []).map((profile) => [profile.id, profile])));
    }
  }, [roomId]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    async function load() {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      if (data.user) {
        await loadConversation();
        channel = supabase
          .channel(`chat-${roomId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "chat_messages",
              filter: `room_id=eq.${roomId}`,
            },
            () => {
              void loadConversation();
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
  }, [loadConversation, roomId]);

  async function sendMessage() {
    if (!userId || !body.trim()) return;
    setSending(true);
    const { error } = await supabase
      .from("chat_messages")
      .insert({ room_id: roomId, sender_id: userId, body: body.trim() });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    await loadConversation();
  }

  async function deleteMessage(messageId: string) {
    const { error } = await supabase
      .from("chat_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", messageId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadConversation();
  }

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#fffaf3] text-[#9f3d25]">
        <Loader2 className="size-8 animate-spin" aria-label="Carregando conversa" />
      </div>
    );
  if (!userId || !room)
    return (
      <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
        <EcosystemHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Lock className="mx-auto size-10 text-[#9f3d25]" />
          <h1 className="mt-4 text-3xl font-black">Conversa privada</h1>
          <p className="mt-3 text-[#755348]">
            Somente os membros convidados podem acessar este espaço.
          </p>
          <Link
            to="/chats"
            className="mt-6 inline-flex items-center gap-2 font-bold text-[#9f3d25]"
          >
            <ArrowLeft className="size-4" />
            Voltar para conversas
          </Link>
        </main>
      </div>
    );

  return (
    <div className="flex min-h-screen flex-col bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
        <section className="rounded-3xl bg-[#351810] p-5 text-white">
          <Link
            to="/chats"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#ffc857]"
          >
            <ArrowLeft className="size-4" />
            Conversas
          </Link>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">{room.name || "Conversa privada"}</h1>
              <p className="mt-2 text-sm text-[#f1d5c7]">
                {room.description || "Espaço reservado para o projeto."}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
              <Users className="size-4" />
              {members.length}
            </span>
          </div>
        </section>

        <section
          className="mt-5 flex-1 space-y-3 rounded-3xl border border-[#ead9ca] bg-white p-4 md:p-6"
          aria-label="Mensagens"
        >
          {messages.map((message) => {
            const own = message.sender_id === userId;
            const profile = profiles[message.sender_id];
            const name = profile?.artistic_name || profile?.display_name || "Membro";
            return (
              <article key={message.id} className={`flex gap-3 ${own ? "flex-row-reverse" : ""}`}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="size-9 rounded-xl object-cover" />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f4e6d7] text-sm font-black text-[#9f3d25]">
                    {name[0]}
                  </span>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 ${own ? "bg-[#9f3d25] text-white" : "bg-[#f4e6d7]"}`}
                >
                  <div className="flex items-center gap-3">
                    <strong className="text-xs">{name}</strong>
                    <time className={`text-[11px] ${own ? "text-white/70" : "text-[#8a5c4d]"}`}>
                      {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p
                    className={`mt-1 whitespace-pre-wrap ${message.deleted_at ? "italic opacity-65" : ""}`}
                  >
                    {message.deleted_at ? "Mensagem removida" : message.body}
                  </p>
                  {own && !message.deleted_at ? (
                    <button
                      type="button"
                      onClick={() => void deleteMessage(message.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-white/75"
                      aria-label="Remover mensagem"
                    >
                      <Trash2 className="size-3" />
                      Remover
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
          {!messages.length ? (
            <div className="py-16 text-center text-[#755348]">
              Envie a primeira mensagem deste projeto.
            </div>
          ) : null}
        </section>

        <form
          className="sticky bottom-0 mt-4 flex gap-3 bg-[#fffaf3] py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={2}
            placeholder="Escreva uma mensagem..."
            className="min-w-0 flex-1 resize-none rounded-2xl border border-[#ead9ca] bg-white px-4 py-3 outline-none focus:border-[#9f3d25]"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="grid size-14 shrink-0 place-items-center self-end rounded-2xl bg-[#9f3d25] text-white disabled:opacity-40"
            aria-label="Enviar mensagem"
          >
            {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </button>
        </form>
      </main>
    </div>
  );
}
