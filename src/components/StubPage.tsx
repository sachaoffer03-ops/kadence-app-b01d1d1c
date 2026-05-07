import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";

function StubPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6" style={{ maxWidth: 1200 }}>
      <div
        className="rounded-xl border p-10 text-center flex flex-col items-center"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="rounded-full flex items-center justify-center mb-4"
          style={{ width: 48, height: 48, backgroundColor: "var(--muted)" }}
        >
          <Clock size={20} style={{ color: "var(--muted-foreground)" }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 400, lineHeight: 1.7 }}>
          {description}
        </div>
        <div
          className="mt-6 rounded-full px-4 py-1.5"
          style={{ fontSize: 11, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)", fontWeight: 500 }}
        >
          Bientôt disponible
        </div>
      </div>
    </div>
  );
}

export default StubPage;
