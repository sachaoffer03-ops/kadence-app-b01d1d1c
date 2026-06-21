import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, AlertTriangle, X, Clock, Check, CheckCheck,
  Star, Sparkles, MapPin, Phone, Trash2, Sparkle, Lock, FileEdit, UserPlus, Pencil, Layers
} from "lucide-react";

import { toast } from "sonner";
import { roleColors, type Role, type Studio } from "@/lib/role-colors";
import { Dropdown } from "@/components/Dropdown";
import { supabase } from "@/integrations/supabase/client";
import { createShift, updateShift, deleteShift as deleteShiftFn, publishPlanning } from "@/lib/shifts.functions";
import { useBusinessRoles } from "@/hooks/use-business-roles";
import { useEmployees, type EmployeeLite } from "@/hooks/use-employees";
import { EditShiftModal } from "@/components/EditShiftModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getRoleStyle } from "@/lib/staff-helpers";
import { RatingInput } from "@/components/RatingInput";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/planning")({
  component: PlanningPage,
  head: () => ({
    meta: [{ title: "Planning — Shyft" }],
  }),
  validateSearch: (s: Record<string, unknown>): { add?: boolean } =>
    s.add ? { add: true } : {},
});

// Les studios sont chargés depuis la DB (table `studios`).
// Les rôles métier sont chargés dynamiquement via useBusinessRoles().

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
  unpublished?: boolean;
  isLocked?: boolean;
  isManual?: boolean;
  conflict?: boolean; // overlap with another shift of same employee
  roleSegments?: { role: string; start_time: string; end_time: string }[] | null;
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

function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekDaysFromStart(start: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
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
function ShiftDetailModal({ shift, employee, onClose, onDelete, onConfirm, onUnlock, onEdit }: { shift: PlanningShift; employee?: EmployeeLite; onClose: () => void; onDelete: () => void; onConfirm: () => void; onUnlock?: () => void; onEdit: () => void }) {
  const { user, appRole } = useAuth();
  const canRate = (appRole === "admin" || appRole === "manager") && !shift.hole && !!shift.clockOut;
  const [rateOpen, setRateOpen] = useState(false);
  const [rateValue, setRateValue] = useState(7);
  const [rateMsg, setRateMsg] = useState("");
  const [rateSaving, setRateSaving] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);

  useEffect(() => {
    if (!canRate) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("feedbacks")
        .select("id")
        .eq("shift_id", shift.id)
        .limit(1);
      if (!cancelled) setAlreadyRated((data ?? []).length > 0);
    })();
    return () => { cancelled = true; };
  }, [shift.id, canRate]);

  const submitRate = async () => {
    if (!user) return;
    setRateSaving(true);
    const { error } = await supabase.from("feedbacks").insert({
      author_id: user.id,
      shift_id: shift.id,
      rating: rateValue,
      message: rateMsg.trim() || null,
    });
    setRateSaving(false);
    if (error) { toast.error("Erreur lors de l'enregistrement"); return; }
    if (shift.employeeId && shift.employeeId !== user.id) {
      await supabase.from("notifications").insert({
        user_id: shift.employeeId,
        type: "feedback_received",
        title: "Nouveau feedback reçu",
        body: `Tu as reçu une note ${rateValue}/10 sur ton shift du ${new Date(shift.shiftDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}.`,
        link: `/staff-app?tab=planning&shift=${shift.id}`,
        priority: "normal",
        category: "general",
      });
    }
    toast.success("Note enregistrée");
    setAlreadyRated(true);
    setRateOpen(false);
  };

  const durationH = useMemo(() => {
    const [sh, sm] = String(shift.startTime).slice(0, 5).split(":").map(Number);
    const [eh, em] = String(shift.endTime).slice(0, 5).split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return Math.round((mins / 60) * 10) / 10;
  }, [shift.startTime, shift.endTime]);
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
              <div style={{ fontSize: 13, fontWeight: 500 }}>{shift.time}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{durationH}h</div>
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

          {/* Note manager */}
          {canRate && (
            <div className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: "var(--muted)" }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>
                  Note manager
                </span>
                {alreadyRated && !rateOpen && (
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Déjà noté</span>
                )}
              </div>
              {!rateOpen ? (
                <button
                  onClick={() => setRateOpen(true)}
                  className="rounded-md px-3 py-1.5"
                  style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}
                >
                  {alreadyRated ? "Ajouter une nouvelle note" : "Noter ce shift"}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <RatingInput value={rateValue} onChange={setRateValue} size="md" />
                  <textarea
                    value={rateMsg}
                    onChange={(e) => setRateMsg(e.target.value)}
                    placeholder="Commentaire (optionnel)"
                    rows={2}
                    className="rounded-md border px-2 py-1.5 outline-none"
                    style={{ fontSize: 12, borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setRateOpen(false); setRateMsg(""); setRateValue(7); }}
                      className="rounded-md px-2.5 py-1"
                      style={{ fontSize: 11, border: "0.5px solid var(--border)" }}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={submitRate}
                      disabled={rateSaving}
                      className="rounded-md px-2.5 py-1"
                      style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
                    >
                      {rateSaving ? "..." : "Enregistrer"}
                    </button>
                  </div>
                </div>
              )}
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
            onClick={onEdit}
            className="flex-1 rounded-md px-3 py-2 transition-colors"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
          >
            Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fill Hole Modal ────────────────────────────────────────
