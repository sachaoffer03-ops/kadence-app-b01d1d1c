import { createFileRoute } from "@tanstack/react-router";
import StubPage from "@/components/StubPage";

export const Route = createFileRoute("/contingents")({
  component: () => (
    <StubPage
      title="Contingents"
      description="Suivez les heures prestées de vos étudiants par rapport au plafond légal de 650h. Alertes quand un étudiant approche la limite."
    />
  ),
});
