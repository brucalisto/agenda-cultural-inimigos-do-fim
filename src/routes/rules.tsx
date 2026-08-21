import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/rules")({
  component: () => (
    <DashboardLayout>
      <h1 className="text-2xl font-bold">Regras</h1>
      <p className="text-muted-foreground">Configuração de filtros e lógica de interpretação.</p>
    </DashboardLayout>
  ),
});
