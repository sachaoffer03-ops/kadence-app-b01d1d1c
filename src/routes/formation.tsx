import { createFileRoute } from "@tanstack/react-router";
import StubPage from "@/components/StubPage";

export const Route = createFileRoute("/formation")({
  component: () => (
    <StubPage
      title="Formation"
      description="Gérez les parcours de formation de votre staff : modules obligatoires, certifications, progression et évaluations."
    />
  ),
});
