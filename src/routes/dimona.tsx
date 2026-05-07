import { createFileRoute } from "@tanstack/react-router";
import StubPage from "@/components/StubPage";

export const Route = createFileRoute("/dimona")({
  component: () => (
    <StubPage
      title="Dimona"
      description="Gérez vos déclarations Dimona (IN/OUT) pour rester en conformité avec la législation belge. Alertes automatiques pour les shifts non déclarés."
    />
  ),
});
