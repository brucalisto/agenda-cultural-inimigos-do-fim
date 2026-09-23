import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { VoiceTextarea } from "@/components/community/VoiceTextarea";
import { supabase } from "@/integrations/supabase/client";
import { assistCommunityEvent } from "@/lib/community-event.functions";

export const Route = createFileRoute("/submit-event")({ component: SubmitEventPage });

const emptyForm = {
  source_text: "",
  title: "",
  description: "",
  event_date: "",
  start_time: "",
  venue_name: "",
  address: "",
  city: "",
  price_info: "",
  contact_info: "",
  ticket_url: "",
  category: "",
};
type EventForm = typeof emptyForm;
type Draft = { form: EventForm; aiData: Record<string, unknown> };

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
  const [drafts, setDrafts] = useState<Draft[]>([{ form: emptyForm, aiData: {} }]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const form = drafts[activeIndex].form;

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = "/join";
      else setUserId(data.user.id);
    });
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function field(key: keyof EventForm, value: string) {
    setDrafts((current) =>
      current.map((draft, index) =>
        index === activeIndex ? { ...draft, form: { ...draft.form, [key]: value } } : draft,
      ),
    );
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return void toast.error("Envie uma imagem JPG, PNG ou WebP.");
    if (file.size > 8 * 1024 * 1024) return void toast.error("A imagem pode ter no máximo 8 MB.");
    if (preview) URL.revokeObjectURL(preview);
    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  function removeDraft(index: number) {
    if (drafts.length === 1) return;
    setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index));
    setActiveIndex((current) =>
      Math.max(0, current > index ? current - 1 : current === index ? 0 : current),
    );
  }

  async function assist() {
    if (!form.source_text.trim() && !image)
      return void toast.info("Cole um texto, conte por voz ou envie o card do evento.");
    setAssisting(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
      const sourceText = form.source_text;
      const result = await assistCommunityEvent({
        data: {
          accessToken: data.session.access_token,
          sourceText,
          image: image
            ? {
                mimeType: image.type as "image/jpeg" | "image/png" | "image/webp",
                data: await fileToBase64(image),
              }
            : null,
        },
      });
      const extractedDrafts: Draft[] = result.events.map((item) => ({
        form: {
          ...emptyForm,
          source_text: sourceText,
          title: item.title,
          description: item.description,
          event_date: item.event_date,
          start_time: item.start_time,
          venue_name: item.venue_name,
          city: item.city,
          price_info: item.price_info,
          contact_info: item.contact_info,
          ticket_url: item.ticket_url,
          category: item.category,
        },
        aiData: { ...item.ai_extracted_data, detected_events: result.detectedEvents },
      }));
      if (extractedDrafts.length) setDrafts(extractedDrafts);
      setActiveIndex(0);
      toast.success(
        extractedDrafts.length > 1
          ? `${extractedDrafts.length} eventos separados. Confira cada um antes de enviar.`
          : "Informações organizadas. Confira os campos antes de enviar.",
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível organizar o evento.");
    } finally {
      setAssisting(false);
    }
  }

  async function uploadCover() {
    if (!image) return null;
    const extension =
      image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/events/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("community-public-images")
      .upload(path, image, { contentType: image.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from("community-public-images").getPublicUrl(path).data.publicUrl;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const incompleteIndex = drafts.findIndex(
      (draft) => !draft.form.title.trim() || !draft.form.event_date || !draft.form.city.trim(),
    );
    if (incompleteIndex >= 0) {
      setActiveIndex(incompleteIndex);
      toast.error(`Complete nome, data e cidade do evento ${incompleteIndex + 1}.`);
      return;
    }
    setLoading(true);
    try {
      const coverUrl = await uploadCover();
      const rows = drafts.map((draft) => ({
        ...draft.form,
        author_id: userId,
        input_type: image ? (draft.form.source_text.trim() ? "mixed" : "image") : "text",
        cover_url: coverUrl,
        ai_extracted_data: draft.aiData,
        status: "pending_review",
      }));
      const { error } = await supabase.from("community_event_submissions").insert(rows);
      if (error) throw error;
      toast.success(
        rows.length === 1
          ? "Evento enviado para revisão!"
          : `${rows.length} eventos enviados para revisão!`,
      );
      window.location.href = "/my-events";
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível enviar os eventos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#f4e6d7] px-3 py-1 text-sm font-semibold text-[#9f3d25]">
            <Sparkles className="size-4" />
            Publicação assistida
          </span>
          <h1 className="mt-4 text-4xl font-black">Conte sobre sua programação</h1>
          <p className="mx-auto mt-3 max-w-2xl text-[#755348]">
            Envie um evento ou uma programação completa. A ferramenta separa, organiza e deixa tudo
            pronto para sua conferência.
          </p>
        </div>
        <form
          onSubmit={(event) => void submit(event)}
          className="mt-8 space-y-5 rounded-[2rem] border bg-white p-6 shadow-xl md:p-9"
        >
          <div className="grid gap-5 md:grid-cols-[1fr_220px]">
            <label className="block font-semibold">
              Cole o texto, link ou conte por voz
              <div className="mt-2">
                <VoiceTextarea
                  value={form.source_text}
                  onChange={(value) => field("source_text", value)}
                  placeholder="Cole a divulgação ou toque no microfone..."
                  rows={7}
                />
              </div>
            </label>
            <div>
              <span className="font-semibold">Card ou cartaz</span>
              {preview ? (
                <div className="relative mt-2 overflow-hidden rounded-2xl border bg-[#f4e6d7]">
                  <img
                    src={preview}
                    alt="Prévia do card dos eventos"
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(preview);
                      setImage(null);
                      setPreview(null);
                    }}
                    className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-white shadow"
                    aria-label="Remover imagem"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <label className="mt-2 grid aspect-square cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-[#d8bca8] bg-[#fffaf3] p-4 text-center text-sm font-medium text-[#9f3d25]">
                  <span>
                    <ImagePlus className="mx-auto mb-2 size-8" />
                    Selecionar imagem
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={chooseImage}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void assist()}
            disabled={assisting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f4e6d7] font-bold text-[#9f3d25] disabled:opacity-50"
          >
            {assisting ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Organizando programação...
              </>
            ) : (
              <>
                <WandSparkles className="size-5" />
                Separar e preencher eventos automaticamente
              </>
            )}
          </button>
          {drafts.length > 1 ? (
            <div className="rounded-2xl border border-[#ead9ca] bg-[#fffaf3] p-4">
              <p className="text-sm font-bold text-[#755348]">
                {drafts.length} eventos encontrados — confira cada um:
              </p>
              <div
                className="mt-3 flex gap-2 overflow-x-auto pb-1"
                role="tablist"
                aria-label="Eventos encontrados"
              >
                {drafts.map((draft, index) => (
                  <button
                    key={`${draft.form.title}-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={index === activeIndex}
                    onClick={() => setActiveIndex(index)}
                    className={`min-w-40 rounded-xl border px-4 py-3 text-left text-sm ${index === activeIndex ? "border-[#9f3d25] bg-[#9f3d25] text-white" : "border-[#d8bca8] bg-white text-[#5b392f]"}`}
                  >
                    <span className="flex items-center gap-2 font-black">
                      <Check className="size-4" />
                      Evento {index + 1}
                    </span>
                    <span className="mt-1 block truncate">{draft.form.title || "Sem título"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">
              {drafts.length > 1 ? `Conferir evento ${activeIndex + 1}` : "Confira as informações"}
            </h2>
            {drafts.length > 1 ? (
              <button
                type="button"
                onClick={() => removeDraft(activeIndex)}
                className="inline-flex items-center gap-2 text-sm font-bold text-rose-700"
              >
                <Trash2 className="size-4" />
                Remover este evento
              </button>
            ) : null}
          </div>
          <label className="block font-semibold">
            Nome do evento
            <input
              required
              value={form.title}
              onChange={(event) => field("title", event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border px-4"
            />
          </label>
          <label className="block font-semibold">
            Descrição
            <div className="mt-2">
              <VoiceTextarea
                value={form.description}
                onChange={(value) => field("description", value)}
                rows={4}
              />
            </div>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="font-semibold">
              Data
              <input
                required
                type="date"
                value={form.event_date}
                onChange={(event) => field("event_date", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
              />
            </label>
            <label className="font-semibold">
              Horário
              <input
                type="time"
                value={form.start_time}
                onChange={(event) => field("start_time", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
              />
            </label>
            <label className="font-semibold">
              Local
              <input
                value={form.venue_name}
                onChange={(event) => field("venue_name", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
              />
            </label>
            <label className="font-semibold">
              Cidade
              <input
                required
                value={form.city}
                onChange={(event) => field("city", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
              />
            </label>
            <label className="font-semibold">
              Endereço
              <input
                value={form.address}
                onChange={(event) => field("address", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
              />
            </label>
            <label className="font-semibold">
              Categoria
              <input
                value={form.category}
                onChange={(event) => field("category", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
                placeholder="Música, teatro, oficina..."
              />
            </label>
            <label className="font-semibold">
              Valor
              <input
                value={form.price_info}
                onChange={(event) => field("price_info", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
                placeholder="Gratuito, R$ 20..."
              />
            </label>
            <label className="font-semibold">
              Contato
              <input
                value={form.contact_info}
                onChange={(event) => field("contact_info", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
              />
            </label>
            <label className="font-semibold md:col-span-2">
              Link de ingresso
              <input
                value={form.ticket_url}
                onChange={(event) => field("ticket_url", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
              />
            </label>
          </div>
          <div className="flex gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
            <ShieldCheck className="size-5 shrink-0" />
            <p className="text-sm">
              Todos os eventos passam por revisão e verificação de duplicidade antes de entrar na
              agenda.
            </p>
          </div>
          <button
            disabled={loading || assisting || !userId}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#9f3d25] font-bold text-white disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : drafts.length > 1 ? (
              `Enviar ${drafts.length} eventos para revisão`
            ) : (
              "Enviar evento para revisão"
            )}
          </button>
        </form>
      </main>
      <EcosystemFooter />
    </div>
  );
}
