import { createFileRoute } from "@tanstack/react-router";
import StubPage from "@/components/StubPage";

export const Route = createFileRoute("/demandes")({
  component: () => (
    <StubPage
      title="Demandes de modification"
      description="Gérez les demandes d'échange, d'annulation ou de modification de shifts soumises par votre staff. Approuvez ou refusez en un clic."
    />
  ),
});
