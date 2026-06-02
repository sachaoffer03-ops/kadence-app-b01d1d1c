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
  const [deadline, setDeadline] = useState<{ days_left: number; passed: boolean; deadline_day: number; planning_published?: boolean; deadline_iso?: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const createFn = useServerFn(createAvailability);
  const updateFn = useServerFn(updateAvailability);
  const deleteFn = useServerFn(deleteAvailability);
  const deadlineFn = useServerFn(getAvailabilityDeadline);

  const dateISO = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  useEffect(() => {
    if (!open) return;
    let flag: string | null = null;
    try { if (typeof window !== "undefined") flag = window.localStorage?.getItem(disposKey(userId, year, month)) ?? null; } catch {}
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

  // Tick du compte à rebours
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const deadlineMs = deadline?.deadline_iso ? new Date(deadline.deadline_iso).getTime() : null;
  const msLeft = deadlineMs ? deadlineMs - now : null;
  const deadlinePassed = msLeft !== null ? msLeft <= 0 : !!deadline?.passed;
  const planningPublished = deadline?.planning_published ?? false;
  const locked = planningPublished || deadlinePassed;

  const formatCountdown = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (days > 0) return `${days}j ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };


  // Convertit "HH:MM" en minutes pour comparaison
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
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

  // Trouve le premier sous-créneau libre >= 4h dans la journée (entre 06:00 et 23:30)
  const findFirstFreeSlot = (day: number): { start: string; end: string } | null => {
    const MIN = 4 * 60; // 4 heures
    const DAY_START = 6 * 60;    // 06:00 — éviter du créneau 00:00-06:00 par défaut
    const DAY_END = 23 * 60 + 30; // 23:30
    const list = (ranges[day] ?? [])
      .map(r => ({ s: toMin(r.start), e: toMin(r.end) }))
      .sort((a, b) => a.s - b.s);
    let cursor = DAY_START;
    for (const r of list) {
      if (r.s - cursor >= MIN) {
        const start = cursor;
        const end = Math.min(start + Math.max(MIN, 4 * 60), r.s);
        return { start: fmtMin(start), end: fmtMin(end) };
      }
      cursor = Math.max(cursor, r.e);
    }
    if (DAY_END - cursor >= MIN) {
      const start = cursor;
      const end = Math.min(start + 4 * 60, DAY_END);
      return { start: fmtMin(start), end: fmtMin(end) };
    }
    return null;
  };

  const addRange = async (day: number) => {
    if (locked) return;
    const free = findFirstFreeSlot(day);
    if (!free) {
      toast.error("Cette journée est déjà entièrement couverte");
      return;
    }
    try {
      const res: any = await createFn({ data: { avail_date: dateISO(day), start_time: free.start, end_time: free.end } });
      setRanges((p) => ({ ...p, [day]: [...(p[day] ?? []), { ...free, id: res.id }] }));
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
    try { window.localStorage?.setItem(disposKey(userId, year, month), new Date().toISOString()); } catch {}
    setValidated(true);
    toast.success("Dispos envoyées pour " + monthLabel);
  };

  const deadlineLabel = deadlineMs
    ? new Date(deadlineMs).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" }) + " à 23:59"
    : `jour ${deadline?.deadline_day ?? "?"} à 23:59`;

  return (
    <Sheet open={open} onClose={onClose} title={`Dispos · ${monthLabel}`}>
      {/* Bannière statut : verrouillé / compte à rebours / à remplir */}
      {locked ? (
        <div className="rounded-xl px-3 py-3 mb-3 flex items-start gap-2" style={{ backgroundColor: "var(--danger-bg)" }}>
          <Lock size={14} style={{ color: "var(--danger-text)", marginTop: 1 }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--danger-text)", lineHeight: 1.5 }}>
            {planningPublished
              ? <>Le planning de <span style={{ textTransform: "capitalize" }}>{monthLabel}</span> est publié. Tu ne peux plus modifier tes dispos. Pour signaler une indisponibilité, fais une demande de modification depuis l'accueil.</>
              : <>Deadline dépassée pour <span style={{ textTransform: "capitalize" }}>{monthLabel}</span>. Pour tout changement, fais une demande de modification depuis l'accueil.</>}
          </span>
        </div>
      ) : validated ? (
        <div className="rounded-xl px-4 py-4 flex flex-col items-center gap-2 mb-3" style={{ backgroundColor: "var(--success-bg)" }}>
          <CheckCircle2 size={28} style={{ color: "var(--success-text)" }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--success-text)" }}>Dispos envoyées</div>
          {msLeft !== null && (
            <div style={{ fontSize: 12, color: "var(--success-text)", textAlign: "center" }}>
              Tu peux encore modifier jusqu'au <strong>{deadlineLabel}</strong>
            </div>
          )}
          {msLeft !== null && (
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--success-text)", fontVariantNumeric: "tabular-nums" }}>
              {formatCountdown(msLeft)}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.4 }}>
            Après la deadline, toute modification passera par une demande à l'admin.
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12, lineHeight: 1.5 }}>
            Indique tes plages horaires de disponibilité pour <span style={{ textTransform: "capitalize" }}>{monthLabel}</span>. Tu peux ajouter plusieurs plages par jour.
          </div>
          {msLeft !== null && (
            <div className="rounded-xl px-3 py-2 mb-2 flex items-center justify-between gap-2" style={{ backgroundColor: "var(--muted)" }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>
                Deadline : {deadlineLabel}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--coral)", fontVariantNumeric: "tabular-nums" }}>
                {formatCountdown(msLeft)}
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
        <div className="flex flex-col gap-1.5 mb-3" style={{ opacity: locked ? 0.6 : 1, pointerEvents: locked ? "none" : "auto" }}>
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

      {!validated && !loading && !locked && (
        <PrimaryButton onClick={validate}>Valider mes dispos</PrimaryButton>
      )}
    </Sheet>
  );
}

