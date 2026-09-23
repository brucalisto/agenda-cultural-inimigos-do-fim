import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Image, MapPin, Search, ShoppingBag, SlidersHorizontal, Wrench } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/marketplace")({ component: MarketplacePage });
type Listing = Tables<"marketplace_listings">;

const typeLabels: Record<string, string> = {
  product: "Produtos",
  service: "Serviços",
  class: "Aulas e oficinas",
  experience: "Experiências",
};

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
}

function MarketplacePage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("pt-BR"));

  useEffect(() => {
    async function load() {
      const [{ data: listings }, { data: auth }] = await Promise.all([
        supabase
          .from("marketplace_listings")
          .select("*")
          .eq("status", "published")
          .order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);
      setItems(listings ?? []);
      const id = auth.user?.id ?? null;
      setUserId(id);
      if (!id) return;
      const { data } = await supabase
        .from("marketplace_favorites")
        .select("listing_id")
        .eq("user_id", id);
      setFavorites(new Set((data ?? []).map((favorite) => favorite.listing_id)));
    }
    void load();
  }, []);

  async function toggleFavorite(listingId: string) {
    if (!userId) {
      toast.info("Entre na comunidade para salvar seus favoritos.");
      return;
    }
    const saved = favorites.has(listingId);
    setFavorites((current) => {
      const next = new Set(current);
      saved ? next.delete(listingId) : next.add(listingId);
      return next;
    });
    const result = saved
      ? await supabase
          .from("marketplace_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("listing_id", listingId)
      : await supabase.from("marketplace_favorites").insert({ user_id: userId, listing_id: listingId });
    if (result.error) {
      setFavorites((current) => {
        const next = new Set(current);
        saved ? next.add(listingId) : next.delete(listingId);
        return next;
      });
      toast.error("Não foi possível atualizar o favorito.");
    }
  }

  const categories = useMemo(() => unique(items.map((item) => item.category)), [items]);
  const cities = useMemo(() => unique(items.map((item) => item.city)), [items]);
  const visible = useMemo(
    () =>
      items.filter((item) => {
        const searchable = [item.title, item.description, item.category, item.city]
          .join(" ")
          .toLocaleLowerCase("pt-BR");
        return (
          (!deferredQuery || searchable.includes(deferredQuery)) &&
          (!type || item.listing_type === type) &&
          (!category || item.category === category) &&
          (!city || item.city === city) &&
          (!favoritesOnly || favorites.has(item.id))
        );
      }),
    [category, city, deferredQuery, favorites, favoritesOnly, items, type],
  );
  const hasFilters = Boolean(query || type || category || city || favoritesOnly);

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main>
        <section className="bg-[#d86132] px-4 py-14 text-white">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[1fr_.75fr]">
              <div>
                <span className="inline-flex gap-2 rounded-full bg-white/15 px-3 py-1 text-sm">
                  <ShoppingBag className="size-4" />
                  Economia criativa local
                </span>
                <h1 className="mt-5 text-4xl font-black md:text-6xl">
                  Descubra, valorize e contrate quem cria.
                </h1>
              </div>
              <div className="rounded-3xl bg-[#351810] p-6">
                <Wrench className="text-[#ffc857]" />
                <h2 className="mt-3 text-2xl font-black">Ferramentas Inimigos do Fim</h2>
                <p className="mt-2 text-[#f1d5c7]">
                  Produtos e soluções oficiais ficam em uma vitrine separada.
                </p>
                <Link to="/tools" className="mt-4 inline-block font-bold text-[#ffc857]">
                  Conhecer ferramentas →
                </Link>
              </div>
            </div>
            <div className="mt-8 flex max-w-3xl gap-3 rounded-2xl bg-white p-3 text-[#351810]">
              <Search aria-hidden="true" />
              <label htmlFor="marketplace-search" className="sr-only">
                Buscar no marketplace
              </label>
              <input
                id="marketplace-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 outline-none"
                placeholder="Busque por trabalho, categoria ou cidade"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black">Feito pela comunidade</h2>
              <p className="mt-1 text-[#755348]">
                {visible.length}{" "}
                {visible.length === 1 ? "anúncio encontrado" : "anúncios encontrados"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!userId) {
                    toast.info("Entre na comunidade para acessar seus favoritos.");
                    return;
                  }
                  setFavoritesOnly((current) => !current);
                }}
                aria-pressed={favoritesOnly}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold ${favoritesOnly ? "border-[#9f3d25] bg-[#9f3d25] text-white" : "border-[#d8bca8] text-[#755348]"}`}
              >
                <Heart className={`size-4 ${favoritesOnly ? "fill-current" : ""}`} />
                Favoritos
              </button>
              <Link
                to="/my-listings"
                className="rounded-xl border border-[#d8bca8] px-4 py-2 text-sm font-bold text-[#755348]"
              >
                Meus anúncios
              </Link>
              <Link
                to="/marketplace-new"
                className="rounded-xl border border-[#9f3d25] px-4 py-2 text-sm font-bold text-[#9f3d25]"
              >
                Divulgar meu trabalho
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 rounded-2xl border border-[#ead9ca] bg-white p-4 md:grid-cols-[auto_1fr_1fr_1fr_auto]">
            <span className="flex items-center gap-2 text-sm font-bold text-[#755348]">
              <SlidersHorizontal className="size-4" />
              Filtrar
            </span>
            <select
              aria-label="Tipo de anúncio"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="h-11 rounded-xl border border-[#ead9ca] bg-white px-3"
            >
              <option value="">Todos os tipos</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Categoria"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 rounded-xl border border-[#ead9ca] bg-white px-3"
            >
              <option value="">Todas as categorias</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="Cidade"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="h-11 rounded-xl border border-[#ead9ca] bg-white px-3"
            >
              <option value="">Todas as cidades</option>
              {cities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setType("");
                  setCategory("");
                  setCity("");
                  setFavoritesOnly(false);
                }}
                className="rounded-xl px-3 text-sm font-bold text-[#9f3d25]"
              >
                Limpar
              </button>
            ) : (
              <span />
            )}
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
              <article
                key={item.id}
                className="group relative overflow-hidden rounded-3xl border border-[#ead9ca] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => void toggleFavorite(item.id)}
                  aria-label={favorites.has(item.id) ? `Remover ${item.title} dos favoritos` : `Salvar ${item.title} nos favoritos`}
                  aria-pressed={favorites.has(item.id)}
                  className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full bg-white/95 text-[#9f3d25] shadow-md backdrop-blur"
                >
                  <Heart className={`size-5 ${favorites.has(item.id) ? "fill-current" : ""}`} />
                </button>
                <Link
                  to="/marketplace/$listingId"
                  params={{ listingId: item.id }}
                  className="block"
                >
                  {item.cover_url ? (
                    <img
                      src={item.cover_url}
                      alt={`Imagem de ${item.title}`}
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <span className="grid aspect-video place-items-center bg-[#f4e6d7] text-[#9f3d25]">
                      <Image className="size-10" aria-hidden="true" />
                    </span>
                  )}
                  <div className="p-6">
                    <span className="text-xs font-bold uppercase text-[#9f3d25]">
                      {item.category || typeLabels[item.listing_type] || item.listing_type}
                    </span>
                    <h3 className="mt-2 text-xl font-black group-hover:text-[#9f3d25]">
                      {item.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-[#755348]">{item.description}</p>
                    {item.price_label ? (
                      <strong className="mt-4 block">{item.price_label}</strong>
                    ) : null}
                    {item.city ? (
                      <p className="mt-2 flex gap-2 text-sm">
                        <MapPin className="size-4" />
                        {item.city}
                      </p>
                    ) : null}
                    <span className="mt-5 block rounded-xl bg-[#9f3d25] px-4 py-2 text-center font-bold text-white">
                      Ver detalhes
                    </span>
                  </div>
                </Link>
              </article>
            ))}
            {!visible.length ? (
              <div className="rounded-3xl border-2 border-dashed border-[#ead9ca] p-8 text-center md:col-span-2 lg:col-span-3">
                <h3 className="text-2xl font-black">
                  {hasFilters
                    ? "Nenhum trabalho corresponde aos filtros"
                    : "A vitrine está recebendo seus primeiros trabalhos"}
                </h3>
                <p className="mt-2 text-[#755348]">
                  {hasFilters
                    ? "Tente ampliar a busca ou limpar os filtros."
                    : "Mostre à comunidade o que você cria ou oferece."}
                </p>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setType("");
                      setCategory("");
                      setCity("");
                      setFavoritesOnly(false);
                    }}
                    className="mt-5 rounded-xl border border-[#9f3d25] px-5 py-3 font-bold text-[#9f3d25]"
                  >
                    Limpar filtros
                  </button>
                ) : (
                  <Link
                    to="/marketplace-new"
                    className="mt-5 inline-block rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white"
                  >
                    Publicar o primeiro anúncio
                  </Link>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </main>
      <EcosystemFooter />
    </div>
  );
}
