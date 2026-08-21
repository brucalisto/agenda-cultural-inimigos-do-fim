import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/interpreted")({
  component: () => (
    <DashboardLayout>
      <h1 className="text-2xl font-bold">Conteúdos interpretados</h1>
      <p className="text-muted-foreground">Resultados da análise do Gemini AI.</p>
    </DashboardLayout>
  ),
});
