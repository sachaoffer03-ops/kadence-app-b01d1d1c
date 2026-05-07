import { createFileRoute } from "@tanstack/react-router";
import StubPage from "@/components/StubPage";

export const Route = createFileRoute("/feedbacks")({
  component: () => (
    <StubPage
      title="Feedbacks"
      description="Recueillez et analysez les feedbacks de votre équipe après chaque shift. Identifiez les points d'amélioration et célébrez les réussites."
    />
  ),
});
