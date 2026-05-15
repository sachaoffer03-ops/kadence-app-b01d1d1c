import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/checklists")({
  component: ChecklistsPage,
  head: () => ({ meta: [{ title: "Checklists — Kadence" }] }),
});

function ChecklistsPage() {
  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="mb-6">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Checklists de fin de shift</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Items à cocher et photos de validation par rôle.
        </p>
      </div>

      <div className="rounded-xl border p-8 flex flex-col items-center text-center"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="rounded-full flex items-center justify-center mb-4"
          style={{ width: 56, height: 56, backgroundColor: "var(--muted)" }}>
          <ClipboardCheck size={26} style={{ color: "var(--coral)" }} strokeWidth={1.6} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
          Module en refonte
        </div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 420, lineHeight: 1.55, marginBottom: 16 }}>
          La nouvelle version arrive : modèles par rôle, items textuels, photos de validation
          avec photo de référence, suivi des soumissions et note libre de fin de shift.
        </div>
        <div className="rounded-md inline-flex items-center gap-1.5 px-2.5 py-1"
          style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
          <Sparkles size={11} />
          Phase 1 / 3 — Fondations base de données prêtes
        </div>
      </div>
    </div>
  );
}
