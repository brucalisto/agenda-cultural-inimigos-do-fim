import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Info } from "lucide-react";

interface RuleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: any;
  onSave: (data: any) => void;
}

export function RuleEditor({ open, onOpenChange, rule, onSave }: RuleEditorProps) {
  const [formData, setFormData] = useState<any>({
    nome: "",
    descricao: "",
    ativo: true,
    priority: 0,
    action_type: "apenas_registrar",
    requires_approval: true,
    conditions: {
      keywords: [],
      categories: [],
      min_confidence: 0.7
    }
  });

  useEffect(() => {
    if (rule) {
      setFormData({
        ...rule,
        conditions: rule.conditions || { keywords: [], categories: [], min_confidence: 0.7 }
      });
    } else {
      setFormData({
        nome: "",
        descricao: "",
        ativo: true,
        priority: 0,
        action_type: "apenas_registrar",
        requires_approval: true,
        conditions: { keywords: [], categories: [], min_confidence: 0.7 }
      });
    }
  }, [rule, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const isDestructive = ['solicitar_exclusao', 'responder', 'publicar'].includes(formData.action_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar Regra" : "Nova Regra"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Regra</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
                placeholder="Ex: Alerta de SPAM"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva o propósito desta regra..."
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label htmlFor="ativo">Regra Ativa</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="requires_approval"
                checked={formData.requires_approval}
                onCheckedChange={(checked) => setFormData({ ...formData, requires_approval: checked })}
              />
              <Label htmlFor="requires_approval">Requer Aprovação Manual</Label>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4">Condições</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Palavras-chave (separadas por vírgula)</Label>
                <Input
                  value={formData.conditions.keywords?.join(", ") || ""}
                  onChange={(e) => setFormData({
                    ...formData,
                    conditions: {
                      ...formData.conditions,
                      keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean)
                    }
                  })}
                  placeholder="venda, urgente, oferta"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Confiança Mínima (0.0 - 1.0)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={formData.conditions.min_confidence}
                    onChange={(e) => setFormData({
                      ...formData,
                      conditions: {
                        ...formData.conditions,
                        min_confidence: parseFloat(e.target.value)
                      }
                    })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4">Ação</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Ação</Label>
                <Select
                  value={formData.action_type}
                  onValueChange={(value) => setFormData({ ...formData, action_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apenas_registrar">Apenas Registrar</SelectItem>
                    <SelectItem value="sinalizar">Sinalizar</SelectItem>
                    <SelectItem value="ignorar">Ignorar</SelectItem>
                    <SelectItem value="enviar_para_revisao">Enviar para Revisão</SelectItem>
                    <SelectItem value="aprovar">Aprovar</SelectItem>
                    <SelectItem value="publicar">Publicar</SelectItem>
                    <SelectItem value="responder">Responder</SelectItem>
                    <SelectItem value="solicitar_exclusao">Solicitar Exclusão</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isDestructive && (
                <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-md flex items-start gap-3 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Ação de Alto Impacto</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Esta ação pode afetar mensagens ou publicar conteúdo. 
                      No momento, ações reais estão bloqueadas e serão apenas <strong>simuladas</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Salvar Regra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
