import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/published")({
  component: () => (
    <DashboardLayout>
      <h1 className="text-2xl font-bold">Publicados</h1>
      <p className="text-muted-foreground">Histórico de conteúdos enviados para destino final.</p>
    </DashboardLayout>
  ),
});
