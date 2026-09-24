import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EcosystemFooter, EcosystemHeader } from "@/components/community/EcosystemHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route=createFileRoute("/notification-preferences")({component:NotificationPreferencesPage});
type Preferences={messages:boolean;interactions:boolean;followers:boolean;moderation:boolean;followed_content:boolean;invitations:boolean};
type RpcResult={data:unknown;error:{message:string}|null};
const defaults:Preferences={messages:true,interactions:true,followers:true,moderation:true,followed_content:true,invitations:true};
const options:[keyof Preferences,string,string][]=[
 ["messages","Mensagens e respostas","Novas mensagens nas conversas das quais você participa."],
 ["interactions","Comentários e reações","Interações recebidas nas suas publicações."],
 ["followers","Novos seguidores","Quando alguém começa a acompanhar seu perfil cultural."],
 ["moderation","Eventos, anúncios e denúncias","Decisões de moderação e mudanças importantes de status."],
 ["followed_content","Perfis que você acompanha","Novas publicações de artistas, coletivos e espaços que você segue."],
 ["invitations","Convites e conversas","Quando outra pessoa inclui você em uma nova conversa."],
];
function isPreferences(value:unknown):value is Preferences{if(!value||typeof value!=="object")return false;const v=value as Record<string,unknown>;return options.every(([key])=>typeof v[key]==="boolean")}
async function callRpc(name:string,args?:Record<string,unknown>):Promise<RpcResult>{const rpc=supabase.rpc as unknown as (fn:string,params?:Record<string,unknown>)=>PromiseLike<RpcResult>;return rpc(name,args)}
function NotificationPreferencesPage(){const[prefs,setPrefs]=useState<Preferences>(defaults),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[logged,setLogged]=useState(true);
 useEffect(()=>{void(async()=>{const{data}=await supabase.auth.getUser();if(!data.user){setLogged(false);setLoading(false);return}const result=await callRpc("get_notification_preferences");if(result.error)toast.error(result.error.message);else if(isPreferences(result.data))setPrefs(result.data);setLoading(false)})()},[]);
 async function save(){setSaving(true);const result=await callRpc("set_notification_preferences",{new_preferences:prefs});setSaving(false);if(result.error){toast.error(result.error.message);return}if(isPreferences(result.data))setPrefs(result.data);toast.success("Preferências salvas")}
 return <div className="min-h-screen bg-[#fffaf3] text-[#351810]"><EcosystemHeader/><main className="mx-auto max-w-3xl px-4 py-10"><Link to="/notifications" className="inline-flex items-center gap-2 text-sm font-bold text-[#9f3d25]"><ArrowLeft className="size-4"/>Voltar às notificações</Link><div className="mt-6"><p className="text-sm font-black uppercase tracking-widest text-[#9f3d25]">Sua experiência</p><h1 className="mt-1 text-4xl font-black">Preferências de notificações</h1><p className="mt-2 text-[#755348]">Escolha quais tipos de novidades você quer receber dentro do Inimigos do Fim. Você pode mudar isso quando quiser.</p></div>{loading?<div className="grid min-h-64 place-items-center"><Loader2 className="size-8 animate-spin text-[#9f3d25]"/></div>:!logged?<div className="mt-8 rounded-3xl bg-white p-8 text-center"><Bell className="mx-auto size-9 text-[#9f3d25]"/><p className="mt-3">Entre na comunidade para configurar suas notificações.</p><Link to="/join" className="mt-4 inline-block font-bold text-[#9f3d25]">Entrar</Link></div>:<><section className="mt-8 space-y-3">{options.map(([key,title,description])=><label key={key} className="flex cursor-pointer items-start justify-between gap-5 rounded-2xl border border-[#ead9ca] bg-white p-5"><span><b className="block">{title}</b><span className="mt-1 block text-sm text-[#755348]">{description}</span></span><input type="checkbox" checked={prefs[key]} onChange={e=>setPrefs(current=>({...current,[key]:e.target.checked}))} className="mt-1 size-5 accent-[#9f3d25]"/></label>)}</section><button type="button" disabled={saving} onClick={()=>void save()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#9f3d25] px-5 py-3 font-bold text-white disabled:opacity-60">{saving?<Loader2 className="size-4 animate-spin"/>:<Save className="size-4"/>}Salvar preferências</button></>}</main><EcosystemFooter/></div>}
