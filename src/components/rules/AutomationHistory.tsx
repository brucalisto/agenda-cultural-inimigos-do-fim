import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAutomationHistory } from "@/lib/automation.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, AlertTriangle } from "lucide-react";

export function AutomationHistory() {
  const fetchHistory = useServerFn(getAutomationHistory);
  const { data: history, isLoading } = useQuery({
    queryKey: ["automation-history"],
    queryFn: () => fetchHistory(),
  });

  if (isLoading) return <div>Carregando histórico...</div>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Regra</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Modo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history?.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-xs">
                {format(new Date(entry.created_at!), "dd/MM HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell className="font-medium">
                {(entry.automation_rules as any)?.nome || "Regra removida"}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{entry.action_type}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="uppercase text-[10px]">
                  {entry.execution_mode}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge 
                  variant={entry.status === 'erro' ? 'destructive' : 'default'}
                  className={cn(
                    entry.status === 'simulado' && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                  )}
                >
                  {entry.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Detalhes da Ação Automática</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-bold">Mensagem</p>
                          <p className="mt-1">{(entry.whatsapp_messages as any)?.text_content || (entry.whatsapp_messages as any)?.caption || "Sem texto"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-bold">Modo de Execução</p>
                          <p className="mt-1 font-mono uppercase">{entry.execution_mode}</p>
                        </div>
                      </div>

                      {entry.error_message && (
                        <div className="bg-destructive/10 p-3 rounded-md flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-destructive">Erro</p>
                            <p className="text-xs text-destructive">{entry.error_message}</p>
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-bold mb-2">Payload Simulado</p>
                        <pre className="bg-secondary p-4 rounded-md text-[10px] overflow-auto max-h-[200px]">
                          {JSON.stringify(entry.request_payload, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-bold mb-2">Resposta</p>
                        <pre className="bg-secondary p-4 rounded-md text-[10px] overflow-auto max-h-[200px]">
                          {JSON.stringify(entry.response_payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
