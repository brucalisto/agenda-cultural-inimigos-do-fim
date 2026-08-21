import { createFileRoute } from "@tanstack/react-router";
import { useEffect,useState } from "react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
export const Route=createFileRoute("/review")({component:ReviewPage});
type Item={id:string;title:string|null;summary:string|null;event_date:string|null;location:string|null;review_status:string};
function ReviewPage(){const[items,setItems]=useState<Item[]>([]);async function load(){const{data}=await supabase.from("interpreted_contents").select("id,title,summary,event_date,location,review_status").in("review_status",["pendente","necessita_revisao"]).order("created_at",{ascending:false});setItems((data as Item[])||[]);}useEffect(()=>{void load()},[]);
async function publish(id:string){const{error}=await supabase.from("interpreted_contents").update({review_status:"publicado",reviewed_at:new Date().toISOString()}).eq("id",id);if(error)toast.error(error.message);else{toast.success("Evento publicado na agenda.");void load();}}
return <DashboardLayout><div className="space-y-6"><div><h1 className="text-2xl font-bold">Revisão</h1><p className="text-muted-foreground">Confira a interpretação do Gemini antes de torná-la pública.</p></div><div className="grid gap-4">{!items.length&&<Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum conteúdo aguardando revisão.</CardContent></Card>}{items.map(item=><Card key={item.id}><CardHeader className="flex-row items-start justify-between"><div><CardTitle>{item.title||"Evento sem título"}</CardTitle><p className="mt-2 text-sm text-muted-foreground">{item.summary}</p></div><Badge variant={item.review_status==="necessita_revisao"?"destructive":"secondary"}>{item.review_status.replaceAll("_"," ")}</Badge></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{item.event_date?new Date(item.event_date).toLocaleString("pt-BR"):"Data não identificada"}{item.location?` · ${item.location}`:""}</span><Button onClick={()=>void publish(item.id)} disabled={!item.event_date}>Aprovar e publicar</Button></CardContent></Card>)}</div></div></DashboardLayout>}
