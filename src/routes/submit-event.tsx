import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, Loader2, ShieldCheck, Sparkles, WandSparkles, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { VoiceTextarea } from "@/components/community/VoiceTextarea";
import { supabase } from "@/integrations/supabase/client";
import { assistCommunityEvent } from "@/lib/community-event.functions";

export const Route = createFileRoute("/submit-event")({ component: SubmitEventPage });
const emptyForm = { source_text: "", title: "", description: "", event_date: "", start_time: "", venue_name: "", address: "", city: "", price_info: "", contact_info: "", ticket_url: "", category: "" };
type EventForm = typeof emptyForm;

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function SubmitEventPage() {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [aiData, setAiData] = useState<Record<string, unknown>>({});

  useEffect(() => { void supabase.auth.getUser().then(({ data }) => { if (!data.user) window.location.href = "/join"; else setUserId(data.user.id); }); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const field = (key: keyof EventForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Envie uma imagem JPG, PNG ou WebP.");
    if (file.size > 8 * 1024 * 1024) return toast.error("A imagem pode ter no máximo 8 MB.");
    if (preview) URL.revokeObjectURL(preview);
    setImage(file); setPreview(URL.createObjectURL(file));
  }

  async function assist() {
    if (!form.source_text.trim() && !image) return toast.info("Cole um texto, conte por voz ou envie o card do evento.");
    setAssisting(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
      const result = await assistCommunityEvent({ data: { accessToken: data.session.access_token, sourceText: form.source_text, image: image ? { mimeType: image.type as "image/jpeg" | "image/png" | "image/webp", data: await fileToBase64(image) } : null } });
      setForm((current) => ({ ...current, title: result.title || current.title, description: result.description || current.description, event_date: result.event_date || current.event_date, start_time: result.start_time || current.start_time, venue_name: result.venue_name || current.venue_name, city: result.city || current.city, price_info: result.price_info || current.price_info, contact_info: result.contact_info || current.contact_info, ticket_url: result.ticket_url || current.ticket_url, category: result.category || current.category }));
      setAiData(result.ai_extracted_data);
      toast.success(result.detectedEvents > 1 ? `${result.detectedEvents} eventos identificados. Confira os dados do primeiro.` : "Informações organizadas. Confira os campos antes de enviar.");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível organizar o evento."); }
    finally { setAssisting(false); }
  }

  async function uploadCover() {
    if (!image) return null;
    const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/events/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("community-public-images").upload(path, image, { contentType: image.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from("community-public-images").getPublicUrl(path).data.publicUrl;
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true);
    try {
      const coverUrl = await uploadCover();
      const { error } = await supabase.from("community_event_submissions").insert({ ...form, author_id: userId, input_type: image ? (form.source_text.trim() ? "mixed" : "image") : "text", cover_url: coverUrl, ai_extracted_data: aiData, status: "pending_review" });
      if (error) throw error;
      toast.success("Evento enviado para revisão!"); window.location.href = "/agenda";
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível enviar o evento."); }
    finally { setLoading(false); }
  }

  return <div className="min-h-screen bg-[#fffaf3] text-[#351810]"><EcosystemHeader/><main className="mx-auto max-w-4xl px-4 py-10">
    <div className="text-center"><span className="inline-flex items-center gap-2 rounded-full bg-[#f4e6d7] px-3 py-1 text-sm font-semibold text-[#9f3d25]"><Sparkles className="size-4"/>Publicação assistida</span><h1 className="mt-4 text-4xl font-black">Conte sobre o seu evento</h1><p className="mx-auto mt-3 max-w-2xl text-[#755348]">Envie o card, cole a divulgação ou explique por voz. A gente organiza e você confere antes de enviar.</p></div>
    <form onSubmit={(event) => void submit(event)} className="mt-8 space-y-5 rounded-[2rem] border bg-white p-6 shadow-xl md:p-9">
      <div className="grid gap-5 md:grid-cols-[1fr_220px]"><label className="block font-semibold">Cole o texto, link ou conte por voz<div className="mt-2"><VoiceTextarea value={form.source_text} onChange={(value) => field("source_text", value)} placeholder="Cole a divulgação ou toque no microfone..." rows={7}/></div></label>
        <div><span className="font-semibold">Card ou cartaz</span>{preview ? <div className="relative mt-2 overflow-hidden rounded-2xl border bg-[#f4e6d7]"><img src={preview} alt="Prévia do card do evento" className="aspect-square w-full object-cover"/><button type="button" onClick={() => { URL.revokeObjectURL(preview); setImage(null); setPreview(null); }} className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-white shadow" aria-label="Remover imagem"><X className="size-4"/></button></div> : <label className="mt-2 grid aspect-square cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-[#d8bca8] bg-[#fffaf3] p-4 text-center text-sm font-medium text-[#9f3d25]"><span><ImagePlus className="mx-auto mb-2 size-8"/>Selecionar imagem</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} className="sr-only"/></label>}</div></div>
      <button type="button" onClick={() => void assist()} disabled={assisting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f4e6d7] font-bold text-[#9f3d25] disabled:opacity-50">{assisting ? <><Loader2 className="size-5 animate-spin"/>Organizando informações...</> : <><WandSparkles className="size-5"/>Preencher informações automaticamente</>}</button>
      <label className="block font-semibold">Nome do evento<input required value={form.title} onChange={(e) => field("title", e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/></label>
      <label className="block font-semibold">Descrição<div className="mt-2"><VoiceTextarea value={form.description} onChange={(value) => field("description", value)} rows={4}/></div></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="font-semibold">Data<input required type="date" value={form.event_date} onChange={(e) => field("event_date", e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/></label><label className="font-semibold">Horário<input type="time" value={form.start_time} onChange={(e) => field("start_time", e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/></label>
        <label className="font-semibold">Local<input value={form.venue_name} onChange={(e) => field("venue_name", e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/></label><label className="font-semibold">Cidade<input required value={form.city} onChange={(e) => field("city", e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/></label>
        <label className="font-semibold">Endereço<input value={form.address} onChange={(e) => field("address", e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/></label><label className="font-semibold">Categoria<input value={form.category} onChange={(e) => field("category", e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4" placeholder="Música, teatro, oficina..."/></label>
        <label className="font-semibold">Valor<input value={form.price_info} onChange={(e) => field("price_info", e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4" placeholder="Gratuito, R$ 20..."/></label><label className="font-semibold">Contato<input value={form.contact_info} onChange={(e) => field("contact_info", e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/></label>
        <label className="font-semibold md:col-span-2">Link de ingresso<input value={form.ticket_url} onChange={(e) => field("ticket_url", e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/></label>
      </div>
      <div className="flex gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900"><ShieldCheck className="size-5 shrink-0"/><p className="text-sm">O evento passa por revisão e verificação de duplicidade antes de entrar na agenda.</p></div>
      <button disabled={loading || assisting || !userId} className="flex h-12 w-full items-center justify-center rounded-xl bg-[#9f3d25] font-bold text-white disabled:opacity-50">{loading ? <Loader2 className="size-5 animate-spin"/> : "Enviar evento para revisão"}</button>
    </form>
  </main><EcosystemFooter/></div>;
}
