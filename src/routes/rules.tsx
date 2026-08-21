import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

import { RulesList } from "@/components/rules/RulesList";

export const Route = createFileRoute("/rules")({
  component: () => (
    <DashboardLayout>
      <RulesList />
    </DashboardLayout>
  ),
});

