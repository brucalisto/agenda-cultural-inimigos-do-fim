import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInterpretedContents, type InterpretedContent } from "@/lib/interpreted";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BrainCircuit, Filter, Search, Eye, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InterpretedDetails } from "@/components/interpreted/InterpretedDetails";

export const Route = createFileRoute("/interpreted")({
  component: InterpretedPage,
});

function InterpretedPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: contents, isLoading } = useQuery({
    queryKey: ["interpreted-contents"],
    queryFn: getInterpretedContents,
  });

  const filteredContents = contents?.filter((item) => {
    const matchesSearch =
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.whatsapp_messages?.text_content?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || item.review_status === statusFilter;
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const categories = Array.from(new Set(contents?.map((c) => c.category).filter(Boolean)));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aprovado":
        return <Badge className="bg-green-500 hover:bg-green-600">Aprovado</Badge>;
      case "pendente":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendente</Badge>;
      case "revisao":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Em Revisão</Badge>;
      case "ignorado":
        return <Badge variant="destructive">Ignorado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 text-primary" />
              Conteúdos Interpretados
            </h1>
            <p className="text-muted-foreground">Analise e valide as interpretações geradas pela IA.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-card p-4 rounded-lg border shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou texto..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status da revisão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="revisao">Em Revisão</SelectItem>
              <SelectItem value="ignorado">Ignorado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="flex gap-2">
            <Filter className="h-4 w-4" />
            Mais Filtros
          </Button>
        </div>

        {/* Content Table */}
        <div className="rounded-md border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold">Título</TableHead>
                <TableHead className="font-semibold">Categoria</TableHead>
                <TableHead className="font-semibold">Origem</TableHead>
                <TableHead className="font-semibold">Data</TableHead>
                <TableHead className="font-semibold text-center">Confiança</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Carregando conteúdos...
                  </TableCell>
                </TableRow>
              ) : filteredContents?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Nenhum conteúdo encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContents?.map((item) => (
                  <TableRow key={item.id} className="hover:bg-accent/5 transition-colors">
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {item.title || "Sem título"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category || "N/A"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium">{item.whatsapp_messages?.sender_name}</span>
                        <span className="text-xs text-muted-foreground">{item.whatsapp_messages?.whatsapp_groups?.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={cn(
                          "text-sm font-bold",
                          (item.confidence_score || 0) > 0.8 ? "text-green-600" : (item.confidence_score || 0) > 0.5 ? "text-yellow-600" : "text-red-600"
                        )}>
                          {Math.round((item.confidence_score || 0) * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(item.review_status)}
                      {item.missing_fields && item.missing_fields.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-orange-600 font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          {item.missing_fields.length} campos ausentes
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedId(item.id)}>
                        <Eye className="h-4 w-4 mr-1" />
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

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto p-0 border-l">
          <SheetHeader className="p-6 border-b sticky top-0 bg-background z-10">
            <div className="flex justify-between items-start">
              <div>
                <SheetTitle className="text-2xl">Detalhes do Conteúdo</SheetTitle>
                <SheetDescription>
                  Revise as informações interpretadas pela IA e o contexto original.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          {selectedId && <InterpretedDetails id={selectedId} onClose={() => setSelectedId(null)} />}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
