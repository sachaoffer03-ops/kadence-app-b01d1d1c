import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { getAppMode } from "@/lib/app-mode";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { session, appRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement...</p>
      </div>
    );
  }

  if (!session) {
    // Pas connecté → page de connexion (avec contexte admin/employé)
    const mode = getAppMode();
    return <Navigate to="/login" search={{ mode }} />;
  }

  // Connecté → bonne destination selon le rôle
  if (appRole === "employee") return <Navigate to="/staff-app" />;
  return <Navigate to="/dashboard" />;
}
