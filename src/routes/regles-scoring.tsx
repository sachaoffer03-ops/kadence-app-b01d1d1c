import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/regles-scoring")({
  beforeLoad: () => {
    throw redirect({ to: "/cloture", search: { tab: "notation" } });
  },
});
