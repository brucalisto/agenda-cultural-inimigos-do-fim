import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRules, saveRule } from "@/lib/automation.functions";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, History, AlertTriangle } from "lucide-react";
import { RuleEditor } from "./RuleEditor";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AutomationHistory } from "./AutomationHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function RulesList() {
  const [editingRule, setEditingRule] = useState<any>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const queryClient = useQueryClient();

  const fetchRules = useServerFn(getRules);
  const { data: rules, isLoading } = useQuery({
    queryKey: ["automation-rules"],
    queryFn: () => fetchRules(),
  });

  const saveRuleMutation = useMutation({
    mutationFn: useServerFn(saveRule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Regra salva com sucesso");
      setIsEditorOpen(false);
      setEditingRule(null);
    },
    onError: (error) => {
      toast.error("Erro ao salvar regra: " + error.message);
    }
  });

  const handleEdit = (rule: any) => {
    setEditingRule(rule);
    setIsEditorOpen(true);
  };

  const handleNew = () => {
    setEditingRule(null);
    setIsEditorOpen(true);
  };

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Regras de Automação</h1>
          <p className="text-muted-foreground">Configure ações automáticas baseadas no conteúdo das mensagens.</p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Regra
        </Button>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" className="gap-2">
            <Edit2 className="h-4 w-4" /> Regras
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aprovação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules?.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.priority}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-semibold">{rule.nome}</div>
                        <div className="text-xs text-muted-foreground">{rule.descricao}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={cn(
                          (rule.action_type === 'solicitar_exclusao' || rule.action_type === 'responder' || rule.action_type === 'publicar') && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        )}>
                          {rule.action_type}
                        </Badge>
                        {(rule.action_type === 'solicitar_exclusao' || rule.action_type === 'responder' || rule.action_type === 'publicar') && (
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={rule.ativo ? "default" : "secondary"}>
                        {rule.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rule.requires_approval ? "Sim" : "Não"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <AutomationHistory />
        </TabsContent>
      </Tabs>

      <RuleEditor
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        rule={editingRule}
        onSave={(data: any) => saveRuleMutation.mutate(data)}
      />
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
