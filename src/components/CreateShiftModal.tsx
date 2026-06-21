import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { X, Send, AlertTriangle, ChevronDown, ChevronUp, UserCheck, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStudioBusinessRoles } from "@/hooks/use-studio-business-roles";
import { getRoleStyle, fullName } from "@/lib/staff-helpers";
import { getEligibleEmployeesForShift, type EligibleEmployee } from "@/lib/shift-eligibility.functions";
import { sendProposalsToShifts } from "@/lib/proposals.functions";
import { assignShiftsDirect } from "@/lib/shifts.functions";
import { RoleSegmentsEditor } from "@/components/admin/RoleSegmentsEditor";
import { validateRoleSegments, type RoleSegment } from "@/lib/role-segments";


interface Studio { id: string; name: string }

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

type Step = "form" | "recipients";

function timeToMin(t: string): number {
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day - 1));
  return monday.toISOString().slice(0, 10);
}

export function CreateShiftModal({ open, onClose, onCreated }: Props) {
  const eligibilityFn = useServerFn(getEligibleEmployeesForShift);
  const sendFn = useServerFn(sendProposalsToShifts);
  const assignFn = useServerFn(assignShiftsDirect);


  const [studios, setStudios] = useState<Studio[]>([]);
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [studioId, setStudioId] = useState("");
  const { names: BUSINESS_ROLES } = useStudioBusinessRoles(studioId || null);
  const [role, setRole] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("15:00");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "biweekly" | "monthly">("none");
  const [until, setUntil] = useState("");
  const [extraWeekdays, setExtraWeekdays] = useState<Set<number>>(new Set());


  // step 2 state
  const [shiftIds, setShiftIds] = useState<string[]>([]);
  const [createdCount, setCreatedCount] = useState(0);
  const [loadingElig, setLoadingElig] = useState(false);
  const [eligible, setEligible] = useState<EligibleEmployee[]>([]);
  const [partial, setPartial] = useState<EligibleEmployee[]>([]);
  const [showPartial, setShowPartial] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    supabase.from("studios").select("id, name").then(({ data }) => {
      if (data) {
        setStudios(data);
        if (data.length && !studioId) setStudioId(data[0].id);
      }
    });
  }, [open]);

  // Aligne le rôle sélectionné avec les rôles du studio courant
  useEffect(() => {
    if (BUSINESS_ROLES.length === 0) { setRole(""); return; }
    if (!role || !BUSINESS_ROLES.includes(role)) setRole(BUSINESS_ROLES[0]);
  }, [BUSINESS_ROLES.join("|")]);

  const resetAll = () => {
    setStep("form");
    setNotes(""); setStartTime("10:00"); setEndTime("15:00");
    setRecurrence("none"); setUntil(""); setExtraWeekdays(new Set());
    setShiftIds([]); setCreatedCount(0);
    setEligible([]); setPartial([]); setSelected(new Set()); setShowPartial(false);
  };


  const handleClose = () => {
    if (step === "recipients" && shiftIds.length > 0 && selected.size === 0) {
      toast(`${shiftIds.length > 1 ? "Shifts créés" : "Shift créé"} comme trou${shiftIds.length > 1 ? "s" : ""}`, { description: "Tu peux les traiter dans l'écran Trous." });
    }
    resetAll();
    onClose();
  };

  const buildDates = (): string[] => {
    const start = new Date(date + "T00:00:00");
    if (recurrence === "none" || !until) return [date];
    const end = new Date(until + "T00:00:00");
    if (end < start) return [date];
    const out: string[] = [];
    const toIso = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    if (recurrence === "monthly") {
      const cur = new Date(start);
      let safety = 0;
      while (cur <= end && safety++ < 200) {
        out.push(toIso(cur));
        cur.setMonth(cur.getMonth() + 1);
      }
      return out;
    }

    // weekly / biweekly — include start weekday + extraWeekdays
    const startWd = start.getDay();
    const wds = new Set<number>([startWd, ...Array.from(extraWeekdays)]);
    const stepDays = recurrence === "weekly" ? 7 : 14;
    // Anchor each weekday to its first occurrence on/after start, then repeat by stepDays
    const seen = new Set<string>();
    wds.forEach((wd) => {
      const first = new Date(start);
      const diff = (wd - startWd + 7) % 7;
      first.setDate(first.getDate() + diff);
      const cur = new Date(first);
      let safety = 0;
      while (cur <= end && safety++ < 200) {
        const iso = toIso(cur);
        if (!seen.has(iso)) { seen.add(iso); out.push(iso); }
        cur.setDate(cur.getDate() + stepDays);
      }
    });
    out.sort();
    return out;
  };


  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (endTime <= startTime) return toast.error("L'heure de fin doit être après le début");
    if (recurrence !== "none" && !until) return toast.error("Indiquez une date de fin de répétition");

    const dates = buildDates();
    setSubmitting(true);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("shifts")
      .insert(
        dates.map((d) => ({
          user_id: null,
          studio_id: studioId || null,
          business_role: role,
          shift_date: d,
          start_time: startTime,
          end_time: endTime,
          notes: notes || null,
          is_manual: true,
          is_locked: false,
          status: "scheduled",
          published_at: nowIso,
        })),
      )
      .select("id, shift_date")
      .order("shift_date", { ascending: true });

    if (error || !data || data.length === 0) {
      setSubmitting(false);
      return toast.error(error?.message || "Erreur création");
    }

    const ids = data.map((row) => row.id);
    setShiftIds(ids);
    setCreatedCount(data.length);
    onCreated?.();
    setStep("recipients");

    // charge l'éligibilité pour toute la série créée
    setLoadingElig(true);
    try {
      const results = await Promise.all(ids.map((id) => eligibilityFn({ data: { shiftId: id } })));
      const shiftDurationH = Math.max(0, (timeToMin(endTime) - timeToMin(startTime)) / 60);
      const seriesHoursByWeek = new Map<string, number>();
      dates.forEach((d) => {
        const key = isoWeekKey(d);
        seriesHoursByWeek.set(key, (seriesHoursByWeek.get(key) ?? 0) + shiftDurationH);
      });
      const weeklyHoursByUser = new Map<string, Map<string, number>>();
      const eligibleForAll = new Set(results[0]?.eligible.map((emp) => emp.id) ?? []);
      results.slice(1).forEach((r) => {
        const idsForShift = new Set(r.eligible.map((emp) => emp.id));
        Array.from(eligibleForAll).forEach((id) => {
          if (!idsForShift.has(id)) eligibleForAll.delete(id);
        });
      });

      const byId = new Map<string, EligibleEmployee>();
      results.forEach((r, index) => {
        const weekKey = isoWeekKey(dates[index]);
        [...r.eligible, ...r.partial].forEach((emp) => {
          const weeks = weeklyHoursByUser.get(emp.id) ?? new Map<string, number>();
          weeks.set(weekKey, emp.weekly_hours);
          weeklyHoursByUser.set(emp.id, weeks);
          const previous = byId.get(emp.id);
          if (!previous) {
            byId.set(emp.id, { ...emp, reasons: [...emp.reasons] });
            return;
          }
          byId.set(emp.id, {
            ...previous,
            weekly_hours: Math.max(previous.weekly_hours, emp.weekly_hours),
            max_weekly_hours: Math.min(previous.max_weekly_hours, emp.max_weekly_hours),
            pending_proposal: previous.pending_proposal || emp.pending_proposal,
            has_studio: previous.has_studio && emp.has_studio,
            has_availability: previous.has_availability && emp.has_availability,
            is_saturated: previous.is_saturated || emp.is_saturated,
            not_trained: previous.not_trained || emp.not_trained,
            reasons: Array.from(new Set([...previous.reasons, ...emp.reasons])),
          });
        });
      });

      const allRows = Array.from(byId.values()).map((emp) => {
        const hasSeriesCapacity = Array.from(seriesHoursByWeek.entries()).every(([week, addedHours]) => {
          const existingHours = weeklyHoursByUser.get(emp.id)?.get(week) ?? emp.weekly_hours;
          return existingHours + addedHours <= emp.max_weekly_hours;
        });
        if (hasSeriesCapacity) return emp;
        return {
          ...emp,
          is_saturated: true,
          reasons: Array.from(new Set([...emp.reasons, "saturé sur la série complète"])),
        };
      });
      setEligible(allRows.filter((emp) => eligibleForAll.has(emp.id) && !emp.pending_proposal && !emp.is_saturated));
      setPartial(allRows.filter((emp) => !eligibleForAll.has(emp.id) || emp.pending_proposal || emp.is_saturated));
    } catch (err: any) {
      toast.error(err.message || "Erreur calcul éligibilité");
    } finally {
      setLoadingElig(false);
      setSubmitting(false);
    }
  };

  const toggle = (uid: string, disabled: boolean) => {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const sendNow = async () => {
    if (shiftIds.length === 0 || selected.size === 0) return;
    setSubmitting(true);
    try {
      await sendFn({ data: { shiftIds, userIds: Array.from(selected) } });
      toast.success(`${shiftIds.length} proposition${shiftIds.length > 1 ? "s" : ""} envoyée${shiftIds.length > 1 ? "s" : ""} à ${selected.size} employé${selected.size > 1 ? "s" : ""}`);
      resetAll();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const assignNow = async () => {
    if (shiftIds.length === 0 || selected.size !== 1) return;
    const uid = Array.from(selected)[0];
    setSubmitting(true);
    try {
      await assignFn({ data: { shiftIds, userId: uid } });
      toast.success(`${shiftIds.length} shift${shiftIds.length > 1 ? "s" : ""} assigné${shiftIds.length > 1 ? "s" : ""} directement`);
      onCreated?.();
      resetAll();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur assignation");
    } finally {
      setSubmitting(false);
    }
  };


  if (!open) return null;

  const labelStyle = { fontSize: 12, fontWeight: 500 as const, color: "var(--muted-foreground)" };
  const inputCls = "mt-1 w-full rounded-md border px-3 py-2 outline-none";
  const inputStyle = { fontSize: 14, borderColor: "var(--border)", backgroundColor: "var(--background)" };

  const chip = (active: boolean) => ({
    fontSize: 12,
    fontWeight: active ? 500 as const : 400 as const,
    backgroundColor: active ? "var(--foreground)" : "transparent",
    color: active ? "var(--card)" : "var(--muted-foreground)",
    border: active ? "none" : "0.5px solid var(--border)",
  });

  const studioName = studios.find((s) => s.id === studioId)?.name || "—";
  const dateLabel = new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const roleStyle = getRoleStyle(role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={handleClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 500 }}>
              {step === "form" ? "Créer un shift" : "Choisir les destinataires"}
            </h2>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
              {step === "form"
                ? "Étape 1 / 2 — définir le besoin"
                : "Étape 2 / 2 — proposer à un ou plusieurs employés"}
            </p>
          </div>
          <button onClick={handleClose} className="p-1 rounded hover:bg-[var(--muted)]"><X size={18} /></button>
        </div>

        {step === "form" && (
          <form onSubmit={submitForm} className="p-5 space-y-4">
            <div>
              <label style={labelStyle}>Studio</label>
              <div className="flex flex-wrap gap-1 mt-2">
                {studios.map((s) => (
                  <button key={s.id} type="button" onClick={() => setStudioId(s.id)}
                    className="rounded-full px-2.5 py-1 transition-colors" style={chip(studioId === s.id)}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Poste *</label>
              {BUSINESS_ROLES.length === 0 ? (
                <div className="mt-2 rounded-md px-3 py-2"
                  style={{ fontSize: 12, color: "var(--muted-foreground)", border: "0.5px dashed var(--border)" }}>
                  Sélectionne d'abord un studio configuré avec des rôles métier.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1 mt-2">
                  {BUSINESS_ROLES.map((r: string) => (
                    <button key={r} type="button" onClick={() => setRole(r)}
                      className="rounded-full px-2.5 py-1 transition-colors" style={chip(role === r)}>
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div><label style={labelStyle}>Date *</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle} required /></div>
              <div><label style={labelStyle}>Début *</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} style={inputStyle} required /></div>
              <div><label style={labelStyle}>Fin *</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} style={inputStyle} required /></div>
            </div>

            <div>
              <label style={labelStyle}>Répétition</label>
              <div className="flex flex-wrap gap-1 mt-2">
                {([
                  { v: "none", label: "Jamais" },
                  { v: "weekly", label: "Chaque semaine" },
                  { v: "biweekly", label: "Toutes les 2 semaines" },
                  { v: "monthly", label: "Chaque mois" },
                ] as const).map((opt) => (
                  <button key={opt.v} type="button" onClick={() => setRecurrence(opt.v)}
                    className="rounded-full px-2.5 py-1 transition-colors" style={chip(recurrence === opt.v)}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {recurrence !== "none" && (
                <div className="mt-3">
                  <label style={labelStyle}>Jusqu'au *</label>
                  <input type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)}
                    className={inputCls} style={inputStyle} required />
                </div>
              )}
              {(recurrence === "weekly" || recurrence === "biweekly") && (() => {
                const days = [
                  { wd: 1, label: "Lun" },
                  { wd: 2, label: "Mar" },
                  { wd: 3, label: "Mer" },
                  { wd: 4, label: "Jeu" },
                  { wd: 5, label: "Ven" },
                  { wd: 6, label: "Sam" },
                  { wd: 0, label: "Dim" },
                ];
                const startWd = new Date(date + "T00:00:00").getDay();
                return (
                  <div className="mt-3">
                    <label style={labelStyle}>Jours répétés (en plus du jour de base)</label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {days.map((d) => {
                        const isBase = d.wd === startWd;
                        const active = isBase || extraWeekdays.has(d.wd);
                        return (
                          <button
                            key={d.wd}
                            type="button"
                            disabled={isBase}
                            title={isBase ? "Jour de base (date sélectionnée)" : ""}
                            onClick={() => {
                              setExtraWeekdays((prev) => {
                                const n = new Set(prev);
                                if (n.has(d.wd)) n.delete(d.wd);
                                else n.add(d.wd);
                                return n;
                              });
                            }}
                            className="rounded-full px-2.5 py-1 transition-colors"
                            style={{ ...chip(active), opacity: isBase ? 0.6 : 1, cursor: isBase ? "default" : "pointer" }}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>
                      Ex : lundi + jeudi {recurrence === "weekly" ? "chaque semaine" : "toutes les 2 semaines"}.
                    </p>
                  </div>
                );
              })()}
            </div>


            <div>
              <label style={labelStyle}>Note (optionnel)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} style={inputStyle} placeholder="Briefing, info particulière..." />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={handleClose} className="rounded-md border px-4 py-2"
                style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)" }}>Annuler</button>
              <button type="submit" disabled={submitting} className="rounded-md px-4 py-2 disabled:opacity-50"
                style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                {submitting ? "Création..." : "Suivant : choisir les destinataires"}
              </button>
            </div>
          </form>
        )}

        {step === "recipients" && (
          <div className="p-5 space-y-4">
            {/* Récap */}
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, backgroundColor: roleStyle.bg, color: roleStyle.text }}>
                  {role}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>{dateLabel}</span>
                <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                  · {startTime} — {endTime} · {studioName}
                </span>
              </div>
              {createdCount > 1 && (
                <div className="mt-2 rounded-md px-2.5 py-1.5 flex items-center gap-1.5"
                  style={{ fontSize: 11, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
                  <AlertTriangle size={12} />
                  Série complète : les {createdCount} shifts seront proposés ou assignés ensemble.
                </div>
              )}
            </div>

            {loadingElig ? (
              <div className="py-8 text-center" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                Calcul de l'éligibilité…
              </div>
            ) : (
              <>
                <Section
                  title={`Éligibles (${eligible.length}) — triés par score`}
                  rows={eligible}
                  selected={selected}
                  onToggle={toggle}
                  shiftRole={role}
                />

                {partial.length > 0 && (
                  <div>
                    <button type="button" onClick={() => setShowPartial((v) => !v)}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--muted)]"
                      style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>
                      {showPartial ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {showPartial ? "Cacher" : "Voir aussi"} {partial.length} non éligible{partial.length > 1 ? "s" : ""}
                    </button>
                    {showPartial && (
                      <div className="mt-2">
                        <Section
                          title=""
                          rows={partial}
                          selected={selected}
                          onToggle={toggle}
                          shiftRole={role}
                          showReasons
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="flex justify-between gap-2 pt-2 border-t flex-wrap" style={{ borderColor: "var(--border)" }}>
              <button onClick={handleClose} className="rounded-md border px-4 py-2 mt-3"
                style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)" }}>
                Fermer sans envoyer
              </button>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button
                  onClick={assignNow}
                  disabled={selected.size !== 1 || submitting}
                  title={selected.size !== 1 ? "Sélectionnez exactement 1 employé pour l'assigner directement" : "Assigner directement sans envoyer de proposition"}
                  className="rounded-md border px-4 py-2 flex items-center gap-1.5 disabled:opacity-40"
                  style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--foreground)", color: "var(--foreground)" }}>
                  <UserCheck size={14} />
                  {submitting ? "…" : "Assigner directement"}
                </button>
                <button onClick={sendNow} disabled={selected.size === 0 || submitting}
                  className="rounded-md px-4 py-2 flex items-center gap-1.5 disabled:opacity-40"
                  style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}>
                  <Send size={14} />
                  {submitting ? "Envoi…" : `Envoyer la proposition à ${selected.size}`}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, rows, selected, onToggle, shiftRole, showReasons }: {
  title: string;
  rows: EligibleEmployee[];
  selected: Set<string>;
  onToggle: (uid: string, disabled: boolean) => void;
  shiftRole: string;
  showReasons?: boolean;
}) {
  return (
    <div>
      {title && (
        <div className="mb-2" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
        </div>
      )}
      {rows.length === 0 ? (
        <div className="py-4 text-center rounded-md border" style={{ fontSize: 12, color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
          Personne dans cette liste.
        </div>
      ) : (
        <div className="rounded-md border divide-y" style={{ borderColor: "var(--border)" }}>
          {rows.map((emp) => (
            <EmployeeRow key={emp.id} emp={emp} checked={selected.has(emp.id)}
              onToggle={onToggle} shiftRole={shiftRole} showReasons={showReasons} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeRow({ emp, checked, onToggle, shiftRole, showReasons }: {
  emp: EligibleEmployee;
  checked: boolean;
  onToggle: (uid: string, disabled: boolean) => void;
  shiftRole: string;
  showReasons?: boolean;
}) {
  const disabled = emp.pending_proposal;
  const reasons = useMemo(() => emp.reasons, [emp.reasons]);

  return (
    <div className="flex items-start gap-3 p-3" style={{ backgroundColor: disabled ? "var(--muted)" : "transparent" }}>
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={() => onToggle(emp.id, disabled)}
        className="mt-1 cursor-pointer disabled:cursor-not-allowed" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/staff/$id" params={{ id: emp.id }}
            style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", textDecoration: "underline", textDecorationColor: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = "var(--foreground)")}
            onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = "transparent")}>
            {fullName({ first_name: emp.first_name, last_name: emp.last_name })}
          </Link>
          {emp.score !== null && (
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {emp.score.toFixed(1)}/10
            </span>
          )}
          {disabled && (
            <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontStyle: "italic" }}>
              proposition déjà en attente
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap mt-1">
          {emp.business_roles.map((r) => {
            const st = getRoleStyle(r);
            const highlight = r === shiftRole;
            return (
              <span key={r} className="rounded-full px-2 py-0.5"
                style={{
                  fontSize: 10, fontWeight: highlight ? 600 : 400,
                  backgroundColor: st.bg, color: st.text,
                  outline: highlight ? `1.5px solid ${st.dot}` : "none",
                }}>
                {r}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {emp.contracts.length > 0 && <span>{emp.contracts.join(" · ")}</span>}
          <span>· {emp.weekly_hours}h cette semaine / {emp.max_weekly_hours}h max</span>
        </div>
        {showReasons && reasons.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1" style={{ fontSize: 11, color: "var(--coral-dark)" }}>
            <AlertTriangle size={11} />
            {reasons.join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
