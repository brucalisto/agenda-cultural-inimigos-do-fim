import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Settings2, ShieldCheck, ShieldAlert, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/groups")({
  component: GroupsPage,
});

type WhatsAppGroup = Tables<"whatsapp_groups">;

function GroupsPage() {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [newGroup, setNewGroup] = useState({
    nome: "",
    external_group_id: "",
    descricao: "",
    ativo: true,
    autorizado: false,
    automation_mode: "monitorar" as "monitorar" | "simular" | "executar",
  });

  const fetchGroups = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_groups")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar grupos: " + error.message);
    } else {
      setGroups(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("whatsapp_groups").insert([newGroup]);

    if (error) {
      toast.error("Erro ao criar grupo: " + error.message);
    } else {
      toast.success("Grupo criado com sucesso!");
      setIsDialogOpen(false);
      setNewGroup({
        nome: "",
        external_group_id: "",
        descricao: "",
        ativo: true,
        autorizado: false,
        automation_mode: "monitorar",
      });
      fetchGroups();
    }
  };

  const toggleGroupStatus = async (id: string, field: "ativo" | "autorizado", value: boolean) => {
    const { error } = await supabase
      .from("whatsapp_groups")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar grupo: " + error.message);
    } else {
      setGroups(groups.map(g => g.id === id ? { ...g, [field]: value } : g));
      toast.success("Grupo atualizado");
    }
  };

  const updateAutomationMode = async (id: string, mode: "monitorar" | "simular" | "executar") => {
    const { error } = await supabase
      .from("whatsapp_groups")
      .update({ automation_mode: mode })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar modo: " + error.message);
    } else {
      setGroups(groups.map(g => g.id === id ? { ...g, automation_mode: mode } : g));
      toast.success(`Modo alterado para ${mode}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Grupos</h1>
            <p className="text-muted-foreground">Gerenciamento de grupos do WhatsApp monitorados.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Grupo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleCreateGroup}>
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Grupo</DialogTitle>
                  <DialogDescription>
                    Adicione um grupo para começar a monitorar as mensagens.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="nome">Nome do Grupo</Label>
                    <Input
                      id="nome"
                      required
                      value={newGroup.nome}
                      onChange={(e) => setNewGroup({ ...newGroup, nome: e.target.value })}
                      placeholder="Ex: Vendas e Leads"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="external_id">ID Externo (WhatsApp)</Label>
                    <Input
                      id="external_id"
                      required
                      value={newGroup.external_group_id}
                      onChange={(e) => setNewGroup({ ...newGroup, external_group_id: e.target.value })}
                      placeholder="1203630239485@g.us"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Input
                      id="descricao"
                      value={newGroup.descricao || ""}
                      onChange={(e) => setNewGroup({ ...newGroup, descricao: e.target.value })}
                      placeholder="Breve descrição do propósito do grupo"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Modo de Automação</Label>
                    <Select
                      value={newGroup.automation_mode}
                      onValueChange={(value: any) => setNewGroup({ ...newGroup, automation_mode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o modo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monitorar">Monitorar (Apenas leitura)</SelectItem>
                        <SelectItem value="simular">Simular (Logs sem envio)</SelectItem>
                        <SelectItem value="executar">Executar (Ações Reais)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newGroup.automation_mode === "executar" && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-xs">Atenção</AlertTitle>
                      <AlertDescription className="text-xs">
                        O modo executar permite ações reais. Use com cautela.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
                    <Label htmlFor="ativo" className="flex flex-col gap-1">
                      <span>Ativo</span>
                      <span className="text-xs font-normal text-muted-foreground">Habilitar monitoramento</span>
                    </Label>
                    <Switch
                      id="ativo"
                      checked={newGroup.ativo}
                      onCheckedChange={(checked) => setNewGroup({ ...newGroup, ativo: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
                    <Label htmlFor="autorizado" className="flex flex-col gap-1">
                      <span>Autorizado</span>
                      <span className="text-xs font-normal text-muted-foreground">Permitir processamento</span>
                    </Label>
                    <Switch
                      id="autorizado"
                      checked={newGroup.autorizado}
                      onCheckedChange={(checked) => setNewGroup({ ...newGroup, autorizado: checked })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Cadastrar Grupo</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead>ID Externo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Modo</TableHead>
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
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Nenhum grupo cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div className="font-medium">{group.nome}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {group.descricao || "Sem descrição"}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{group.external_group_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!group.ativo}
                          onCheckedChange={(val) => toggleGroupStatus(group.id, "ativo", val)}
                          aria-label="Ativo"
                        />
                        <span className="text-xs">{group.ativo ? "Ativo" : "Inativo"}</span>
                        {group.autorizado ? (
                          <ShieldCheck className="h-4 w-4 text-emerald-500" title="Autorizado" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-amber-500" title="Não Autorizado" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={group.automation_mode || "monitorar"}
                        onValueChange={(val: any) => updateAutomationMode(group.id, val)}
                      >
                        <SelectTrigger className="h-8 w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monitorar">Monitorar</SelectItem>
                          <SelectItem value="simular">Simular</SelectItem>
                          <SelectItem value="executar">Executar</SelectItem>
                        </SelectContent>
                      </Select>
                      {group.automation_mode === "executar" && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-destructive font-bold uppercase">
                          <AlertCircle className="h-3 w-3" />
                          Alerta: Ações Reais
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <Settings2 className="h-4 w-4" />
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

