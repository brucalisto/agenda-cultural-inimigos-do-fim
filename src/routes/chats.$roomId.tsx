import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Lock,
  Paperclip,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/chats/$roomId")({ component: ChatRoomPage });

const PRIVATE_BUCKET = "community-private-files";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "audio/ogg",
  "audio/mp4",
  "video/mp4",
  "video/webm",
]);

type Room = Tables<"chat_rooms">;
type Message = Tables<"chat_messages">;
type Member = Tables<"chat_room_members">;
type Profile = Pick<
  Tables<"community_profiles">,
  "id" | "display_name" | "artistic_name" | "avatar_url" | "profile_type"
>;

function profileName(profile?: Profile) {
  return profile?.artistic_name || profile?.display_name || "Membro";
}

function attachmentKind(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(extension ?? "")) return "image";
  if (["mp3", "ogg", "m4a"].includes(extension ?? "")) return "audio";
  if (["mp4", "webm"].includes(extension ?? "")) return "video";
  return "document";
}

function attachmentLabel(path: string) {
  const storedName = path.split("/").pop() ?? "arquivo";
  return storedName.replace(/^[0-9a-f-]{36}-/, "");
}

function ChatAttachment({
  path,
  signedUrl,
  own,
}: {
  path: string;
  signedUrl?: string;
  own: boolean;
}) {
  if (!signedUrl) return <span className="mt-2 block text-xs opacity-70">Preparando arquivo…</span>;
  const kind = attachmentKind(path);
  if (kind === "image")
    return (
      <a href={signedUrl} target="_blank" rel="noreferrer">
        <img
          src={signedUrl}
          alt={attachmentLabel(path)}
          className="mt-3 max-h-72 w-full rounded-xl object-cover"
        />
      </a>
    );
  if (kind === "audio")
    return (
      <audio controls preload="metadata" className="mt-3 max-w-full">
        <source src={signedUrl} />
      </audio>
    );
  if (kind === "video")
    return (
      <video controls preload="metadata" className="mt-3 max-h-72 w-full rounded-xl">
        <source src={signedUrl} />
      </video>
    );
  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noreferrer"
      className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${own ? "border-white/30" : "border-[#9f3d25]/20"}`}
    >
      <FileText className="size-4" />
      <span className="min-w-0 flex-1 truncate">{attachmentLabel(path)}</span>
      <Download className="size-4" />
    </a>
  );
}

function ChatRoomPage() {
  const { roomId } = Route.useParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [managing, setManaging] = useState(false);
  const [changingMemberId, setChangingMemberId] = useState<string | null>(null);

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
    const loadedMessages = messagesResult.data ?? [];
    const loadedMembers = membersResult.data ?? [];
    setRoom(roomResult.data);
    setMessages(loadedMessages);
    setMembers(loadedMembers);

    const ids = [
      ...new Set([
        ...loadedMembers.map((member) => member.profile_id),
        ...loadedMessages.map((message) => message.sender_id),
      ]),
    ];
    const mediaPaths = [
      ...new Set(
        loadedMessages
          .filter((message) => !message.deleted_at)
          .flatMap((message) => message.media_urls),
      ),
    ];
    const [profilesResult, signedResult] = await Promise.all([
      ids.length
        ? supabase
            .from("community_profiles")
            .select("id,display_name,artistic_name,avatar_url,profile_type")
            .in("id", ids)
        : Promise.resolve({ data: [] as Profile[] }),
      mediaPaths.length
        ? supabase.storage.from(PRIVATE_BUCKET).createSignedUrls(mediaPaths, 3600)
        : Promise.resolve({ data: [] }),
    ]);
    setProfiles(
      Object.fromEntries((profilesResult.data ?? []).map((profile) => [profile.id, profile])),
    );
    setSignedUrls(
      Object.fromEntries(
        (signedResult.data ?? [])
          .filter((item) => item.signedUrl)
          .map((item) => [item.path, item.signedUrl]),
      ),
    );

    const latestMessage = loadedMessages.at(-1);
    void supabase.rpc("mark_chat_read", {
      target_room_id: roomId,
      read_through: latestMessage?.created_at ?? new Date().toISOString(),
    });
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

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    const invalid = selected.find(
      (file) => !ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE,
    );
    if (invalid) {
      toast.error("Envie imagens, PDF, áudio ou vídeo com até 25 MB por arquivo.");
      return;
    }
    setFiles((current) => [...current, ...selected]);
  }

  async function sendMessage() {
    if (!userId || (!body.trim() && !files.length)) return;
    setSending(true);
    const uploadedPaths: string[] = [];
    try {
      for (const file of files) {
        const safeName = file.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "-");
        const path = `${userId}/chat/${roomId}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage
          .from(PRIVATE_BUCKET)
          .upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
        if (error) throw error;
        uploadedPaths.push(path);
      }
      const { error } = await supabase.from("chat_messages").insert({
        room_id: roomId,
        sender_id: userId,
        body: body.trim() || null,
        media_urls: uploadedPaths,
      });
      if (error) throw error;
      setBody("");
      setFiles([]);
      await loadConversation();
    } catch (cause) {
      if (uploadedPaths.length) await supabase.storage.from(PRIVATE_BUCKET).remove(uploadedPaths);
      toast.error(cause instanceof Error ? cause.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(messageId: string) {
    const { error } = await supabase
      .from("chat_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", messageId);
    if (error) toast.error(error.message);
    else await loadConversation();
  }

  async function openMemberManager() {
    setManaging(true);
    const memberIds = new Set(members.map((member) => member.profile_id));
    const { data } = await supabase
      .from("community_profiles")
      .select("id,display_name,artistic_name,avatar_url,profile_type")
      .eq("visibility", "public")
      .order("display_name");
    setAvailableProfiles((data ?? []).filter((profile) => !memberIds.has(profile.id)));
  }

  async function changeMember(profileId: string, operation: "add" | "remove") {
    setChangingMemberId(profileId);
    const { error } = await supabase.rpc("manage_chat_member", {
      target_room_id: roomId,
      target_profile_id: profileId,
      operation,
    });
    setChangingMemberId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(operation === "add" ? "Pessoa adicionada." : "Pessoa removida.");
    await loadConversation();
    if (operation === "add")
      setAvailableProfiles((current) => current.filter((profile) => profile.id !== profileId));
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

  const isOwner = room.owner_id === userId;

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
            <button
              type="button"
              onClick={() => (isOwner ? void openMemberManager() : undefined)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm ${isOwner ? "cursor-pointer hover:bg-white/20" : ""}`}
              aria-label={isOwner ? "Gerenciar participantes" : "Quantidade de participantes"}
            >
              <Users className="size-4" />
              {members.length}
            </button>
          </div>
        </section>

        {managing && isOwner ? (
          <section className="mt-4 rounded-3xl border border-[#ead9ca] bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">Participantes</h2>
                <p className="text-sm text-[#755348]">
                  Somente você pode adicionar ou remover pessoas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManaging(false)}
                aria-label="Fechar participantes"
              >
                <X />
              </button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {members.map((member) => {
                const profile = profiles[member.profile_id];
                const name = profileName(profile);
                const ownerMember = member.profile_id === room.owner_id;
                return (
                  <div
                    key={member.profile_id}
                    className="flex items-center gap-3 rounded-2xl bg-[#fffaf3] p-3"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="size-10 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-xl bg-[#f4e6d7] font-black text-[#9f3d25]">
                        {name[0]}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate">{name}</strong>
                      <small className="text-[#755348]">
                        {ownerMember ? "Responsável" : "Participante"}
                      </small>
                    </span>
                    {!ownerMember ? (
                      <button
                        type="button"
                        disabled={changingMemberId === member.profile_id}
                        onClick={() => void changeMember(member.profile_id, "remove")}
                        className="text-red-700"
                        aria-label={`Remover ${name}`}
                      >
                        {changingMemberId === member.profile_id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <UserMinus className="size-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {availableProfiles.length ? (
              <div className="mt-5 border-t border-[#ead9ca] pt-4">
                <h3 className="font-bold">Adicionar pessoas</h3>
                <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                  {availableProfiles.map((profile) => (
                    <button
                      type="button"
                      key={profile.id}
                      disabled={changingMemberId === profile.id}
                      onClick={() => void changeMember(profile.id, "add")}
                      className="flex items-center gap-3 rounded-2xl border border-[#ead9ca] p-3 text-left"
                    >
                      <UserPlus className="size-4 text-[#9f3d25]" />
                      <span className="min-w-0 flex-1 truncate font-bold">
                        {profileName(profile)}
                      </span>
                      {changingMemberId === profile.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section
          className="mt-5 flex-1 space-y-3 rounded-3xl border border-[#ead9ca] bg-white p-4 md:p-6"
          aria-label="Mensagens"
        >
          {messages.map((message) => {
            const own = message.sender_id === userId;
            const profile = profiles[message.sender_id];
            const name = profileName(profile);
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
                  {!message.deleted_at
                    ? message.media_urls.map((path) => (
                        <ChatAttachment
                          key={path}
                          path={path}
                          signedUrl={signedUrls[path]}
                          own={own}
                        />
                      ))
                    : null}
                  {own && !message.deleted_at ? (
                    <button
                      type="button"
                      onClick={() => void deleteMessage(message.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs opacity-75"
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

        {files.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#f4e6d7] px-3 py-2 text-xs"
              >
                <Paperclip className="size-3" />
                <span className="max-w-52 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                  aria-label={`Remover ${file.name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <form
          className="sticky bottom-0 mt-3 flex gap-2 bg-[#fffaf3] py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <label
            className="grid size-14 shrink-0 cursor-pointer place-items-center self-end rounded-2xl border border-[#ead9ca] bg-white text-[#9f3d25]"
            aria-label="Anexar arquivos"
          >
            <Paperclip className="size-5" />
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,application/pdf,audio/mpeg,audio/ogg,audio/mp4,video/mp4,video/webm"
              className="sr-only"
              onChange={selectFiles}
            />
          </label>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={2}
            placeholder="Escreva uma mensagem..."
            className="min-w-0 flex-1 resize-none rounded-2xl border border-[#ead9ca] bg-white px-4 py-3 outline-none focus:border-[#9f3d25]"
          />
          <button
            type="submit"
            disabled={sending || (!body.trim() && !files.length)}
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
