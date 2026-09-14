import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Handshake, Lock, MessageCircle, Palette, Plus, Radio, Sparkles, Users } from "lucide-react";
import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";

export const Route = createFileRoute("/community")({ component: CommunityPage });

const spaces = [
  { name: "Geral", description: "Apresentações, ideias e encontros da comunidade.", icon: MessageCircle, color: "bg-orange-100 text-orange-700", members: "Toda a comunidade" },
  { name: "Música e cena", description: "Shows, bandas, DJs, teatro e dança.", icon: Radio, color: "bg-purple-100 text-purple-700", members: "128 participantes" },
  { name: "Artes visuais", description: "Design, fotografia, audiovisual e exposições.", icon: Palette, color: "bg-blue-100 text-blue-700", members: "86 participantes" },
  { name: "Parcerias e oportunidades", description: "Editais, equipes, serviços e colaborações.", icon: Handshake, color: "bg-emerald-100 text-emerald-700", members: "174 participantes" },
];

function CommunityPage() {
  return <div className="min-h-screen bg-[#fffaf3] text-[#351810]">
    <EcosystemHeader />
    <main>
      <section className="overflow-hidden bg-[#6d2418] px-4 py-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
          <div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm"><Sparkles className="size-4" /> Nossa cultura se encontra aqui</span><h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight md:text-6xl">Conheça pessoas, troque ideias e tire projetos do papel.</h1><p className="mt-5 max-w-2xl text-lg text-orange-100">Um espaço para artistas, produtores, espaços culturais, serviços e público construírem juntos.</p><div className="mt-7 flex flex-wrap gap-3"><Link to="/join" className="rounded-xl bg-[#ffc857] px-5 py-3 font-bold text-[#3d2117]">Criar meu perfil</Link><Link to="/people" className="rounded-xl border border-white/35 px-5 py-3 font-semibold">Conhecer a comunidade</Link></div></div>
          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur"><div className="flex items-center gap-3"><Bell className="size-5 text-[#ffc857]" /><div><strong>Comunicados</strong><p className="text-sm text-orange-100">Novidades oficiais do Inimigos do Fim</p></div></div><div className="mt-5 rounded-2xl bg-white p-5 text-[#351810]"><span className="text-xs font-bold uppercase tracking-wider text-[#9f3d25]">Em construção</span><h2 className="mt-2 text-xl font-bold">A comunidade está ganhando casa própria</h2><p className="mt-2 text-sm text-[#755348]">Perfis culturais, publicação de eventos, conversas e uma vitrine para a economia criativa.</p></div></div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8"><div className="flex items-end justify-between gap-4"><div><p className="font-bold uppercase tracking-widest text-[#9f3d25]">Espaços</p><h2 className="mt-2 text-3xl font-black">Onde as conversas acontecem</h2></div><button className="hidden items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold sm:flex"><Plus className="size-4" /> Sugerir espaço</button></div><div className="mt-7 grid gap-4 md:grid-cols-2">{spaces.map(({name,description,icon:Icon,color,members}) => <article key={name} className="rounded-3xl border border-[#ead9ca] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className={`grid size-12 place-items-center rounded-2xl ${color}`}><Icon /></div><h3 className="mt-5 text-xl font-bold">{name}</h3><p className="mt-2 text-[#755348]">{description}</p><div className="mt-5 flex items-center gap-2 text-sm text-[#8a5c4d]"><Users className="size-4" />{members}</div></article>)}</div></section>
      <section className="bg-[#f4e6d7] px-4 py-12"><div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2"><div className="rounded-3xl bg-white p-7"><Lock className="size-8 text-[#9f3d25]" /><h2 className="mt-4 text-2xl font-black">Projetos privados</h2><p className="mt-3 text-[#755348]">Crie uma conversa reservada, convide sua equipe e organize materiais, decisões e o evento relacionado.</p><span className="mt-5 inline-block rounded-full bg-[#f4e6d7] px-3 py-1 text-xs font-bold">Próxima etapa</span></div><div className="rounded-3xl bg-[#351810] p-7 text-white"><Users className="size-8 text-[#ffc857]" /><h2 className="mt-4 text-2xl font-black">Sua trajetória também importa</h2><p className="mt-3 text-[#f1d5c7]">Monte um perfil cultural conversando com a assistente, por texto ou voz.</p><Link to="/join" className="mt-5 inline-block font-bold text-[#ffc857]">Começar meu perfil →</Link></div></div></section>
    </main><EcosystemFooter />
  </div>;
}
