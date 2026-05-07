import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/staff-app")({
  component: StaffAppPage,
});

function StaffAppPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="text-center px-6">
        <div style={{ fontSize: 22, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
          Application employé
        </div>
        <div style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
          Bientôt disponible
        </div>
        <div
          className="mt-6 inline-block rounded-full px-4 py-1.5"
          style={{ fontSize: 12, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)", fontWeight: 500 }}
        >
          Skult Studios
        </div>
      </div>
    </div>
  );
}
