import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/groups")({
  component: () => (
    <DashboardLayout>
      <h1 className="text-2xl font-bold">Grupos</h1>
      <p className="text-muted-foreground">Gerenciamento de grupos do WhatsApp monitorados.</p>
    </DashboardLayout>
  ),
});
