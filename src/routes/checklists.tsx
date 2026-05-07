import { createFileRoute } from "@tanstack/react-router";
import StubPage from "@/components/StubPage";

export const Route = createFileRoute("/checklists")({
  component: () => (
    <StubPage
      title="Checklists"
      description="Créez des checklists d'ouverture et de fermeture pour chaque studio. Suivez leur complétion en temps réel."
    />
  ),
});
