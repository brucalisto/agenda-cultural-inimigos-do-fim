import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Mic, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/people")({ component: PeoplePage });

type PublicProfile = Pick<
  Tables<"community_profiles">,
  | "id"
  | "display_name"
  | "artistic_name"
  | "profile_type"
  | "short_bio"
  | "full_bio"
  | "city"
  | "avatar_url"
  | "categories"
  | "created_at"
>;

function PeoplePage() {
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    supabase
      .from("community_profiles")
      .select(
        "id,display_name,artistic_name,profile_type,short_bio,full_bio,city,avatar_url,categories,created_at",
      )
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .then(({ data }) => setProfiles(data ?? []));
  }, []);

  const visible = useMemo(
    () =>
      profiles.filter((profile) =>
        [
          profile.display_name,
          profile.artistic_name,
          profile.city,
          profile.full_bio,
          ...(profile.categories ?? []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [profiles, query],
  );

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <section className="rounded-[2rem] bg-[#351810] p-7 text-white md:p-12">
          <p className="font-bold uppercase tracking-widest text-[#ffc857]">
            Mapa humano da cultura
          </p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">
            Encontre quem faz a cultura acontecer.
          </h1>
          <div className="mt-7 flex max-w-3xl items-center gap-3 rounded-2xl bg-white p-3 text-[#351810]">
            <Search className="size-5 text-[#9f3d25]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 outline-none"
              placeholder="Nome, trabalho, cidade ou habilidade"
            />
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((profile) => (
            <Link
              key={profile.id}
              to="/people/$profileId"
              params={{ profileId: profile.id }}
              className="rounded-3xl border border-[#ead9ca] bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-4">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="size-16 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="grid size-16 place-items-center rounded-2xl bg-[#f4e6d7] text-2xl font-black text-[#9f3d25]">
                    {(profile.artistic_name || profile.display_name || "?")[0]}
                  </span>
                )}
                <div>
                  <h2 className="text-xl font-black">
                    {profile.artistic_name || profile.display_name}
                  </h2>
                  <p className="text-sm capitalize text-[#9f3d25]">{profile.profile_type}</p>
                </div>
              </div>
              <p className="mt-4 line-clamp-4 text-[#755348]">
                {profile.short_bio || profile.full_bio || "Perfil cultural em construção."}
              </p>
              {profile.city && (
                <p className="mt-4 flex items-center gap-2 text-sm">
                  <MapPin className="size-4" />
                  {profile.city}
                </p>
              )}
              <span className="mt-5 inline-block text-sm font-bold text-[#9f3d25]">
                Ver perfil e portfólio →
              </span>
            </Link>
          ))}

          {!visible.length && (
            <div className="rounded-3xl border-2 border-dashed p-8 text-center md:col-span-2 lg:col-span-3">
              <Sparkles className="mx-auto size-9 text-[#9f3d25]" />
              <h2 className="mt-3 text-2xl font-black">Seja uma das primeiras pessoas daqui</h2>
              <Link
                to="/my-profile"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white"
              >
                <Mic className="size-4" />
                Criar meu perfil
              </Link>
            </div>
          )}
        </section>
      </main>
      <EcosystemFooter />
    </div>
  );
}
