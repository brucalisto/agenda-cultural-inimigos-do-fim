import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ImagePlus, Loader2, Pencil, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EcosystemHeader } from "@/components/community/EcosystemHeader";
import { VoiceTextarea } from "@/components/community/VoiceTextarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";
import { normalizeContactUrl } from "@/lib/community-links";

export const Route = createFileRoute("/marketplace-edit/$listingId")({
  component: EditListingPage,
});
type Listing = Tables<"marketplace_listings">;

function LocalPreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="Nova imagem" className="aspect-square w-full object-cover" />;
}

function EditListingPage() {
  const { listingId } = Route.useParams();
  const [userId, setUserId] = useState("");
  const [listing, setListing] = useState<Listing | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [form, setForm] = useState({
    listing_type: "service",
    title: "",
    description: "",
    category: "",
    price_label: "",
    city: "",
    contact_url: "",
  });

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const id = authData.user?.id;
      if (!id) {
        window.location.href = "/join";
        return;
      }
      setUserId(id);
      const { data } = await supabase
        .from("marketplace_listings")
        .select("*")
        .eq("id", listingId)
        .eq("owner_id", id)
        .maybeSingle();
      setListing(data);
      if (data) {
        setExistingImages(
          data.gallery_urls.length ? data.gallery_urls : data.cover_url ? [data.cover_url] : [],
        );
        setForm({
          listing_type: data.listing_type,
          title: data.title,
          description: data.description ?? "",
          category: data.category ?? "",
          price_label: data.price_label ?? "",
          city: data.city ?? "",
          contact_url: data.contact_url ?? "",
        });
      }
      setPageLoading(false);
    }
    void load();
  }, [listingId]);

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
    const available = Math.max(0, 6 - existingImages.length - newImages.length);
    setNewImages((current) => [...current, ...selected.slice(0, available)]);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!listing || !userId) return;
    const contactUrl = normalizeContactUrl(form.contact_url);
    if (form.contact_url.trim() && !contactUrl) {
      toast.error("Informe um contato válido.");
      return;
    }
    setSaving(true);
    const uploadedPaths: string[] = [];
    const addedUrls: string[] = [];
    for (const image of newImages) {
      const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/marketplace/${listing.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from("community-public-images")
        .upload(path, image, { contentType: image.type, upsert: false });
      if (error) {
        if (uploadedPaths.length)
          await supabase.storage.from("community-public-images").remove(uploadedPaths);
        setSaving(false);
        toast.error(error.message);
        return;
      }
      uploadedPaths.push(path);
      addedUrls.push(
        supabase.storage.from("community-public-images").getPublicUrl(path).data.publicUrl,
      );
    }
    const gallery = [...existingImages, ...addedUrls];
    const { error } = await supabase
      .from("marketplace_listings")
      .update({
        ...form,
        contact_url: contactUrl,
        cover_url: gallery[0] ?? null,
        gallery_urls: gallery,
        status: "pending",
        moderation_notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id)
      .eq("owner_id", userId);
    setSaving(false);
    if (error) {
      if (uploadedPaths.length)
        await supabase.storage.from("community-public-images").remove(uploadedPaths);
      toast.error(error.message);
      return;
    }
    toast.success("Alterações salvas e anúncio enviado para revisão.");
    window.location.href = "/my-listings";
  }

  if (pageLoading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#fffaf3]">
        <Loader2 className="size-8 animate-spin text-[#9f3d25]" />
      </div>
    );
  if (!listing || listing.status === "published")
    return (
      <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
        <EcosystemHeader />
        <main className="mx-auto max-w-2xl px-4 py-20 text-center">
          <Pencil className="mx-auto size-10 text-[#9f3d25]" />
          <h1 className="mt-4 text-3xl font-black">Anúncio indisponível para edição</h1>
          <p className="mt-2 text-[#755348]">
            Se estiver publicado, pause o anúncio antes de editar.
          </p>
          <Link
            to="/my-listings"
            className="mt-6 inline-flex items-center gap-2 font-bold text-[#9f3d25]"
          >
            <ArrowLeft className="size-4" />
            Voltar aos meus anúncios
          </Link>
        </main>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link
          to="/my-listings"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#9f3d25]"
        >
          <ArrowLeft className="size-4" />
          Meus anúncios
        </Link>
        <h1 className="mt-5 text-4xl font-black">Editar anúncio</h1>
        <p className="mt-2 text-[#755348]">Ao salvar, o anúncio volta para a fila de revisão.</p>
        <form
          onSubmit={(event) => void save(event)}
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
            />
          </label>
          <label className="block font-semibold">
            Descrição
            <div className="mt-2">
              <VoiceTextarea
                value={form.description}
                onChange={(value) => field("description", value)}
                rows={6}
              />
            </div>
          </label>
          <div>
            <span className="font-semibold">Galeria</span>
            <p className="mt-1 text-sm text-[#755348]">
              A primeira imagem é a capa. Remova ou acrescente imagens antes de reenviar.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              {existingImages.map((url, index) => (
                <div key={url} className="relative overflow-hidden rounded-2xl border">
                  <img
                    src={url}
                    alt={`Imagem ${index + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setExistingImages((current) => current.filter((item) => item !== url))
                    }
                    className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/70 text-white"
                    aria-label={`Remover imagem ${index + 1}`}
                  >
                    <X className="size-4" />
                  </button>
                  {index === 0 ? (
                    <span className="absolute bottom-2 left-2 rounded-full bg-[#351810] px-2 py-1 text-xs font-bold text-white">
                      Capa
                    </span>
                  ) : null}
                </div>
              ))}
              {newImages.map((file, index) => (
                <div
                  key={`${file.name}-${file.lastModified}`}
                  className="relative overflow-hidden rounded-2xl border"
                >
                  <LocalPreview file={file} />
                  <button
                    type="button"
                    onClick={() =>
                      setNewImages((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/70 text-white"
                    aria-label={`Remover ${file.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            {existingImages.length + newImages.length < 6 ? (
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
                value={form.category}
                onChange={(event) => field("category", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
              />
            </label>
            <label className="font-semibold">
              Valor
              <input
                value={form.price_label}
                onChange={(event) => field("price_label", event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4"
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
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#9f3d25] font-bold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-5 animate-spin" /> : "Salvar e enviar para revisão"}
          </button>
        </form>
      </main>
    </div>
  );
}
