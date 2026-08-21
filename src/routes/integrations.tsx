import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  CircleOff,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Smartphone,
  Unplug,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { manageWhatsAppIntegration } from "@/lib/integrations.functions";

export const Route = createFileRoute("/integrations")({
  component: IntegrationsPage,
});

type WhatsAppState = {
  state: string;
  connected: boolean;
  qrAvailable: boolean;
  user: { id: string; name: string | null } | null;
};

type WhatsAppGroup = {
  id: string;
  subject: string;
  participants: number;
};

async function callIntegration(action: "status" | "qr" | "groups" | "logout" | "gemini-status") {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  return manageWhatsAppIntegration({
    data: { action, accessToken: session.access_token },
  });
}

function stateLabel(state?: string) {
  const labels: Record<string, string> = {
    connected: "Conectado",
    qr_pending: "Aguardando leitura do QR",
    disconnected: "Desconectado",
    starting: "Iniciando",
  };
  return labels[state || ""] || state || "Indisponível";
}

function IntegrationsPage() {
  const [status, setStatus] = useState<WhatsAppState | null>(null);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (showToast = false) => {
    try {
      const result = await callIntegration("status");
      if (result.kind !== "status") throw new Error("Resposta inesperada do Baileys.");

      const nextStatus = result as unknown as WhatsAppState & { kind: "status" };
      setStatus(nextStatus);
      setError(null);

      if (nextStatus.connected) {
        setQrDataUrl(null);
        const groupResult = await callIntegration("groups");
        if (groupResult.kind === "groups") {
          setGroups((groupResult as unknown as { groups?: WhatsAppGroup[] }).groups || []);
        }
      } else {
        setGroups([]);
        if (nextStatus.qrAvailable) {
          const qrResult = await callIntegration("qr");
          if (qrResult.kind === "qr") setQrDataUrl(qrResult.dataUrl);
        } else {
          setQrDataUrl(null);
        }
      }

      if (showToast) toast.success("Estado da integração atualizado.");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Não foi possível consultar o Baileys.";
      setError(message);
      if (showToast) toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    void callIntegration("gemini-status")
      .then((result) => {
        if (result.kind === "gemini-status") setGeminiConfigured(result.configured);
      })
      .catch(() => setGeminiConfigured(false));
  }, []);

  async function disconnect() {
    setDisconnecting(true);
    try {
      await callIntegration("logout");
      toast.success("WhatsApp desconectado.");
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Falha ao desconectar.");
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = Boolean(status?.connected);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Integrações</h1>
          <p className="text-muted-foreground">
            Conecte e acompanhe os serviços que recebem e interpretam os conteúdos.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <CircleOff className="h-4 w-4" />
            <AlertTitle>Não foi possível consultar o Baileys</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-emerald-500" />
                  <CardTitle>WhatsApp via Baileys</CardTitle>
                </div>
                <CardDescription>
                  Instância principal para leitura dos grupos autorizados.
                </CardDescription>
              </div>
              {loading ? (
                <Badge variant="outline">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Consultando
                </Badge>
              ) : (
                <Badge
                  variant={connected ? "default" : "outline"}
                  className={connected ? "bg-emerald-600 hover:bg-emerald-600" : ""}
                >
                  {connected ? (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  ) : (
                    <CircleOff className="mr-1 h-3 w-3" />
                  )}
                  {stateLabel(status?.state)}
                </Badge>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Instância
                  </p>
                  <p className="mt-1 font-medium">Principal</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Conta
                  </p>
                  <p className="mt-1 break-all font-medium">
                    {status?.user?.name || status?.user?.id || "Nenhuma conta conectada"}
                  </p>
                  {status?.user?.name && status.user.id && (
                    <p className="break-all text-xs text-muted-foreground">{status.user.id}</p>
                  )}
                </div>
              </div>

              {!connected && qrDataUrl && (
                <div className="grid items-center gap-5 rounded-xl border p-4 md:grid-cols-[minmax(220px,320px)_1fr]">
                  <img
                    src={qrDataUrl}
                    alt="QR Code para conectar o WhatsApp"
                    className="w-full rounded-lg border bg-white p-2"
                  />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 font-semibold">
                      <QrCode className="h-5 w-5" />
                      Conecte o dispositivo
                    </div>
                    <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                      <li>Abra o WhatsApp no celular.</li>
                      <li>Acesse Dispositivos conectados.</li>
                      <li>Escolha Conectar um dispositivo e leia o código.</li>
                    </ol>
                    <p className="text-xs text-muted-foreground">
                      O painel atualiza automaticamente após a leitura.
                    </p>
                  </div>
                </div>
              )}

              {!connected && !qrDataUrl && !loading && !error && (
                <Alert>
                  <Smartphone className="h-4 w-4" />
                  <AlertTitle>{stateLabel(status?.state)}</AlertTitle>
                  <AlertDescription>
                    Aguarde alguns segundos e atualize. O QR Code aparecerá quando o Baileys estiver
                    pronto.
                  </AlertDescription>
                </Alert>
              )}

              {connected && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold">
                      <Users className="h-4 w-4" />
                      Grupos detectados
                    </div>
                    <Badge variant="secondary">{groups.length}</Badge>
                  </div>
                  <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                    {groups.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">
                        Nenhum grupo retornado pela conta.
                      </p>
                    ) : (
                      groups.map((group) => (
                        <div key={group.id} className="flex items-center justify-between gap-4 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{group.subject}</p>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {group.id}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {group.participants} participantes
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void refresh(true)} disabled={loading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
                {connected && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Unplug className="mr-2 h-4 w-4" />
                        Desconectar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Desconectar o WhatsApp?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A leitura de novas mensagens será interrompida e será necessário ler outro
                          QR Code para conectar novamente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void disconnect()}
                          disabled={disconnecting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {disconnecting ? "Desconectando..." : "Confirmar desconexão"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <CardTitle>Google Gemini</CardTitle>
              </div>
              <CardDescription>
                Interpretação estruturada de textos e mídias recebidos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge
                variant={geminiConfigured ? "default" : "outline"}
                className={geminiConfigured ? "bg-emerald-600 hover:bg-emerald-600" : ""}
              >
                {geminiConfigured ? "Configurado" : "Aguardando configuração"}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {geminiConfigured
                  ? "A chave está protegida no backend e pronta para uso."
                  : "Adicione GEMINI_API_KEY nos segredos do backend para ativar a interpretação."}
              </p>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                A chave nunca é exibida nem enviada para o navegador.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
