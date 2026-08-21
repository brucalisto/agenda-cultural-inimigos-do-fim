import { createFileRoute } from '@tanstack/react-router';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export const Route = createFileRoute('/logs')({
  component: WebhookLogsPage,
});

function WebhookLogsPage() {
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['webhook_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_events')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const isAdmin = profile?.role === 'administrador';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed': return <Badge className="bg-green-500">Processado</Badge>;
      case 'received': return <Badge className="bg-blue-500">Recebido</Badge>;
      case 'ignored': return <Badge className="bg-yellow-500">Ignorado</Badge>;
      case 'error': return <Badge variant="destructive">Erro</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Logs de Webhook</h1>
          <p className="text-muted-foreground">Monitore o recebimento de eventos da Evolution API</p>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Provedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Carregando logs...</TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Nenhum log encontrado.</TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.received_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="capitalize">{log.provider}</TableCell>
                    <TableCell className="font-mono text-xs">{log.event_type}</TableCell>
                    <TableCell>{getStatusBadge(log.processing_status)}</TableCell>
                    <TableCell>
                      <span className={log.http_status === 200 ? 'text-green-600' : 'text-red-600'}>
                        {log.http_status || '-'}
                      </span>
                    </TableCell>
                    <TableCell>{log.processing_duration_ms ? `${log.processing_duration_ms}ms` : '-'}</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedEvent(log)}>
                            Ver Detalhes
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>Detalhes do Evento</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="h-[60vh] mt-4">
                            <div className="space-y-4">
                              {log.error_message && (
                                <div className="bg-red-50 border border-red-200 p-3 rounded text-red-700 text-sm">
                                  <strong>Erro:</strong> {log.error_message}
                                </div>
                              )}
                              
                              <div>
                                <h4 className="font-semibold mb-2">Payload Bruto</h4>
                                {isAdmin ? (
                                  <pre className="bg-slate-900 text-slate-100 p-4 rounded text-xs overflow-auto">
                                    {JSON.stringify(log.payload, null, 2)}
                                  </pre>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">
                                    Visualização restrita a administradores.
                                  </p>
                                )}
                              </div>

                              <div>
                                <h4 className="font-semibold mb-2">Headers</h4>
                                <pre className="bg-slate-100 p-4 rounded text-xs overflow-auto">
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
