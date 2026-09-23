import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Loader2, MessageCircle, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/admin-chat-moderation")({ component: AdminChatModerationPage });

type Room = Tables<"chat_rooms">;

function AdminChatModerationPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadPending() {
    const { data, error } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("room_type", "group")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: true });
    if (error) {
      setAuthorized(false);
      return;
    }
    setRooms(data ?? []);
    setAuthorized(true);
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setAuthorized(false);
        return;
      }
      const { data: admin } = await supabase
        .from("admin_users")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!admin) {
        setAuthorized(false);
        return;
      }
      await loadPending();
    }
    void load();
  }, []);

  async function moderate(room: Room, decision: "approved" | "rejected") {
    setBusyId(room.id);
    const { error } = await supabase.rpc("moderate_thematic_chat", {
      target_room_id: room.id,
      decision,
      notes: notes[room.id]?.trim() || null,
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(decision === "approved" ? "Conversa aprovada." : "Conversa não aprovada.");
    setRooms((current) => current.filter((item) => item.id !== room.id));
  }

  if (authorized === null) return <div className="grid min-h-screen place-items-center bg-[#fffaf3]"><Loader2 className="size-8 animate-spin text-[#9f3d25]" /></div>;

  if (!authorized) return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <ShieldCheck className="mx-auto size-12 text-[#9f3d25]" />
        <h1 className="mt-4 text-3xl font-black">Área administrativa</h1>
        <p className="mt-2 text-[#755348]">Esta página é restrita à equipe de moderação.</p>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link to="/chats" className="inline-flex items-center gap-2 text-sm font-bold text-[#9f3d25]"><ArrowLeft className="size-4" /> Conversas</Link>
        <div className="mt-4 flex items-center gap-3">
          <ShieldCheck className="size-9 text-[#9f3d25]" />
          <div>
            <h1 className="text-3xl font-black">Moderar conversas temáticas</h1>
            <p className="text-sm text-[#755348]">Revise as propostas antes de liberá-las para a comunidade.</p>
          </div>
        </div>
        <section className="mt-7 grid gap-4">
          {rooms.map((room) => (
            <article key={room.id} className="rounded-3xl border border-[#ead9ca] bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f4e6d7] text-[#9f3d25]"><MessageCircle className="size-5" /></span>
                <div>
                  <h2 className="text-xl font-black">{room.name}</h2>
                  <p className="mt-1 whitespace-pre-line text-sm text-[#755348]">{room.description || "Sem descrição."}</p>
                </div>
              </div>
              <textarea value={notes[room.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [room.id]: event.target.value }))} rows={2} placeholder="Observação da moderação (opcional)" className="mt-4 w-full rounded-xl border border-[#ead9ca] px-4 py-3 text-sm" />
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" disabled={busyId === room.id} onClick={() => void moderate(room, "rejected")} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-40"><X className="size-4" /> Não aprovar</button>
                <button type="button" disabled={busyId === room.id} onClick={() => void moderate(room, "approved")} className="inline-flex items-center gap-2 rounded-xl bg-[#9f3d25] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{busyId === room.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Aprovar</button>
              </div>
            </article>
          ))}
          {!rooms.length ? <div className="rounded-3xl border-2 border-dashed border-[#ead9ca] p-10 text-center text-[#755348]">Nenhuma conversa temática aguardando revisão.</div> : null}
        </section>
      </main>
    </div>
  );
}
