import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CalendarDays, Eye, Loader2, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/my-events")({ component: MyEventsPage });
type Submission = Tables<"community_event_submissions">;

const statuses: Record<string, { label: string; style: string; description: string }> = {
  draft: { label: "Rascunho", style: "bg-slate-100 text-slate-700", description: "Ainda não foi enviado para revisão." },
  processing: { label: "Organizando", style: "bg-violet-100 text-violet-800", description: "As informações estão sendo organizadas." },
  pending_review: { label: "Em revisão", style: "bg-amber-100 text-amber-800", description: "A equipe está conferindo as informações." },
  needs_information: { label: "Faltam informações", style: "bg-rose-100 text-rose-800", description: "Complete os dados indicados pela moderação." },
  changes_requested: { label: "Ajustes solicitados", style: "bg-rose-100 text-rose-800", description: "Edite o evento e envie novamente." },
  approved: { label: "Aprovado", style: "bg-sky-100 text-sky-800", description: "O evento foi aprovado e aguarda publicação." },
  published: { label: "Publicado", style: "bg-emerald-100 text-emerald-800", description: "O evento já está disponível na agenda." },
  rejected: { label: "Não aprovado", style: "bg-slate-100 text-slate-700", description: "Confira a observação da moderação." },
};

function MyEventsPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const id = auth.user?.id ?? null;
    setUserId(id);
    if (!id) return setLoading(false);
    const { data, error } = await supabase.from("community_event_submissions").select("*").eq("author_id", id).order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <div className="min-h-screen bg-[#fffaf3] text-[#351810]"><EcosystemHeader/><main className="mx-auto max-w-5xl px-4 py-10">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-black uppercase tracking-widest text-[#9f3d25]">Agenda colaborativa</p><h1 className="mt-1 text-4xl font-black">Meus eventos</h1><p className="mt-2 text-[#755348]">Acompanhe cada envio e veja quando alguma informação precisar de ajuste.</p></div><Link to="/submit-event" className="inline-flex items-center gap-2 rounded-xl bg-[#9f3d25] px-4 py-3 font-bold text-white"><Plus className="size-4"/>Divulgar evento</Link></div>
    {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="size-8 animate-spin text-[#9f3d25]"/></div> : !userId ? <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm"><CalendarDays className="mx-auto size-9 text-[#9f3d25]"/><p className="mt-3">Entre na comunidade para acompanhar seus eventos.</p><Link to="/join" className="mt-4 inline-block font-bold text-[#9f3d25]">Entrar na comunidade</Link></div> : items.length ? <section className="mt-8 grid gap-5">
      {items.map((item) => { const status = statuses[item.status] ?? { label: item.status, style: "bg-slate-100", description: "" }; const editable = ["draft", "needs_information", "changes_requested", "pending_review"].includes(item.status); return <article key={item.id} className="overflow-hidden rounded-3xl border border-[#ead9ca] bg-white shadow-sm"><div className="grid md:grid-cols-[13rem_1fr]">{item.cover_url ? <img src={item.cover_url} alt="" className="h-full min-h-48 w-full object-cover"/> : <div className="grid min-h-48 place-items-center bg-[#f4e6d7]"><CalendarDays className="size-10 text-[#9f3d25]"/></div>}<div className="p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`inline-block rounded-full px-3 py-1 text-xs font-black ${status.style}`}>{status.label}</span><h2 className="mt-3 text-2xl font-black">{item.title || "Evento sem título"}</h2><p className="mt-1 text-sm text-[#755348]">{status.description}</p></div><span className="text-xs text-[#8a5c4d]">Enviado em {new Date(item.created_at).toLocaleDateString("pt-BR")}</span></div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#5b392f]"><span>{item.event_date ? new Date(`${item.event_date}T12:00:00`).toLocaleDateString("pt-BR") : "Data não informada"}</span>{item.city ? <span>{item.city}</span> : null}{item.venue_name ? <span>{item.venue_name}</span> : null}</div>
        {item.moderation_notes ? <div className="mt-4 flex gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900"><AlertCircle className="mt-0.5 size-5 shrink-0"/><div><strong>Observação da moderação</strong><p className="mt-1">{item.moderation_notes}</p></div></div> : null}
        <div className="mt-5 flex flex-wrap gap-2">{editable ? <Link to="/event-edit/$submissionId" params={{ submissionId: item.id }} className="inline-flex items-center gap-2 rounded-xl border border-[#9f3d25] px-4 py-2 text-sm font-bold text-[#9f3d25]"><Pencil className="size-4"/>Editar evento</Link> : null}{item.status === "published" ? <Link to="/agenda" className="inline-flex items-center gap-2 rounded-xl border border-[#d8bca8] px-4 py-2 text-sm font-bold"><Eye className="size-4"/>Ver na agenda</Link> : null}</div>
      </div></div></article>; })}
    </section> : <div className="mt-8 rounded-3xl border-2 border-dashed border-[#ead9ca] p-10 text-center"><CalendarDays className="mx-auto size-10 text-[#9f3d25]"/><h2 className="mt-3 text-2xl font-black">Você ainda não enviou eventos</h2><p className="mt-2 text-[#755348]">Envie um card ou conte sobre a programação. A ferramenta organiza os dados para você.</p><Link to="/submit-event" className="mt-5 inline-block rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white">Divulgar primeiro evento</Link></div>}
  </main><EcosystemFooter/></div>;
}
