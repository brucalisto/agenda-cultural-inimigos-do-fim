import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, Loader2, Store, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EcosystemHeader } from "@/components/community/EcosystemHeader";
import { VoiceTextarea } from "@/components/community/VoiceTextarea";
import { supabase } from "@/integrations/supabase/client";
import { normalizeContactUrl } from "@/lib/community-links";

export const Route = createFileRoute("/marketplace-new")({ component: NewListing });

const initialForm = {
  listing_type: "service",
  title: "",
  description: "",
  category: "",
  price_label: "",
  city: "",
  contact_url: "",
};

function ImagePreview({
  file,
  index,
  onRemove,
}: {
  file: File;
  index: number;
  onRemove: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-[#f4e6d7]">
      <img src={url} alt={`Prévia ${index + 1}`} className="aspect-square w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/70 text-white"
        aria-label={`Remover ${file.name}`}
      >
        <X className="size-4" />
      </button>
      {index === 0 ? (
        <span className="absolute bottom-2 left-2 rounded-full bg-[#351810] px-2 py-1 text-xs font-bold text-white">
          Capa
        </span>
      ) : null}
    </div>
  );
}

function NewListing() {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState<File[]>([]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = "/join";
      else setUserId(data.user.id);
    });
  }, []);

  function field(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseImages(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      toast.error("Use imagens JPG, PNG ou WebP.");
      return;
    }
    if (selected.some((file) => file.size > 8 * 1024 * 1024)) {
      toast.error("Cada imagem pode ter no máximo 8 MB.");
      return;
    }
    setImages((current) => [...current, ...selected].slice(0, 6));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!userId) return;
    const contactUrl = normalizeContactUrl(form.contact_url);
    if (form.contact_url.trim() && !contactUrl) {
      toast.error("Informe um link, @ do Instagram ou número de WhatsApp válido.");
      return;
    }
    setLoading(true);
    const listingId = crypto.randomUUID();
    const uploadedPaths: string[] = [];
    const galleryUrls: string[] = [];
    for (const image of images) {
      const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/marketplace/${listingId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("community-public-images").upload(path, image, {
        contentType: image.type,
        upsert: false,
      });
      if (error) {
        if (uploadedPaths.length)
          await supabase.storage.from("community-public-images").remove(uploadedPaths);
        setLoading(false);
        toast.error(error.message);
        return;
      }
      uploadedPaths.push(path);
      galleryUrls.push(
        supabase.storage.from("community-public-images").getPublicUrl(path).data.publicUrl,
      );
    }

    const { error } = await supabase.from("marketplace_listings").insert({
      id: listingId,
      ...form,
      contact_url: contactUrl,
      cover_url: galleryUrls[0] ?? null,
      gallery_urls: galleryUrls,
      owner_id: userId,
      status: "pending",
    });
    setLoading(false);
    if (error) {
      if (uploadedPaths.length)
        await supabase.storage.from("community-public-images").remove(uploadedPaths);
      toast.error(error.message);
      return;
    }
    toast.success("Seu anúncio foi enviado para revisão.");
    window.location.href = "/marketplace";
  }

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="text-center">
          <Store className="mx-auto size-10 text-[#9f3d25]" />
          <h1 className="mt-3 text-4xl font-black">Divulgue seu trabalho</h1>
          <p className="mt-2 text-[#755348]">
            O anúncio será revisado antes de aparecer no marketplace.
          </p>
        </div>
        <form
          onSubmit={(event) => void submit(event)}
          className="mt-8 space-y-5 rounded-[2rem] border border-[#ead9ca] bg-white p-6 shadow-xl md:p-9"
        >
          <label className="block font-semibold">
            O que você oferece?
            <select
              value={form.listing_type}
              onChange={(event) => field("listing_type", event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border bg-white px-3"
            >
              <option value="product">Produto</option>
              <option value="service">Serviço</option>
              <option value="class">Aula ou oficina</option>
              <option value="experience">Experiência</option>
            </select>
          </label>
          <label className="block font-semibold">
            Título
            <input
              required
              maxLength={120}
              value={form.title}
              onChange={(event) => field("title", event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border px-4"
              placeholder="Ex.: Fotografia para eventos culturais"
            />
          </label>
          <label className="block font-semibold">
            Conte sobre seu trabalho
            <div className="mt-2">
              <VoiceTextarea
                value={form.description}
                onChange={(value) => field("description", value)}
                placeholder="Fale ou digite: o que você oferece e como funciona?"
                rows={6}
              />
            </div>
          </label>

          <div>
            <span className="font-semibold">Imagens do trabalho</span>
            <p className="mt-1 text-sm text-[#755348]">
              Até 6 imagens. A primeira será usada como capa.
            </p>
            {images.length ? (
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                {images.map((image, index) => (
                  <ImagePreview
                    key={`${image.name}-${image.lastModified}`}
                    file={image}
                    index={index}
                    onRemove={() =>
                      setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                  />
                ))}
              </div>
            ) : null}
            {images.length < 6 ? (
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#d8bca8] p-5 font-bold text-[#9f3d25]">
                <ImagePlus className="size-5" />
                Adicionar imagens
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    chooseImages(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="font-semibold">
              Categoria
              <input
                required
                maxLength={80}
                value={form.category}
                onChange={(event) => field("category", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
                placeholder="Fotografia, artesanato..."
              />
            </label>
            <label className="font-semibold">
              Valor
              <input
                value={form.price_label}
                onChange={(event) => field("price_label", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
                placeholder="R$ 100, sob consulta..."
              />
            </label>
            <label className="font-semibold">
              Cidade
              <input
                value={form.city}
                onChange={(event) => field("city", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
              />
            </label>
            <label className="font-semibold">
              Contato
              <input
                value={form.contact_url}
                onChange={(event) => field("contact_url", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
                placeholder="WhatsApp, @Instagram ou site"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={loading || !userId}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#9f3d25] font-bold text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-5 animate-spin" /> : "Enviar para revisão"}
          </button>
        </form>
      </main>
    </div>
  );
}
