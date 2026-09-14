import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Bot, Layers3, ShieldCheck, Sparkles } from "lucide-react";
import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";

export const Route = createFileRoute("/tools")({ component: ToolsPage });

const benefits = [
  { title: "Materiais digitais", text: "Guias, modelos, conteúdos e recursos prontos para usar.", icon: Layers3 },
  { title: "Ferramentas inteligentes", text: "Soluções para criação, divulgação, organização e vendas.", icon: Bot },
  { title: "Seleção confiável", text: "Produtos apresentados de forma clara, com suporte e acesso organizado.", icon: ShieldCheck },
];

function ToolsPage() {
  return <div className="min-h-screen bg-[#fffaf3] text-[#351810]"><EcosystemHeader /><main><section className="relative overflow-hidden bg-[#351810] px-4 py-16 text-white"><div className="absolute -right-24 -top-24 size-80 rounded-full bg-[#d86132]/30 blur-3xl" /><div className="relative mx-auto max-w-7xl"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-[#ffd99b]"><Sparkles className="size-4" /> Curadoria Inimigos do Fim</span><h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight md:text-6xl">Ferramentas para transformar ideias em projetos reais.</h1><p className="mt-5 max-w-2xl text-lg text-[#f1d5c7]">Aqui ficarão reunidas as ferramentas, materiais e soluções oferecidas pela plataforma — em uma página própria, sem misturar com os anúncios da comunidade.</p><button className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#ffc857] px-5 py-3 font-black text-[#351810]">Quero receber novidades <ArrowRight className="size-4" /></button></div></section><section className="mx-auto max-w-7xl px-4 py-12 lg:px-8"><div className="grid gap-5 md:grid-cols-3">{benefits.map(({title,text,icon:Icon})=><article key={title} className="rounded-3xl border border-[#ead9ca] bg-white p-6"><Icon className="size-8 text-[#9f3d25]" /><h2 className="mt-4 text-xl font-black">{title}</h2><p className="mt-2 text-[#755348]">{text}</p></article>)}</div><div className="mt-10 rounded-[2rem] bg-[#f4e6d7] p-8 md:p-12"><p className="font-bold uppercase tracking-widest text-[#9f3d25]">Em breve</p><h2 className="mt-3 text-3xl font-black">Uma vitrine dedicada aos seus produtos</h2><p className="mt-3 max-w-3xl text-[#755348]">Cada ferramenta poderá ter apresentação, vídeo, benefícios, preço, perguntas frequentes e botão que direciona para sua página de vendas ou checkout. A gestão ficará separada no painel administrativo.</p></div></section></main><EcosystemFooter /></div>;
}
