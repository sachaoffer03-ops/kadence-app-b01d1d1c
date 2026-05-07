import { createFileRoute } from "@tanstack/react-router";
import StubPage from "@/components/StubPage";

export const Route = createFileRoute("/trous")({
  component: () => (
    <StubPage
      title="Trous à combler"
      description="Visualisez tous les shifts non couverts, recevez des alertes et comblez les trous en un clic en proposant le shift aux membres disponibles."
    />
  ),
});
