import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { Wallet, Clock, FileCheck, Star, TrendingUp, TrendingDown, Minus, AlertTriangle, ExternalLink, GraduationCap, Lock } from "lucide-react";
import { getEmployeeStats } from "@/lib/my-stats.functions";
import { getAssignedCoursesForEmployee } from "@/lib/formation.functions";

type Stats = Awaited<ReturnType<typeof getEmployeeStats>>;
type Formation = Awaited<ReturnType<typeof getAssignedCoursesForEmployee>>;

function fmtMoney(n: number): string { return n.toFixed(2).replace(".", ",") + " €"; }
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
    <div className="rounded-xl" style={{
      padding: "14px 14px 12px",
      backgroundColor: "var(--background)",
      border: "0.5px solid var(--border)",
      minHeight: 110,
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div className="flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {icon}<span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rounded-xl border p-3 mb-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            height: 110, borderRadius: 12, backgroundColor: "var(--muted)",
            opacity: 0.5, animation: "pulse 1.5s ease-in-out infinite",
          }} />
        ))}
      </div>
    </div>
  );
}

export function EmployeeStatsCard({ userId, onOpenFormation }: { userId: string; onOpenFormation?: () => void }) {
  const fetchStats = useServerFn(getEmployeeStats);
  const fetchFormation = useServerFn(getAssignedCoursesForEmployee);
  const [stats, setStats] = useState<Stats | null>(null);
  const [formation, setFormation] = useState<Formation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      fetchStats({ data: { userId } }),
      fetchFormation({ data: { userId } }).catch(() => null),
    ])
      .then(([s, f]) => { if (!cancel) { setStats(s); setFormation(f as Formation | null); setLoading(false); } })
      .catch(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [fetchStats, fetchFormation, userId]);

  if (loading) return <Skeleton />;
  if (!stats) return null;

  const { earnings, weekHours, lastShiftDimona, career, score, admin } = stats;

  const deltaColor = earnings.delta > 0 ? "#16a34a" : earnings.delta < 0 ? "#dc2626" : "var(--muted-foreground)";
  const DeltaIcon = earnings.delta > 0 ? TrendingUp : earnings.delta < 0 ? TrendingDown : Minus;
  const deltaSign = earnings.delta > 0 ? "+" : "";
  const quotaColor = weekHours.percentUsed < 70 ? "#16a34a" : weekHours.percentUsed < 90 ? "#ea8a00" : "#dc2626";
  const dimonaInfo = lastShiftDimona.status ? DIMONA_LABEL[lastShiftDimona.status] : null;
  const scoreColor = score.current >= 7 ? "#16a34a" : score.current >= 5 ? "#ea8a00" : "#dc2626";
  const sparkData = score.sparkline30d.map((value, i) => ({ i, value }));

  const hasAlerts = admin.retards30d > 0 || admin.checklistsIncomplete30d > 0;
  const alertColor = hasAlerts ? "#ea8a00" : "var(--muted-foreground)";

  return (
    <div className="rounded-xl border p-3 mb-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 4px 8px" }}>
        Stats
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <SubCard title="Gains ce mois" icon={<Wallet size={11} />}>
          {!earnings.hasRate ? (
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Taux non renseigné</div>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.1, marginTop: 2 }}>{fmtMoney(earnings.currentMonth)}</div>
              <div className="flex items-center gap-1" style={{ fontSize: 11, color: deltaColor, fontWeight: 500 }}>
                <DeltaIcon size={11} />
                <span>{deltaSign}{fmtMoney(earnings.delta)} vs mois dernier</span>
              </div>
            </>
          )}
        </SubCard>

        <SubCard title="Cette semaine" icon={<Clock size={11} />}>
          <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.1, marginTop: 2 }}>
            {fmtHours(weekHours.total)}
            {weekHours.isStudent && (
              <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 400 }}> / {weekHours.studentLimit}h</span>
            )}
          </div>
          {weekHours.isStudent ? (
            <>
              <div style={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "var(--muted)", marginTop: 4 }}>
                <div style={{ width: `${weekHours.percentUsed}%`, height: "100%", borderRadius: 3, backgroundColor: quotaColor, transition: "width 0.3s" }} />
              </div>
              <div style={{ fontSize: 10, color: weekHours.percentUsed >= 90 ? "#dc2626" : "var(--muted-foreground)" }}>
                {weekHours.worked}h pointées · {weekHours.scheduled}h prévues
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {weekHours.worked}h pointées · {weekHours.scheduled}h prévues
            </div>
          )}
        </SubCard>

        <SubCard title="Dernière Dimona" icon={<FileCheck size={11} />}>
          {!lastShiftDimona.shiftDate ? (
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>—</div>
          ) : !dimonaInfo ? (
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
              En attente
              <div style={{ fontSize: 11, marginTop: 2 }}>shift du {fmtDateShort(lastShiftDimona.shiftDate)}</div>
            </div>
          ) : (
            <>
              <div className="inline-flex items-center self-start" style={{
                fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 999,
                backgroundColor: dimonaInfo.bg, color: dimonaInfo.color, marginTop: 2,
              }}>{dimonaInfo.label}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>shift du {fmtDateShort(lastShiftDimona.shiftDate)}</div>
            </>
          )}
        </SubCard>

        <SubCard title="Score" icon={<Star size={11} />}>
          <div className="flex items-baseline gap-1" style={{ marginTop: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.1, color: scoreColor }}>
              {score.current.toFixed(1).replace(".", ",")}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>/ 10</span>
          </div>
          <div style={{ height: 28, marginTop: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <YAxis hide domain={[0, 10]} />
                <Line type="monotone" dataKey="value" stroke={scoreColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>30 derniers jours</div>
        </SubCard>
      </div>

      {/* Indicateurs admin */}
      <div className="mt-3 pt-3 flex items-center gap-2 flex-wrap" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
        <AlertTriangle size={12} style={{ color: alertColor }} />
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
          Indicateurs admin (30j)
        </span>
        <span style={{ fontSize: 12, color: alertColor, fontWeight: 500 }}>
          {admin.retards30d} retard{admin.retards30d > 1 ? "s" : ""}
        </span>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>·</span>
        <span style={{ fontSize: 12, color: alertColor, fontWeight: 500 }}>
          {admin.checklistsIncomplete30d} checklist{admin.checklistsIncomplete30d > 1 ? "s" : ""} incomplète{admin.checklistsIncomplete30d > 1 ? "s" : ""}
        </span>
      </div>

      {/* Carrière */}
      <div className="flex items-center gap-1.5 mt-2 pt-2 flex-wrap" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)", fontSize: 11, color: "var(--muted-foreground)" }}>
        <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{career.totalShiftsCompleted}</span>
        <span>shifts ·</span>
        <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{fmtHours(career.totalHoursWorked)}</span>
        {career.hasRate && (
          <>
            <span>·</span>
            <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{fmtMoney(career.totalEarnings)}</span>
          </>
        )}
        <span>depuis l'embauche</span>

        <Link
          to="/rapports"
          search={{ view: "employees" as const, preset: "30d" as const, userId }}
          className="ml-auto inline-flex items-center gap-1"
          style={{ fontSize: 11, color: "var(--coral)", fontWeight: 500 }}
        >
          Détail dans Rapports <ExternalLink size={11} />
        </Link>
      </div>
    </div>
  );
}
