import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2, MessageCircle, Plus, Radio, Smartphone, Workflow } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { assignAgendaGroup, getAutomationHub } from "@/lib/automation-hub.functions";
import { manageWhatsAppIntegration } from "@/lib/integrations.functions";

export const Route = createFileRoute("/automations")({ component: AutomationsPage });

type Group = { id: string; subject: string; participants: number };
type AgendaGroup = { external_group_id: string; nome: string };

function AutomationsPage() {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [device, setDevice] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [agendaGroups, setAgendaGroups] = useState<AgendaGroup[]>([]);
  const [selected, setSelected] = useState("");
  const [manualId, setManualId] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Entre na área administrativa para continuar.");
        const accessToken = session.access_token;
        const hub = await getAutomationHub({ data: { accessToken } });
        if (!active) return;
        setAllowed(true);
        setAgendaGroups(hub.groups);
        try {
          const status = await manageWhatsAppIntegration({ data: { action: "status", accessToken } });
          if (!active) return;
          if (status.kind !== "status") throw new Error("Resposta inesperada do dispositivo.");
          setDevice(status.connected ? "Conectado" : "Desconectado");
          if (status.connected) {
            const result = await manageWhatsAppIntegration({ data: { action: "groups", accessToken } });
            if (active && result.kind === "groups") setGroups((result as unknown as { groups?: Group[] }).groups ?? []);
          }
        } catch {
          if (active) setDevice("Consulta indisponível");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Acesso indisponível.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function associateGroup() {
    const group = groups.find((item) => item.id === selected);
    const groupId = group?.id || manualId.trim();
    if (!groupId) return toast.error("Selecione um grupo ou informe o ID completo.");
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sua sessão expirou.");
      await assignAgendaGroup({ data: {
        accessToken: session.access_token,
        groupId,
        groupName: group?.subject || `Grupo ${groupId}`,
      } });
      const hub = await getAutomationHub({ data: { accessToken: session.access_token } });
      setAgendaGroups(hub.groups);
      setManualId("");
      toast.success("Grupo associado à captação de eventos.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Falha ao associar grupo.");
    } finally {
      setSaving(false);
    }
  }

  return <DashboardLayout>
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-2"><Workflow className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Automações</h1></div>
        <p className="mt-2 text-muted-foreground">Espaço separado da agenda para organizar as rotinas que usam os dispositivos conectados.</p>
      </div>
      {loading ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verificando acesso...</p>
        : error ? <Card><CardContent className="pt-6 text-destructive">{error}</CardContent></Card>
        : allowed && <>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" /> Dispositivos</CardTitle><CardDescription>A conexão existente da agenda pode atender outras rotinas. O servidor atual suporta uma sessão; a expansão para vários dispositivos depende de sessões isoladas no Baileys.</CardDescription></CardHeader><CardContent className="flex items-center justify-between gap-3"><span>Dispositivo principal · {device || "Consultando"}</span><Button asChild variant="outline" size="sm"><Link to="/integrations">Gerenciar conexão</Link></Button></CardContent></Card>
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Rotinas</h2><span className="flex items-center gap-1 text-sm text-muted-foreground"><Plus className="h-4 w-4" /> Novas rotinas terão configuração própria</span></div>
          <Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" /> Inimigos do Fim</CardTitle><CardDescription className="mt-2">Captação de eventos de grupos autorizados. As regras de interpretação continuam na área da agenda.</CardDescription></div><Badge variant="outline">Agenda cultural</Badge></div></CardHeader><CardContent className="space-y-4">
            <div><Label htmlFor="agenda-group">Selecionar grupo do dispositivo</Label><Select value={selected} onValueChange={setSelected}><SelectTrigger id="agenda-group" className="mt-2"><SelectValue placeholder={groups.length ? "Escolha um grupo" : "Nenhum grupo disponível no dispositivo"} /></SelectTrigger><SelectContent>{groups.map(group => <SelectItem key={group.id} value={group.id}>{group.subject} · {group.id}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="agenda-group-id">Ou informar ID completo do grupo</Label><Input id="agenda-group-id" className="mt-2" placeholder="120363...@g.us" value={manualId} onChange={event => { setManualId(event.target.value); if(event.target.value) setSelected(""); }} /></div>
            <Button onClick={() => void associateGroup()} disabled={saving}>{saving ? "Salvando..." : "Associar à agenda"}</Button>
            <div className="text-sm text-muted-foreground">Grupos autorizados: {agendaGroups.length ? agendaGroups.map(group => group.nome).join(", ") : "nenhum"}. <Link to="/groups" className="underline">Gerenciar permissões e leitura</Link>.</div>
          </CardContent></Card>
          <Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5" /> Edital 36/2025 · Odé da Mata</CardTitle><CardDescription className="mt-2">Acompanhamento das publicações oficiais do edital, separado da captação de eventos.</CardDescription></div><Badge variant="outline">Envio por WhatsApp pendente</Badge></div></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>A consulta programada registra o histórico no projeto do Odé. Nenhum grupo está conectado para receber avisos por WhatsApp até o envio e a confirmação de entrega serem implementados no servidor.</p><a className="inline-flex items-center gap-1 text-primary underline" href="https://github.com/brucalis/edital-36.2025-od-da-mata" target="_blank" rel="noopener noreferrer">Abrir projeto do edital <ExternalLink className="h-4 w-4" /></a></CardContent></Card>
        </>}
    </div>
  </DashboardLayout>;
}
