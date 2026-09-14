import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, Loader2, Mail, Mic, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EcosystemHeader } from "@/components/community/EcosystemHeader";

export const Route = createFileRoute("/join")({ component: JoinPage });

type Mode = "register" | "login";

function JoinPage() {
  const [mode,setMode]=useState<Mode>("register");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);

  async function submit(event:FormEvent) {
    event.preventDefault(); setLoading(true);
    try {
      if(mode==="register") {
        const { error }=await supabase.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/my-profile`}});
        if(error) throw error;
        toast.success("Cadastro iniciado! Confira seu e-mail para confirmar o acesso.");
      } else {
        const { error }=await supabase.auth.signInWithPassword({email,password});
        if(error) throw error;
        window.location.href="/my-profile";
      }
    } catch(error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally { setLoading(false); }
  }

  return <div className="min-h-screen bg-[#fffaf3] text-[#351810]"><EcosystemHeader /><main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-2 lg:items-center lg:px-8"><section className="rounded-[2rem] bg-[#6d2418] p-8 text-white md:p-12"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm"><Sparkles className="size-4 text-[#ffc857]" /> Você faz parte dessa cultura</span><h1 className="mt-5 text-4xl font-black md:text-5xl">Crie seu espaço no Inimigos do Fim.</h1><p className="mt-4 text-lg text-orange-100">Divulgue sua trajetória, encontre pessoas, publique eventos e apresente seu trabalho no marketplace.</p><div className="mt-8 rounded-2xl bg-white/10 p-5"><Mic className="size-6 text-[#ffc857]" /><strong className="mt-3 block">Não sabe escrever uma bio?</strong><p className="mt-1 text-sm text-orange-100">Conte por voz ou texto. A assistente fará perguntas simples e organizará seu perfil para você revisar.</p></div></section><section className="rounded-[2rem] border border-[#ead9ca] bg-white p-7 shadow-xl md:p-10"><div className="grid grid-cols-2 rounded-xl bg-[#f4e6d7] p-1"><button onClick={()=>setMode("register")} className={`rounded-lg px-4 py-2 font-semibold ${mode==="register"?"bg-white shadow-sm":""}`}>Criar conta</button><button onClick={()=>setMode("login")} className={`rounded-lg px-4 py-2 font-semibold ${mode==="login"?"bg-white shadow-sm":""}`}>Já tenho conta</button></div><h2 className="mt-7 text-2xl font-black">{mode==="register"?"Vamos começar":"Boas-vindas de volta"}</h2><p className="mt-1 text-sm text-[#755348]">{mode==="register"?"Primeiro criamos seu acesso. Depois montamos seu perfil.":"Entre para acessar sua comunidade."}</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-semibold">E-mail<div className="mt-2 flex items-center gap-2 rounded-xl border px-3"><Mail className="size-4 text-[#9f3d25]" /><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="h-12 min-w-0 flex-1 outline-none" placeholder="voce@email.com" /></div></label><label className="block text-sm font-semibold">Senha<div className="mt-2 flex items-center rounded-xl border px-3"><input required minLength={6} type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} className="h-12 min-w-0 flex-1 outline-none" placeholder="Mínimo de 6 caracteres" /><button type="button" onClick={()=>setShow(!show)}>{show?<EyeOff className="size-4"/>:<Eye className="size-4"/>}</button></div></label><button disabled={loading} className="flex h-12 w-full items-center justify-center rounded-xl bg-[#9f3d25] font-bold text-white disabled:opacity-60">{loading?<Loader2 className="size-5 animate-spin"/>:mode==="register"?"Criar minha conta":"Entrar"}</button></form><p className="mt-5 text-center text-xs text-[#8a5c4d]">Ao continuar, você concorda com as regras de convivência e privacidade da comunidade.</p>{mode==="login"&&<Link to="/auth" className="mt-3 block text-center text-sm font-semibold text-[#9f3d25]">Esqueci minha senha</Link>}</section></main></div>;
}
