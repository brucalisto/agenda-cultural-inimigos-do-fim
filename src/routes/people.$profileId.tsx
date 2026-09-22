import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ImageIcon, Loader2, MapPin, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/people/$profileId")({ component: PublicProfilePage });

type Profile = Pick<
  Tables<"community_profiles">,
  | "id"
  | "display_name"
  | "artistic_name"
  | "profile_type"
  | "short_bio"
  | "full_bio"
  | "city"
  | "avatar_url"
  | "collaboration_interests"
>;
type PortfolioItem = Tables<"portfolio_items">;

function PublicProfilePage() {
  const { profileId } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const [profileResult, portfolioResult] = await Promise.all([
        supabase
          .from("community_profiles")
          .select(
            "id,display_name,artistic_name,profile_type,short_bio,full_bio,city,avatar_url,collaboration_interests",
          )
          .eq("id", profileId)
          .eq("visibility", "public")
          .maybeSingle(),
        supabase
          .from("portfolio_items")
          .select("*")
          .eq("profile_id", profileId)
          .eq("is_public", true)
          .order("sort_order", { ascending: true }),
      ]);
      if (!active) return;
      setProfile(profileResult.data);
      setPortfolio(portfolioResult.data ?? []);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [profileId]);

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#fffaf3] text-[#9f3d25]">
        <Loader2 className="size-8 animate-spin" aria-label="Carregando perfil" />
      </div>
    );

  if (!profile)
    return (
      <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
        <EcosystemHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Sparkles className="mx-auto size-10 text-[#9f3d25]" />
          <h1 className="mt-4 text-3xl font-black">Perfil não encontrado</h1>
          <Link
            to="/people"
            className="mt-6 inline-flex items-center gap-2 font-bold text-[#9f3d25]"
          >
            <ArrowLeft className="size-4" />
            Voltar para a comunidade
          </Link>
        </main>
      </div>
    );

  const name = profile.artistic_name || profile.display_name || "Perfil cultural";

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main>
        <section className="bg-[#351810] px-4 py-10 text-white">
          <div className="mx-auto max-w-6xl">
            <Link
              to="/people"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#ffc857]"
            >
              <ArrowLeft className="size-4" />
              Voltar para pessoas
            </Link>
            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="grid size-36 shrink-0 place-items-center overflow-hidden rounded-[2rem] bg-[#f4e6d7] text-5xl font-black text-[#9f3d25]">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={`Foto de ${name}`}
                    className="size-full object-cover"
                  />
                ) : (
                  name[0]
                )}
              </div>
              <div>
                <p className="font-bold uppercase tracking-widest text-[#ffc857]">
                  {profile.profile_type}
                </p>
                <h1 className="mt-2 text-4xl font-black md:text-6xl">{name}</h1>
                {profile.city ? (
                  <p className="mt-4 flex items-center gap-2 text-orange-100">
                    <MapPin className="size-5" />
                    {profile.city}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[.8fr_1.2fr]">
          <article className="rounded-3xl border border-[#ead9ca] bg-white p-7 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-widest text-[#9f3d25]">Sobre</p>
            <h2 className="mt-2 text-2xl font-black">Trajetória e trabalho</h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-[#755348]">
              {profile.full_bio ||
                profile.short_bio ||
                "Este perfil ainda está construindo sua apresentação."}
            </p>
            {profile.collaboration_interests.length ? (
              <div className="mt-6">
                <h3 className="font-bold">Interesses e conexões</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.collaboration_interests.map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full bg-[#f4e6d7] px-3 py-1 text-sm text-[#6d2418]"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </article>

          <article>
            <p className="text-sm font-bold uppercase tracking-widest text-[#9f3d25]">Portfólio</p>
            <h2 className="mt-2 text-3xl font-black">Conheça esse trabalho</h2>
            {portfolio.length ? (
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
                {portfolio.map((item) => (
                  <figure
                    key={item.id}
                    className="overflow-hidden rounded-3xl border border-[#ead9ca] bg-white shadow-sm"
                  >
                    <img
                      src={item.media_url}
                      alt={item.alt_text ?? item.title ?? `Trabalho de ${name}`}
                      className="aspect-square w-full object-cover"
                    />
                    {item.title ? (
                      <figcaption className="p-4 text-sm font-bold">{item.title}</figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border-2 border-dashed border-[#ead9ca] p-10 text-center text-[#755348]">
                <ImageIcon className="mx-auto size-9 text-[#9f3d25]" />
                <p className="mt-3">Este portfólio ainda não tem imagens publicadas.</p>
              </div>
            )}
          </article>
        </section>
      </main>
      <EcosystemFooter />
    </div>
  );
}
