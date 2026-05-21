import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, PrimaryButton } from "./shared";
import { CheckCircle2, Plus, X, Lock } from "lucide-react";
import { createAvailability, updateAvailability, deleteAvailability, getAvailabilityDeadline } from "@/lib/availabilities.functions";

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// Créneaux horaires (pas de 30 min)
const HOURS: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 23; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();

interface Range {
  id?: string; // db id (existant) ou undefined (nouveau)
  start: string; // HH:MM
  end: string;   // HH:MM
}

export function disposKey(userId: string, year: number, month: number) {
  return `dispos_validated_${userId}_${year}_${String(month + 1).padStart(2, "0")}`;
}

export function DisposSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const monthRef = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d;
  }, []);
  const year = monthRef.getFullYear();
  const month = monthRef.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = monthRef.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const [ranges, setRanges] = useState<Record<number, Range[]>>({});
  const [loading, setLoading] = useState(true);
  const [validated, setValidated] = useState(false);
  const [deadline, setDeadline] = useState<{ days_left: number; passed: boolean; deadline_day: number; planning_published?: boolean } | null>(null);

  const createFn = useServerFn(createAvailability);
  const updateFn = useServerFn(updateAvailability);
  const deleteFn = useServerFn(deleteAvailability);
  const deadlineFn = useServerFn(getAvailabilityDeadline);

  const dateISO = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  useEffect(() => {
    if (!open) return;
    const flag = typeof window !== "undefined" ? localStorage.getItem(disposKey(userId, year, month)) : null;
    setValidated(!!flag);
    deadlineFn().then((d: any) => setDeadline(d)).catch(() => {});
    (async () => {
      setLoading(true);
      const start = dateISO(1);
      const end = dateISO(daysInMonth);
      const { data } = await supabase
        .from("availabilities")
        .select("id, avail_date, start_time, end_time")
        .eq("user_id", userId)
        .gte("avail_date", start)
        .lte("avail_date", end);
      const map: Record<number, Range[]> = {};
      data?.forEach((r) => {
        const d = parseInt(r.avail_date.slice(8, 10), 10);
        if (!map[d]) map[d] = [];
        map[d].push({
          id: r.id,
          start: String(r.start_time).slice(0, 5),
          end: String(r.end_time).slice(0, 5),
        });
      });
      setRanges(map);
      setLoading(false);
    })();
  }, [open, userId, year, month, daysInMonth]);

  const planningPublished = deadline?.planning_published ?? false;
  const locked = validated || planningPublished;

  // Convertit "HH:MM" en minutes pour comparaison
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  // Détecte un chevauchement entre une plage candidate et les plages existantes (en excluant éventuellement un index)
  const overlapsExisting = (day: number, start: string, end: string, excludeIdx?: number) => {
    const s = toMin(start);
    const e = toMin(end);
    if (e <= s) return "invalid";
    const list = ranges[day] ?? [];
    for (let i = 0; i < list.length; i++) {
      if (i === excludeIdx) continue;
      const rs = toMin(list[i].start);
      const re = toMin(list[i].end);
      if (s < re && rs < e) return "overlap";
    }
    return null;
  };

  const addRange = async (day: number) => {
    if (locked) return;
    // Cherche un créneau de 4h libre, sinon fallback 9h-13h
    let newRange: Range = { start: "09:00", end: "13:00" };
    const candidates: Range[] = [
      { start: "09:00", end: "13:00" },
      { start: "13:00", end: "17:00" },
      { start: "17:00", end: "21:00" },
      { start: "06:00", end: "09:00" },
      { start: "21:00", end: "23:30" },
    ];
    const free = candidates.find(c => !overlapsExisting(day, c.start, c.end));
    if (free) newRange = free;
    else {
      toast.error("Aucun créneau libre — ajuste les plages existantes");
      return;
    }
    try {
      const res: any = await createFn({ data: { avail_date: dateISO(day), start_time: newRange.start, end_time: newRange.end } });
      setRanges((p) => ({ ...p, [day]: [...(p[day] ?? []), { ...newRange, id: res.id }] }));
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de sauvegarde");
    }
  };

  const updateRange = async (day: number, idx: number, patch: Partial<Range>) => {
    if (locked) return;
    const list = ranges[day] ?? [];
    const updated = { ...list[idx], ...patch };
    if (!updated.id) return;
    const conflict = overlapsExisting(day, updated.start, updated.end, idx);
    if (conflict === "invalid") {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }
    if (conflict === "overlap") {
      toast.error("Cette plage chevauche une autre plage du même jour");
      return;
    }
    try {
      await updateFn({ data: { id: updated.id, start_time: updated.start, end_time: updated.end } });
      setRanges((p) => ({ ...p, [day]: list.map((r, i) => (i === idx ? updated : r)) }));
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  };

  const removeRange = async (day: number, idx: number) => {
    if (locked) return;
    const list = ranges[day] ?? [];
    const target = list[idx];
    if (!target.id) return;
    try {
      await deleteFn({ data: { id: target.id } });
      setRanges((p) => ({ ...p, [day]: list.filter((_, i) => i !== idx) }));
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  };

  const configured = Object.values(ranges).filter((r) => r.length > 0).length;

  const validate = () => {
    if (configured === 0) {
      toast.error("Indique au moins une disponibilité");
      return;
    }
    localStorage.setItem(disposKey(userId, year, month), new Date().toISOString());
    setValidated(true);
    toast.success("Dispos envoyées pour " + monthLabel);
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Dispos · ${monthLabel}`}>
      {validated ? (
        <div className="rounded-xl px-4 py-6 flex flex-col items-center gap-3 mb-3" style={{ backgroundColor: "var(--success-bg)" }}>
          <CheckCircle2 size={36} style={{ color: "var(--success-text)" }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--success-text)" }}>Dispos envoyées</div>
          <div style={{ fontSize: 12, color: "var(--success-text)", textAlign: "center", textTransform: "capitalize" }}>
            Tes dispos pour {monthLabel} ont été envoyées.
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>
            L'admin va générer le planning sous 24-48h. Tu pourras à nouveau modifier tes dispos le mois prochain.
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12, lineHeight: 1.5 }}>
            Indique tes plages horaires de disponibilité pour <span style={{ textTransform: "capitalize" }}>{monthLabel}</span>. Tu peux ajouter plusieurs plages par jour.
          </div>
          {deadline && (
            <div
              className="rounded-xl px-3 py-2 mb-2 flex items-center gap-2"
              style={{
                backgroundColor: deadline.passed
                  ? "var(--danger-bg)"
                  : deadline.days_left <= 3
                  ? "var(--warning-bg)"
                  : "var(--muted)",
              }}
            >
              {(deadline.passed || deadline.days_left <= 3) && <Lock size={12} style={{ color: deadline.passed ? "var(--danger-text)" : "var(--warning-text)" }} />}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: deadline.passed
                    ? "var(--danger-text)"
                    : deadline.days_left <= 3
                    ? "var(--warning-text)"
                    : "var(--muted-foreground)",
                }}
              >
                {deadline.passed
                  ? `Deadline dépassée (le ${deadline.deadline_day} du mois). Édition verrouillée.`
                  : deadline.days_left === 0
                  ? `Dernier jour pour valider (deadline aujourd'hui)`
                  : `Plus que ${deadline.days_left} jour${deadline.days_left > 1 ? "s" : ""} avant la deadline (le ${deadline.deadline_day} du mois)`}
              </span>
            </div>
          )}
          <div className="rounded-xl px-3 py-2 mb-3" style={{ backgroundColor: configured >= 10 ? "var(--success-bg)" : "var(--warning-bg)" }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: configured >= 10 ? "var(--success-text)" : "var(--warning-text)" }}>
              {configured} / {daysInMonth} jours configurés
            </span>
          </div>
        </>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-3" style={{ opacity: validated ? 0.6 : 1, pointerEvents: validated ? "none" : "auto" }}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dow = DAY_NAMES[new Date(year, month, day).getDay()];
            const dayRanges = ranges[day] ?? [];
            return (
              <div key={day} className="rounded-lg border px-3 py-2" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{dow} {day}</div>
                  <button
                    onClick={() => addRange(day)}
                    className="flex items-center gap-1 rounded-md px-2 py-0.5"
                    style={{ fontSize: 10, color: "var(--coral)", border: "0.5px solid var(--coral)" }}
                  >
                    <Plus size={11} /> Ajouter
                  </button>
                </div>
                {dayRanges.length === 0 ? (
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontStyle: "italic" }}>Aucune dispo</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {dayRanges.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <select
                          value={r.start}
                          onChange={(e) => updateRange(day, idx, { start: e.target.value })}
                          className="rounded-md px-1.5 py-0.5"
                          style={{ fontSize: 11, border: "0.5px solid var(--border)", backgroundColor: "#fff" }}
                        >
                          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>→</span>
                        <select
                          value={r.end}
                          onChange={(e) => updateRange(day, idx, { end: e.target.value })}
                          className="rounded-md px-1.5 py-0.5"
                          style={{ fontSize: 11, border: "0.5px solid var(--border)", backgroundColor: "#fff" }}
                        >
                          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <button
                          onClick={() => removeRange(day, idx)}
                          className="ml-auto rounded-md p-1"
                          style={{ color: "var(--muted-foreground)" }}
                          aria-label="Supprimer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!validated && !loading && (
        <PrimaryButton onClick={validate}>Valider mes dispos</PrimaryButton>
      )}
    </Sheet>
  );
}
