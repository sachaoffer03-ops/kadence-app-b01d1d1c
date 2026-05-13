import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, AlertTriangle, X, Clock, Check, CheckCheck,
  Star, Sparkles, MapPin, Phone, Trash2, Sparkle, Lock, FileEdit
} from "lucide-react";
import { toast } from "sonner";
import { employees, roleColors, type Role, type Studio, type Employee } from "@/lib/mock-data";
import { Dropdown } from "@/components/Dropdown";
import { supabase } from "@/integrations/supabase/client";
import { createShift, updateShift, deleteShift as deleteShiftFn, publishPlanning } from "@/lib/shifts.functions";
import { useBusinessRoles } from "@/hooks/use-business-roles";

export const Route = createFileRoute("/planning")({
  component: PlanningPage,
  head: () => ({
    meta: [{ title: "Planning — Shyft" }],
  }),
  validateSearch: (s: Record<string, unknown>): { add?: boolean } =>
    s.add ? { add: true } : {},
});

// Studios par défaut (UI filtres). Les vraies données viennent de la DB.
// Les rôles métier sont chargés dynamiquement via useBusinessRoles().
const studios: Studio[] = ["Skult Rhodes", "Skult Châtelain"];

type ViewMode = "semaine" | "jour";
type ShiftConfirmation = "confirmé" | "en-attente" | "refusé";
type ShiftPointage = "à-temps" | "retard" | "absent" | "non-pointé" | "en-cours";

interface PlanningShift {
  id: string;
  day: number;
  slot: number;
  employeeId: string;
  name: string;
  role: Role;
  studio: Studio;
  studioId: string;
  shiftDate: string;
  time: string;
  startHour: string;
  endHour: string;
  startTime: string; // HH:MM:SS DB format
  endTime: string;
  hole?: boolean;
  confirmation: ShiftConfirmation;
  pointage: ShiftPointage;
  delayMinutes?: number;
  clockIn?: string;
  clockOut?: string;
  phone?: string;
  note?: string;
  isDraft?: boolean;
  isLocked?: boolean;
  isManual?: boolean;
  conflict?: boolean; // overlap with another shift of same employee
}

const monthNames = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];
const dayNamesFull = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const dayNamesShort = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const timeSlotDefs = [
  { label: "07h", start: "07h00", end: "12h00", time: "07h — 12h" },
  { label: "10h", start: "10h00", end: "15h00", time: "10h — 15h" },
  { label: "14h", start: "14h00", end: "19h00", time: "14h — 19h" },
  { label: "17h", start: "17h00", end: "23h00", time: "17h — 23h" },
];

function getWeekDays(year: number, month: number, weekOffset: number): Date[] {
  // Get first Monday of the month, then offset by weeks
  const first = new Date(year, month, 1);
  const dayOfWeek = first.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const firstMonday = new Date(year, month, 1 + mondayOffset + weekOffset * 7);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(firstMonday);
    d.setDate(firstMonday.getDate() + i);
    days.push(d);
  }
  return days;
}

// (Mock generateShifts removed — shifts are now loaded from Supabase.)

