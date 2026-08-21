import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/settings")({
  component: () => (
    <DashboardLayout>
      <h1 className="text-2xl font-bold">Configurações</h1>
      <p className="text-muted-foreground">Configurações gerais da conta e do painel.</p>
    </DashboardLayout>
  ),
});
