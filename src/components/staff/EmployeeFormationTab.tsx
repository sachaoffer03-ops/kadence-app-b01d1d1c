import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getEmployeeTrainingProgress } from "@/lib/formation.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle, Clock, BookOpen, ChevronRight, ChevronDown } from "lucide-react";

type Data = Awaited<ReturnType<typeof getEmployeeTrainingProgress>>;

function fmtDuration(s: number) {
  if (!s) return "0 min";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed")
    return <CheckCircle2 size={14} style={{ color: "var(--success-text)" }} />;
  if (status === "in_progress")
    return <Clock size={14} style={{ color: "var(--coral)" }} />;
  return <Circle size={14} style={{ color: "var(--muted-foreground)" }} />;
}

export function EmployeeFormationTab({ userId }: { userId: string }) {
  const fetchProgress = useServerFn(getEmployeeTrainingProgress);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [openCourse, setOpenCourse] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchProgress({ data: { userId } })
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data || data.courses.length === 0) {
    return (
      <div
        className="rounded-xl border p-10 text-center"
        style={{
          backgroundColor: "var(--card)",
          borderColor: "var(--border)",
          fontSize: 13,
          color: "var(--muted-foreground)",
        }}
      >
        <BookOpen
          size={28}
          style={{ color: "var(--muted-foreground)", margin: "0 auto 12px" }}
        />
        Aucun parcours assigné à cet employé.
      </div>
    );
  }

  const { summary, courses } = data;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div
        className="rounded-xl border p-5 grid grid-cols-3 gap-4"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <Kpi
          label="Parcours complétés"
          value={`${summary.completedCourses}/${summary.totalCourses}`}
        />
        <Kpi
          label="Temps passé"
          value={fmtDuration(summary.totalTimeSpentSeconds)}
        />
        <Kpi
          label="Dernier accès"
          value={
            summary.lastAccessAt
              ? new Date(summary.lastAccessAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })
              : "—"
          }
        />
      </div>

      {/* Courses */}
      {courses.map((c) => {
        const isOpen = openCourse === c.course.id;
        return (
          <div
            key={c.course.id}
            className="rounded-xl border"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => setOpenCourse(isOpen ? null : c.course.id)}
              className="w-full p-4 flex items-center gap-3 text-left"
            >
              <span style={{ fontSize: 22 }}>{c.course.icon || "📚"}</span>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {c.course.title}
                </div>
                <div
                  className="flex items-center gap-2 mt-1"
                  style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                >
                  <StatusIcon status={c.status} />
                  <span>
                    {c.completed_contents}/{c.total_contents} contenus
                  </span>
                  <span>·</span>
                  <span>{fmtDuration(c.total_time_spent_seconds)}</span>
                </div>
                <div
                  className="mt-2"
                  style={{
                    width: "100%",
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: "var(--muted)",
                  }}
                >
                  <div
                    style={{
                      width: `${c.progress_pct}%`,
                      height: "100%",
                      borderRadius: 2,
                      backgroundColor:
                        c.status === "completed"
                          ? "var(--success-text)"
                          : "var(--coral)",
                    }}
                  />
                </div>
              </div>
              <span
                style={{ fontSize: 13, fontWeight: 500, minWidth: 36, textAlign: "right" }}
              >
                {c.progress_pct}%
              </span>
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {isOpen && (
              <div
                className="px-4 pb-4 flex flex-col gap-3"
                style={{ borderTop: "0.5px solid var(--border)", paddingTop: 12 }}
              >
                {c.sections.length === 0 && (
                  <div
                    style={{ fontSize: 12, color: "var(--muted-foreground)" }}
                  >
                    Pas encore de section pour ce parcours.
                  </div>
                )}
                {c.sections.map((sec) => (
                  <div key={sec.section.id} className="flex flex-col gap-1.5">
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--muted-foreground)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {sec.section.title}
                    </div>
                    {sec.modules.map((mod) => (
                      <div
                        key={mod.module.id}
                        className="rounded-md px-3 py-2 flex items-center gap-2"
                        style={{
                          backgroundColor: "var(--background)",
                          fontSize: 12,
                        }}
                      >
                        <StatusIcon status={mod.status} />
                        <span className="flex-1">{mod.module.title}</span>
                        {mod.quiz && (
                          <span
                            className="rounded-full px-2 py-0.5"
                            style={{
                              fontSize: 10,
                              fontWeight: 500,
                              backgroundColor: mod.quiz.passed
                                ? "var(--success-bg)"
                                : "var(--muted)",
                              color: mod.quiz.passed
                                ? "var(--success-text)"
                                : "var(--muted-foreground)",
                            }}
                          >
                            Quiz
                            {mod.quiz.best_score != null
                              ? ` ${mod.quiz.best_score}%`
                              : ""}
                          </span>
                        )}
                        <span
                          style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                        >
                          {mod.progress_pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: "var(--muted-foreground)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{value}</div>
    </div>
  );
}
