import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Image, Loader2, MapPin, Store, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";
import { normalizeContactUrl } from "@/lib/community-links";

export const Route = createFileRoute("/marketplace/$listingId")({ component: ListingDetailPage });
type Listing = Tables<"marketplace_listings">;
type Owner = Pick<
  Tables<"community_profiles">,
  "id" | "display_name" | "artistic_name" | "avatar_url" | "short_bio" | "city" | "verified"
>;

function ListingDetailPage() {
  const { listingId } = Route.useParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [related, setRelated] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("marketplace_listings")
        .select("*")
        .eq("id", listingId)
        .eq("status", "published")
        .maybeSingle();
      setListing(data);
      if (!data) {
        setLoading(false);
        return;
      }
      const [ownerResult, relatedResult] = await Promise.all([
        supabase
          .from("community_profiles")
          .select("id,display_name,artistic_name,avatar_url,short_bio,city,verified")
          .eq("id", data.owner_id)
          .maybeSingle(),
        supabase
          .from("marketplace_listings")
          .select("*")
          .eq("status", "published")
          .eq("category", data.category ?? "")
          .neq("id", data.id)
          .limit(3),
      ]);
      setOwner(ownerResult.data);
      setRelated(relatedResult.data ?? []);
      setLoading(false);
    }
    void load();
  }, [listingId]);

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#fffaf3] text-[#9f3d25]">
        <Loader2 className="size-8 animate-spin" aria-label="Carregando anúncio" />
      </div>
    );
  if (!listing)
    return (
      <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
        <EcosystemHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Store className="mx-auto size-10 text-[#9f3d25]" />
          <h1 className="mt-4 text-3xl font-black">Anúncio indisponível</h1>
          <p className="mt-2 text-[#755348]">
            Ele pode estar em revisão, pausado ou ter sido removido.
          </p>
          <Link
            to="/marketplace"
            className="mt-6 inline-flex items-center gap-2 font-bold text-[#9f3d25]"
          >
            <ArrowLeft className="size-4" />
            Voltar ao marketplace
          </Link>
        </main>
      </div>
    );

  const images = listing.gallery_urls.length
    ? listing.gallery_urls
    : listing.cover_url
      ? [listing.cover_url]
      : [];
  const ownerName = owner?.artistic_name || owner?.display_name || "Membro da comunidade";
  const contactUrl = normalizeContactUrl(listing.contact_url);

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#9f3d25]"
        >
          <ArrowLeft className="size-4" />
          Voltar ao marketplace
        </Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
          <section aria-label="Imagens do anúncio">
            {images.length ? (
              <div className="overflow-hidden rounded-[2rem] bg-[#f4e6d7]">
                <img
                  src={images[activeImage]}
                  alt={`${listing.title} — imagem ${activeImage + 1}`}
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
            ) : (
              <div className="grid aspect-[4/3] place-items-center rounded-[2rem] bg-[#f4e6d7] text-[#9f3d25]">
                <Image className="size-16" />
              </div>
            )}
            {images.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
                {images.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`Ver imagem ${index + 1}`}
                    aria-pressed={activeImage === index}
                    className={`overflow-hidden rounded-xl border-2 ${activeImage === index ? "border-[#9f3d25]" : "border-transparent"}`}
                  >
                    <img src={url} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="self-start rounded-[2rem] border border-[#ead9ca] bg-white p-6 shadow-sm md:p-8">
            <span className="text-xs font-black uppercase tracking-wider text-[#9f3d25]">
              {listing.category || listing.listing_type}
            </span>
            <h1 className="mt-3 text-4xl font-black">{listing.title}</h1>
            {listing.price_label ? (
              <p className="mt-5 text-2xl font-black text-[#9f3d25]">{listing.price_label}</p>
            ) : null}
            {listing.city ? (
              <p className="mt-3 flex items-center gap-2 text-[#755348]">
                <MapPin className="size-4" />
                {listing.city}
              </p>
            ) : null}
            <p className="mt-6 whitespace-pre-wrap leading-relaxed text-[#5b392f]">
              {listing.description || "Entre em contato para conhecer melhor este trabalho."}
            </p>
            {contactUrl ? (
              <a
                href={contactUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white"
              >
                Tenho interesse <ExternalLink className="size-4" />
              </a>
            ) : null}

            {owner ? (
              <div className="mt-7 border-t border-[#ead9ca] pt-6">
                <p className="text-xs font-bold uppercase tracking-wider text-[#8a5c4d]">
                  Publicado por
                </p>
                <Link
                  to="/people/$profileId"
                  params={{ profileId: owner.id }}
                  className="mt-3 flex items-center gap-3 rounded-2xl bg-[#fffaf3] p-3 hover:bg-[#f4e6d7]"
                >
                  {owner.avatar_url ? (
                    <img
                      src={owner.avatar_url}
                      alt=""
                      className="size-12 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="grid size-12 place-items-center rounded-2xl bg-[#ead9ca]">
                      <UserRound className="size-5" />
                    </span>
                  )}
                  <span>
                    <strong className="block">
                      {ownerName}
                      {owner.verified ? " ✓" : ""}
                    </strong>
                    <small className="text-[#755348]">
                      {owner.short_bio || owner.city || "Ver perfil cultural"}
                    </small>
                  </span>
                </Link>
              </div>
            ) : null}
          </section>
        </div>

        {related.length ? (
          <section className="mt-14">
            <h2 className="text-3xl font-black">Outros trabalhos relacionados</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {related.map((item) => (
                <Link
                  key={item.id}
                  to="/marketplace/$listingId"
                  params={{ listingId: item.id }}
                  className="overflow-hidden rounded-3xl border border-[#ead9ca] bg-white shadow-sm"
                >
                  {item.cover_url ? (
                    <img
                      src={item.cover_url}
                      alt=""
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                  ) : null}
                  <div className="p-5">
                    <span className="text-xs font-bold uppercase text-[#9f3d25]">
                      {item.category}
                    </span>
                    <h3 className="mt-2 text-lg font-black">{item.title}</h3>
                    {item.price_label ? <p className="mt-3 font-bold">{item.price_label}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <EcosystemFooter />
    </div>
  );
}
