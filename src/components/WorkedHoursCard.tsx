import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Wallet, ChevronDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "this_month", label: "Ce mois" },
  { key: "last_month", label: "Mois précédent" },
  { key: "last_3_months", label: "3 derniers mois" },
  { key: "this_year", label: "Cette année" },
];

function PeriodPicker({ value, onChange }: { value: PeriodKey; onChange: (v: PeriodKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = PERIOD_OPTIONS.find(o => o.key === value)?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-full transition-colors"
        style={{
          fontSize: 11,
          fontWeight: 500,
          padding: "5px 10px 5px 12px",
          border: "0.5px solid var(--border)",
          backgroundColor: open ? "var(--muted)" : "transparent",
          color: "var(--foreground)",
          letterSpacing: "0.01em",
        }}
      >
        <span>{current}</span>
        <ChevronDown size={11} style={{ opacity: 0.6, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 170,
            backgroundColor: "var(--card)",
            border: "0.5px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 8px 24px -8px rgba(0,0,0,0.12), 0 2px 6px -2px rgba(0,0,0,0.06)",
            padding: 4,
            zIndex: 30,
          }}
        >
          {PERIOD_OPTIONS.map(opt => {
            const active = opt.key === value;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => { onChange(opt.key); setOpen(false); }}
                className="w-full flex items-center justify-between rounded-md transition-colors"
                style={{
                  fontSize: 12,
                  fontWeight: active ? 500 : 400,
                  padding: "7px 10px",
                  textAlign: "left",
                  color: "var(--foreground)",
                  backgroundColor: active ? "var(--muted)" : "transparent",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--muted)"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
              >
                <span>{opt.label}</span>
                {active && <Check size={12} style={{ color: "var(--primary, #F0997B)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type PeriodKey = "this_month" | "last_month" | "last_3_months" | "this_year";

function getPeriod(key: PeriodKey): { start: string; end: string; label: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (key === "this_month") {
    return { start: fmt(new Date(y, m, 1)), end: fmt(today), label: "Ce mois" };
  }
  if (key === "last_month") {
    return { start: fmt(new Date(y, m - 1, 1)), end: fmt(new Date(y, m, 0)), label: "Mois précédent" };
  }
  if (key === "last_3_months") {
    return { start: fmt(new Date(y, m - 3, today.getDate())), end: fmt(today), label: "3 derniers mois" };
  }
  return { start: fmt(new Date(y, 0, 1)), end: fmt(today), label: "Cette année" };
}

export function formatHM(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return "0h";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

function formatMoney(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

interface Stats {
  total_minutes: number;
  total_hours: number;
  shift_count: number;
  avg_minutes_late: number;
}

async function fetchStats(userId: string, start: string, end: string): Promise<Stats | null> {
  const { data, error } = await supabase.rpc("get_worked_hours", {
    target_user_id: userId,
    period_start: start,
    period_end: end,
  });
  if (error) { console.error(error); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    total_minutes: Number(row.total_minutes) || 0,
    total_hours: Number(row.total_hours) || 0,
    shift_count: Number(row.shift_count) || 0,
    avg_minutes_late: Number(row.avg_minutes_late) || 0,
  };
}

const DISCLAIMER_FULL = "⚠️ Estimation indicative uniquement. Ne tient pas compte des cotisations, primes, heures supplémentaires, ni des règles Dimona. Consulter la fiche de paie officielle pour le montant réel.";
const DISCLAIMER_SHORT = "Estimation indicative. Voir fiche de paie pour le montant officiel.";

/* ---------------- ADMIN VARIANT ---------------- */
export function WorkedHoursAdminCard({ userId, hourlyRate }: { userId: string; hourlyRate: number | null }) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("this_month");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const period = useMemo(() => getPeriod(periodKey), [periodKey]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchStats(userId, period.start, period.end).then(s => { if (!cancel) { setStats(s); setLoading(false); } });
    return () => { cancel = true; };
  }, [userId, period.start, period.end]);

  const minutes = stats?.total_minutes ?? 0;
  const hoursDecimal = (stats?.total_hours ?? 0);
  const hasShifts = (stats?.shift_count ?? 0) > 0;
  const pay = hourlyRate !== null ? hoursDecimal * hourlyRate : null;
  const avgShiftMin = hasShifts ? Math.round(minutes / (stats!.shift_count)) : 0;

  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Activité & Rémunération
        </div>
        <select value={periodKey} onChange={(e) => setPeriodKey(e.target.value as PeriodKey)}
          className="rounded-md px-2 py-1"
          style={{ fontSize: 11, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}>
          <option value="this_month">Ce mois</option>
          <option value="last_month">Mois précédent</option>
          <option value="last_3_months">3 derniers mois</option>
          <option value="this_year">Cette année</option>
        </select>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : !hasShifts ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun pointage sur cette période</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--background)" }}>
              <div className="flex items-center gap-1.5" style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <Clock size={11} /> Heures travaillées
              </div>
              <div style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>{formatHM(minutes)}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>sur {stats!.shift_count} shift{stats!.shift_count > 1 ? "s" : ""}</div>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--background)" }}>
              <div className="flex items-center gap-1.5" style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <Wallet size={11} /> Rémunération
              </div>
              {pay === null ? (
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4, color: "var(--muted-foreground)" }}>Taux non renseigné</div>
              ) : (
                <>
                  <div style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>~{formatMoney(pay)}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>(estimation brute)</div>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 pt-3" style={{ borderTop: "0.5px solid var(--border)" }}>
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Détails</div>
            <div className="flex items-center justify-between py-1" style={{ fontSize: 12 }}>
              <span style={{ color: "var(--muted-foreground)" }}>Shift moyen</span>
              <span style={{ fontWeight: 500 }}>{formatHM(avgShiftMin)}</span>
            </div>
            <div className="flex items-center justify-between py-1" style={{ fontSize: 12 }}>
              <span style={{ color: "var(--muted-foreground)" }}>Retard moyen</span>
              <span style={{ fontWeight: 500 }}>+{Math.round(stats!.avg_minutes_late)} min</span>
            </div>
            <div className="flex items-center justify-between py-1" style={{ fontSize: 12 }}>
              <span style={{ color: "var(--muted-foreground)" }}>Taux horaire</span>
              <span style={{ fontWeight: 500 }}>{hourlyRate !== null ? `${hourlyRate.toFixed(2).replace(".", ",")} €/h` : "—"}</span>
            </div>
          </div>
        </>
      )}

      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 10, lineHeight: 1.4 }}>
        {DISCLAIMER_FULL}
      </div>
    </div>
  );
}

/* ---------------- ADMIN: SHIFTS TABLE ---------------- */
interface ShiftRowLite {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  status: string;
  minutes_late?: number | null;
}

export function ClockedShiftsTable({ userId }: { userId: string }) {
  const [rows, setRows] = useState<ShiftRowLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("shifts")
        .select("id,shift_date,start_time,end_time,clocked_in_at,clocked_out_at,status,minutes_late")
        .eq("user_id", userId)
        .eq("status", "completed")
        .not("clocked_in_at", "is", null)
        .not("clocked_out_at", "is", null)
        .order("shift_date", { ascending: false })
        .limit(10);
      if (!cancel) { setRows((data || []) as ShiftRowLite[]); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [userId]);

  const fmtT = (t: string) => t.slice(0, 5).replace(":", "h");
  const fmtClock = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h") : "—";
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
  const durationMin = (a: string | null, b: string | null) => (a && b) ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) : 0;
  const lateColor = (m: number | null | undefined) => {
    const v = m ?? 0;
    if (v <= 0) return "var(--success-text, #16a34a)";
    if (v <= 15) return "#ea8a00";
    return "var(--danger-text, #dc2626)";
  };

  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
        Derniers shifts pointés
      </div>
      {loading ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div> :
       rows.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun pointage</div> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--muted-foreground)", textAlign: "left" }}>
                <th style={{ padding: "4px 6px", fontWeight: 500 }}>Date</th>
                <th style={{ padding: "4px 6px", fontWeight: 500 }}>Prévu</th>
                <th style={{ padding: "4px 6px", fontWeight: 500 }}>Arrivée</th>
                <th style={{ padding: "4px 6px", fontWeight: 500 }}>Départ</th>
                <th style={{ padding: "4px 6px", fontWeight: 500 }}>Durée</th>
                <th style={{ padding: "4px 6px", fontWeight: 500 }}>Retard</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const dur = durationMin(r.clocked_in_at, r.clocked_out_at);
                const late = r.minutes_late ?? 0;
                return (
                  <tr key={r.id} style={{ borderTop: "0.5px solid var(--border)" }}>
                    <td style={{ padding: "6px" }}>{fmtDate(r.shift_date)}</td>
                    <td style={{ padding: "6px", color: "var(--muted-foreground)" }}>{fmtT(r.start_time)}</td>
                    <td style={{ padding: "6px", fontWeight: 500 }}>{fmtClock(r.clocked_in_at)}</td>
                    <td style={{ padding: "6px", fontWeight: 500 }}>{fmtClock(r.clocked_out_at)}</td>
                    <td style={{ padding: "6px" }}>{formatHM(dur)}</td>
                    <td style={{ padding: "6px", color: lateColor(late), fontWeight: 500 }}>{late > 0 ? `+${late} min` : "0 min"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- EMPLOYEE VARIANT ---------------- */
export function WorkedHoursEmployeeCard({ userId, hourlyRate }: { userId: string; hourlyRate: number | null }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const period = useMemo(() => getPeriod("this_month"), []);
  const monthLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).replace(/^./, c => c.toUpperCase());
  }, []);

  useEffect(() => {
    let cancel = false;
    fetchStats(userId, period.start, period.end).then(s => { if (!cancel) { setStats(s); setLoading(false); } });
    return () => { cancel = true; };
  }, [userId, period.start, period.end]);

  const minutes = stats?.total_minutes ?? 0;
  const hasShifts = (stats?.shift_count ?? 0) > 0;
  const showPay = hourlyRate !== null;
  const pay = showPay ? (stats?.total_hours ?? 0) * (hourlyRate as number) : null;

  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 4px", marginBottom: 8, marginTop: 16 }}>
        Mon activité — {monthLabel}
      </div>
      <div className="rounded-xl border p-4" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
        {loading ? (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
        ) : !hasShifts ? (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun shift effectué ce mois</div>
        ) : (
          <div className={showPay ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <div className="flex items-center gap-1.5" style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <Clock size={11} /> Heures effectuées
              </div>
              <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>{formatHM(minutes)}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>sur {stats!.shift_count} shift{stats!.shift_count > 1 ? "s" : ""}</div>
            </div>
            {showPay && (
              <div>
                <div className="flex items-center gap-1.5" style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <Wallet size={11} /> Estimation salaire
                </div>
                <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>~{formatMoney(pay as number)}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>(brut indicatif)</div>
              </div>
            )}
          </div>
        )}
        {showPay && (
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 10, lineHeight: 1.4 }}>
            {DISCLAIMER_SHORT}
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------- EMPLOYEE: COMPACT SHIFTS LIST ---------------- */
interface EmpShiftRow {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  status: string;
  published_at: string | null;
}

export function EmployeeLastShifts({ userId }: { userId: string }) {
  const [rows, setRows] = useState<EmpShiftRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("shifts")
        .select("id,shift_date,start_time,end_time,clocked_in_at,clocked_out_at,status,published_at")
        .eq("user_id", userId)
        .lte("shift_date", today)
        .order("shift_date", { ascending: false })
        .limit(5);
      if (!cancel) { setRows((data || []) as EmpShiftRow[]); setLoading(false); }
    })();
  }, [userId]);

  const fmtClock = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h") : "—";
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
  const durationMin = (a: string | null, b: string | null) => (a && b) ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) : 0;

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 4px", marginBottom: 8, marginTop: 16 }}>
        Mes derniers shifts
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
        {rows.map((r, i) => {
          const isCompleted = r.status === "completed" && r.clocked_in_at && r.clocked_out_at;
          const isMissed = !r.clocked_in_at;
          const dur = durationMin(r.clocked_in_at, r.clocked_out_at);
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: i < rows.length - 1 ? "0.5px solid rgba(0,0,0,0.06)" : "none", fontSize: 12 }}>
              <div style={{ width: 80, color: "var(--muted-foreground)" }}>{fmtDate(r.shift_date)}</div>
              <div style={{ flex: 1, fontWeight: 500 }}>
                {isCompleted ? `${fmtClock(r.clocked_in_at)} → ${fmtClock(r.clocked_out_at)}` : "—"}
              </div>
              <div style={{ width: 50, color: "var(--muted-foreground)" }}>
                {isCompleted ? formatHM(dur) : "—"}
              </div>
              <div style={{ fontSize: 13 }}>
                {isCompleted ? "✅" : isMissed ? "⚠️" : "⏳"}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
