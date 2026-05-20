import { GraduationCap } from "lucide-react";

export function FormationPanel({ userId: _userId }: { userId: string }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: 400 }}>
      <div className="rounded-full flex items-center justify-center mb-4" style={{ width: 64, height: 64, backgroundColor: "var(--coral-light)" }}>
        <GraduationCap size={28} style={{ color: "var(--coral-dark)" }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Formation</div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 280, lineHeight: 1.5 }}>
        Refonte en cours. Le nouveau parcours de formation sera disponible bientôt.
      </div>
    </div>
  );
}
