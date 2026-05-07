import { createFileRoute } from "@tanstack/react-router";
import StubPage from "@/components/StubPage";

export const Route = createFileRoute("/reglages")({
  component: () => (
    <StubPage
      title="Réglages"
      description="Configurez les paramètres généraux de Shifty : notifications, permissions, intégrations et préférences d'affichage."
    />
  ),
});
