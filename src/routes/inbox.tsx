import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/inbox")({
  component: () => (
    <DashboardLayout>
      <h1 className="text-2xl font-bold">Caixa de entrada</h1>
      <p className="text-muted-foreground">Visualização de mensagens brutas recebidas.</p>
    </DashboardLayout>
  ),
});
