import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Loader2, Mic, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VoiceTextarea } from "@/components/community/VoiceTextarea";
import { EcosystemHeader } from "@/components/community/EcosystemHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/my-profile")({ component: ProfileOnboarding });
const questions=[
  {key:"display_name",title:"Como você gostaria de aparecer?",help:"Pode ser seu nome, nome artístico, coletivo ou espaço."},
  {key:"story",title:"Conte do seu jeito: o que você faz?",help:"Fale sobre sua arte, serviço, trajetória ou projeto."},
  {key:"city",title:"Onde seu trabalho acontece?",help:"Informe cidade, bairro, região ou se trabalha online."},
  {key:"goals",title:"Que conexões você procura?",help:"Parcerias, público, clientes, equipe, espaços ou oportunidades."},
] as const;

function ProfileOnboarding(){
  const [step,setStep]=useState(0),[saving,setSaving]=useState(false),[userId,setUserId]=useState("");
  const [answers,setAnswers]=useState<Record<string,string>>({display_name:"",story:"",city:"",goals:""});
  useEffect(()=>{supabase.auth.getUser().then(({data})=>{if(!data.user)window.location.href="/join";else setUserId(data.user.id);});},[]);
  const bio=useMemo(()=>[answers.story.trim(),answers.goals.trim()?("Tenho interesse em "+answers.goals.trim()+"."):""].filter(Boolean).join(" "),[answers]);
  async function finish(){
    setSaving(true);
    const db=supabase as unknown as {from:(table:string)=>{upsert:(data:Record<string,unknown>)=>Promise<{error:{message:string}|null}>}};
    const {error}=await db.from("community_profiles").upsert({id:userId,display_name:answers.display_name.trim(),full_bio:bio,city:answers.city.trim(),collaboration_interests:answers.goals.split(",").map(x=>x.trim()).filter(Boolean),onboarding_status:"complete",visibility:"public",updated_at:new Date().toISOString()});
    setSaving(false);if(error){toast.error(error.message);return;}toast.success("Seu perfil foi salvo!");window.location.href="/people";
  }
  const question=questions[step],value=answers[question.key];
  return <div className="min-h-screen bg-[#fffaf3] text-[#351810]"><EcosystemHeader/><main className="mx-auto max-w-4xl px-4 py-10"><div className="mb-8 flex justify-between"><b className="text-[#9f3d25]">Seu perfil cultural</b><span>{step+1} de {questions.length}</span></div><div className="h-2 rounded-full bg-[#ead9ca]"><div className="h-full rounded-full bg-[#d86132]" style={{width:((step+1)/questions.length)*100+"%"}}/></div><section className="mt-8 rounded-[2rem] border border-[#ead9ca] bg-white p-6 shadow-xl md:p-10"><div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#6d2418] text-[#ffc857]"><Sparkles/></span><div><p className="text-sm font-bold text-[#9f3d25]">Assistente de perfil</p><h1 className="mt-1 text-3xl font-black">{question.title}</h1><p className="mt-2 text-[#755348]">{question.help}</p></div></div><div className="mt-7"><VoiceTextarea value={value} onChange={next=>setAnswers({...answers,[question.key]:next})} placeholder="Digite aqui ou toque no microfone para falar..." rows={step===1||step===3?6:3}/></div>{step===questions.length-1&&bio&&<div className="mt-6 rounded-2xl bg-[#f4e6d7] p-5"><p className="text-xs font-bold uppercase text-[#9f3d25]">Prévia da sua bio</p><p className="mt-2">{bio}</p></div>}<div className="mt-7 flex justify-between gap-3"><button disabled={step===0} onClick={()=>setStep(step-1)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold disabled:opacity-30"><ChevronLeft className="size-4"/>Voltar</button>{step<questions.length-1?<button disabled={!value.trim()} onClick={()=>setStep(step+1)} className="inline-flex items-center gap-2 rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white disabled:opacity-40">Continuar<ChevronRight className="size-4"/></button>:<button disabled={saving||!value.trim()} onClick={finish} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">{saving?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}Publicar perfil</button>}</div></section><div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#8a5c4d]"><Mic className="size-4"/>Você pode misturar voz e digitação.</div><Link to="/community" className="mt-4 block text-center text-sm font-semibold text-[#9f3d25]">Continuar depois</Link></main></div>;
}
