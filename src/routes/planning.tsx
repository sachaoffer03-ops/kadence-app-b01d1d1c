import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import {
  ChevronLeft, ChevronRight, AlertTriangle, X, Clock, Check, CheckCheck,
  Star, Sparkles, MapPin, Phone, Trash2, Sparkle
} from "lucide-react";
import { toast } from "sonner";
import { employees, roleColors, type Role, type Studio, type Employee } from "@/lib/mock-data";
import { Dropdown } from "@/components/Dropdown";

export const Route = createFileRoute("/planning")({
  component: PlanningPage,
  head: () => ({
    meta: [{ title: "Planning — Shyft" }],
  }),
  validateSearch: (s: Record<string, unknown>): { add?: boolean } =>
    s.add ? { add: true } : {},
});

const roles: Role[] = ["Barista", "Accueil", "Host", "Cuisine"];
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
  time: string;
  startHour: string;
  endHour: string;
  hole?: boolean;
  confirmation: ShiftConfirmation;
  pointage: ShiftPointage;
  delayMinutes?: number;
  clockIn?: string;
  clockOut?: string;
  phone?: string;
  note?: string;
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

function generateShifts(weekDays: Date[]): PlanningShift[] {
  const shifts: PlanningShift[] = [];
  let id = 0;
  const names = employees.slice(0, 16);
  const confirmations: ShiftConfirmation[] = ["confirmé", "confirmé", "confirmé", "en-attente", "confirmé"];
  const pointages: ShiftPointage[] = ["à-temps", "à-temps", "retard", "non-pointé", "en-cours", "à-temps"];

  const now = new Date();

  for (let day = 0; day < 7; day++) {
    const shiftDate = weekDays[day];
    const isPast = shiftDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isToday = shiftDate.toDateString() === now.toDateString();

    for (let slot = 0; slot < 4; slot++) {
      // Both studios run in parallel — generate shifts for each
      for (const studio of studios) {
        const count = slot === 0 || slot === 3 ? 1 : 2;
        for (let i = 0; i < count; i++) {
        const emp = names[(id + day * 3 + slot + (studio === "Skult Châtelain" ? 7 : 0)) % names.length];
        const role = emp.roles[0];
        const conf = isPast ? "confirmé" as const : confirmations[id % confirmations.length];
        const delay = (id % 7 === 3) ? 8 + (id % 12) : undefined;
        let ptg: ShiftPointage;
        if (isPast) {
          ptg = delay ? "retard" : "à-temps";
        } else if (isToday) {
          ptg = slot < 2 ? (delay ? "retard" : "à-temps") : "non-pointé";
        } else {
          ptg = "non-pointé";
        }

        shifts.push({
          id: String(id++),
          day, slot,
          employeeId: emp.id,
          name: `${emp.firstName} ${emp.lastName.charAt(0)}.`,
          role, studio,
          time: timeSlotDefs[slot].time,
          startHour: timeSlotDefs[slot].start,
          endHour: timeSlotDefs[slot].end,
          confirmation: conf,
          pointage: ptg,
          delayMinutes: delay,
          clockIn: ptg === "retard" ? `${timeSlotDefs[slot].start.replace("h00", `h${String(delay || 0).padStart(2, "0")}`)}` : (ptg === "à-temps" ? timeSlotDefs[slot].start : undefined),
          phone: emp.phone,
        });
        }
      }
    }
  }

  // Add holes
  shifts.push({ id: "hole1", day: 2, slot: 1, employeeId: "", name: "", role: "Barista", studio: "Skult Rhodes", time: "10h — 15h", startHour: "10h00", endHour: "15h00", hole: true, confirmation: "en-attente", pointage: "non-pointé" });
  shifts.push({ id: "hole2", day: 5, slot: 2, employeeId: "", name: "", role: "Host", studio: "Skult Châtelain", time: "14h — 19h", startHour: "14h00", endHour: "19h00", hole: true, confirmation: "en-attente", pointage: "non-pointé" });
  shifts.push({ id: "hole3", day: 1, slot: 3, employeeId: "", name: "", role: "Accueil", studio: "Skult Rhodes", time: "17h — 23h", startHour: "17h00", endHour: "23h00", hole: true, confirmation: "en-attente", pointage: "non-pointé" });
  shifts.push({ id: "hole4", day: 6, slot: 0, employeeId: "", name: "", role: "Cuisine", studio: "Skult Châtelain", time: "07h — 12h", startHour: "07h00", endHour: "12h00", hole: true, confirmation: "en-attente", pointage: "non-pointé" });

  return shifts;
}

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
function ShiftDetailModal({ shift, employee, onClose, onDelete, onUpdateSlot, onConfirm }: { shift: PlanningShift; employee?: Employee; onClose: () => void; onDelete: () => void; onUpdateSlot: (slot: number) => void; onConfirm: () => void }) {
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
        <div className="flex gap-2 px-5 py-3" style={{ borderTop: "0.5px solid var(--border)" }}>
          <button
            onClick={onDelete}
            className="rounded-md px-3 py-2 transition-colors flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", color: "var(--danger-text)" }}
          >
            <Trash2 size={13} /> Supprimer
          </button>
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
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedStudio, setSelectedStudio] = useState<Studio>("Skult Rhodes");
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [selectedShift, setSelectedShift] = useState<PlanningShift | null>(null);
  const [holeShift, setHoleShift] = useState<PlanningShift | null>(null);

  const weekDays = useMemo(() => getWeekDays(year, month, weekOffset), [year, month, weekOffset]);
  const [shifts, setShifts] = useState<PlanningShift[]>(() => generateShifts(weekDays));

  const lastWeekKey = useRef(`${year}-${month}-${weekOffset}`);
  const weekKey = `${year}-${month}-${weekOffset}`;
  if (weekKey !== lastWeekKey.current) {
    lastWeekKey.current = weekKey;
    setShifts(generateShifts(getWeekDays(year, month, weekOffset)));
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
  const gridCols = `140px repeat(${visibleDayIndices.length}, 1fr)`;

  const goToday = () => { setMonth(now.getMonth()); setYear(now.getFullYear()); setWeekOffset(0); };
  const goPrev = () => setWeekOffset((w) => w - 1);
  const goNext = () => setWeekOffset((w) => w + 1);

  const handleFillHole = (holeId: string, empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    setShifts((prev) => prev.map((s) => {
      if (s.id !== holeId) return s;
      return { ...s, hole: false, employeeId: emp.id, name: `${emp.firstName} ${emp.lastName.charAt(0)}.`, confirmation: "en-attente", phone: emp.phone };
    }));
    setHoleShift(null);
    toast.success(`${emp.firstName} ${emp.lastName.charAt(0)}. assigné·e au shift`);
  };

  const handleDeleteShift = (id: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== id));
    setSelectedShift(null);
    toast.success("Shift supprimé");
  };

  const handleUpdateSlot = (id: string, slot: number) => {
    const def = timeSlotDefs[slot];
    setShifts((prev) => prev.map((s) => s.id === id ? { ...s, slot, time: def.time, startHour: def.start, endHour: def.end } : s));
    setSelectedShift((cur) => cur && cur.id === id ? { ...cur, slot, time: def.time, startHour: def.start, endHour: def.end } : cur);
    toast.success("Horaire mis à jour");
  };

  const handleConfirmShift = (id: string) => {
    setShifts((prev) => prev.map((s) => s.id === id ? { ...s, confirmation: "confirmé" } : s));
    setSelectedShift((cur) => cur && cur.id === id ? { ...cur, confirmation: "confirmé" } : cur);
    toast.success("Shift confirmé");
  };

  const handleAddShift = (empId: string, day: number, slot: number, role: Role) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    const def = timeSlotDefs[slot];
    const newShift: PlanningShift = {
      id: `new-${Date.now()}`,
      day, slot, employeeId: emp.id,
      name: `${emp.firstName} ${emp.lastName.charAt(0)}.`,
      role, studio: selectedStudio,
      time: def.time, startHour: def.start, endHour: def.end,
      confirmation: "en-attente", pointage: "non-pointé",
      phone: emp.phone,
    };
    setShifts((prev) => [...prev, newShift]);
    setShowAdd(false);
    toast.success(`Shift ajouté pour ${emp.firstName}`);
  };

  const handlePublish = () => {
    setPublished(true);
    toast.success("Planning publié — notifications envoyées à l'équipe");
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
              style={{ gridTemplateColumns: "140px repeat(7, 1fr)", borderBottom: "0.5px solid var(--border)", minHeight: 110 }}
            >
              <div className="px-4 py-3 flex flex-col justify-center" style={{ backgroundColor: "var(--muted)" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{fmtTime(slot.start)}–{fmtTime(slot.end)}</div>
                <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>5 heures</div>
              </div>
              {weekDays.map((_, dayIdx) => {
                const cellShifts = studioShifts.filter((s) => s.day === dayIdx && s.slot === slotIdx);
                const isSelected = selectedDayIdx === dayIdx;
                return (
                  <div
                    key={dayIdx}
                    className="p-1.5 flex flex-col gap-1.5"
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
                          className="rounded-md px-2 py-1.5 text-left transition-all"
                          style={{
                            fontSize: 11,
                            backgroundColor: rc.bg,
                            color: rc.text,
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {shift.name.split(" ")[0]}
                            </span>
                            <StatusDot confirmation={shift.confirmation} pointage={shift.pointage} delayMinutes={shift.delayMinutes} />
                          </div>
                          <div className="flex items-center justify-between gap-1" style={{ fontSize: 10, opacity: 0.85, marginTop: 1 }}>
                            <span className="flex items-center gap-1">
                              <span className="rounded-full" style={{ width: 5, height: 5, backgroundColor: rc.dot }} />
                              {shift.role}
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
    </div>
  );
}

// ── Add Shift Modal ────────────────────────────────────────
function AddShiftModal({ studio, onClose, onAdd }: { studio: Studio; onClose: () => void; onAdd: (empId: string, day: number, slot: number, role: Role) => void }) {
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(0);
  const [role, setRole] = useState<Role>("Barista");
  const [empId, setEmpId] = useState("");

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
              options={roles as readonly string[] as string[]}
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
