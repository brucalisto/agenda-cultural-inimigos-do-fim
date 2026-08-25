import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Edit, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type PublishedItem = {
  id: string;
  title: string | null;
  category: string | null;
  event_date: string | null;
  location: string | null;
  city: string | null;
  price: string | null;
  summary: string | null;
  full_description: string | null;
  contact_phone: string | null;
  contact_instagram: string | null;
};
const empty: PublishedItem = {
  id: "",
  title: "",
  category: "",
  event_date: null,
  location: "",
  city: "",
  price: "",
  summary: "",
  full_description: "",
  contact_phone: "",
  contact_instagram: "",
};
export const Route = createFileRoute("/published")({ component: PublishedPage });

function PublishedPage() {
  const [items, setItems] = useState<PublishedItem[]>([]);
  const [editing, setEditing] = useState<PublishedItem | null>(null);
  const [deleting, setDeleting] = useState<PublishedItem | null>(null);
  const load = async () => {
    const { data, error } = await supabase
      .from("interpreted_contents")
      .select(
        "id,title,category,event_date,location,city,price,summary,full_description,contact_phone,contact_instagram",
      )
      .in("review_status", ["publicado", "aprovado"])
      .order("event_date", { ascending: true });
    if (error) toast.error(error.message);
    else setItems((data || []) as PublishedItem[]);
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async () => {
    if (!editing) return;
    const { id, ...updates } = editing;
    const { error } = await supabase.from("interpreted_contents").update(updates).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Evento publicado atualizado.");
      setEditing(null);
      await load();
    }
  };
  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("interpreted_contents").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Evento removido da agenda.");
      setDeleting(null);
      await load();
    }
  };
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Publicados</h1>
            <p className="text-muted-foreground">
              Edite ou retire eventos visíveis da agenda pública.
            </p>
          </div>
          <Button asChild>
            <a href="/agenda" target="_blank" rel="noreferrer">
              Abrir agenda
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="font-semibold">{item.title || "Sem título"}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.category || "Cultura"} · {item.location || "Local a confirmar"}
                  </p>
                  <p className="text-sm">
                    {item.event_date
                      ? new Date(item.event_date).toLocaleString("pt-BR")
                      : "Sem data"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing({ ...empty, ...item })}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleting(item)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar evento publicado</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={editing.title || ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Título"
              />
              <Input
                value={editing.category || ""}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                placeholder="Categoria"
              />
              <Input
                type="datetime-local"
                value={editing.event_date ? editing.event_date.slice(0, 16) : ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    event_date: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
              <Input
                value={editing.price || ""}
                onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                placeholder="Preço"
              />
              <Input
                value={editing.location || ""}
                onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                placeholder="Local"
              />
              <Input
                value={editing.city || ""}
                onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                placeholder="Cidade"
              />
              <Input
                value={editing.contact_phone || ""}
                onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })}
                placeholder="Telefone"
              />
              <Input
                value={editing.contact_instagram || ""}
                onChange={(e) => setEditing({ ...editing, contact_instagram: e.target.value })}
                placeholder="Instagram"
              />
              <Textarea
                className="md:col-span-2"
                value={editing.summary || ""}
                onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                placeholder="Resumo"
              />
              <Textarea
                className="md:col-span-2"
                value={editing.full_description || ""}
                onChange={(e) => setEditing({ ...editing, full_description: e.target.value })}
                placeholder="Descrição completa"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover evento publicado?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” será apagado e deixará de aparecer imediatamente na agenda
              pública. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir evento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
