import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, Eye, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { InterpretedDetails } from "@/components/interpreted/InterpretedDetails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { reprocessMessages } from "@/lib/gemini.functions";
import { getInterpretedContents } from "@/lib/interpreted";

export const Route = createFileRoute("/interpreted")({ component: ReviewWorkspace });

export function ReviewWorkspace() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"selected" | "category" | null>(null);
  const [busy, setBusy] = useState(false);
  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery({ queryKey: ["interpreted-contents"], queryFn: getInterpretedContents });
  const categories = useMemo(
    () => [...new Set(data.map((item) => item.category).filter(Boolean))] as string[],
    [data],
  );
  const filtered = useMemo(
    () =>
      data.filter((item) => {
        const term = search.toLowerCase();
        return (
          !["publicado", "aprovado"].includes(item.review_status) &&
          (category === "all" || item.category === category) &&
          (!term ||
            item.title?.toLowerCase().includes(term) ||
            item.whatsapp_messages?.text_content?.toLowerCase().includes(term))
        );
      }),
    [category, data, search],
  );
  const allSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.id));
  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current);
      filtered.forEach((item) => (allSelected ? next.delete(item.id) : next.add(item.id)));
      return next;
    });
  const reprocess = async () => {
    const messageIds = [
      ...new Set(
        data
          .filter((item) => selected.has(item.id))
          .map((item) => item.message_id)
          .filter(Boolean),
      ),
    ];
    if (!messageIds.length) return;
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
      const result = await reprocessMessages({
        data: { messageIds, accessToken: sessionData.session.access_token },
      });
      if (result.failures.length) {
        toast.warning(`${result.processed} processadas; ${result.failures.length} falharam.`);
      } else {
        toast.success(`${result.processed} mensagens reprocessadas com as regras atuais.`);
      }
      setSelected(new Set());
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao reprocessar.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    const ids = confirm === "category" ? filtered.map((item) => item.id) : [...selected];
    setBusy(true);
    try {
      const { error } = await supabase.from("interpreted_contents").delete().in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} conteúdo(s) excluído(s).`);
      setSelected(new Set());
      setConfirm(null);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BrainCircuit className="h-6 w-6" />
            Revisão
          </h1>
          <p className="text-muted-foreground">
            Confira, edite, consolide e publique as interpretações geradas pela IA.
          </p>
        </div>
        <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou mensagem..."
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{selected.size} selecionado(s)</span>
          <Button variant="outline" size="sm" disabled={!selected.size || busy} onClick={reprocess}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reprocessar selecionados
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!selected.size || busy}
            onClick={() => setConfirm("selected")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir selecionados
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={category === "all" || !filtered.length || busy}
            onClick={() => setConfirm("category")}
          >
            Excluir categoria filtrada
          </Button>
        </div>
        <div className="overflow-hidden rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar conteúdos filtrados"
                  />
                </TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Data do evento</TableHead>
                <TableHead>Confiança</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Nenhum conteúdo encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
                        aria-label={`Selecionar ${item.title || "conteúdo"}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.title || "Sem título"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category || "N/A"}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.whatsapp_messages?.sender_name || "Desconhecido"}
                      <div className="text-xs text-muted-foreground">
                        {item.whatsapp_messages?.whatsapp_groups?.nome}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.event_date
                        ? new Date(item.event_date).toLocaleDateString("pt-BR")
                        : "Não informada"}
                    </TableCell>
                    <TableCell>{Math.round((item.confidence_score || 0) * 100)}%</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.review_status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetailsId(item.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <Sheet open={Boolean(detailsId)} onOpenChange={(open) => !open && setDetailsId(null)}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-4xl">
          <SheetHeader className="sticky top-0 z-10 border-b bg-background p-6">
            <SheetTitle>Detalhes do Conteúdo</SheetTitle>
            <SheetDescription>
              Veja a interpretação e todas as mensagens consolidadas.
            </SheetDescription>
          </SheetHeader>
          {detailsId ? (
            <InterpretedDetails id={detailsId} onClose={() => setDetailsId(null)} />
          ) : null}
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "category"
                ? `Os ${filtered.length} conteúdos visíveis da categoria “${category}” serão excluídos.`
                : `${selected.size} conteúdo(s) serão excluídos.`}{" "}
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={remove}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
