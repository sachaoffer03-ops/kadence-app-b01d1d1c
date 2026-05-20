import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Wrench } from "lucide-react";

export const Route = createFileRoute("/formation/$courseId")({
  component: CourseBuilderStub,
  head: () => ({ meta: [{ title: "Parcours — Kadence" }] }),
});

function CourseBuilderStub() {
  const { courseId } = Route.useParams();
  return (
    <div className="p-4 md:p-6" style={{ maxWidth: 1000 }}>
      <Link
        to="/formation"
        className="flex items-center gap-1 mb-4"
        style={{ fontSize: 13, color: "var(--muted-foreground)" }}
      >
        <ArrowLeft size={14} /> Retour aux parcours
      </Link>
      <div
        className="rounded-xl border p-10 text-center flex flex-col items-center"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="rounded-full flex items-center justify-center mb-4"
          style={{ width: 48, height: 48, backgroundColor: "var(--muted)" }}
        >
          <Wrench size={20} style={{ color: "var(--muted-foreground)" }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>
          Builder du parcours
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--muted-foreground)",
            maxWidth: 420,
            lineHeight: 1.7,
          }}
        >
          L'éditeur de sections, modules, contenus et quiz arrive dans le
          prochain prompt. ID&nbsp;: <code>{courseId}</code>
        </div>
        <div
          className="mt-6 rounded-full px-4 py-1.5"
          style={{
            fontSize: 11,
            backgroundColor: "var(--coral-light)",
            color: "var(--coral-dark)",
            fontWeight: 500,
          }}
        >
          Bientôt disponible
        </div>
      </div>
    </div>
  );
}
