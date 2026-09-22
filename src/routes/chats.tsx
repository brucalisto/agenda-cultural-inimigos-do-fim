import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Loader2, Lock, MessageCircle, Plus, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/chats")({ component: ChatsPage });

type Room = Tables<"chat_rooms">;
type Profile = Pick<
  Tables<"community_profiles">,
  "id" | "display_name" | "artistic_name" | "avatar_url" | "profile_type"
>;

function ChatsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const loadRooms = useCallback(async (id: string) => {
    const [{ data: memberships }, { data: unreadData }] = await Promise.all([
      supabase.from("chat_room_members").select("room_id").eq("profile_id", id),
      supabase.rpc("get_chat_unread_counts"),
    ]);
    setUnreadCounts(
      Object.fromEntries(
        (unreadData ?? []).map((item) => [item.chat_room_id, Number(item.unread_count)]),
      ),
    );
    const roomIds = (memberships ?? []).map((item) => item.room_id);
    if (!roomIds.length) {
      setRooms([]);
      return;
    }
    const { data } = await supabase
      .from("chat_rooms")
      .select("*")
      .in("id", roomIds)
      .order("updated_at", { ascending: false });
    setRooms(data ?? []);
  }, []);

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const id = authData.user?.id ?? null;
      setUserId(id);
      if (id) {
        await Promise.all([
          loadRooms(id),
          supabase
            .from("community_profiles")
            .select("id,display_name,artistic_name,avatar_url,profile_type")
            .eq("visibility", "public")
            .neq("id", id)
            .order("display_name")
            .then(({ data }) => setProfiles(data ?? [])),
        ]);
      }
      setLoading(false);
    }
    void load();
  }, [loadRooms]);

  function toggleProfile(profileId: string) {
    setSelectedIds((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : [...current, profileId],
    );
  }

  async function createChat() {
    if (!userId || !name.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.rpc("create_private_chat", {
      room_name: name.trim(),
      room_description: description.trim() || null,
      invited_profile_ids: selectedIds,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conversa privada criada.");
    window.location.href = `/chats/${data}`;
  }

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#fffaf3] text-[#9f3d25]">
        <Loader2 className="size-8 animate-spin" aria-label="Carregando conversas" />
      </div>
    );

  if (!userId)
    return (
      <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
        <EcosystemHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Lock className="mx-auto size-10 text-[#9f3d25]" />
          <h1 className="mt-4 text-3xl font-black">Conversas privadas</h1>
          <p className="mt-3 text-[#755348]">
            Entre na comunidade para criar projetos e conversar com outros membros.
          </p>
          <Link
            to="/join"
            className="mt-6 inline-block rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white"
          >
            Entrar ou criar perfil
          </Link>
        </main>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="flex flex-col gap-5 rounded-[2rem] bg-[#351810] p-7 text-white sm:flex-row sm:items-end sm:justify-between md:p-10">
          <div>
            <p className="font-bold uppercase tracking-widest text-[#ffc857]">Área reservada</p>
            <h1 className="mt-2 text-4xl font-black">Conversas e projetos</h1>
            <p className="mt-3 max-w-2xl text-[#f1d5c7]">
              Crie grupos privados para organizar ideias, equipes e novas ações culturais.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#ffc857] px-5 py-3 font-bold text-[#351810]"
          >
            <Plus className="size-5" />
            Nova conversa
          </button>
        </section>

        {showForm ? (
          <section className="mt-6 rounded-3xl border border-[#ead9ca] bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">Criar conversa privada</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Fechar formulário"
              >
                <X />
              </button>
            </div>
            <label className="mt-5 block text-sm font-bold">
              Nome do projeto ou conversa
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#ead9ca] px-4 py-3 font-normal outline-none focus:border-[#9f3d25]"
                placeholder="Ex.: Produção do Festival do Bairro"
              />
            </label>
            <label className="mt-4 block text-sm font-bold">
              Descrição
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#ead9ca] px-4 py-3 font-normal outline-none focus:border-[#9f3d25]"
                rows={3}
                placeholder="Qual é o objetivo deste espaço?"
              />
            </label>
            <div className="mt-5">
              <p className="text-sm font-bold">Convidar pessoas</p>
              <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                {profiles.map((profile) => {
                  const selected = selectedIds.includes(profile.id);
                  const profileName = profile.artistic_name || profile.display_name || "Membro";
                  return (
                    <button
                      type="button"
                      key={profile.id}
                      onClick={() => toggleProfile(profile.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${selected ? "border-[#9f3d25] bg-[#fff4e7]" : "border-[#ead9ca]"}`}
                    >
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="size-10 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="grid size-10 place-items-center rounded-xl bg-[#f4e6d7] font-black text-[#9f3d25]">
                          {profileName[0]}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate">{profileName}</strong>
                        <small className="capitalize text-[#755348]">{profile.profile_type}</small>
                      </span>
                      {selected ? <Check className="size-5 text-[#9f3d25]" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={creating || name.trim().length < 2}
                onClick={() => void createChat()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white disabled:opacity-40"
              >
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Users className="size-4" />
                )}
                Criar conversa
              </button>
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {rooms.map((room) => (
            <Link
              key={room.id}
              to="/chats/$roomId"
              params={{ roomId: room.id }}
              className="rounded-3xl border border-[#ead9ca] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-[#f4e6d7] text-[#9f3d25]">
                <MessageCircle />
              </span>
              {unreadCounts[room.id] ? (
                <span className="float-right -mt-12 grid min-w-7 place-items-center rounded-full bg-[#d86132] px-2 py-1 text-xs font-black text-white">
                  {unreadCounts[room.id]}
                </span>
              ) : null}
              <h2 className="mt-4 text-xl font-black">{room.name || "Conversa privada"}</h2>
              <p className="mt-2 line-clamp-2 text-[#755348]">
                {room.description || "Espaço reservado para membros convidados."}
              </p>
              <span className="mt-5 inline-block text-sm font-bold text-[#9f3d25]">
                Abrir conversa →
              </span>
            </Link>
          ))}
          {!rooms.length ? (
            <div className="rounded-3xl border-2 border-dashed border-[#ead9ca] p-10 text-center md:col-span-2">
              <MessageCircle className="mx-auto size-9 text-[#9f3d25]" />
              <h2 className="mt-3 text-xl font-black">Nenhuma conversa ainda</h2>
              <p className="mt-2 text-[#755348]">
                Crie um espaço privado e convide as pessoas do projeto.
              </p>
            </div>
          ) : null}
        </section>
      </main>
      <EcosystemFooter />
    </div>
  );
}