// ── Confirmation/Pointage badge ────────────────────────────
function StatusDot({ confirmation, pointage, delayMinutes }: { confirmation: ShiftConfirmation; pointage: ShiftPointage; delayMinutes?: number }) {
  if (pointage === "retard") {
    return (
      <span className="flex items-center gap-0.5 rounded-full px-1" style={{ fontSize: 8, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
        <Clock size={7} />
        +{delayMinutes}min
      </span>
    );
  }
  if (pointage === "à-temps") {
    return (
      <span className="flex items-center rounded-full px-1" style={{ fontSize: 8, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
        <Check size={7} />
      </span>
    );
  }
  if (confirmation === "en-attente") {
    return (
      <span className="flex items-center rounded-full px-1" style={{ fontSize: 8, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
        <Clock size={7} />
      </span>
    );
  }
  if (confirmation === "confirmé" && pointage === "non-pointé") {
    return (
      <span className="flex items-center rounded-full px-1" style={{ fontSize: 8, backgroundColor: "var(--info-bg)", color: "var(--info-text)" }}>
        <CheckCheck size={7} />
      </span>
    );
  }
  return null;
}

// ── Visual time-position bar (7h → 23h scale) ──────────────
function TimeBar({ leftPct, widthPct, color }: { leftPct: number; widthPct: number; color: string }) {
  return (
    <div style={{ position: "relative", height: 4, marginTop: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: `${leftPct}%`, width: `${widthPct}%`, top: 0, bottom: 0, borderRadius: 2, backgroundColor: color, opacity: 0.85 }} />
    </div>
  );
}

// ── Shift Detail Modal ─────────────────────────────────────
function ShiftDetailModal({ shift, employee, onClose, onDelete, onUpdateSlot, onConfirm, onUnlock }: { shift: PlanningShift; employee?: Employee; onClose: () => void; onDelete: () => void; onUpdateSlot: (slot: number) => void; onConfirm: () => void; onUnlock?: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={onClose}>
      <div
        className="rounded-xl w-full max-w-md mx-4 overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="rounded-full flex items-center justify-center" style={{ width: 36, height: 36, backgroundColor: roleColors[shift.role].bg, color: roleColors[shift.role].text, fontSize: 13, fontWeight: 500 }}>
              {shift.name.charAt(0)}{shift.name.split(" ")[1]?.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{shift.name}</div>
              <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: roleColors[shift.role].dot }} />
                {shift.role} · {shift.studio}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1" style={{ color: "var(--muted-foreground)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Horaire */}
          <div className="flex items-center gap-3">
            <Clock size={14} style={{ color: "var(--muted-foreground)" }} />
            <div className="flex-1">
              {editing ? (
                <Dropdown
                  value={timeSlotDefs[shift.slot].time}
                  options={timeSlotDefs.map(s => s.time)}
                  onChange={(v) => {
                    const idx = timeSlotDefs.findIndex(s => s.time === v);
                    if (idx >= 0) onUpdateSlot(idx);
                  }}
                  minWidth={180}
                />
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{shift.time}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>5 heures</div>
                </>
              )}
            </div>
          </div>

          {/* Studio */}
          <div className="flex items-center gap-3">
            <MapPin size={14} style={{ color: "var(--muted-foreground)" }} />
            <div style={{ fontSize: 13 }}>{shift.studio}</div>
          </div>

          {/* Contact */}
          {shift.phone && (
            <div className="flex items-center gap-3">
              <Phone size={14} style={{ color: "var(--muted-foreground)" }} />
              <div style={{ fontSize: 13 }}>{shift.phone}</div>
            </div>
          )}

          {/* Statuts */}
          <div className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: "var(--muted)" }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Confirmation</span>
              <span className="rounded-full px-2 py-0.5" style={{
                fontSize: 10, fontWeight: 500,
                backgroundColor: shift.confirmation === "confirmé" ? "var(--success-bg)" : shift.confirmation === "en-attente" ? "var(--warning-bg)" : "var(--danger-bg)",
                color: shift.confirmation === "confirmé" ? "var(--success-text)" : shift.confirmation === "en-attente" ? "var(--warning-text)" : "var(--danger-text)",
              }}>
                {shift.confirmation === "confirmé" ? "Confirmé" : shift.confirmation === "en-attente" ? "En attente" : "Refusé"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Pointage</span>
              <span className="rounded-full px-2 py-0.5" style={{
                fontSize: 10, fontWeight: 500,
                backgroundColor: shift.pointage === "à-temps" ? "var(--success-bg)" : shift.pointage === "retard" ? "var(--warning-bg)" : shift.pointage === "absent" ? "var(--danger-bg)" : "var(--muted)",
                color: shift.pointage === "à-temps" ? "var(--success-text)" : shift.pointage === "retard" ? "var(--warning-text)" : shift.pointage === "absent" ? "var(--danger-text)" : "var(--muted-foreground)",
              }}>
                {shift.pointage === "à-temps" ? "A l'heure" : shift.pointage === "retard" ? `Retard +${shift.delayMinutes}min` : shift.pointage === "absent" ? "Absent" : shift.pointage === "en-cours" ? "En cours" : "Non pointé"}
              </span>
            </div>
            {shift.clockIn && (
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Clock-in</span>
                <span style={{ fontSize: 11, fontWeight: 500 }}>{shift.clockIn}</span>
              </div>
            )}
            {shift.confirmation === "en-attente" && (
              <button
                onClick={onConfirm}
                className="w-full mt-1 rounded-md py-1.5 transition-colors"
                style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}
              >
                Forcer la confirmation
              </button>
            )}
          </div>

          {/* Employee info */}
          {employee && (
            <div className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: "var(--muted)" }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 2 }}>Infos employé</div>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Score</span>
                <div className="flex items-center gap-1">
                  <Star size={10} style={{ color: "var(--coral)" }} />
                  <span style={{ fontSize: 11, fontWeight: 500 }}>{employee.score}/10</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Contrat</span>
                <span style={{ fontSize: 11 }}>{employee.contract}</span>
              </div>
              {employee.quotaUsed !== null && (
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Contingent</span>
                  <span style={{ fontSize: 11 }}>{employee.quotaUsed}/{employee.quotaMax}h</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Ponctualité</span>
                <span style={{ fontSize: 11 }}>{employee.punctuality}/10</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap gap-2 px-5 py-3" style={{ borderTop: "0.5px solid var(--border)" }}>
          <button
            onClick={onDelete}
            className="rounded-md px-3 py-2 transition-colors flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", color: "var(--danger-text)" }}
          >
            <Trash2 size={13} /> Supprimer
          </button>
          {shift.isLocked && onUnlock && (
            <button
              onClick={onUnlock}
              title="Permet à l'IA de réassigner ce shift à la prochaine génération"
              className="rounded-md px-3 py-2 transition-colors flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}
            >
              <Lock size={13} /> Déverrouiller
            </button>
          )}
          <Link
            to="/staff/$id"
            params={{ id: shift.employeeId }}
            className="flex-1 rounded-md px-3 py-2 text-center transition-colors"
            style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", textDecoration: "none", color: "var(--foreground)" }}
          >
            Profil
          </Link>
          <button
            onClick={() => setEditing((v) => !v)}
            className="flex-1 rounded-md px-3 py-2 transition-colors"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
          >
            {editing ? "Terminer" : "Modifier"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fill Hole Modal ────────────────────────────────────────
function FillHoleModal({ shift, onClose, onFill }: { shift: PlanningShift; onClose: () => void; onFill: (empId: string) => void }) {
  const [search, setSearch] = useState("");

  // Find eligible employees for this role
  const eligible = useMemo(() => {
    return employees
      .filter((e) => e.roles.includes(shift.role))
      .map((e) => {
        const roleScore = e.roleScores?.[shift.role] || e.score;
        const hoursLeft = e.quotaMax ? e.quotaMax - (e.quotaUsed || 0) : null;
        const aiScore = roleScore * 10 + (e.punctuality || 0) * 5 + (hoursLeft !== null ? Math.min(hoursLeft / 50, 5) : 5);
        return { ...e, roleScore, hoursLeft, aiScore, aiRecommended: false };
      })
      .sort((a, b) => b.aiScore - a.aiScore)
      .map((e, i) => ({ ...e, aiRecommended: i < 3 }));
  }, [shift.role]);

  const filtered = eligible.filter((e) =>
    search === "" || `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={onClose}>
      <div
        className="rounded-xl w-full max-w-lg mx-4 overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)", maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Remplir ce shift</div>
            <div className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: roleColors[shift.role].dot }} />
              {shift.role} · {shift.time} · {shift.studio}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1" style={{ color: "var(--muted-foreground)" }}>
            <X size={16} />
          </button>
        </div>

        {/* AI suggestions */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-1.5 mb-2" style={{ fontSize: 11, fontWeight: 500, color: "var(--coral-dark)" }}>
            <Sparkles size={12} />
            Suggestions IA
          </div>
          <div className="flex gap-2">
            {filtered.filter(e => e.aiRecommended).slice(0, 3).map((emp) => (
              <button
                key={emp.id}
                onClick={() => onFill(emp.id)}
                className="flex-1 rounded-lg p-2.5 text-left transition-all"
                style={{ border: "0.5px solid var(--coral)", backgroundColor: "var(--coral-light)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
              >
                <div style={{ fontSize: 12, fontWeight: 500 }}>{emp.firstName} {emp.lastName.charAt(0)}.</div>
                <div className="flex items-center gap-1 mt-0.5" style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                  <Star size={8} style={{ color: "var(--coral)" }} />
                  {emp.roleScore.toFixed(1)}
                  {emp.hoursLeft !== null && <span> · {emp.hoursLeft}h restantes</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-2">
          <input
            type="text"
            placeholder="Rechercher un employé..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md px-3 py-2 outline-none"
            style={{ fontSize: 12, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}
          />
        </div>

        {/* Employee list */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8 }}>
            {filtered.length} employé{filtered.length > 1 ? "s" : ""} éligible{filtered.length > 1 ? "s" : ""} ({shift.role})
          </div>
          <div className="flex flex-col gap-1">
            {filtered.map((emp) => (
              <button
                key={emp.id}
                onClick={() => onFill(emp.id)}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors"
                style={{ border: "0.5px solid var(--border)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="rounded-full flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: roleColors[shift.role].bg, color: roleColors[shift.role].text, fontSize: 10, fontWeight: 500 }}>
                    {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{emp.firstName} {emp.lastName}</span>
                      {emp.aiRecommended && (
                        <span className="rounded-full px-1.5 py-0.5 flex items-center gap-0.5" style={{ fontSize: 8, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)" }}>
                          <Sparkles size={7} /> Top
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                      {emp.contract}{emp.hoursLeft !== null ? ` · ${emp.hoursLeft}h restantes` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Star size={10} style={{ color: "var(--coral)" }} />
                  <span style={{ fontSize: 11, fontWeight: 500 }}>{emp.roleScore.toFixed(1)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Planning Page ────────────────────────────────────
const fmtTime = (s: string) => s.replace("h00", ":00").replace("h", ":");

function PlanningPage() {
  const { names: roles } = useBusinessRoles({ onlyActive: true });
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedStudio, setSelectedStudio] = useState<Studio>("Skult Rhodes");
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [selectedShift, setSelectedShift] = useState<PlanningShift | null>(null);
  const [holeShift, setHoleShift] = useState<PlanningShift | null>(null);

  const weekDays = useMemo(() => getWeekDays(year, month, weekOffset), [year, month, weekOffset]);
  const [shifts, setShifts] = useState<PlanningShift[]>([]);
  const [studioMap, setStudioMap] = useState<Map<string, string>>(new Map());
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  // Load studios once for id ↔ name mapping
  useEffect(() => {
    supabase.from("studios").select("id, name").then(({ data }) => {
      if (data) setStudioMap(new Map(data.map((s: any) => [s.id, s.name])));
    });
  }, []);

  // Fetch real shifts from DB whenever the visible week changes
  useEffect(() => {
    const first = weekDays[0];
    const last = weekDays[6];
    const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const startISO = toISO(first);
    const endISO = toISO(last);
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, user_id, studio_id, business_role, shift_date, start_time, end_time, status, clocked_in_at, is_locked, is_manual, published_at, profiles:user_id(first_name, last_name, phone)")
        .gte("shift_date", startISO)
        .lte("shift_date", endISO)
        .order("shift_date")
        .order("start_time")
        .limit(2000);
      if (cancelled) return;
      if (error) { console.error(error); return; }
      const rows = (data ?? []) as any[];

      // Conflict detection (overlap per user)
      const conflictIds = new Set<string>();
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          const a = rows[i], b = rows[j];
          if (!a.user_id || a.user_id !== b.user_id || a.shift_date !== b.shift_date) continue;
          if (a.start_time < b.end_time && b.start_time < a.end_time) {
            conflictIds.add(a.id); conflictIds.add(b.id);
          }
        }
      }

      const mapped: PlanningShift[] = rows.map((row: any) => {
        const date = new Date(`${row.shift_date}T00:00:00`);
        const dayIdx = weekDays.findIndex((d) => d.toDateString() === date.toDateString());
        const startH = parseInt(String(row.start_time).slice(0, 2), 10);
        const slot = startH < 9 ? 0 : startH < 13 ? 1 : startH < 16 ? 2 : 3;
        const fmt = (t: string) => `${t.slice(0, 2)}h${t.slice(3, 5)}`;
        const studioName = (studioMap.get(row.studio_id) as Studio) ?? "Skult Rhodes";
        const fn = row.profiles?.first_name ?? "";
        const ln = row.profiles?.last_name ?? "";
        const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
        const ptg: ShiftPointage = row.clocked_in_at ? "à-temps" : isPast ? "absent" : "non-pointé";
        return {
          id: row.id,
          day: dayIdx >= 0 ? dayIdx : 0,
          slot,
          employeeId: row.user_id ?? "",
          name: row.user_id ? `${fn} ${ln.charAt(0)}.` : "",
          role: row.business_role as Role,
          studio: studioName as Studio,
          studioId: row.studio_id,
          shiftDate: row.shift_date,
          time: `${fmt(row.start_time)} — ${fmt(row.end_time)}`,
          startHour: fmt(row.start_time),
          endHour: fmt(row.end_time),
          startTime: row.start_time,
          endTime: row.end_time,
          hole: !row.user_id,
          confirmation: row.status === "scheduled" ? "confirmé" : "en-attente",
          pointage: ptg,
          phone: row.profiles?.phone ?? undefined,
          isDraft: row.status === "draft",
          isLocked: !!row.is_locked,
          isManual: !!row.is_manual,
          conflict: conflictIds.has(row.id),
        };
      });
      setShifts(mapped);
    })();
    return () => { cancelled = true; };
  }, [weekDays, studioMap, refreshKey]);

  // weekKey ref kept for compatibility but no longer regenerates mock
  const lastWeekKey = useRef(`${year}-${month}-${weekOffset}`);
  const weekKey = `${year}-${month}-${weekOffset}`;
  if (weekKey !== lastWeekKey.current) {
    lastWeekKey.current = weekKey;
  }

  const todayIdx = useMemo(() => {
    const today = new Date();
    return weekDays.findIndex((d) => d.toDateString() === today.toDateString());
  }, [weekDays]);

  const studioShifts = useMemo(() => shifts.filter((s) => s.studio === selectedStudio), [shifts, selectedStudio]);
  const realShifts = studioShifts.filter((s) => !s.hole);
  const holes = studioShifts.filter((s) => s.hole);
  const roleTotals = roles.map((r) => ({ role: r, count: realShifts.filter((s) => s.role === r).length }));

  const [published, setPublished] = useState(false);
  const search = Route.useSearch();
  const [showAdd, setShowAdd] = useState(!!search.add);
  const [viewMode, setViewMode] = useState<ViewMode>("semaine");
  const [dayIdxJour, setDayIdxJour] = useState<number>(() => {
    const t = new Date();
    const idx = weekDays.findIndex((d) => d.toDateString() === t.toDateString());
    return idx >= 0 ? idx : 0;
  });

  const visibleDayIndices = viewMode === "jour" ? [dayIdxJour] : [0, 1, 2, 3, 4, 5, 6];
  const gridCols = `90px repeat(${visibleDayIndices.length}, minmax(90px, 1fr))`;

  const goToday = () => { setMonth(now.getMonth()); setYear(now.getFullYear()); setWeekOffset(0); };
  const goPrev = () => setWeekOffset((w) => w - 1);
  const goNext = () => setWeekOffset((w) => w + 1);

  // Server functions
  const createShiftFn = useServerFn(createShift);
  const updateShiftFn = useServerFn(updateShift);
  const deleteShiftRpc = useServerFn(deleteShiftFn);
  const publishPlanningFn = useServerFn(publishPlanning);

  const handleFillHole = async (holeId: string, empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    try {
      await updateShiftFn({ data: { shiftId: holeId, userId: empId } });
      setHoleShift(null);
      toast.success(`${emp.firstName} ${emp.lastName.charAt(0)}. assigné·e au shift`);
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  };

  const handleDeleteShift = async (id: string) => {
    setSelectedShift(null);
    try {
      await deleteShiftRpc({ data: { shiftId: id } });
      toast.success("Shift supprimé");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  };

  const handleUpdateSlot = async (id: string, slot: number) => {
    const def = timeSlotDefs[slot];
    const startTime = `${def.start.replace("h", ":")}:00`;
    const endTime = `${def.end.replace("h", ":")}:00`;
    try {
      await updateShiftFn({ data: { shiftId: id, startTime, endTime } });
      toast.success("Horaire mis à jour");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  };

  const handleConfirmShift = async (id: string) => {
    // Force-confirmer = passer en scheduled (publié) si encore draft
    try {
      await updateShiftFn({ data: { shiftId: id } }); // marque locked+manual
      toast.success("Shift confirmé");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  };

  const handleAddShift = async (empId: string, day: number, slot: number, role: Role) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    const def = timeSlotDefs[slot];
    const date = weekDays[day];
    const shiftDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const startTime = `${def.start.replace("h", ":")}:00`;
    const endTime = `${def.end.replace("h", ":")}:00`;
    // Resolve studio_id from name
    const studioEntry = Array.from(studioMap.entries()).find(([_id, name]) => name === selectedStudio);
    if (!studioEntry) {
      toast.error("Studio introuvable");
      return;
    }
    try {
      await createShiftFn({
        data: {
          userId: empId,
          studioId: studioEntry[0],
          businessRole: role as any,
          shiftDate,
          startTime,
          endTime,
          publishImmediately: false,
        },
      });
      setShowAdd(false);
      toast.success(`Shift ajouté en brouillon pour ${emp.firstName}`);
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  };

  const draftCount = useMemo(() => studioShifts.filter((s) => s.isDraft).length, [studioShifts]);
  const conflictCount = useMemo(() => studioShifts.filter((s) => s.conflict).length, [studioShifts]);
  const [publishOpen, setPublishOpen] = useState(false);

  const handlePublishConfirm = async (force = false) => {
    const start = weekDays[0];
    const end = weekDays[6];
    const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const studioEntry = Array.from(studioMap.entries()).find(([_id, name]) => name === selectedStudio);
    try {
      const res: any = await publishPlanningFn({
        data: {
          startDate: toISO(start),
          endDate: toISO(end),
          ...(studioEntry ? { studioId: studioEntry[0] } : {}),
          ...(force ? { confirmRepublish: true } : {}),
        },
      });
      if (res?.alreadyPublished) {
        const dt = new Date(res.previousPublishedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
        const ok = window.confirm(`Cette période a déjà été publiée le ${dt}. Republier et notifier à nouveau les employés ?`);
        if (ok) return handlePublishConfirm(true);
        return;
      }
      setPublishOpen(false);
      setPublished(true);
      toast.success(`${res?.published ?? 0} shifts publiés · ${res?.notified ?? 0} employés notifiés`);
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  };
  const handlePublish = () => setPublishOpen(true);

  const handleMoveShift = async (shiftId: string, newDay: number, newSlot: number) => {
    const def = timeSlotDefs[newSlot];
    const date = weekDays[newDay];
    const shiftDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const original = studioShifts.find((s) => s.id === shiftId);
    const slotStart = `${def.start.replace("h", ":")}:00`;
    const slotEnd = `${def.end.replace("h", ":")}:00`;
    let startTime = slotStart;
    let endTime = slotEnd;
    // Les horaires doivent suivre les besoins définis par l'admin (staffing_templates)
    // pour le studio, le jour et le poste cibles. Si un template matche le créneau,
    // on utilise SES horaires (durée = celle configurée), pas la durée d'origine.
    if (original?.studioId && original.role) {
      const dow = (date.getDay() + 6) % 7; // 0 = Lundi
      const { data: tpls } = await supabase
        .from("staffing_templates")
        .select("start_time, end_time")
        .eq("studio_id", original.studioId)
        .eq("day_of_week", dow)
        .eq("business_role", original.role);
      const list = (tpls ?? []).map((t: any) => ({
        s: String(t.start_time).slice(0, 8),
        e: String(t.end_time).slice(0, 8),
      }));
      // Match prioritaire : template dont le début tombe dans le slot cible.
      const inSlot = list.find((t) => t.s >= slotStart && t.s < slotEnd)
        ?? list.find((t) => t.s === slotStart);
      if (inSlot) {
        startTime = inSlot.s;
        endTime = inSlot.e;
      }
    }
    try {
      await updateShiftFn({ data: { shiftId, shiftDate, startTime, endTime } });
      toast.success("Shift déplacé");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  };

  const handleUnlockShift = async (id: string) => {
    try {
      await updateShiftFn({ data: { shiftId: id, unlock: true, markManual: false } });
      toast.success("Shift déverrouillé — l'IA pourra le réassigner");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  };


  // Compute ISO-ish week number
  const weekNumber = useMemo(() => {
    const d = new Date(weekDays[3]);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }, [weekDays]);

  const startD = weekDays[0];
  const endD = weekDays[6];
  const sameMonth = startD.getMonth() === endD.getMonth();
  const weekRangeLabel = sameMonth
    ? `Semaine du ${startD.getDate()} au ${endD.getDate()} ${monthNames[endD.getMonth()].toLowerCase()} ${endD.getFullYear()}`
    : `Semaine du ${startD.getDate()} ${monthNames[startD.getMonth()].toLowerCase()} au ${endD.getDate()} ${monthNames[endD.getMonth()].toLowerCase()} ${endD.getFullYear()}`;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-5 flex-wrap">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 2 }}>Planning</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{weekRangeLabel}</div>
        </div>

        {/* Studio toggle */}
        <div className="flex rounded-full p-1" style={{ backgroundColor: "var(--muted)" }}>
          {studios.map((s) => {
            const active = selectedStudio === s;
            return (
              <button
                key={s}
                onClick={() => setSelectedStudio(s)}
                className="rounded-full px-5 py-1.5 transition-colors"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: active ? "var(--foreground)" : "transparent",
                  color: active ? "var(--card)" : "var(--muted-foreground)",
                }}
              >
                {s.replace("Skult ", "")}
              </button>
            );
          })}
        </div>

        {/* View mode toggle */}
        <div className="flex rounded-full p-1" style={{ backgroundColor: "var(--muted)" }}>
          {(["semaine", "jour"] as const).map((m) => {
            const active = viewMode === m;
            return (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className="rounded-full px-4 py-1.5 transition-colors"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: active ? "var(--foreground)" : "transparent",
                  color: active ? "var(--card)" : "var(--muted-foreground)",
                  textTransform: "capitalize",
                }}
              >
                {m === "semaine" ? "Semaine" : "Jour"}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md" style={{ border: "0.5px solid var(--border)" }}>
            <button onClick={goPrev} className="p-1.5" style={{ color: "var(--muted-foreground)" }}>
              <ChevronLeft size={14} />
            </button>
            <button onClick={goToday} className="px-2 py-1.5" style={{ fontSize: 12, fontWeight: 500, borderLeft: "0.5px solid var(--border)", borderRight: "0.5px solid var(--border)" }}>
              Sem. {weekNumber} · {monthNames[weekDays[3].getMonth()]} {weekDays[3].getFullYear()}
            </button>
            <button onClick={goNext} className="p-1.5" style={{ color: "var(--muted-foreground)" }}>
              <ChevronRight size={14} />
            </button>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-md px-4 py-2 flex items-center gap-1.5 transition-colors"
            style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "transparent", color: "var(--foreground)" }}
          >
            + Ajouter
          </button>
          <Link
            to="/planning/generate"
            className="rounded-md px-4 py-2 flex items-center gap-1.5 transition-colors"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff", textDecoration: "none" }}
          >
            <Sparkle size={13} /> Générer
          </Link>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-3 flex-wrap" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
        {roles.map((r) => (
          <span key={r} className="flex items-center gap-1.5">
            <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: roleColors[r].dot }} />
            {r}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span style={{ width: 14, height: 0, borderTop: "1.5px dashed var(--coral)" }} />
          Trou à combler
        </span>
      </div>

      {/* Banners */}
      {(draftCount > 0 || conflictCount > 0) && (
        <div className="rounded-xl border mb-3 px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
          style={{ borderColor: "var(--coral)", backgroundColor: "var(--coral-light)" }}>
          <div className="flex items-center gap-2" style={{ fontSize: 12 }}>
            <FileEdit size={14} style={{ color: "var(--coral-dark)" }} />
            <span style={{ fontWeight: 500, color: "var(--coral-dark)" }}>
              {draftCount > 0 && `${draftCount} shift${draftCount > 1 ? "s" : ""} en brouillon`}
              {draftCount > 0 && conflictCount > 0 && " · "}
              {conflictCount > 0 && `${conflictCount} conflit${conflictCount > 1 ? "s" : ""} détecté${conflictCount > 1 ? "s" : ""}`}
            </span>
            {draftCount > 0 && (
              <span style={{ fontSize: 11, color: "var(--coral-dark)", opacity: 0.8 }}>· non visibles par les employés</span>
            )}
          </div>
          {draftCount > 0 && (
            <button onClick={handlePublish} className="rounded-md px-3 py-1.5 transition-colors"
              style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}>
              Publier la semaine
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <div style={{ minWidth: viewMode === "jour" ? "auto" : 760 }}>
        {/* Day headers */}
        <div className="grid" style={{ gridTemplateColumns: gridCols, borderBottom: "0.5px solid var(--border)" }}>
          <div className="px-4 py-3" style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>Horaire</div>
          {visibleDayIndices.map((i) => {
            const d = weekDays[i];
            const isSelected = viewMode === "jour" ? true : selectedDayIdx === i;
            const isToday = i === todayIdx;
            return (
              <button
                key={i}
                onClick={() => {
                  if (viewMode === "jour") return;
                  setSelectedDayIdx(isSelected ? null : i);
                }}
                className="px-3 py-3 text-center transition-colors"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  borderLeft: "0.5px solid var(--border)",
                  backgroundColor: isSelected ? "var(--muted)" : "transparent",
                  color: "var(--foreground)",
                  cursor: viewMode === "jour" ? "default" : "pointer",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.6, marginBottom: 2 }}>{viewMode === "jour" ? dayNamesFull[d.getDay()] : dayNamesShort[d.getDay()]}</div>
                <div style={{ fontSize: 13 }}>
                  {d.getDate()} {monthNames[d.getMonth()].slice(0, 3).toLowerCase()}
                  {isToday && !isSelected && (
                    <span className="rounded-full ml-1" style={{ display: "inline-block", width: 5, height: 5, backgroundColor: "var(--coral)", verticalAlign: "middle" }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Time slot rows */}
        {timeSlotDefs.map((slot, slotIdx) => {
          return (
            <div
              key={slot.label}
              className="grid"
              style={{ gridTemplateColumns: gridCols, borderBottom: "0.5px solid var(--border)", minHeight: 110 }}
            >
              <div className="px-3 py-3 flex flex-col justify-center" style={{ backgroundColor: "var(--muted)" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{fmtTime(slot.start)}–{fmtTime(slot.end)}</div>
                <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>5 heures</div>
              </div>
              {visibleDayIndices.map((dayIdx) => {
                const cellShifts = studioShifts.filter((s) => s.day === dayIdx && s.slot === slotIdx);
                const isSelected = selectedDayIdx === dayIdx;
                return (
                  <div
                    key={dayIdx}
                    className="p-1.5 flex flex-col gap-1.5"
                    onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).style.outline = "2px dashed var(--coral)"; (e.currentTarget as HTMLElement).style.outlineOffset = "-2px"; }}
                    onDragLeave={(e) => { (e.currentTarget as HTMLElement).style.outline = "none"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).style.outline = "none";
                      const sid = e.dataTransfer.getData("text/shift-id");
                      if (sid) handleMoveShift(sid, dayIdx, slotIdx);
                    }}
                    style={{
                      borderLeft: "0.5px solid var(--border)",
                      backgroundColor: isSelected ? "rgba(15,15,15,0.03)" : "transparent",
                    }}
                  >
                    {[...cellShifts].sort((a, b) => a.startHour.localeCompare(b.startHour)).map((shift) => {
                      const rc = roleColors[shift.role];
                      const startH = parseInt(shift.startHour, 10) + parseInt(shift.startHour.slice(3, 5), 10) / 60;
                      const endH = parseInt(shift.endHour, 10) + parseInt(shift.endHour.slice(3, 5), 10) / 60;
                      const DAY_START = 7, DAY_END = 23, DAY_RANGE = DAY_END - DAY_START;
                      const leftPct = Math.max(0, ((startH - DAY_START) / DAY_RANGE) * 100);
                      const widthPct = Math.max(4, ((endH - startH) / DAY_RANGE) * 100);
                      const startLabel = shift.startHour.replace("h00", "h").replace("h", "h");
                      const endLabel = shift.endHour.replace("h00", "h");
                      return shift.hole ? (
                        <button
                          key={shift.id}
                          onClick={() => setHoleShift(shift)}
                          className="rounded-md px-2 py-1.5 text-left transition-all"
                          style={{
                            fontSize: 11,
                            backgroundColor: "var(--coral-light)",
                            color: "var(--coral-dark)",
                            border: "1px dashed var(--coral)",
                            cursor: "pointer",
                          }}
                        >
                          <div className="flex items-center justify-between gap-1" style={{ fontWeight: 500 }}>
                            <span className="flex items-center gap-1">
                              <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: rc.dot }} />
                              + Libre · {shift.role}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 500 }}>{startLabel}–{endLabel}</span>
                          </div>
                          <TimeBar leftPct={leftPct} widthPct={widthPct} color="var(--coral)" />
                        </button>
                      ) : (
                        <button
                          key={shift.id}
                          onClick={() => setSelectedShift(shift)}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData("text/shift-id", shift.id); e.dataTransfer.effectAllowed = "move"; }}
                          className="rounded-md px-2 py-1.5 text-left transition-all"
                          style={{
                            fontSize: 11,
                            backgroundColor: rc.bg,
                            color: rc.text,
                            cursor: "grab",
                            opacity: shift.isDraft ? 0.75 : 1,
                            border: shift.conflict ? "1px solid var(--danger-text)" : shift.isDraft ? "1px dashed var(--muted-foreground)" : "none",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = shift.isDraft ? "0.9" : "0.85"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = shift.isDraft ? "0.75" : "1"; }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} className="flex items-center gap-1">
                              {shift.isLocked && <Lock size={9} />}
                              {shift.name.split(" ")[0]}
                            </span>
                            <span className="flex items-center gap-1">
                              {shift.conflict && <AlertTriangle size={10} style={{ color: "var(--danger-text)" }} />}
                              <StatusDot confirmation={shift.confirmation} pointage={shift.pointage} delayMinutes={shift.delayMinutes} />
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1" style={{ fontSize: 10, opacity: 0.85, marginTop: 1 }}>
                            <span className="flex items-center gap-1">
                              <span className="rounded-full" style={{ width: 5, height: 5, backgroundColor: rc.dot }} />
                              {shift.isDraft ? "Brouillon" : shift.role}
                            </span>
                            <span style={{ fontWeight: 500 }}>{startLabel}–{endLabel}</span>
                          </div>
                          <TimeBar leftPct={leftPct} widthPct={widthPct} color={rc.dot} />
                        </button>
                      );
                    })}

                  </div>
                );
              })}
            </div>
          );
        })}
        </div>
      </div>

      {/* Footer summary */}
      <div
        className="rounded-xl border mt-4 px-5 py-3 flex items-center justify-between gap-4 flex-wrap"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <div className="flex items-center gap-3" style={{ fontSize: 12 }}>
          <span style={{ fontWeight: 500 }}>Semaine {selectedStudio.replace("Skult ", "")}</span>
          <span style={{ color: "var(--muted-foreground)" }}>·</span>
          <span style={{ color: "var(--muted-foreground)" }}>{realShifts.length} shifts planifiés</span>
          {holes.length > 0 && (
            <>
              <span style={{ color: "var(--muted-foreground)" }}>·</span>
              <Link to="/trous" style={{ color: "var(--coral-dark)", fontWeight: 500, textDecoration: "underline" }}>
                {holes.length} trous à combler
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {roleTotals.map(({ role, count }) => (
            <span key={role} className="flex items-center gap-1.5">
              <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: roleColors[role].dot }} />
              {count} {role}
            </span>
          ))}
          <button
            onClick={handlePublish}
            disabled={published}
            className="rounded-md px-3 py-1.5 transition-colors"
            style={{
              fontSize: 11, fontWeight: 500,
              backgroundColor: published ? "var(--success-bg)" : "var(--foreground)",
              color: published ? "var(--success-text)" : "var(--card)",
              cursor: published ? "default" : "pointer",
            }}
          >
            {published ? "✓ Publié" : "Publier la semaine"}
          </button>
        </div>
      </div>

      {/* Modals */}
      {selectedShift && (
        <ShiftDetailModal
          shift={selectedShift}
          employee={employees.find((e) => e.id === selectedShift.employeeId)}
          onClose={() => setSelectedShift(null)}
          onDelete={() => handleDeleteShift(selectedShift.id)}
          onUpdateSlot={(slot) => handleUpdateSlot(selectedShift.id, slot)}
          onConfirm={() => handleConfirmShift(selectedShift.id)}
          onUnlock={() => { handleUnlockShift(selectedShift.id); setSelectedShift(null); }}
        />
      )}
      {holeShift && (
        <FillHoleModal
          shift={holeShift}
          onClose={() => setHoleShift(null)}
          onFill={(empId) => handleFillHole(holeShift.id, empId)}
        />
      )}
      {showAdd && (
        <AddShiftModal
          studio={selectedStudio}
          onClose={() => setShowAdd(false)}
          onAdd={handleAddShift}
        />
      )}
      {publishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={() => setPublishOpen(false)}>
          <div className="rounded-xl w-full max-w-md mx-4 overflow-hidden" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4" style={{ borderBottom: "0.5px solid var(--border)" }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Publier la semaine</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{weekRangeLabel}</div>
            </div>
            <div className="px-5 py-4" style={{ fontSize: 13, color: "var(--foreground)" }}>
              Tu vas publier <strong>{draftCount} shift{draftCount > 1 ? "s" : ""} en brouillon</strong>. Les employés concernés recevront une notification dans l'app.
              {conflictCount > 0 && (
                <div className="mt-3 rounded-md px-3 py-2 flex items-center gap-2" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)", fontSize: 11 }}>
                  <AlertTriangle size={12} /> {conflictCount} conflit{conflictCount > 1 ? "s" : ""} non résolu{conflictCount > 1 ? "s" : ""} — vérifie avant de publier.
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 py-3" style={{ borderTop: "0.5px solid var(--border)" }}>
              <button onClick={() => setPublishOpen(false)} className="flex-1 rounded-md px-3 py-2" style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>
                Annuler
              </button>
              <button onClick={() => handlePublishConfirm()} className="flex-1 rounded-md px-3 py-2"
                style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}>
                Publier & notifier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Shift Modal ────────────────────────────────────────
function AddShiftModal({ studio, onClose, onAdd }: { studio: Studio; onClose: () => void; onAdd: (empId: string, day: number, slot: number, role: Role) => void }) {
  const { names: roles } = useBusinessRoles({ onlyActive: true });
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(0);
  const [role, setRole] = useState<Role>(roles[0] ?? "");
  const [empId, setEmpId] = useState("");
  useEffect(() => { if (!role && roles.length) setRole(roles[0]); }, [roles.join(",")]);

  const eligible = useMemo(() => employees.filter((e) => e.roles.includes(role)), [role]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={onClose}>
      <div
        className="rounded-xl w-full max-w-md mx-4 overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Ajouter un shift</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{studio}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1" style={{ color: "var(--muted-foreground)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {(() => {
            const dayLabels = dayNamesFull.slice(1).concat(dayNamesFull[0]);
            return (
              <Field label="Jour">
                <Dropdown
                  value={dayLabels[day]}
                  options={dayLabels}
                  onChange={(v) => setDay(dayLabels.indexOf(v))}
                  minWidth={220}
                />
              </Field>
            );
          })()}
          <Field label="Créneau">
            <Dropdown
              value={timeSlotDefs[slot].time}
              options={timeSlotDefs.map(s => s.time)}
              onChange={(v) => {
                const idx = timeSlotDefs.findIndex(s => s.time === v);
                if (idx >= 0) setSlot(idx);
              }}
              minWidth={220}
            />
          </Field>
          <Field label="Poste">
            <Dropdown
              value={role}
              options={roles}
              onChange={(v) => { setRole(v as Role); setEmpId(""); }}
              minWidth={220}
            />
          </Field>
          <Field label="Employé">
            {(() => {
              const empOptions = ["— Sélectionner —", ...eligible.map(e => `${e.firstName} ${e.lastName}`)];
              const current = empId ? (() => { const e = eligible.find(e => e.id === empId); return e ? `${e.firstName} ${e.lastName}` : "— Sélectionner —"; })() : "— Sélectionner —";
              return (
                <Dropdown
                  value={current}
                  options={empOptions}
                  onChange={(v) => {
                    if (v === "— Sélectionner —") { setEmpId(""); return; }
                    const found = eligible.find(e => `${e.firstName} ${e.lastName}` === v);
                    setEmpId(found?.id || "");
                  }}
                  minWidth={220}
                />
              );
            })()}
          </Field>
        </div>
        <div className="flex gap-2 px-5 py-3" style={{ borderTop: "0.5px solid var(--border)" }}>
          <button onClick={onClose} className="flex-1 rounded-md px-3 py-2" style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>
            Annuler
          </button>
          <button
            onClick={() => empId && onAdd(empId, day, slot, role)}
            disabled={!empId}
            className="flex-1 rounded-md px-3 py-2 transition-colors"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)", opacity: empId ? 1 : 0.4 }}
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
