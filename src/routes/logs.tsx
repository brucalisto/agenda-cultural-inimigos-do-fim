import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { reprocessWebhookEvent } from "@/lib/webhook.functions";
import { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/logs")({
  component: WebhookLogsPage,
});

function WebhookLogsPage() {
  const { user } = useAuth();
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  const {
    data: logs,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["webhook_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_events")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user,
  });

  const isAdmin = profile?.role === "admin";
  const reprocess = async (log: Tables<"webhook_events">) => {
    setReprocessingId(log.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada. Entre novamente.");
      await reprocessWebhookEvent({ data: { eventId: log.id, accessToken } });
      toast.success("Evento reprocessado. A mensagem foi enviada ao Gemini.");
      await refetch();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível reprocessar.");
    } finally {
      setReprocessingId(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "processed":
        return <Badge className="bg-green-500 text-white">Processado</Badge>;
      case "received":
        return <Badge className="bg-blue-500 text-white">Recebido</Badge>;
      case "ignored":
        return <Badge className="bg-yellow-500 text-white">Ignorado</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">{status || "Desconhecido"}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Logs de Webhook</h1>
          <p className="text-muted-foreground">
            Monitore o recebimento de eventos da Evolution API
          </p>
        </div>

        <div className="border rounded-md bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Provedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Carregando logs...
                  </TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Nenhum log encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {log.received_at
                        ? format(new Date(log.received_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="capitalize">{log.provider}</TableCell>
                    <TableCell className="font-mono text-xs">{log.event_type}</TableCell>
                    <TableCell>{getStatusBadge(log.processing_status)}</TableCell>
                    <TableCell>
                      <span
                        className={
                          log.http_status === 200
                            ? "text-green-600 font-medium"
                            : "text-red-600 font-medium"
                        }
                      >
                        {log.http_status || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {log.processing_duration_ms ? `${log.processing_duration_ms}ms` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            Ver Detalhes
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh]">
                          <DialogHeader>
                            <DialogTitle>Detalhes do Evento</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="h-[70vh] pr-4">
                            <div className="space-y-6 pb-4">
                              {log.error_message && (
                                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg text-destructive text-sm font-medium">
                                  <strong>Erro:</strong> {log.error_message}
                                </div>
                              )}
                              {(log.processing_status === "ignored" ||
                                log.processing_status === "error") && (
                                <div className="flex justify-end">
                                  <Button
                                    onClick={() => void reprocess(log)}
                                    disabled={reprocessingId === log.id}
                                  >
                                    {reprocessingId === log.id ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <RotateCcw className="mr-2 h-4 w-4" />
                                    )}
                                    Reprocessar evento
                                  </Button>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                  <span className="text-muted-foreground block">ID Externo</span>
                                  <span className="font-mono">
                                    {log.external_event_id || "N/A"}
                                  </span>
                                </div>
                                <div className="space-y-1 text-right">
                                  <span className="text-muted-foreground block">
                                    Data Processamento
                                  </span>
                                  <span>
                                    {log.processed_at
                                      ? format(new Date(log.processed_at), "dd/MM HH:mm:ss")
                                      : "-"}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center justify-between">
                                  Payload Bruto
                                  {!isAdmin && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      Restrito
                                    </Badge>
                                  )}
                                </h4>
                                {isAdmin ? (
                                  <div className="relative group">
                                    <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-[11px] overflow-auto max-h-[400px] leading-relaxed">
                                      {JSON.stringify(log.payload, null, 2)}
                                    </pre>
                                  </div>
                                ) : (
                                  <div className="bg-muted/30 border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground italic">
                                    A visualização do payload é restrita a administradores.
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Headers (Sanitizados)</h4>
                                <pre className="bg-muted p-4 rounded-lg text-[11px] overflow-auto max-h-[200px] leading-relaxed">
                                  {JSON.stringify(log.headers_sanitized, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
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
