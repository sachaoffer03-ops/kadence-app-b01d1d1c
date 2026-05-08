import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, AlertTriangle, X, Clock, Check, CheckCheck,
  AlertCircle, User, Star, Sparkles, GripVertical, MapPin, Phone
} from "lucide-react";
import { employees, roleColors, type Role, type Studio, type Employee } from "@/lib/mock-data";

export const Route = createFileRoute("/planning")({
  component: PlanningPage,
  head: () => ({
    meta: [{ title: "Planning — Shifty" }],
  }),
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

// ── Shift Detail Modal ─────────────────────────────────────
function ShiftDetailModal({ shift, employee, onClose }: { shift: PlanningShift; employee?: Employee; onClose: () => void }) {
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
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{shift.time}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>5 heures</div>
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
          <Link
            to="/staff/$id"
            params={{ id: shift.employeeId }}
            className="flex-1 rounded-md px-3 py-2 text-center transition-colors"
            style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", textDecoration: "none", color: "var(--foreground)" }}
          >
            Voir le profil
          </Link>
          <button
            className="flex-1 rounded-md px-3 py-2 transition-colors"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
          >
            Modifier le shift
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
function PlanningPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("semaine");
  const [dayViewIdx, setDayViewIdx] = useState(now.getDay() === 0 ? 6 : now.getDay() - 1);
  const [roleFilter, setRoleFilter] = useState<Role | "tous">("tous");
  const [studioFilter, setStudioFilter] = useState<Studio | "tous">("tous");
  const [selectedShift, setSelectedShift] = useState<PlanningShift | null>(null);
  const [holeShift, setHoleShift] = useState<PlanningShift | null>(null);
  const [dragShift, setDragShift] = useState<string | null>(null);

  const weekDays = useMemo(() => getWeekDays(year, month, weekOffset), [year, month, weekOffset]);
  const [shifts, setShifts] = useState<PlanningShift[]>(() => generateShifts(weekDays));

  // Regenerate shifts when week changes
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

  const filtered = shifts.filter((s) => {
    if (roleFilter !== "tous" && s.role !== roleFilter) return false;
    if (studioFilter !== "tous" && s.studio !== studioFilter) return false;
    return true;
  });

  // Navigation
  const goToday = () => { setMonth(now.getMonth()); setYear(now.getFullYear()); setWeekOffset(0); };
  const goPrev = () => {
    if (viewMode === "jour") {
      if (dayViewIdx === 0) { setWeekOffset((w) => w - 1); setDayViewIdx(6); }
      else setDayViewIdx((d) => d - 1);
    } else {
      setWeekOffset((w) => w - 1);
    }
  };
  const goNext = () => {
    if (viewMode === "jour") {
      if (dayViewIdx === 6) { setWeekOffset((w) => w + 1); setDayViewIdx(0); }
      else setDayViewIdx((d) => d + 1);
    } else {
      setWeekOffset((w) => w + 1);
    }
  };

  // Drag & Drop
  const handleDragStart = (shiftId: string) => setDragShift(shiftId);
  const handleDrop = (targetDay: number, targetSlot: number) => {
    if (!dragShift) return;
    setShifts((prev) => prev.map((s) => s.id === dragShift ? { ...s, day: targetDay, slot: targetSlot } : s));
    setDragShift(null);
  };

  // Fill hole
  const handleFillHole = (holeId: string, empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    setShifts((prev) => prev.map((s) => {
      if (s.id !== holeId) return s;
      return { ...s, hole: false, employeeId: emp.id, name: `${emp.firstName} ${emp.lastName.charAt(0)}.`, confirmation: "en-attente", phone: emp.phone };
    }));
    setHoleShift(null);
  };

  const displayMonth = weekDays[3] ? monthNames[weekDays[3].getMonth()] : monthNames[month];
  const displayYear = weekDays[3] ? weekDays[3].getFullYear() : year;

  // Day view label
  const dayViewDate = weekDays[dayViewIdx];
  const dayViewLabel = dayViewDate ? `${dayNamesFull[dayViewDate.getDay()]} ${dayViewDate.getDate()} ${monthNames[dayViewDate.getMonth()]}` : "";

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={goPrev} className="rounded-md p-1 transition-colors" style={{ border: "0.5px solid var(--border)" }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 500 }}>
            {viewMode === "jour" ? dayViewLabel : `${displayMonth} ${displayYear}`}
          </span>
          <button onClick={goNext} className="rounded-md p-1 transition-colors" style={{ border: "0.5px solid var(--border)" }}>
            <ChevronRight size={16} />
          </button>
          <button onClick={goToday} className="rounded-md px-3 py-1 ml-2 transition-colors" style={{ fontSize: 12, border: "0.5px solid var(--border)", color: "var(--foreground)" }}>
            Aujourd'hui
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode */}
          <div className="flex rounded-md overflow-hidden" style={{ border: "0.5px solid var(--border)" }}>
            {(["jour", "semaine"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className="px-3 py-1.5 transition-colors"
                style={{
                  fontSize: 11, fontWeight: viewMode === v ? 500 : 400,
                  backgroundColor: viewMode === v ? "var(--foreground)" : "transparent",
                  color: viewMode === v ? "var(--card)" : "var(--muted-foreground)",
                }}
              >
                {v === "jour" ? "Jour" : "Semaine"}
              </button>
            ))}
          </div>
          <a
            href="/planning/generate"
            className="rounded-md px-4 py-2 flex items-center gap-1.5 transition-colors"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
          >
            Générer le planning
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(["tous", ...roles] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r as Role | "tous")}
            className="rounded-full px-2.5 py-1 flex items-center gap-1.5 transition-colors"
            style={{
              fontSize: 11,
              fontWeight: roleFilter === r ? 500 : 400,
              backgroundColor: roleFilter === r ? (r === "tous" ? "var(--foreground)" : roleColors[r as Role].bg) : "transparent",
              color: roleFilter === r ? (r === "tous" ? "var(--card)" : roleColors[r as Role].text) : "var(--muted-foreground)",
              border: roleFilter === r ? "none" : "0.5px solid var(--border)",
            }}
          >
            {r !== "tous" && <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: roleColors[r as Role].dot }} />}
            {r === "tous" ? "Tous les rôles" : r}
          </button>
        ))}
        <span style={{ width: 1, height: 16, backgroundColor: "var(--border)", display: "inline-block", margin: "0 4px" }} />
        {(["tous", ...studios] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStudioFilter(s as Studio | "tous")}
            className="rounded-full px-2.5 py-1 transition-colors"
            style={{
              fontSize: 11,
              fontWeight: studioFilter === s ? 500 : 400,
              backgroundColor: studioFilter === s ? "var(--foreground)" : "transparent",
              color: studioFilter === s ? "var(--card)" : "var(--muted-foreground)",
              border: studioFilter === s ? "none" : "0.5px solid var(--border)",
            }}
          >
            {s === "tous" ? "Tous les studios" : s.replace("Skult ", "")}
          </button>
        ))}
      </div>

      {/* ── WEEK VIEW ── */}
      {viewMode === "semaine" && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          {/* Day headers */}
        <div className="grid grid-cols-8" style={{ borderBottom: "0.5px solid var(--border)" }}>
            <div className="px-3 py-2" style={{ fontSize: 11, color: "var(--muted-foreground)" }} />
            {weekDays.map((d, i) => {
              const isToday = i === todayIdx;
              const dn = dayNamesShort[d.getDay()];
              return (
                <button
                  key={i}
                  className="px-3 py-2 text-center transition-colors"
                  onClick={() => { setViewMode("jour"); setDayViewIdx(i); }}
                  style={{
                    fontSize: 11, fontWeight: 500, cursor: "pointer",
                    color: isToday ? "var(--coral-dark)" : "var(--muted-foreground)",
                    backgroundColor: isToday ? "var(--coral-light)" : "transparent",
                  }}
                >
                  <div>{dn} {d.getDate()}</div>
                  {studioFilter === "tous" && (
                    <div className="grid grid-cols-2 gap-1 mt-1.5" style={{ fontSize: 9, fontWeight: 400, color: "var(--muted-foreground)" }}>
                      <span>Rhodes</span>
                      <span>Châtelain</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Time rows */}
          {timeSlotDefs.map((slot, slotIdx) => (
            <div key={slot.label} className="grid grid-cols-8" style={{ borderBottom: "0.5px solid var(--border)", minHeight: 80 }}>
              <div className="px-3 py-2 flex items-start" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{slot.label}</div>
              {weekDays.map((_, dayIdx) => {
                const cellShifts = filtered.filter((s) => s.day === dayIdx && s.slot === slotIdx);
                const isToday = dayIdx === todayIdx;
                const splitByStudio = studioFilter === "tous";
                const renderShift = (shift: PlanningShift) =>
                  shift.hole ? (
                    <div
                      key={shift.id}
                      onClick={() => setHoleShift(shift)}
                      className="rounded-md px-2 py-1.5 flex items-center gap-1 transition-all"
                      style={{ fontSize: 10, backgroundColor: "var(--danger-bg)", color: "var(--danger-text)", border: "1px dashed var(--danger-text)", cursor: "pointer" }}
                    >
                      <AlertTriangle size={10} />
                      Trou · {shift.role}
                    </div>
                  ) : (
                    <div
                      key={shift.id}
                      draggable
                      onDragStart={() => handleDragStart(shift.id)}
                      onClick={() => setSelectedShift(shift)}
                      className="rounded-md px-2 py-1.5 transition-all group"
                      style={{ fontSize: 10, backgroundColor: roleColors[shift.role].bg, color: roleColors[shift.role].text, cursor: "pointer" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 min-w-0">
                          <GripVertical size={8} style={{ opacity: 0.4, flexShrink: 0 }} />
                          <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shift.name}</span>
                        </div>
                        <StatusDot confirmation={shift.confirmation} pointage={shift.pointage} delayMinutes={shift.delayMinutes} />
                      </div>
                    </div>
                  );

                if (splitByStudio) {
                  const rhodes = cellShifts.filter((s) => s.studio === "Skult Rhodes");
                  const chatelain = cellShifts.filter((s) => s.studio === "Skult Châtelain");
                  return (
                    <div
                      key={dayIdx}
                      className="grid grid-cols-2"
                      style={{ borderLeft: "0.5px solid var(--border)", backgroundColor: isToday ? "rgba(240,153,123,0.04)" : "transparent" }}
                    >
                      <div
                        className="px-1 py-1 flex flex-col gap-1"
                        style={{ borderRight: "0.5px dashed var(--border)" }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(dayIdx, slotIdx)}
                      >
                        {rhodes.length === 0 ? (
                          <div style={{ fontSize: 9, color: "var(--muted-foreground)", opacity: 0.5, padding: "2px 4px" }}>—</div>
                        ) : rhodes.map(renderShift)}
                      </div>
                      <div
                        className="px-1 py-1 flex flex-col gap-1"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(dayIdx, slotIdx)}
                      >
                        {chatelain.length === 0 ? (
                          <div style={{ fontSize: 9, color: "var(--muted-foreground)", opacity: 0.5, padding: "2px 4px" }}>—</div>
                        ) : chatelain.map(renderShift)}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={dayIdx}
                    className="px-1 py-1 flex flex-col gap-1"
                    style={{ borderLeft: "0.5px solid var(--border)", backgroundColor: isToday ? "rgba(240,153,123,0.04)" : "transparent" }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(dayIdx, slotIdx)}
                  >
                    {cellShifts.map(renderShift)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── DAY VIEW ── */}
      {viewMode === "jour" && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          {timeSlotDefs.map((slot, slotIdx) => {
            const cellShifts = filtered.filter((s) => s.day === dayViewIdx && s.slot === slotIdx);
            return (
              <div key={slot.label} style={{ borderBottom: "0.5px solid var(--border)" }}>
                <div className="px-4 py-2" style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", backgroundColor: "var(--muted)" }}>
                  {slot.time}
                </div>
                <div
                  className="px-4 py-2 flex flex-col gap-2"
                  style={{ minHeight: 60 }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(dayViewIdx, slotIdx)}
                >
                  {cellShifts.length === 0 && (
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", padding: "8px 0" }}>Aucun shift</div>
                  )}
                  {cellShifts.map((shift) =>
                    shift.hole ? (
                      <div
                        key={shift.id}
                        onClick={() => setHoleShift(shift)}
                        className="rounded-lg px-3 py-2.5 flex items-center gap-2 transition-all"
                        style={{ fontSize: 12, backgroundColor: "var(--danger-bg)", color: "var(--danger-text)", border: "1px dashed var(--danger-text)", cursor: "pointer" }}
                      >
                        <AlertTriangle size={14} />
                        <div>
                          <div style={{ fontWeight: 500 }}>Trou non rempli</div>
                          <div style={{ fontSize: 11, opacity: 0.8 }}>{shift.role} · {shift.studio}</div>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={shift.id}
                        draggable
                        onDragStart={() => handleDragStart(shift.id)}
                        onClick={() => setSelectedShift(shift)}
                        className="rounded-lg px-3 py-2.5 flex items-center justify-between transition-all"
                        style={{ fontSize: 12, backgroundColor: roleColors[shift.role].bg, color: roleColors[shift.role].text, cursor: "pointer" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical size={12} style={{ opacity: 0.4 }} />
                          <div className="rounded-full flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 500 }}>
                            {shift.name.charAt(0)}{shift.name.split(" ")[1]?.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{shift.name}</div>
                            <div style={{ fontSize: 10, opacity: 0.7 }}>{shift.role} · {shift.studio}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusDot confirmation={shift.confirmation} pointage={shift.pointage} delayMinutes={shift.delayMinutes} />
                          <span style={{ fontSize: 11, opacity: 0.7 }}>{shift.time}</span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 flex-wrap" style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full px-1" style={{ backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}><Check size={7} /></span>
          Pointé a l'heure
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full px-1" style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}><Clock size={7} /></span>
          Retard
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full px-1" style={{ backgroundColor: "var(--info-bg)", color: "var(--info-text)" }}><CheckCheck size={7} /></span>
          Confirmé
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full px-1" style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}><Clock size={7} /></span>
          En attente
        </div>
        <div className="flex items-center gap-1.5">
          <GripVertical size={10} />
          Glisser-déposer
        </div>
      </div>

      {/* Modals */}
      {selectedShift && (
        <ShiftDetailModal
          shift={selectedShift}
          employee={employees.find((e) => e.id === selectedShift.employeeId)}
          onClose={() => setSelectedShift(null)}
        />
      )}
      {holeShift && (
        <FillHoleModal
          shift={holeShift}
          onClose={() => setHoleShift(null)}
          onFill={(empId) => handleFillHole(holeShift.id, empId)}
        />
      )}
    </div>
  );
}
