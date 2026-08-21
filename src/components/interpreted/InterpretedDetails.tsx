import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  MessageSquare, 
  User, 
  Users, 
  Calendar, 
  Link as LinkIcon, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Mic, 
  ChevronDown, 
  ChevronUp,
  Brain,
  AlertCircle,
  Clock,
  RotateCcw,
  Sparkles,
  CheckCircle,
  Edit,
  Trash2,
  Send,
  Copy,
  ExternalLink,
  History,
  Save,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
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
import { useQuery } from "@tanstack/react-query";
import { getInterpretedContentById, updateInterpretedContent, type InterpretedContent } from "@/lib/interpreted";
import { reprocessMessage } from "@/lib/gemini.functions";
import { simulateAutomation } from "@/lib/automation.functions";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

interface InterpretedDetailsProps {
  id: string;
  onClose: () => void;
}

export function InterpretedDetails({ id, onClose }: InterpretedDetailsProps) {
  const [isTechnicalOpen, setIsTechnicalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  
  const { data: content, isLoading, refetch } = useQuery({
    queryKey: ["interpreted-content", id],
    queryFn: () => getInterpretedContentById(id),
  });

  const [editForm, setEditForm] = useState<Partial<InterpretedContent>>({});

  const startEditing = () => {
    if (content) {
      setEditForm({
        title: content.title,
        category: content.category,
        summary: content.summary,
        location: content.location,
        price: content.price,
      });
      setIsEditing(true);
    }
  };

  const saveEdits = async () => {
    try {
      await updateInterpretedContent(id, editForm as any);
      toast.success("Conteúdo atualizado com sucesso");
      setIsEditing(false);
      refetch();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await updateInterpretedContent(id, { review_status: status });
      toast.success(`Status atualizado para ${status}`);
      refetch();
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const handleGeminiReprocess = async () => {
    const messageId = (content as any)?.message_id as string | undefined;
    if (!messageId) return;
    setIsReprocessing(true);
    try {
      await reprocessMessage({ data: { messageId } });
      toast.success("Reprocessado com sucesso pelo Gemini");
      refetch();
    } catch (error: any) {
      toast.error("Erro no Gemini: " + error.message);
    } finally {
      setIsReprocessing(false);
    }
  };


  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(content, null, 2));
    toast.success("JSON copiado para a área de transferência");
  };

  if (isLoading) return <div className="p-10 text-center">Carregando detalhes...</div>;
  if (!content) return <div className="p-10 text-center">Conteúdo não encontrado.</div>;

  const msg = content.whatsapp_messages;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-y-auto">
        {/* Left Column: Original Message context */}
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Mensagem Original
            </h3>
            
            <div className="bg-muted/30 rounded-lg p-4 border space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{msg?.sender_name || "Desconhecido"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {msg?.whatsapp_groups?.nome || "Grupo Privado"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    <Calendar className="h-3 w-3" />
                    {msg?.occurred_at ? format(new Date(msg.occurred_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "N/A"}
                  </p>
                </div>
              </div>

              <div className="bg-background rounded p-3 border text-sm italic whitespace-pre-wrap">
                {msg?.text_content || "Sem conteúdo de texto."}
              </div>

              {/* Media Section */}
              {msg?.message_media && msg.message_media.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Mídias anexadas:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {msg.message_media.map((media: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-background border rounded text-xs">
                        {media.media_type.includes('image') ? <ImageIcon className="h-3 w-3" /> : 
                         media.media_type.includes('video') ? <Video className="h-3 w-3" /> : 
                         media.media_type.includes('audio') ? <Mic className="h-3 w-3" /> : 
                         <FileText className="h-3 w-3" />}
                        <span className="truncate">{media.original_filename}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Links Section */}
              {msg?.extracted_links && msg.extracted_links.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Links encontrados:</p>
                  <div className="space-y-1">
                    {msg.extracted_links.map((link: any, i: number) => (
                      <a 
                        key={i} 
                        href={link.original_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded text-xs text-blue-700"
                      >
                        <LinkIcon className="h-3 w-3" />
                        <span className="truncate flex-1">{link.page_title || link.original_url}</span>
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="space-y-2">
            <Collapsible open={isTechnicalOpen} onOpenChange={setIsTechnicalOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between font-semibold">
                  DADOS TÉCNICOS (ADM)
                  {isTechnicalOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 bg-slate-950 rounded-lg overflow-x-auto">
                <pre className="text-[10px] text-green-400 font-mono">
                  {JSON.stringify(msg?.raw_payload || {}, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between font-semibold">
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    HISTÓRICO DE ALTERAÇÕES
                  </span>
                  {isHistoryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                <div className="p-3 bg-muted/50 rounded-lg border text-xs space-y-2">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Criado por Gemini 1.5 Pro</span>
                    <span>{format(new Date(content.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                  {content.reviewed_at && (
                    <div className="flex justify-between items-center text-muted-foreground pt-2 border-t">
                      <span>Revisado por Admin</span>
                      <span>{format(new Date(content.reviewed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}
                  <p className="text-center italic text-muted-foreground pt-2">Fim do histórico demonstrativo</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Right Column: AI Interpretation */}
        <div className="space-y-6">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Informações Extraídas (IA)
              </h3>
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={startEditing} className="gap-2">
                  <Edit className="h-3 w-3" />
                  Editar
                </Button>
              )}
            </div>
            
            <div className="bg-card rounded-lg border shadow-sm divide-y">
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-center gap-4">
                  {isEditing ? (
                    <Input 
                      value={editForm.title || ""} 
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      placeholder="Título do conteúdo"
                    />
                  ) : (
                    <h4 className="font-bold text-lg">{content.title || "Sem título"}</h4>
                  )}
                  <Badge className={cn(
                    (content.confidence_score || 0) > 0.8 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                  )}>
                    {Math.round((content.confidence_score || 0) * 100)}% Confiança
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-semibold">Categoria</p>
                    {isEditing ? (
                      <Input 
                        value={editForm.category || ""} 
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{content.category || "Não categorizado"}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-semibold">Localização</p>
                    {isEditing ? (
                      <Input 
                        value={editForm.location || ""} 
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{content.location || "Não informada"}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-semibold">Preço/Valor</p>
                    {isEditing ? (
                      <Input 
                        value={editForm.price || ""} 
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{content.price || "N/A"}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-semibold">Data do Evento</p>
                    <p className="font-medium">
                      {content.event_date ? format(new Date(content.event_date), "dd/MM/yyyy", { locale: ptBR }) : "Não detectada"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold mb-1">Resumo</p>
                  {isEditing ? (
                    <Textarea 
                      value={editForm.summary || ""} 
                      onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                      className="mt-1 min-h-[100px]"
                    />
                  ) : (
                    <p className="text-sm leading-relaxed">{content.summary || "Sem resumo disponível."}</p>
                  )}
                </div>

                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold mb-2">Palavras-chave</p>
                  <div className="flex flex-wrap gap-1">
                    {content.keywords?.map((kw, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{kw}</Badge>
                    )) || <span className="text-xs italic">Nenhuma</span>}
                  </div>
                </div>
              </div>

              {/* Warnings and Missing Fields */}
              {(content.missing_fields?.length || 0) + (content.warnings?.length || 0) > 0 && (
                <div className="p-4 bg-orange-50/30 space-y-3">
                  {content.missing_fields && content.missing_fields.length > 0 && (
                    <div className="flex gap-2 text-xs text-orange-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-bold">Campos ausentes:</p>
                        <p>{content.missing_fields.join(", ")}</p>
                      </div>
                    </div>
                  )}
                  {content.warnings && content.warnings.length > 0 && (
                    <div className="flex gap-2 text-xs text-amber-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-bold">Avisos da IA:</p>
                        <ul className="list-disc list-inside">
                          {content.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4">
                 <div className="flex items-center gap-2 text-xs text-muted-foreground">
                   <Clock className="h-3 w-3" />
                   <span>Processado com: <strong>{content.model_used}</strong></span>
                 </div>
              </div>
            </div>

            {isEditing && (
              <div className="mt-4 flex gap-2">
                <Button className="flex-1 gap-2" onClick={saveEdits}>
                  <Save className="h-4 w-4" />
                  Salvar Alterações
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Footer Actions */}
      {!isEditing && (
        <div className="border-t p-4 bg-muted/20 flex flex-wrap gap-2 justify-end sticky bottom-0">
          <SimulateAutomationButton messageId={content.message_id} />
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 text-purple-600 border-purple-200" 
            onClick={handleGeminiReprocess}
            disabled={isReprocessing}
          >
            <Sparkles className={cn("h-4 w-4", isReprocessing && "animate-spin")} />
            {isReprocessing ? "Processando..." : "Reprocessar com Gemini"}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleStatusChange('reprocessar')}>
            <RotateCcw className="h-4 w-4" />
            Reprocessar
          </Button>

          <Button variant="outline" size="sm" className="gap-2" onClick={copyJson}>
            <Copy className="h-4 w-4" />
            Copiar JSON
          </Button>
          <div className="w-px h-8 bg-border mx-1" />
          <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => handleStatusChange('ignorado')}>
            <Trash2 className="h-4 w-4" />
            Ignorar
          </Button>
          <Button variant="outline" size="sm" className="gap-2 text-blue-600 border-blue-200" onClick={() => handleStatusChange('revisao')}>
            <Edit className="h-4 w-4" />
            Enviar p/ Revisão
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4" />
                Aprovar & Publicar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Publicação</AlertDialogTitle>
                <AlertDialogDescription>
                  Deseja publicar este conteúdo no destino configurado? Esta ação enviará os dados extraídos para a plataforma externa.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleStatusChange('aprovado')} className="bg-green-600 hover:bg-green-700">
                  Confirmar e Publicar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

function SimulateAutomationButton({ messageId }: { messageId: string | null }) {
  const simulate = useMutation({
    mutationFn: useServerFn(simulateAutomation),
    onSuccess: (data: any) => {
      if (data.status === "matched") {
        toast.success(`Regra "${data.rule.nome}" acionada (SIMULAÇÃO)`);
      } else {
        toast.info("Nenhuma regra de automação correspondente.");
      }
    },
    onError: (err: any) => {
      toast.error("Erro na simulação: " + err.message);
    }
  });

  if (!messageId) return null;

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="gap-2"
      onClick={() => simulate.mutate({ data: { messageId } })}
      disabled={simulate.isPending}
    >
      <Zap className={cn("h-4 w-4", simulate.isPending && "animate-pulse")} />
      Simular Automação
    </Button>
  );
}

