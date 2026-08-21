import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/integrations")({
  component: () => (
    <DashboardLayout>
      <h1 className="text-2xl font-bold">Integrações</h1>
      <p className="text-muted-foreground">Configuração Evolution API e Gemini.</p>
    </DashboardLayout>
  ),
});
