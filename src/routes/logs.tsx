import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/logs")({
  component: () => (
    <DashboardLayout>
      <h1 className="text-2xl font-bold">Logs</h1>
      <p className="text-muted-foreground">Histórico de eventos do sistema.</p>
    </DashboardLayout>
  ),
});
