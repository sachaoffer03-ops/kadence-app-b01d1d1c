import { createFileRoute } from "@tanstack/react-router";
import { feedbackEntries, roleColors, employees, getInitials } from "@/lib/mock-data";

export const Route = createFileRoute("/feedbacks")({
  component: FeedbacksPage,
  head: () => ({ meta: [{ title: "Feedbacks — Shifty" }] }),
});

function ratingColor(v: number) {
  return v >= 4 ? "var(--success-text)" : v >= 3 ? "var(--foreground)" : "var(--danger-text)";
}

function ratingBg(v: number) {
  return v >= 4 ? "var(--success-bg)" : v >= 3 ? "var(--muted)" : "var(--danger-bg)";
}

function FeedbacksPage() {
  const avgShift = (feedbackEntries.reduce((s, f) => s + f.shiftRating, 0) / feedbackEntries.length).toFixed(1);
  const avgTeam = (feedbackEntries.reduce((s, f) => s + f.teamRating, 0) / feedbackEntries.length).toFixed(1);
  const avgSelf = (feedbackEntries.reduce((s, f) => s + f.selfRating, 0) / feedbackEntries.length).toFixed(1);

  return (
    <div className="p-6" style={{}}>
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Feedbacks post-shift</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          {feedbackEntries.length} feedbacks reçus cette semaine
        </p>
      </div>

      {/* Averages */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <AvgCard label="Satisfaction shift" value={avgShift} />
        <AvgCard label="Ambiance équipe" value={avgTeam} />
        <AvgCard label="Auto-évaluation" value={avgSelf} />
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        {/* Header */}
        <div className="grid px-5 py-2.5" style={{ gridTemplateColumns: "1fr 80px 80px 80px", borderBottom: "0.5px solid var(--border)" }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Employé</div>
          <div className="text-center" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Shift</div>
          <div className="text-center" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Équipe</div>
          <div className="text-center" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Soi</div>
        </div>

        {/* Rows */}
        {feedbackEntries.map((fb, i) => {
          const rc = roleColors[fb.role];
          return (
            <div key={fb.id} style={{ borderBottom: i < feedbackEntries.length - 1 ? "0.5px solid var(--border)" : "none" }}>
              <div className="grid px-5 py-3 items-center" style={{ gridTemplateColumns: "1fr 80px 80px 80px" }}>
                {/* Employee */}
                <div className="flex items-center gap-2.5">
                  <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 30, height: 30, backgroundColor: rc.bg, color: rc.text, fontSize: 10, fontWeight: 500 }}>
                    {getInitials(fb.employeeName.split(" ")[0], fb.employeeName.split(" ")[1] || "")}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{fb.employeeName}</div>
                    <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      <span className="rounded-full" style={{ width: 5, height: 5, backgroundColor: rc.dot }} />
                      {fb.role} · {fb.studio.replace("Skult ", "")} · {fb.date}
                    </div>
                  </div>
                </div>

                {/* Ratings */}
                <div className="flex justify-center">
                  <RatingBadge value={fb.shiftRating} />
                </div>
                <div className="flex justify-center">
                  <RatingBadge value={fb.teamRating} />
                </div>
                <div className="flex justify-center">
                  <RatingBadge value={fb.selfRating} />
                </div>
              </div>

              {/* Comment */}
              {fb.comment && (
                <div className="px-5 pb-3" style={{ paddingLeft: 62 }}>
                  <div className="rounded-md px-3 py-2" style={{ backgroundColor: "var(--muted)", fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    "{fb.comment}"
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AvgCard({ label, value }: { label: string; value: string }) {
  const num = Number(value);
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 24, fontWeight: 500, color: ratingColor(num) }}>{value}</span>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>/5</span>
      </div>
      {/* Bar */}
      <div className="mt-2" style={{ width: "100%", height: 3, borderRadius: 2, backgroundColor: "var(--muted)" }}>
        <div style={{ width: `${(num / 5) * 100}%`, height: "100%", borderRadius: 2, backgroundColor: ratingColor(num) }} />
      </div>
    </div>
  );
}

function RatingBadge({ value }: { value: number }) {
  return (
    <span className="rounded-md px-2 py-0.5" style={{ fontSize: 12, fontWeight: 500, backgroundColor: ratingBg(value), color: ratingColor(value) }}>
      {value}/5
    </span>
  );
}
