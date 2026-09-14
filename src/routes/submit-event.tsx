import { createFileRoute } from "@tanstack/react-router";
import { FileText, Image, Link2, Mic, ShieldCheck, Sparkles } from "lucide-react";
import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";

export const Route = createFileRoute("/submit-event")({ component: SubmitEventPage });

const options = [
  { title: "Enviar um card", text: "A IA lê a imagem e encontra data, horário, local e outras informações.", icon: Image },
  { title: "Colar texto ou link", text: "Cole a divulgação que você já tem e nós organizamos no formato da agenda.", icon: Link2 },
  { title: "Contar por voz", text: "Explique o evento do seu jeito. A fala será transcrita e organizada.", icon: Mic },
  { title: "Preencher manualmente", text: "Use o formulário tradicional se você já tem todas as informações.", icon: FileText },
];

function SubmitEventPage() {
  return <div className="min-h-screen bg-[#fffaf3] text-[#351810]"><EcosystemHeader /><main className="mx-auto max-w-6xl px-4 py-12 lg:px-8"><div className="text-center"><span className="inline-flex items-center gap-2 rounded-full bg-[#f4e6d7] px-3 py-1 text-sm font-semibold text-[#9f3d25]"><Sparkles className="size-4" /> Publicação assistida</span><h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black md:text-5xl">Divulgue seu evento sem preencher um formulário complicado.</h1><p className="mx-auto mt-4 max-w-2xl text-lg text-[#755348]">Escolha a forma mais fácil. A assistente organiza as informações, você confere e envia para revisão.</p></div><section className="mt-10 grid gap-5 md:grid-cols-2">{options.map(({title,text,icon:Icon},index)=><button key={title} className="group rounded-3xl border border-[#ead9ca] bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-[#d86132] hover:shadow-lg"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f4e6d7] text-[#9f3d25] group-hover:bg-[#d86132] group-hover:text-white"><Icon /></span><div><span className="text-xs font-bold uppercase tracking-wider text-[#9f3d25]">Opção {index+1}</span><h2 className="mt-1 text-xl font-black">{title}</h2><p className="mt-2 text-[#755348]">{text}</p></div></div></button>)}</section><div className="mt-8 flex items-start gap-3 rounded-2xl bg-emerald-50 p-5 text-emerald-900"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><p><strong>Ambiente cuidado:</strong> antes de entrar na agenda, o evento passa por verificação de informações, possíveis duplicidades e revisão da equipe.</p></div></main><EcosystemFooter /></div>;
}
