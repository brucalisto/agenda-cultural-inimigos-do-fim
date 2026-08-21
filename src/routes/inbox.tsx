import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  User, 
  Calendar, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  Brain,
  Eye,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
});

type WhatsAppMessage = Tables<"whatsapp_messages">;

function InboxPage() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*, whatsapp_groups(nome)")
      .order("received_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar mensagens: " + error.message);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "recebido": return <Badge variant="secondary">Recebido</Badge>;
      case "pendente": return <Badge variant="outline">Pendente</Badge>;
      case "processando": return <Badge variant="secondary" className="animate-pulse">Processando</Badge>;
      case "interpretado": return <Badge className="bg-purple-500">Interpretado</Badge>;
      case "necessita_revisao": return <Badge className="bg-amber-500">Revisão</Badge>;
      case "aprovado": return <Badge className="bg-emerald-500">Aprovado</Badge>;
      case "publicado": return <Badge className="bg-blue-500">Publicado</Badge>;
      case "ignorado": return <Badge variant="slate">Ignorado</Badge>;
      case "erro": return <Badge variant="destructive">Erro</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Caixa de entrada</h1>
            <p className="text-muted-foreground">Visualização de mensagens brutas recebidas.</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchMessages} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
          </Button>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Remetente / Grupo</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Recebido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : messages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Nenhuma mensagem recebida ainda.
                  </TableCell>
                </TableRow>
              ) : (
                messages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 font-medium text-sm">
                          <User className="h-3 w-3" />
                          {msg.sender_name || msg.sender_external_id}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          {(msg as any).whatsapp_groups?.nome || "Grupo desconhecido"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[400px]">
                        <p className="text-sm line-clamp-2 italic text-muted-foreground">
                          {msg.text_content || msg.caption || "(Mídia/Sem texto)"}
                        </p>
                        {msg.message_type !== "text" && msg.message_type && (
                          <Badge variant="outline" className="mt-1 text-[10px] h-4">
                            {msg.message_type}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {msg.received_at ? format(new Date(msg.received_at), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {msg.received_at ? format(new Date(msg.received_at), "HH:mm:ss") : "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(msg.processing_status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}