function FillHoleModal({ shift, employees, onClose, onFill }: { shift: PlanningShift; employees: EmployeeLite[]; onClose: () => void; onFill: (empId: string) => void }) {
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname !== "/planning") {
    return <Outlet />;
  }

  return <PlanningCalendarPage />;
}

function PlanningCalendarPage() {
  const { names: roles } = useBusinessRoles({ onlyActive: true });
  const { employees } = useEmployees();
  const now = new Date();
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [selectedStudios, setSelectedStudios] = useState<Set<Studio>>(new Set());
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [selectedShift, setSelectedShift] = useState<PlanningShift | null>(null);
  const [holeShift, setHoleShift] = useState<PlanningShift | null>(null);
  const [editShift, setEditShift] = useState<PlanningShift | null>(null);
  const [calOpen, setCalOpen] = useState(false);

  const weekDays = useMemo(() => getWeekDaysFromStart(weekStart), [weekStart]);
  const [shifts, setShifts] = useState<PlanningShift[]>([]);
  const [studioMap, setStudioMap] = useState<Map<string, string>>(new Map());
  // Liste de noms de studios chargée depuis la DB (remplace l'ancien tableau hardcodé).
  const studios = useMemo<Studio[]>(() => Array.from(studioMap.values()), [studioMap]);
  // Sélection automatique de tous les studios dès que la liste est chargée.
  useEffect(() => {
    if (selectedStudios.size === 0 && studios.length > 0) {
      setSelectedStudios(new Set(studios));
    }
  }, [studios, selectedStudios]);
  // Studio "primaire" (premier sélectionné) pour les modals/création de shift
  const selectedStudio: Studio = useMemo(
    () => (selectedStudios.size > 0 ? Array.from(selectedStudios)[0] : studios[0] ?? ""),
    [selectedStudios, studios],
  );
  const toggleStudio = (s: Studio) => {
    setSelectedStudios((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        if (next.size === 1) return prev; // garder au moins un studio actif
        next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  };
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
        .select("id, user_id, studio_id, business_role, shift_date, start_time, end_time, status, clocked_in_at, is_locked, is_manual, published_at, role_segments, profiles:user_id(first_name, last_name, phone)")
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
        const studioName = (studioMap.get(row.studio_id) as Studio) ?? "";
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
          unpublished: !!row.user_id && !row.published_at,
          isLocked: !!row.is_locked,
          isManual: !!row.is_manual,
          conflict: conflictIds.has(row.id),
          roleSegments: (row.role_segments as any[] | null) ?? null,
        };

      });
      setShifts(mapped);
    })();
    return () => { cancelled = true; };
  }, [weekDays, studioMap, refreshKey]);

  const weekKey = weekStart.toISOString().slice(0, 10);
  const lastWeekKey = useRef(weekKey);
  if (weekKey !== lastWeekKey.current) {
    lastWeekKey.current = weekKey;
  }

  const todayIdx = useMemo(() => {
    const today = new Date();
    return weekDays.findIndex((d) => d.toDateString() === today.toDateString());
  }, [weekDays]);

  const studioShifts = useMemo(() => shifts.filter((s) => selectedStudios.has(s.studio)), [shifts, selectedStudios]);
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

  const shiftWeek = (delta: number) => setWeekStart((d) => { const n = new Date(d); n.setDate(d.getDate() + delta * 7); return n; });
  const goToday = () => {
    setWeekStart(mondayOf(new Date()));
    const t = new Date();
    const idx = getWeekDaysFromStart(mondayOf(new Date())).findIndex((d) => d.toDateString() === t.toDateString());
    if (idx >= 0) setDayIdxJour(idx);
  };
  const shiftDay = (delta: number) => {
    // Navigate one day at a time in "jour" view; cross week boundaries by shifting weekStart.
    const current = weekDays[dayIdxJour] ?? weekDays[0];
    const target = new Date(current);
    target.setDate(current.getDate() + delta);
    const newWeekStart = mondayOf(target);
    if (newWeekStart.getTime() !== weekStart.getTime()) {
      setWeekStart(newWeekStart);
    }
    const newIdx = getWeekDaysFromStart(newWeekStart).findIndex(
      (d) => d.toDateString() === target.toDateString(),
    );
    setDayIdxJour(newIdx >= 0 ? newIdx : 0);
  };
  const goPrev = () => (viewMode === "jour" ? shiftDay(-1) : shiftWeek(-1));
  const goNext = () => (viewMode === "jour" ? shiftDay(1) : shiftWeek(1));

  // Auto-actualisation : si l'onglet redevient visible ou que minuit passe,
  // on recentre sur la semaine réelle (utile quand l'app reste ouverte plusieurs jours).
  const initialMondayRef = useRef(mondayOf(new Date()).getTime());
  useEffect(() => {
    const tick = () => {
      const todayMonday = mondayOf(new Date()).getTime();
      if (todayMonday !== initialMondayRef.current) {
        initialMondayRef.current = todayMonday;
        setWeekStart(new Date(todayMonday));
        setRefreshKey((k) => k + 1);
      }
    };
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(tick, 60_000);
    return () => { document.removeEventListener("visibilitychange", onVis); window.clearInterval(id); };
  }, []);

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

  const draftCount = useMemo(() => studioShifts.filter((s) => s.unpublished).length, [studioShifts]);
  const conflictCount = useMemo(() => studioShifts.filter((s) => s.conflict).length, [studioShifts]);
  const [publishOpen, setPublishOpen] = useState(false);

  const handlePublishConfirm = async (force = false) => {
    const start = weekDays[0];
    const end = weekDays[6];
    const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const studioIds = Array.from(selectedStudios)
      .map((name) => Array.from(studioMap.entries()).find(([_id, n]) => n === name)?.[0])
      .filter((id): id is string => !!id);
    try {
      const res: any = await publishPlanningFn({
        data: {
          startDate: toISO(start),
          endDate: toISO(end),
          ...(studioIds.length > 0 ? { studioIds } : {}),
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
  const handlePublish = () => {
    if (draftCount === 0) {
      toast.info("Rien à publier — tous les shifts sont déjà publiés");
      return;
    }
    setPublishOpen(true);
  };

  const handleMoveShift = async (shiftId: string, newDay: number, newSlot: number) => {
    const def = timeSlotDefs[newSlot];
    const date = weekDays[newDay];
    const shiftDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const original = studioShifts.find((s) => s.id === shiftId);
    const slotStart = `${def.start.replace("h", ":")}:00`;
    const slotEnd = `${def.end.replace("h", ":")}:00`;
    // Par défaut : on conserve la durée d'origine en alignant le début sur le slot cible.
    let startTime = slotStart;
    let endTime = slotEnd;
    if (original?.startTime && original?.endTime) {
      const toMin = (t: string) => {
        const [h, m] = String(t).slice(0, 5).split(":").map(Number);
        return h * 60 + m;
      };
      const dur = Math.max(15, toMin(original.endTime) - toMin(original.startTime));
      const startMin = toMin(slotStart);
      const endMin = startMin + dur;
      const pad = (n: number) => String(n).padStart(2, "0");
      startTime = `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}:00`;
      endTime = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}:00`;
    }
    // Si un staffing_template du studio/jour/poste matche le slot cible, on l'utilise (priorité).
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

  const handleMoveShiftPrecise = async (shiftId: string, newDay: number, newStartMinRaw: number) => {
    const original = studioShifts.find((s) => s.id === shiftId);
    if (!original) return;
    const date = weekDays[newDay];
    const shiftDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const toMin = (t: string) => {
      const [h, m] = String(t).slice(0, 5).split(":").map(Number);
      return h * 60 + m;
    };
    const dur = Math.max(15, toMin(original.endTime) - toMin(original.startTime));
    // Snap to 15 min, clamp to [0, 24h - dur]
    const snap = Math.round(newStartMinRaw / 15) * 15;
    const startMin = Math.max(0, Math.min(snap, 24 * 60 - dur));
    const endMin = startMin + dur;
    const pad = (n: number) => String(n).padStart(2, "0");
    const startTime = `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}:00`;
    const endTime = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}:00`;
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



  const startD = weekDays[0];
  const endD = weekDays[6];
  const sameMonth = startD.getMonth() === endD.getMonth();
  const weekRangeLabel = sameMonth
    ? `Semaine du ${startD.getDate()} au ${endD.getDate()} ${monthNames[endD.getMonth()].toLowerCase()} ${endD.getFullYear()}`
    : `Semaine du ${startD.getDate()} ${monthNames[startD.getMonth()].toLowerCase()} au ${endD.getDate()} ${monthNames[endD.getMonth()].toLowerCase()} ${endD.getFullYear()}`;

  return (
    <div className="p-4 md:p-6 overflow-x-hidden max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-5 flex-wrap">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 2 }}>Planning</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{weekRangeLabel}</div>
        </div>

        {/* Studio toggle */}
        <div className="flex rounded-full p-1" style={{ backgroundColor: "var(--muted)" }}>
          {studios.map((s) => {
            const active = selectedStudios.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleStudio(s)}
                title={active ? "Cliquer pour masquer ce studio" : "Cliquer pour afficher ce studio"}
                className="rounded-full px-5 py-1.5 transition-colors"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: active ? "#fff" : "transparent",
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
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
                  backgroundColor: active ? "#fff" : "transparent",
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
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
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button className="px-2 py-1.5 hover:bg-[var(--muted)] transition-colors" style={{ fontSize: 12, fontWeight: 500, borderLeft: "0.5px solid var(--border)", borderRight: "0.5px solid var(--border)" }}>
                  {(() => {
                    const start = weekDays[0];
                    const end = weekDays[6];
                    const sameMonth = start.getMonth() === end.getMonth();
                    const sameYear = start.getFullYear() === end.getFullYear();
                    const startStr = sameMonth
                      ? `${start.getDate()}`
                      : `${start.getDate()} ${monthNames[start.getMonth()]}${sameYear ? "" : ` ${start.getFullYear()}`}`;
                    const endStr = `${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
                    return `${startStr} – ${endStr}`;
                  })()}
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-auto p-2">
                <div className="flex items-center justify-between px-2 pb-2">
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>Choisir une semaine</span>
                  <button
                    onClick={() => { goToday(); setCalOpen(false); }}
                    className="rounded-md px-2 py-1"
                    style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
                  >
                    Aujourd'hui
                  </button>
                </div>
                <Calendar
                  mode="single"
                  weekStartsOn={1}
                  showWeekNumber
                  selected={weekStart}
                  defaultMonth={weekStart}
                  onSelect={(d) => { if (d) { setWeekStart(mondayOf(d)); setCalOpen(false); } }}
                />
              </PopoverContent>
            </Popover>
            <button onClick={goNext} className="p-1.5" style={{ color: "var(--muted-foreground)" }}>
              <ChevronRight size={14} />
            </button>
          </div>
          <Link
            to="/planning/generate"
            className="rounded-xl flex items-center gap-2 transition-colors"
            style={{ height: 40, padding: "0 20px", fontSize: 13, fontWeight: 500, backgroundColor: "var(--primary)", color: "var(--primary-foreground)", textDecoration: "none" }}
          >
            <Sparkles size={16} /> Générer un planning
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

      {/* Bandeau publication — toujours visible */}
      <div className="rounded-xl border mb-3 px-5 py-3 flex items-center justify-between gap-4 flex-wrap"
        style={{ borderColor: draftCount > 0 ? "var(--coral)" : "var(--border)", backgroundColor: draftCount > 0 ? "var(--coral-light)" : "var(--card)", borderWidth: 1.5 }}>
        <div className="flex items-center gap-3" style={{ fontSize: 13 }}>
          <FileEdit size={18} style={{ color: draftCount > 0 ? "var(--coral-dark)" : "var(--muted-foreground)" }} />
          <div className="flex flex-col gap-0.5">
            <span style={{ fontWeight: 600, color: draftCount > 0 ? "var(--coral-dark)" : "var(--foreground)", fontSize: 14 }}>
              {draftCount > 0
                ? `${draftCount} shift${draftCount > 1 ? "s" : ""} à publier`
                : "Aucun shift à publier"}
              {conflictCount > 0 && ` · ${conflictCount} conflit${conflictCount > 1 ? "s" : ""}`}
            </span>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {draftCount > 0
                ? "Les employés ne sont pas encore notifiés — publie pour leur envoyer"
                : "Tous les shifts de la semaine sont déjà publiés"}
            </span>
          </div>
        </div>
        <button onClick={handlePublish} className="rounded-lg px-5 py-2.5 transition-transform hover:scale-[1.02]"
          style={{ fontSize: 13, fontWeight: 600, backgroundColor: draftCount > 0 ? "var(--coral)" : "var(--muted)", color: draftCount > 0 ? "#fff" : "var(--muted-foreground)", boxShadow: draftCount > 0 ? "0 4px 12px -2px color-mix(in oklab, var(--coral) 50%, transparent)" : "none" }}>
          Publier la semaine →
        </button>
      </div>


      {/* Zoom slider (vue calendrier) */}
      <PlanningCalendar
        weekDays={weekDays}
        visibleDayIndices={visibleDayIndices}
        todayIdx={todayIdx}
        studioShifts={studioShifts}
        viewMode={viewMode}
        onEdit={(s) => setEditShift(s)}
        onReassign={(s) => setHoleShift(s)}
        onDelete={(s) => handleDeleteShift(s.id)}
      />


      {/* Footer summary */}
      <div
        className="rounded-xl border mt-4 px-5 py-3 flex items-center justify-between gap-4 flex-wrap"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <div className="flex items-center gap-3" style={{ fontSize: 12 }}>
          <span style={{ fontWeight: 500 }}>
            Semaine {selectedStudios.size === studios.length
              ? "tous studios"
              : Array.from(selectedStudios).map((s) => s.replace("Skult ", "")).join(" + ")}
          </span>
          <span style={{ color: "var(--muted-foreground)" }}>·</span>
          <span style={{ color: "var(--muted-foreground)" }}>{realShifts.length} shifts planifiés</span>
          {holes.length > 0 && (
            <>
              <span style={{ color: "var(--muted-foreground)" }}>·</span>
              <Link
                to="/trous"
                search={{
                  studios: Array.from(selectedStudios).map((s) => s.replace(/^Skult\s+/i, "")).join(","),
                  week: weekStart.toISOString().slice(0, 10),
                }}
                style={{ color: "var(--coral-dark)", fontWeight: 500, textDecoration: "underline" }}
              >
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
          {published && (
            <span className="rounded-md px-3 py-1.5"
              style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
              ✓ Publié
            </span>
          )}
        </div>
      </div>

      {/* Modals */}

      {editShift && (
        <EditShiftModal
          shift={{
            id: editShift.id,
            employeeId: editShift.employeeId,
            role: editShift.role,
            studioId: editShift.studioId,
            shiftDate: editShift.shiftDate,
            startTime: editShift.startTime,
            endTime: editShift.endTime,
            roleSegments: editShift.roleSegments ?? null,
          }}

          onClose={() => setEditShift(null)}
          onSaved={refresh}
        />
      )}
      {holeShift && (
        <FillHoleModal
          shift={holeShift}
          employees={employees}
          onClose={() => setHoleShift(null)}
          onFill={(empId) => handleFillHole(holeShift.id, empId)}
        />
      )}
      {showAdd && (
        <AddShiftModal
          studio={selectedStudio}
          employees={employees}
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
              Tu vas publier <strong>{draftCount} shift{draftCount > 1 ? "s" : ""} non encore notifié{draftCount > 1 ? "s" : ""}</strong>. Les employés concernés recevront une notification dans l'app.
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
function AddShiftModal({ studio, employees, onClose, onAdd }: { studio: Studio; employees: EmployeeLite[]; onClose: () => void; onAdd: (empId: string, day: number, slot: number, role: Role) => void }) {
  const { names: roles } = useBusinessRoles({ onlyActive: true });
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(0);
  const [role, setRole] = useState<Role>(roles[0] ?? "");
  const [empId, setEmpId] = useState("");
  useEffect(() => { if (!role && roles.length) setRole(roles[0]); }, [roles.join(",")]);

  const eligible = useMemo(() => employees.filter((e) => e.roles.includes(role)), [employees, role]);

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

// ────────────────────────────────────────────────────────────
// PlanningCalendar — vue "Google Calendar"
// Axe Y = heures, axe X = jours, blocs absolute positionnés.
// Chevauchements résolus en sous-colonnes par cluster.
// TODO drag&drop: réactiver le drag&drop @dnd-kit sur les blocs absolute.
// ────────────────────────────────────────────────────────────

const HOUR_PX = 40;
const TIME_COL_PX = 56;
const DEFAULT_COL_PX = 180;
const MIN_COL_PX = 80;
const MAX_COL_PX = 600;
const COL_WIDTHS_KEY = "kadence_planning_column_widths";

function minOf(t: string): number {
  const [h, m] = String(t).slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function fmtHHMM(t: string): string {
  const s = String(t).slice(0, 5);
  return s.endsWith(":00") ? `${s.slice(0, 2)}h` : s.replace(":", "h");
}
function durLabel(s: PlanningShift): string {
  const m = Math.max(0, minOf(s.endTime) - minOf(s.startTime));
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h${String(r).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${r}min`;
}

interface LaidOut {
  shift: PlanningShift;
  col: number;
  clusterCols: number;
}

function layoutDay(shifts: PlanningShift[]): LaidOut[] {
  const sorted = [...shifts].sort(
    (a, b) =>
      String(a.startTime).localeCompare(String(b.startTime)) ||
      String(a.endTime).localeCompare(String(b.endTime)),
  );
  const out: LaidOut[] = [];
  let cluster: LaidOut[] = [];
  let clusterEnd = -1;
  const finalize = () => {
    if (!cluster.length) return;
    const cols = Math.max(1, ...cluster.map((i) => i.col + 1));
    for (const it of cluster) it.clusterCols = cols;
    cluster = [];
    clusterEnd = -1;
  };
  for (const sh of sorted) {
    const sM = minOf(sh.startTime);
    const eM = minOf(sh.endTime);
    if (cluster.length && sM >= clusterEnd) finalize();
    let col = 0;
    while (cluster.some((it) => it.col === col && minOf(it.shift.endTime) > sM)) col++;
    const item: LaidOut = { shift: sh, col, clusterCols: 1 };
    cluster.push(item);
    out.push(item);
    clusterEnd = Math.max(clusterEnd, eM);
  }
  finalize();
  return out;
}

function PlanningCalendar({
  weekDays,
  visibleDayIndices,
  todayIdx,
  studioShifts,
  viewMode,
  onEdit,
  onReassign,
  onDelete,
}: {
  weekDays: Date[];
  visibleDayIndices: number[];
  todayIdx: number;
  studioShifts: PlanningShift[];
  viewMode: ViewMode;
  onEdit: (s: PlanningShift) => void;
  onReassign: (s: PlanningShift) => void;
  onDelete: (s: PlanningShift) => void;
}) {
  // Largeurs personnalisées par colonne jour (clé = dayIdx 0-6), persistées en localStorage
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(COL_WIDTHS_KEY);
      return raw ? (JSON.parse(raw) as Record<number, number>) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(columnWidths));
    }
  }, [columnWidths]);

  const resizingRef = useRef<{ dayIdx: number; startX: number; startW: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const startResize = useCallback(
    (dayIdx: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startW = columnWidths[dayIdx] ?? DEFAULT_COL_PX;
      resizingRef.current = { dayIdx, startX: e.clientX, startW };
      setIsResizing(true);
      const prevCursor = document.body.style.cursor;
      const prevUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      const onMove = (ev: MouseEvent) => {
        const ctx = resizingRef.current;
        if (!ctx) return;
        const next = Math.max(MIN_COL_PX, Math.min(MAX_COL_PX, ctx.startW + (ev.clientX - ctx.startX)));
        setColumnWidths((prev) => ({ ...prev, [ctx.dayIdx]: next }));
      };
      const onUp = () => {
        resizingRef.current = null;
        setIsResizing(false);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevUserSelect;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [columnWidths],
  );

  const widthOf = useCallback(
    (dayIdx: number) => columnWidths[dayIdx] ?? DEFAULT_COL_PX,
    [columnWidths],
  );
  void viewMode; // réservé pour adaptation mobile future

  // Plage horaire dynamique : extension si shifts hors 7h-23h
  const { startHour, endHour } = useMemo(() => {
    let s = 6, e = 23;
    for (const sh of studioShifts) {
      const sm = minOf(sh.startTime), em = minOf(sh.endTime);
      s = Math.min(s, Math.floor(sm / 60));
      e = Math.max(e, Math.ceil(em / 60));
    }
    return { startHour: Math.max(0, s), endHour: Math.min(24, Math.max(e, s + 1)) };
  }, [studioShifts]);
  const totalHours = endHour - startHour;
  const gridHeight = totalHours * HOUR_PX;

  const shiftsByDay = useMemo(() => {
    const map = new Map<number, LaidOut[]>();
    for (const idx of visibleDayIndices) {
      map.set(idx, layoutDay(studioShifts.filter((s) => s.day === idx)));
    }
    return map;
  }, [studioShifts, visibleDayIndices]);

  const colTrack = (idx: number) => `minmax(0, ${widthOf(idx)}fr)`;
  const gridCols = `${TIME_COL_PX}px ${visibleDayIndices.map(colTrack).join(" ")}`;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <div style={{ overflowX: "hidden", userSelect: isResizing ? "none" : undefined }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridCols,
              minWidth: 0,
              width: "100%",
            }}
          >
            <div
              style={{
                borderBottom: "0.5px solid var(--border)",
                borderRight: "0.5px solid var(--border)",
                backgroundColor: "var(--muted)",
                height: 56,
              }}
            />
            {visibleDayIndices.map((dayIdx) => {
              const d = weekDays[dayIdx];
              const isToday = dayIdx === todayIdx;
              const dayShifts = studioShifts.filter((s) => s.day === dayIdx);
              // Compteur = nb total de shifts du jour (tous studios sélectionnés, trous inclus)
              // Heures cumulées = somme des heures des employés assignés (hors trous)
              const assignedShifts = dayShifts.filter((s) => !s.hole);
              const totalMin = assignedShifts.reduce(
                (sum, s) => sum + Math.max(0, minOf(s.endTime) - minOf(s.startTime)),
                0,
              );
              const totalH = Math.round((totalMin / 60) * 10) / 10;
              return (
                <div
                  key={`h-${dayIdx}`}
                  style={{
                    position: "relative",
                    borderBottom: "0.5px solid var(--border)",
                    borderRight: "0.5px solid var(--border)",
                    padding: "8px 10px",
                    backgroundColor: isToday ? "var(--coral-light)" : "var(--muted)",
                    height: 56,
                  }}
                >
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {dayNamesShort[d.getDay()]}
                  </div>
                  <div className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 500, marginTop: 1 }}>
                    {d.getDate()} {monthNames[d.getMonth()].toLowerCase()}
                    {isToday && <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: "var(--coral)" }} />}
                    <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 400, marginLeft: "auto" }}>
                      {dayShifts.length} · {totalH}h
                    </span>
                  </div>
                  {/* Poignée de redimensionnement (style Excel) */}
                  <div
                    onMouseDown={(e) => startResize(dayIdx, e)}
                    onDoubleClick={() => {
                      setColumnWidths((prev) => {
                        const next = { ...prev };
                        delete next[dayIdx];
                        return next;
                      });
                    }}
                    title="Glisser pour redimensionner · Double-clic pour réinitialiser"
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      right: -3,
                      width: 6,
                      cursor: "col-resize",
                      zIndex: 10,
                      backgroundColor: "transparent",
                      transition: "background-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--border)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
                    }}
                  />
                </div>
              );
            })}

            <div
              style={{
                position: "relative",
                height: gridHeight,
                borderRight: "0.5px solid var(--border)",
                backgroundColor: "var(--background)",
              }}
            >
              {Array.from({ length: totalHours }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: i * HOUR_PX + 2,
                    right: 6,
                    fontSize: 10,
                    lineHeight: 1,
                    color: "var(--muted-foreground)",
                  }}
                >
                  {String(startHour + i).padStart(2, "0")}h
                </div>
              ))}
            </div>

            {visibleDayIndices.map((dayIdx) => {
              const isToday = dayIdx === todayIdx;
              const items = shiftsByDay.get(dayIdx) ?? [];
              return (
                <div
                  key={`d-${dayIdx}`}
                  style={{
                    position: "relative",
                    height: gridHeight,
                    borderRight: "0.5px solid var(--border)",
                    backgroundColor: isToday
                      ? "color-mix(in oklab, var(--coral-light) 30%, transparent)"
                      : "transparent",
                  }}
                >
                  {Array.from({ length: totalHours }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        top: i * HOUR_PX,
                        left: 0,
                        right: 0,
                        height: 1,
                        borderTop: "0.5px solid var(--border)",
                        opacity: 0.6,
                      }}
                    />
                  ))}
                  {items.map(({ shift, col, clusterCols }) => {
                    const sM = minOf(shift.startTime);
                    const eM = minOf(shift.endTime);
                    const top = ((sM - startHour * 60) / 60) * HOUR_PX;
                    const height = Math.max(22, ((eM - sM) / 60) * HOUR_PX - 2);
                    const gap = 3;
                    const trackPct = 100 / clusterCols;
                    const leftPad = col === 0 ? 2 : gap / 2;
                    const rightPad = col === clusterCols - 1 ? 2 : gap / 2;
                    const left = `calc(${col * trackPct}% + ${leftPad}px)`;
                    const width = `calc(${trackPct}% - ${leftPad + rightPad}px)`;
                    return (
                      <ShiftBlock
                        key={shift.id}
                        shift={shift}
                        top={top}
                        height={height}
                        left={left}
                        width={width}
                        onEdit={onEdit}
                        onReassign={onReassign}
                        onDelete={onDelete}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShiftBlock({
  shift,
  top,
  height,
  left,
  width,
  onEdit,
  onReassign,
  onDelete,
}: {
  shift: PlanningShift;
  top: number;
  height: number;
  left: number | string;
  width: number | string;
  onEdit: (s: PlanningShift) => void;
  onReassign: (s: PlanningShift) => void;
  onDelete: (s: PlanningShift) => void;
}) {
  const style = getRoleStyle(shift.role);
  const isHole = shift.hole;
  const bg = isHole ? "var(--coral-light)" : style.bg;
  const fg = isHole ? "var(--coral-dark)" : style.text;
  const accent = isHole ? "var(--coral)" : style.dot;
  const initials = shift.name
    ? shift.name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "··";
  const compact = height < 44;
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          style={{
            position: "absolute",
            top,
            left,
            width,
            height,
            backgroundColor: bg,
            color: fg,
            borderLeft: `3px solid ${accent}`,
            borderRadius: 6,
            padding: compact ? "3px 6px" : "4px 6px 4px 8px",
            textAlign: "left",
            overflow: "hidden",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "flex-start",
            boxShadow: shift.conflict
              ? "0 0 0 1px var(--danger-text)"
              : shift.isDraft
                ? "inset 0 0 0 1px var(--muted-foreground)"
                : "none",
            opacity: shift.isDraft ? 0.82 : 1,
          }}
        >
          <div
            className="flex items-center gap-1"
            style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}
          >
            {shift.isLocked && <Lock size={9} style={{ flexShrink: 0 }} />}
            {shift.conflict && (
              <AlertTriangle size={9} style={{ color: "var(--danger-text)", flexShrink: 0 }} />
            )}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {isHole ? "Trou" : shift.name || initials}
            </span>
          </div>
          {!compact && (
            <>
              <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.85, marginTop: 1 }}>{shift.role}</div>
              <div style={{ fontSize: 9, opacity: 0.7, marginTop: 1 }}>
                {fmtHHMM(shift.startTime)} — {fmtHHMM(shift.endTime)}
              </div>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        collisionPadding={12}
        style={{
          width: 280,
          padding: 0,
          backgroundColor: "var(--card)",
          border: "0.5px solid var(--border)",
        }}
      >
        <div className="px-4 py-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
          {isHole ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Trou — aucun employé assigné</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{shift.role}</div>
            </div>
          ) : (
            <>
              <Link
                to="/staff/$id"
                params={{ id: shift.employeeId }}
                style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}
              >
                {shift.name || "—"}
              </Link>
              <div className="mt-1.5">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
                  style={{ fontSize: 10, fontWeight: 500, backgroundColor: style.bg, color: style.text }}
                >
                  <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: style.dot }} />
                  {shift.role}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 flex flex-col gap-1.5" style={{ fontSize: 12 }}>
          <Row label="Début" value={fmtHHMM(shift.startTime)} />
          <Row label="Fin" value={fmtHHMM(shift.endTime)} />
          <Row label="Durée" value={durLabel(shift)} />
          <Row label="Studio" value={shift.studio || "—"} />
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted-foreground)" }}>Statut</span>
            <StatusBadge shift={shift} />
          </div>
        </div>

        <div className="flex gap-2 px-4 py-3" style={{ borderTop: "0.5px solid var(--border)" }}>
          {isHole ? (
            <>
              <button
                onClick={() => {
                  setOpen(false);
                  if (confirm("Supprimer définitivement ce trou ? Les propositions en attente seront annulées.")) {
                    onDelete(shift);
                  }
                }}
                className="rounded-md px-2.5 py-2"
                style={{ fontSize: 12, border: "0.5px solid var(--border)", color: "var(--danger-text)" }}
                aria-label="Supprimer"
                title="Supprimer ce trou"
              >
                <Trash2 size={13} />
              </button>
              <Link
                to="/trous"
                search={{ shift: shift.id } as never}
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md px-3 py-2 text-center"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: "var(--coral)",
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Envoyer une proposition
              </Link>
            </>

          ) : (
            <>
              <button
                onClick={() => {
                  setOpen(false);
                  const who = shift.name ? ` de ${shift.name}` : "";
                  if (confirm(`Supprimer définitivement ce shift${who} ? L'employé sera notifié si le shift était publié.`)) {
                    onDelete(shift);
                  }
                }}
                className="rounded-md px-2.5 py-2"
                style={{ fontSize: 12, border: "0.5px solid var(--border)", color: "var(--danger-text)" }}
                aria-label="Supprimer"
                title="Supprimer ce shift"
              >
                <Trash2 size={13} />
              </button>

              <button
                onClick={() => { setOpen(false); onReassign(shift); }}
                className="flex-1 rounded-md px-3 py-2 flex items-center justify-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}
              >
                <UserPlus size={13} /> Réassigner
              </button>
              <button
                onClick={() => { setOpen(false); onEdit(shift); }}
                className="flex-1 rounded-md px-3 py-2 flex items-center justify-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
              >
                <Pencil size={13} /> Modifier
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function StatusBadge({ shift }: { shift: PlanningShift }) {
  let label = "Confirmé";
  let bg = "var(--success-bg)", fg = "var(--success-text)";
  if (shift.isDraft) { label = "Brouillon"; bg = "var(--muted)"; fg = "var(--muted-foreground)"; }
  else if (shift.confirmation === "en-attente") { label = "En attente"; bg = "var(--warning-bg)"; fg = "var(--warning-text)"; }
  else if (shift.confirmation === "refusé") { label = "Refusé"; bg = "var(--danger-bg)"; fg = "var(--danger-text)"; }
  return (
    <span
      className="rounded-full px-2 py-0.5"
      style={{ fontSize: 10, fontWeight: 500, backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}
