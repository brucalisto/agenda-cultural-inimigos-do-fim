import { createFileRoute } from "@tanstack/react-router";
import { useEffect,useState } from "react";
import { ExternalLink } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card,CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
export const Route=createFileRoute("/published")({component:PublishedPage});
function PublishedPage(){const[items,setItems]=useState<any[]>([]);useEffect(()=>{void supabase.from("interpreted_contents").select("id,title,event_date,location,category").eq("review_status","publicado").order("event_date",{ascending:true}).then(({data})=>setItems(data||[]))},[]);return <DashboardLayout><div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Publicados</h1><p className="text-muted-foreground">Eventos visíveis no calendário público.</p></div><Button asChild><a href="/agenda" target="_blank" rel="noreferrer">Abrir agenda <ExternalLink className="ml-2 h-4 w-4"/></a></Button></div><div className="grid gap-3">{items.map(i=><Card key={i.id}><CardContent className="flex flex-wrap justify-between gap-2 p-5"><div><p className="font-semibold">{i.title}</p><p className="text-sm text-muted-foreground">{i.category||"Cultura"} · {i.location||"Local a confirmar"}</p></div><p className="text-sm">{i.event_date?new Date(i.event_date).toLocaleString("pt-BR"):"Sem data"}</p></CardContent></Card>)}</div></div></DashboardLayout>}
