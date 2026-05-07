import { createFileRoute } from "@tanstack/react-router";
import StubPage from "@/components/StubPage";

export const Route = createFileRoute("/pointage")({
  component: () => (
    <StubPage
      title="Pointage"
      description="Suivez les pointages en temps réel : arrivées, départs, retards et heures supplémentaires. Export automatique pour la paie."
    />
  ),
});
