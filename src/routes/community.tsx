import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  Handshake,
  Lock,
  MessageCircle,
  Palette,
  Radio,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database";

export const Route = createFileRoute("/community")({ component: CommunityPage });

type Space = Tables<"community_spaces">;
const iconMap = {
  bell: Bell,
  "message-circle": MessageCircle,
  radio: Radio,
  palette: Palette,
  handshake: Handshake,
} as const;
const colorMap = {
  bell: "bg-amber-100 text-amber-700",
  "message-circle": "bg-orange-100 text-orange-700",
  radio: "bg-purple-100 text-purple-700",
  palette: "bg-blue-100 text-blue-700",
  handshake: "bg-emerald-100 text-emerald-700",
} as const;

function CommunityPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("community_spaces")
      .select("*")
      .eq("active", true)
      .order("created_at")
      .then(({ data }) => {
        setSpaces(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
      <EcosystemHeader />
      <main>
        <section className="overflow-hidden bg-[#6d2418] px-4 py-14 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
                <Sparkles className="size-4" />
                Nossa cultura se encontra aqui
              </span>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight md:text-6xl">
                Conheça pessoas, troque ideias e tire projetos do papel.
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-orange-100">
                Um espaço para artistas, produtores, espaços culturais, serviços e público
                construírem juntos.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/join"
                  className="rounded-xl bg-[#ffc857] px-5 py-3 font-bold text-[#3d2117]"
                >
                  Criar meu perfil
                </Link>
                <Link
                  to="/people"
                  className="rounded-xl border border-white/35 px-5 py-3 font-semibold"
                >
                  Conhecer a comunidade
                </Link>
              </div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <Lock className="size-5 text-[#ffc857]" />
                <div>
                  <strong>Projetos privados</strong>
                  <p className="text-sm text-orange-100">
                    Converse com sua equipe em um espaço reservado
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-white p-5 text-[#351810]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#9f3d25]">
                  Agora disponível
                </span>
                <h2 className="mt-2 text-xl font-bold">Organize projetos com outras pessoas</h2>
                <p className="mt-2 text-sm text-[#755348]">
                  Crie uma conversa privada, convide membros e mantenha as decisões no mesmo lugar.
                </p>
                <Link to="/chats" className="mt-4 inline-block font-bold text-[#9f3d25]">
                  Abrir conversas →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <Link
            to="/following"
            className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-[#351810] p-6 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#ffc857] text-[#351810]">
                <UserCheck />
              </span>
              <span>
                <strong className="block text-xl">Acompanhando</strong>
                <span className="text-sm text-[#f1d5c7]">
                  Veja as novidades dos perfis que você segue
                </span>
              </span>
            </span>
            <span className="font-bold text-[#ffc857]">Abrir meu feed →</span>
          </Link>
          <div>
            <p className="font-bold uppercase tracking-widest text-[#9f3d25]">Espaços</p>
            <h2 className="mt-2 text-3xl font-black">Onde as conversas acontecem</h2>
          </div>
          {loading ? (
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-48 animate-pulse rounded-3xl bg-[#f4e6d7]" />
              ))}
            </div>
          ) : (
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {spaces.map((space) => {
                const iconKey = space.icon as keyof typeof iconMap;
                const Icon = iconMap[iconKey] ?? MessageCircle;
                const color = colorMap[iconKey] ?? colorMap["message-circle"];
                return (
                  <Link
                    key={space.id}
                    to="/community/$spaceSlug"
                    params={{ spaceSlug: space.slug }}
                    className="rounded-3xl border border-[#ead9ca] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className={`grid size-12 place-items-center rounded-2xl ${color}`}>
                      <Icon />
                    </div>
                    <h3 className="mt-5 text-xl font-bold">{space.name}</h3>
                    <p className="mt-2 text-[#755348]">{space.description}</p>
                    <div className="mt-5 flex items-center gap-2 text-sm font-bold text-[#9f3d25]">
                      <Users className="size-4" />
                      Entrar no espaço →
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          {!loading && !spaces.length ? (
            <div className="mt-7 rounded-3xl border-2 border-dashed border-[#ead9ca] p-8 text-center text-[#755348]">
              Os espaços serão exibidos assim que a atualização do banco for concluída.
            </div>
          ) : null}
        </section>

        <section className="bg-[#f4e6d7] px-4 py-12">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
            <div className="rounded-3xl bg-white p-7">
              <MessageCircle className="size-8 text-[#9f3d25]" />
              <h2 className="mt-4 text-2xl font-black">Conversas abertas</h2>
              <p className="mt-3 text-[#755348]">
                Publique ideias, apresentações, oportunidades e novidades nos espaços temáticos.
              </p>
            </div>
            <div className="rounded-3xl bg-[#351810] p-7 text-white">
              <Users className="size-8 text-[#ffc857]" />
              <h2 className="mt-4 text-2xl font-black">Sua trajetória também importa</h2>
              <p className="mt-3 text-[#f1d5c7]">
                Monte um perfil cultural conversando com a assistente, por texto ou voz.
              </p>
              <Link to="/my-profile" className="mt-5 inline-block font-bold text-[#ffc857]">
                Criar ou atualizar meu perfil →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <EcosystemFooter />
    </div>
  );
}
