import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

/**
 * Empêche l'affichage d'une page sensible (seeder, diagnostic, audit…)
 * en production. En dev (`import.meta.env.DEV`), affiche normalement
 * son contenu. En prod, affiche un message verrouillé.
 */
export function DevOnly({ children, label }: { children: ReactNode; label?: string }) {
  if (import.meta.env.DEV) return <>{children}</>;

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <Lock size={18} />
          <div style={{ fontSize: 16, fontWeight: 500 }}>Outil de développement</div>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          {label ?? "Cette page"} n'est disponible qu'en environnement de développement.
          Elle est volontairement masquée en production pour éviter toute manipulation
          accidentelle de données réelles.
        </p>
        <Link
          to="/dashboard"
          className="inline-block mt-5"
          style={{ fontSize: 12, color: "var(--primary)" }}
        >
          ← Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
