import { useEffect, useMemo, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, PrimaryButton } from "./shared";
import { CheckCircle2, Plus, X, Lock, ChevronLeft, ChevronRight, Pencil, Clock } from "lucide-react";
import {
  createAvailability,
  updateAvailability,
  deleteAvailability,
  getAvailabilityLockInfo,
  type AvailabilityLockInfo,
} from "@/lib/availabilities.functions";

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const HOURS: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 23; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();

interface Range {
  id?: string;
  start: string;
  end: string;
}

export function disposKey(userId: string, year: number, month: number) {
  return `dispos_validated_${userId}_${year}_${String(month + 1).padStart(2, "0")}`;
}

export function DisposSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  // Mois affiché (offset par rapport au mois courant, 0 = mois courant, max 12)
  const [monthOffset, setMonthOffset] = useState(1); // par défaut : mois prochain
  const monthRef = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);
  const year = monthRef.getFullYear();
  const month = monthRef.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = monthRef.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const [ranges, setRanges] = useState<Record<number, Range[]>>({});
  const [loading, setLoading] = useState(true);
  const [validated, setValidated] = useState(false);
  const [lockInfo, setLockInfo] = useState<AvailabilityLockInfo | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const createFn = useServerFn(createAvailability);
  const updateFn = useServerFn(updateAvailability);
  const deleteFn = useServerFn(deleteAvailability);
  const lockInfoFn = useServerFn(getAvailabilityLockInfo);

  const dateISO = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const refreshLockInfo = useCallback(() => {
    lockInfoFn().then((d) => setLockInfo(d as AvailabilityLockInfo)).catch(() => {});
  }, [lockInfoFn]);

  useEffect(() => {
    if (!open) return;
    let flag: string | null = null;
    try { if (typeof window !== "undefined") flag = window.localStorage?.getItem(disposKey(userId, year, month)) ?? null; } catch {}
    setValidated(!!flag);
    refreshLockInfo();
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
  }, [open, userId, year, month, daysInMonth, refreshLockInfo]);

  // Tick countdown (every 30s suffisant)
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [open]);

  // Statut verrou pour le mois affiché
  const displayedMonthLock = lockInfo?.lockedMonthsForUser.find(
    (m) => m.year === year && m.month === month + 1,
  );
  const locked = displayedMonthLock?.locked ?? false;

  // Prochaine deadline live
  const nextDeadlineMs = lockInfo?.nextDeadline ? new Date(lockInfo.nextDeadline).getTime() : null;
  const msLeftGlobal = nextDeadlineMs ? Math.max(0, nextDeadlineMs - now) : null;

  // Deadline du mois affiché : lockDay du mois précédent à 23:59
  const displayedMonthDeadline = useMemo(() => {
    if (!lockInfo) return null;
    const d = new Date(year, month - 1, lockInfo.lockDay, 23, 59, 59, 999);
    return d;
  }, [lockInfo, year, month]);

  const formatCountdown = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (days > 0) return `${days}j ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  };

  const countdownColor = (ms: number) => {
    const days = ms / 86_400_000;
    if (days > 7) return "#16a34a"; // vert
    if (days >= 1) return "#ea580c"; // orange
    return "#dc2626"; // rouge
  };

  const fmtDateFR = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) +
    " à " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
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

  const findFirstFreeSlot = (day: number): { start: string; end: string } | null => {
    const MIN = 4 * 60;
    const DAY_START = 6 * 60;
    const DAY_END = 23 * 60 + 30;
    const list = (ranges[day] ?? [])
      .map(r => ({ s: toMin(r.start), e: toMin(r.end) }))
      .sort((a, b) => a.s - b.s);
    let cursor = DAY_START;
    for (const r of list) {
      if (r.s - cursor >= MIN) {
        const start = cursor;
        const end = Math.min(start + 4 * 60, r.s);
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
    if (conflict === "invalid") { toast.error("L'heure de fin doit être après l'heure de début"); return; }
    if (conflict === "overlap") { toast.error("Cette plage chevauche une autre plage du même jour"); return; }
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
    if (configured === 0) { toast.error("Indique au moins une disponibilité"); return; }
    try { window.localStorage?.setItem(disposKey(userId, year, month), new Date().toISOString()); } catch {}
    setValidated(true);
    toast.success("Dispos envoyées pour " + monthLabel);
  };

  const canPrev = monthOffset > 0;
  const canNext = monthOffset < 12;

  return (
    <Sheet open={open} onClose={onClose} title="Mes disponibilités">
      {/* Countdown global vers la prochaine deadline */}
      {msLeftGlobal !== null && nextDeadlineMs && (
        <div
          className="rounded-xl px-3 py-2 mb-3 flex items-center justify-between gap-2"
          style={{ backgroundColor: "var(--muted)" }}
        >
          <div className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            <Clock size={13} />
            <span>Prochaine deadline : <strong>{fmtDateFR(new Date(nextDeadlineMs))}</strong></span>
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: countdownColor(msLeftGlobal),
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCountdown(msLeftGlobal)}
          </span>
        </div>
      )}

      {/* Navigation mois */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => canPrev && setMonthOffset((o) => o - 1)}
          disabled={!canPrev}
          className="rounded-md p-1.5"
          style={{
            border: "0.5px solid var(--border)",
            backgroundColor: "#fff",
            opacity: canPrev ? 1 : 0.3,
            cursor: canPrev ? "pointer" : "not-allowed",
          }}
          aria-label="Mois précédent"
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{monthLabel}</div>
        <button
          onClick={() => canNext && setMonthOffset((o) => o + 1)}
          disabled={!canNext}
          className="rounded-md p-1.5"
          style={{
            border: "0.5px solid var(--border)",
            backgroundColor: "#fff",
            opacity: canNext ? 1 : 0.3,
            cursor: canNext ? "pointer" : "not-allowed",
          }}
          aria-label="Mois suivant"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Bandeau verrou ou bandeau ouverture */}
      {locked ? (
        <div className="rounded-xl px-3 py-3 mb-3 flex items-start gap-2" style={{ backgroundColor: "var(--danger-bg, #fee2e2)" }}>
          <Lock size={14} style={{ color: "var(--danger-text, #991b1b)", marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--danger-text, #991b1b)", lineHeight: 1.5 }}>
            Ce mois est verrouillé.
            {displayedMonthDeadline && (
              <> La deadline était le <strong>{fmtDateFR(displayedMonthDeadline)}</strong>.</>
            )}
            {" "}Tu ne peux plus modifier tes dispos pour ce mois — contacte ton manager si tu dois changer quelque chose.
          </span>
        </div>
      ) : (
        <div className="rounded-xl px-3 py-2 mb-3 flex items-start gap-2" style={{ backgroundColor: "var(--success-bg, #dcfce7)" }}>
          <Pencil size={13} style={{ color: "var(--success-text, #166534)", marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--success-text, #166534)", lineHeight: 1.5 }}>
            Tu peux modifier les dispos de <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{monthLabel}</span>
            {displayedMonthDeadline && <> jusqu'au <strong>{fmtDateFR(displayedMonthDeadline)}</strong></>}.
          </span>
        </div>
      )}

      {!locked && validated && (
        <div className="rounded-xl px-3 py-2 mb-3 flex items-center gap-2" style={{ backgroundColor: "var(--success-bg, #dcfce7)" }}>
          <CheckCircle2 size={14} style={{ color: "var(--success-text, #166534)" }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--success-text, #166534)" }}>Dispos envoyées</span>
        </div>
      )}

      {!locked && (
        <div className="rounded-xl px-3 py-2 mb-3" style={{ backgroundColor: configured >= 10 ? "var(--success-bg, #dcfce7)" : "var(--warning-bg, #fef3c7)" }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: configured >= 10 ? "var(--success-text, #166534)" : "var(--warning-text, #92400e)" }}>
            {configured} / {daysInMonth} jours configurés
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-3" style={{ opacity: locked ? 0.6 : 1 }}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dow = DAY_NAMES[new Date(year, month, day).getDay()];
            const dayRanges = ranges[day] ?? [];
            return (
              <div key={day} className="rounded-lg border px-3 py-2" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{dow} {day}</div>
                  {!locked && (
                    <button
                      onClick={() => addRange(day)}
                      className="flex items-center gap-1 rounded-md px-2 py-0.5"
                      style={{ fontSize: 10, color: "var(--coral)", border: "0.5px solid var(--coral)" }}
                    >
                      <Plus size={11} /> Ajouter
                    </button>
                  )}
                </div>
                {dayRanges.length === 0 ? (
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontStyle: "italic" }}>Aucune dispo</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {dayRanges.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        {locked ? (
                          <span style={{ fontSize: 11, color: "var(--foreground)" }}>
                            {r.start} → {r.end}
                          </span>
                        ) : (
                          <>
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
                          </>
                        )}
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
