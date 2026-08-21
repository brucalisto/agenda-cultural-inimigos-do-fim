import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/review")({
  component: () => (
    <DashboardLayout>
      <h1 className="text-2xl font-bold">Revisão</h1>
      <p className="text-muted-foreground">Conteúdos que aguardam aprovação manual.</p>
    </DashboardLayout>
  ),
});
