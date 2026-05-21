import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { Wallet, Clock, FileCheck, Star, TrendingUp, TrendingDown, Minus, GraduationCap, Award, Lock } from "lucide-react";
import { getMyStats } from "@/lib/my-stats.functions";
import { getMyAssignedCourses } from "@/lib/formation.functions";

type Stats = Awaited<ReturnType<typeof getMyStats>>;
type Formation = Awaited<ReturnType<typeof getMyAssignedCourses>>;

function fmtMoney(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}
function fmtHours(n: number): string {
  if (n === 0) return "0h";
  if (Number.isInteger(n)) return `${n}h`;
  return `${n.toString().replace(".", ",")}h`;
}
function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const DIMONA_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  sent: { label: "Envoyée à l'ONSS", color: "#16a34a", bg: "rgba(22,163,74,0.08)" },
  pending: { label: "En attente", color: "#ea8a00", bg: "rgba(234,138,0,0.08)" },
  failed: { label: "Échouée", color: "#dc2626", bg: "rgba(220,38,38,0.08)" },
  not_applicable: { label: "Non applicable", color: "var(--muted-foreground)", bg: "var(--muted)" },
};

function SubCard({ children, title, icon }: { children: React.ReactNode; title: string; icon: React.ReactNode }) {
  return (
    <div
      className="rounded-xl"
      style={{
        padding: "14px 14px 12px",
        backgroundColor: "var(--background)",
        border: "0.5px solid var(--border)",
        minHeight: 110,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div className="flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div
      className="rounded-xl border p-4 mt-4"
      style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 110,
              borderRadius: 12,
              backgroundColor: "var(--muted)",
              opacity: 0.5,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function MyStatsCard() {
  const fetchStats = useServerFn(getMyStats);
  const fetchFormation = useServerFn(getMyAssignedCourses);
  const [stats, setStats] = useState<Stats | null>(null);
  const [formation, setFormation] = useState<Formation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    Promise.all([fetchStats({}), fetchFormation({}).catch(() => null)])
      .then(([s, f]) => { if (!cancel) { setStats(s); setFormation(f as Formation | null); setLoading(false); } })
      .catch(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [fetchStats, fetchFormation]);

  // Badges en mémoire (clé : completedCount). Si l'utilisateur ouvre l'app et a un nouveau parcours validé depuis sa dernière visite → "Nouveau badge !"
  const newBadge = useMemo(() => {
    if (!formation) return false;
    const done = formation.summary.completedCourses;
    try {
      const last = parseInt(sessionStorage.getItem("formation_badges_seen") ?? "-1", 10);
      if (done > last) {
        sessionStorage.setItem("formation_badges_seen", String(done));
        return last >= 0 && done > last;
      }
    } catch {}
    return false;
  }, [formation]);

  if (loading) return <Skeleton />;
  if (!stats) return null;

  const { earnings, weekHours, lastShiftDimona, career, score } = stats;

  // delta couleur
  const deltaColor = earnings.delta > 0 ? "#16a34a" : earnings.delta < 0 ? "#dc2626" : "var(--muted-foreground)";
  const DeltaIcon = earnings.delta > 0 ? TrendingUp : earnings.delta < 0 ? TrendingDown : Minus;
  const deltaSign = earnings.delta > 0 ? "+" : "";

  // quota color
  const quotaColor = weekHours.percentUsed < 70 ? "#16a34a" : weekHours.percentUsed < 90 ? "#ea8a00" : "#dc2626";

  // dimona
  const dimonaInfo = lastShiftDimona.status ? DIMONA_LABEL[lastShiftDimona.status] : null;

  // score color
  const scoreColor = score.current >= 7 ? "#16a34a" : score.current >= 5 ? "#ea8a00" : "#dc2626";
  const sparkData = score.sparkline30d.map((value, i) => ({ i, value }));

  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 4px", marginBottom: 8, marginTop: 16 }}>
        Mes stats
      </div>
      <div
        className="rounded-xl border p-3"
        style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">

          {/* Gains ce mois */}
          <SubCard title="Gains ce mois" icon={<Wallet size={11} />}>
            {!earnings.hasRate ? (
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
                Taux non renseigné
              </div>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.1, marginTop: 2 }}>
                  {fmtMoney(earnings.currentMonth)}
                </div>
                <div className="flex items-center gap-1" style={{ fontSize: 11, color: deltaColor, fontWeight: 500 }}>
                  <DeltaIcon size={11} />
                  <span>{deltaSign}{fmtMoney(earnings.delta)} vs mois dernier</span>
                </div>
              </>
            )}
          </SubCard>

          {/* Cette semaine */}
          <SubCard title="Cette semaine" icon={<Clock size={11} />}>
            <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.1, marginTop: 2 }}>
              {fmtHours(weekHours.total)}
              {weekHours.isStudent && (
                <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 400 }}>
                  {" "}/ {weekHours.studentLimit}h
                </span>
              )}
            </div>
            {weekHours.isStudent ? (
              <>
                <div style={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "var(--muted)", marginTop: 4 }}>
                  <div style={{ width: `${weekHours.percentUsed}%`, height: "100%", borderRadius: 3, backgroundColor: quotaColor, transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 10, color: weekHours.percentUsed >= 90 ? "#dc2626" : "var(--muted-foreground)" }}>
                  {weekHours.percentUsed >= 90
                    ? "Tu approches de la limite légale"
                    : `${weekHours.worked}h pointées · ${weekHours.scheduled}h prévues`}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                {weekHours.worked}h pointées · {weekHours.scheduled}h prévues
              </div>
            )}
          </SubCard>

          {/* Dimona */}
          <SubCard title="Dernière Dimona" icon={<FileCheck size={11} />}>
            {!lastShiftDimona.shiftDate ? (
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>—</div>
            ) : !dimonaInfo ? (
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
                En attente
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  shift du {fmtDateShort(lastShiftDimona.shiftDate)}
                </div>
              </div>
            ) : (
              <>
                <div
                  className="inline-flex items-center self-start"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "4px 10px",
                    borderRadius: 999,
                    backgroundColor: dimonaInfo.bg,
                    color: dimonaInfo.color,
                    marginTop: 2,
                  }}
                >
                  {dimonaInfo.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  shift du {fmtDateShort(lastShiftDimona.shiftDate)}
                </div>
              </>
            )}
          </SubCard>

        </div>


        {/* Carrière */}
        <div
          className="flex items-center gap-1.5 mt-3 pt-3"
          style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)", fontSize: 11, color: "var(--muted-foreground)" }}
        >
          <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
            {career.totalShiftsCompleted}
          </span>
          <span>shifts ·</span>
          <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
            {fmtHours(career.totalHoursWorked)}
          </span>
          {career.hasRate && (
            <>
              <span>·</span>
              <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
                {fmtMoney(career.totalEarnings)}
              </span>
            </>
          )}
          <span>depuis ton arrivée</span>
        </div>

        {/* Formation */}
        {formation && formation.summary.totalCourses > 0 && (() => {
          const sum = formation.summary;
          const pct = sum.progressPct;
          const barColor = sum.lockedPlanning ? "#ea8a00" : pct === 100 ? "#16a34a" : "var(--coral)";
          return (
            <div
              className="mt-3 pt-3"
              style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  {sum.lockedPlanning ? <Lock size={12} /> : <GraduationCap size={12} />}
                  <span style={{ fontWeight: 500, color: "var(--foreground)" }}>Formation</span>
                  <span>·</span>
                  <span>{sum.completedCourses}/{sum.totalCourses} parcours</span>
                  {newBadge && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)", border: "0.5px solid var(--coral)" }}>
                      <Award size={10} /> Nouveau badge
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--foreground)" }}>{pct}%</span>
              </div>
              <div style={{ width: "100%", height: 5, borderRadius: 3, backgroundColor: "var(--muted)" }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, backgroundColor: barColor, transition: "width 0.3s" }} />
              </div>
              {sum.lockedPlanning && (
                <div style={{ fontSize: 10, color: "#9A3412", marginTop: 4 }}>
                  Termine {sum.blockingCourses.map((c: any) => `"${c.title}"`).join(", ")} pour débloquer ton planning
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </>
  );
}
