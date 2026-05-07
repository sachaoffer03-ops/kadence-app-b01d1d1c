import { createFileRoute } from "@tanstack/react-router";
import { feedbackEntries, roleColors, employees } from "@/lib/mock-data";

export const Route = createFileRoute("/feedbacks")({
  component: FeedbacksPage,
  head: () => ({ meta: [{ title: "Feedbacks — Shifty" }] }),
});

const smileys = ['', '😞', '😐', '🙂', '😊', '😄'];

function FeedbacksPage() {
  const avgShift = (feedbackEntries.reduce((s, f) => s + f.shiftRating, 0) / feedbackEntries.length).toFixed(1);
  const avgTeam = (feedbackEntries.reduce((s, f) => s + f.teamRating, 0) / feedbackEntries.length).toFixed(1);
  const avgSelf = (feedbackEntries.reduce((s, f) => s + f.selfRating, 0) / feedbackEntries.length).toFixed(1);

  return (
    <div className="p-6" style={{ maxWidth: 1200 }}>
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Feedbacks post-shift</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          {feedbackEntries.length} feedbacks reçus cette semaine
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <AvgCard label="Shift" value={avgShift} emoji={smileys[Math.round(Number(avgShift))]} />
        <AvgCard label="Ambiance équipe" value={avgTeam} emoji={smileys[Math.round(Number(avgTeam))]} />
        <AvgCard label="Auto-évaluation" value={avgSelf} emoji={smileys[Math.round(Number(avgSelf))]} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        {feedbackEntries.map((fb, i) => {
          const roleColor = roleColors[fb.role];
          return (
            <div key={fb.id} className="flex items-start gap-4 px-5 py-4" style={{ borderBottom: i < feedbackEntries.length - 1 ? "0.5px solid var(--border)" : "none" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{fb.employeeName}</span>
                  <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColor.bg, color: roleColor.text }}>{fb.role}</span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{fb.studio.replace('Skult ', '')} · {fb.date}</span>
                </div>
                {fb.comment && (
                  <div className="rounded-lg px-3 py-2 mt-2" style={{ backgroundColor: "var(--muted)", fontSize: 12, color: "var(--foreground)", lineHeight: 1.5 }}>
                    "{fb.comment}"
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <RatingDot label="Shift" value={fb.shiftRating} />
                <RatingDot label="Équipe" value={fb.teamRating} />
                <RatingDot label="Soi" value={fb.selfRating} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AvgCard({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="rounded-xl border p-4 flex items-center gap-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <span style={{ fontSize: 28 }}>{emoji}</span>
      <div>
        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
        <span style={{ fontSize: 22, fontWeight: 500 }}>{value}</span>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>/5</span>
      </div>
    </div>
  );
}

function RatingDot({ label, value }: { label: string; value: number }) {
  const color = value >= 4 ? "var(--success-text)" : value >= 3 ? "var(--warning-text)" : "var(--danger-text)";
  return (
    <div className="text-center">
      <div style={{ fontSize: 16 }}>{smileys[value]}</div>
      <div style={{ fontSize: 9, color: "var(--muted-foreground)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
