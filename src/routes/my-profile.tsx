import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Mic,
  Sparkles,
  Trash2,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EcosystemHeader } from "@/components/community/EcosystemHeader";
import { VoiceTextarea } from "@/components/community/VoiceTextarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/my-profile")({ component: ProfileOnboarding });

const BUCKET = "community-public-images";
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const questions = [
  {
    key: "display_name",
    title: "Como você gostaria de aparecer?",
    help: "Pode ser seu nome, nome artístico, coletivo ou espaço.",
  },
  {
    key: "story",
    title: "Conte do seu jeito: o que você faz?",
    help: "Fale sobre sua arte, serviço, trajetória ou projeto.",
  },
  {
    key: "city",
    title: "Onde seu trabalho acontece?",
    help: "Informe cidade, bairro, região ou se trabalha online.",
  },
  {
    key: "goals",
    title: "Que conexões você procura?",
    help: "Parcerias, público, clientes, equipe, espaços ou oportunidades.",
  },
] as const;

type PortfolioItem = Tables<"portfolio_items">;
type Answers = Record<(typeof questions)[number]["key"], string>;

function validateImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return "Envie uma imagem JPG, PNG ou WebP.";
  if (file.size > MAX_IMAGE_SIZE) return "A imagem precisa ter no máximo 8 MB.";
  return null;
}

function fileExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function ProfileOnboarding() {
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [details, setDetails] = useState({
    artistic_name: "",
    profile_type: "artist",
    neighborhood: "",
    categories: "",
    skills: "",
    instagram: "",
    website: "",
    contact_email: "",
    contact_phone: "",
    public_email: false,
    public_phone: false,
    allow_direct_messages: true,
  });
  const [answers, setAnswers] = useState<Answers>({
    display_name: "",
    story: "",
    city: "",
    goals: "",
  });

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        window.location.href = "/join";
        return;
      }
      const id = authData.user.id;
      const [profileResult, portfolioResult] = await Promise.all([
        supabase
          .from("community_profiles")
          .select("display_name,artistic_name,profile_type,full_bio,city,neighborhood,categories,skills,collaboration_interests,avatar_url,instagram,website,contact_email,contact_phone,public_email,public_phone,allow_direct_messages")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("portfolio_items")
          .select("*")
          .eq("profile_id", id)
          .order("sort_order", { ascending: true }),
      ]);
      if (!active) return;
      setUserId(id);
      if (profileResult.data) {
        const interests = (profileResult.data.collaboration_interests ?? []).join(", ");
        const generatedInterestSentence = interests ? ` Tenho interesse em ${interests}.` : "";
        const savedBio = profileResult.data.full_bio ?? "";
        setAnswers({
          display_name: profileResult.data.display_name ?? "",
          story:
            generatedInterestSentence && savedBio.endsWith(generatedInterestSentence)
              ? savedBio.slice(0, -generatedInterestSentence.length)
              : savedBio,
          city: profileResult.data.city ?? "",
          goals: interests,
        });
        setAvatarUrl(profileResult.data.avatar_url);
        setDetails({
          artistic_name: profileResult.data.artistic_name ?? "",
          profile_type: profileResult.data.profile_type ?? "artist",
          neighborhood: profileResult.data.neighborhood ?? "",
          categories: (profileResult.data.categories ?? []).join(", "),
          skills: (profileResult.data.skills ?? []).join(", "),
          instagram: profileResult.data.instagram ?? "",
          website: profileResult.data.website ?? "",
          contact_email: profileResult.data.contact_email ?? "",
          contact_phone: profileResult.data.contact_phone ?? "",
          public_email: profileResult.data.public_email ?? false,
          public_phone: profileResult.data.public_phone ?? false,
          allow_direct_messages: profileResult.data.allow_direct_messages ?? true,
        });
      }
      setPortfolio(portfolioResult.data ?? []);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const bio = useMemo(
    () =>
      [
        answers.story.trim(),
        answers.goals.trim() ? `Tenho interesse em ${answers.goals.trim()}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    [answers.goals, answers.story],
  );

  async function saveProfile(complete = false) {
    if (!userId) return false;
    setSaving(true);
    const { error } = await supabase.from("community_profiles").upsert({
      id: userId,
      display_name: answers.display_name.trim(),
      full_bio: bio,
      city: answers.city.trim(),
      collaboration_interests: answers.goals
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      artistic_name: details.artistic_name.trim() || null,
      profile_type: details.profile_type,
      neighborhood: details.neighborhood.trim() || null,
      categories: details.categories.split(",").map((item) => item.trim()).filter(Boolean),
      skills: details.skills.split(",").map((item) => item.trim()).filter(Boolean),
      instagram: details.instagram.trim() || null,
      website: details.website.trim() || null,
      contact_email: details.contact_email.trim() || null,
      contact_phone: details.contact_phone.trim() || null,
      public_email: details.public_email,
      public_phone: details.public_phone,
      allow_direct_messages: details.allow_direct_messages,
      onboarding_status: complete ? "complete" : "draft",
      visibility: "public",
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  }

  async function uploadImage(file: File, folder: "avatar" | "portfolio") {
    const validationError = validateImage(file);
    if (validationError) throw new Error(validationError);
    const path = `${userId}/${folder}/${crypto.randomUUID()}.${fileExtension(file)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function changeAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !userId) return;
    setUploadingAvatar(true);
    try {
      const publicUrl = await uploadImage(file, "avatar");
      const { error } = await supabase
        .from("community_profiles")
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
      setAvatarUrl(publicUrl);
      toast.success("Foto de perfil atualizada.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível enviar a foto.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function addPortfolioImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || !userId) return;
    const validationError = files.map(validateImage).find(Boolean);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setUploadingPortfolio(true);
    try {
      for (const [index, file] of files.entries()) {
        const mediaUrl = await uploadImage(file, "portfolio");
        const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
        const { data, error } = await supabase
          .from("portfolio_items")
          .insert({
            profile_id: userId,
            media_type: "image",
            title,
            alt_text: title,
            media_url: mediaUrl,
            sort_order: portfolio.length + index,
            is_public: true,
          })
          .select("*")
          .single();
        if (error) throw error;
        setPortfolio((current) => [...current, data]);
      }
      toast.success(
        files.length === 1
          ? "Trabalho adicionado ao portfólio."
          : "Trabalhos adicionados ao portfólio.",
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível enviar o portfólio.");
    } finally {
      setUploadingPortfolio(false);
    }
  }

  async function removePortfolioItem(item: PortfolioItem) {
    const { error } = await supabase.from("portfolio_items").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPortfolio((current) => current.filter((candidate) => candidate.id !== item.id));
    toast.success("Imagem removida do portfólio.");
  }

  async function advance() {
    if (await saveProfile()) setStep((current) => current + 1);
  }

  async function finish() {
    if (!(await saveProfile(true))) return;
    toast.success("Seu perfil foi salvo!");
    window.location.href = `/people/${userId}`;
  }

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#fffaf3] text-[#9f3d25]">
        <Loader2 className="size-8 animate-spin" aria-label="Carregando perfil" />
      </div>
    );

  const question = questions[step];
  const value = answers[question.key];
  const isLastStep = step === questions.length - 1;

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex justify-between gap-4">
          <b className="text-[#9f3d25]">Seu perfil cultural</b>
          <span>
            {step + 1} de {questions.length}
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#ead9ca]">
          <div
            className="h-full rounded-full bg-[#d86132] transition-[width]"
            style={{ width: `${((step + 1) / questions.length) * 100}%` }}
          />
        </div>
        <section className="mt-8 rounded-[2rem] border border-[#ead9ca] bg-white p-6 shadow-xl md:p-10">
          <div className="flex gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#6d2418] text-[#ffc857]">
              <Sparkles />
            </span>
            <div>
              <p className="text-sm font-bold text-[#9f3d25]">Assistente de perfil</p>
              <h1 className="mt-1 text-3xl font-black">{question.title}</h1>
              <p className="mt-2 text-[#755348]">{question.help}</p>
            </div>
          </div>
          <div className="mt-7">
            <VoiceTextarea
              value={value}
              onChange={(next) => setAnswers((current) => ({ ...current, [question.key]: next }))}
              placeholder="Digite aqui ou toque no microfone para falar..."
              rows={step === 1 || step === 3 ? 6 : 3}
            />
          </div>
          {isLastStep && bio ? (
            <div className="mt-6 rounded-2xl bg-[#f4e6d7] p-5">
              <p className="text-xs font-bold uppercase text-[#9f3d25]">Prévia da sua bio</p>
              <p className="mt-2">{bio}</p>
            </div>
          ) : null}

          {isLastStep ? (
            <div className="mt-7 grid gap-5 border-t border-[#ead9ca] pt-7 md:grid-cols-2">
              <div className="md:col-span-2">
                <h2 className="text-xl font-black">Detalhes do perfil</h2>
                <p className="mt-1 text-sm text-[#755348]">
                  Complete o que fizer sentido. Contatos ficam privados até você escolher exibi-los.
                </p>
              </div>
              <ProfileField label="Nome artístico" value={details.artistic_name} onChange={(value) => setDetails((current) => ({ ...current, artistic_name: value }))} />
              <label className="grid gap-2 text-sm font-bold">
                Tipo de perfil
                <select value={details.profile_type} onChange={(event) => setDetails((current) => ({ ...current, profile_type: event.target.value }))} className="rounded-xl border border-[#d8bca8] bg-white px-4 py-3 font-normal">
                  <option value="artist">Artista</option>
                  <option value="collective">Coletivo</option>
                  <option value="space">Espaço cultural</option>
                  <option value="producer">Produção cultural</option>
                  <option value="professional">Profissional</option>
                  <option value="other">Outro</option>
                </select>
              </label>
              <ProfileField label="Bairro ou região" value={details.neighborhood} onChange={(value) => setDetails((current) => ({ ...current, neighborhood: value }))} />
              <ProfileField label="Categorias" help="Separe por vírgulas." value={details.categories} onChange={(value) => setDetails((current) => ({ ...current, categories: value }))} />
              <ProfileField label="Habilidades" help="Separe por vírgulas." value={details.skills} onChange={(value) => setDetails((current) => ({ ...current, skills: value }))} />
              <ProfileField label="Instagram" value={details.instagram} onChange={(value) => setDetails((current) => ({ ...current, instagram: value }))} />
              <ProfileField label="Site" value={details.website} onChange={(value) => setDetails((current) => ({ ...current, website: value }))} />
              <ProfileField label="E-mail de contato" value={details.contact_email} onChange={(value) => setDetails((current) => ({ ...current, contact_email: value }))} />
              <ProfileField label="Telefone de contato" value={details.contact_phone} onChange={(value) => setDetails((current) => ({ ...current, contact_phone: value }))} />
              <label className="flex items-start gap-3 rounded-2xl bg-[#fffaf3] p-4 text-sm md:col-span-2">
                <input type="checkbox" checked={details.public_email} onChange={(event) => setDetails((current) => ({ ...current, public_email: event.target.checked }))} className="mt-1" />
                <span><b>Mostrar meu e-mail no perfil público</b><br /><span className="text-[#755348]">Desativado por padrão.</span></span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl bg-[#fffaf3] p-4 text-sm md:col-span-2">
                <input type="checkbox" checked={details.public_phone} onChange={(event) => setDetails((current) => ({ ...current, public_phone: event.target.checked }))} className="mt-1" />
                <span><b>Mostrar meu telefone no perfil público</b><br /><span className="text-[#755348]">Desativado por padrão.</span></span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl bg-[#fffaf3] p-4 text-sm md:col-span-2">
                <input type="checkbox" checked={details.allow_direct_messages} onChange={(event) => setDetails((current) => ({ ...current, allow_direct_messages: event.target.checked }))} className="mt-1" />
                <span><b>Permitir novas conversas privadas</b><br /><span className="text-[#755348]">Você pode mudar esta preferência depois.</span></span>
              </label>
            </div>
          ) : null}

          {isLastStep ? (
            <div className="mt-7 border-t border-[#ead9ca] pt-7">
              <h2 className="text-xl font-black">Complete com imagens</h2>
              <p className="mt-1 text-sm text-[#755348]">
                Esta parte é opcional. Você pode atualizar ou acrescentar trabalhos quando quiser.
              </p>
              <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-3xl bg-[#f4e6d7] text-[#9f3d25]">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Sua foto de perfil"
                      className="size-full object-cover"
                    />
                  ) : (
                    <Camera className="size-8" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold">Foto de perfil</h3>
                  <p className="mt-1 text-sm text-[#755348]">JPG, PNG ou WebP, com até 8 MB.</p>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#9f3d25]/25 px-4 py-2 text-sm font-bold text-[#9f3d25]">
                    {uploadingAvatar ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                    {avatarUrl ? "Trocar foto" : "Adicionar foto"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={uploadingAvatar}
                      onChange={changeAvatar}
                    />
                  </label>
                </div>
              </div>
              <div className="mt-7">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="font-bold">Portfólio</h3>
                    <p className="mt-1 text-sm text-[#755348]">
                      Adicione imagens que ajudem a conhecer seu trabalho.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#351810] px-4 py-2 text-sm font-bold text-white">
                    {uploadingPortfolio ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ImagePlus className="size-4" />
                    )}
                    Adicionar imagens
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      disabled={uploadingPortfolio}
                      onChange={addPortfolioImages}
                    />
                  </label>
                </div>
                {portfolio.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {portfolio.map((item) => (
                      <figure
                        key={item.id}
                        className="relative aspect-square overflow-hidden rounded-2xl bg-[#f4e6d7]"
                      >
                        <img
                          src={item.media_url}
                          alt={item.alt_text ?? item.title ?? "Trabalho do portfólio"}
                          className="size-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => void removePortfolioItem(item)}
                          className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-white/95 text-red-700 shadow-md"
                          aria-label={`Remover ${item.title ?? "imagem"} do portfólio`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border-2 border-dashed border-[#ead9ca] p-6 text-center text-sm text-[#755348]">
                    Seu portfólio ainda não tem imagens.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-7 flex justify-between gap-3">
            <button
              type="button"
              disabled={step === 0 || saving}
              onClick={() => setStep((current) => current - 1)}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
              Voltar
            </button>
            {!isLastStep ? (
              <button
                type="button"
                disabled={!value.trim() || saving}
                onClick={() => void advance()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white disabled:opacity-40"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}Continuar
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving || !value.trim() || uploadingAvatar || uploadingPortfolio}
                onClick={() => void finish()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Publicar perfil
              </button>
            )}
          </div>
        </section>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#8a5c4d]">
          <Mic className="size-4" />
          Você pode misturar voz e digitação.
        </div>
        <Link
          to="/community"
          className="mt-4 block text-center text-sm font-semibold text-[#9f3d25]"
        >
          Continuar depois
        </Link>
      </main>
    </div>
  );
}


function ProfileField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-[#d8bca8] bg-white px-4 py-3 font-normal"
      />
      {help ? <span className="text-xs font-normal text-[#755348]">{help}</span> : null}
    </label>
  );
}
