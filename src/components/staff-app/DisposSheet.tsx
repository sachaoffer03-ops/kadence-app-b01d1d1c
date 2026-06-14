import { useEffect, useMemo, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, PrimaryButton } from "./shared";
import { CheckCircle2, Plus, X, Lock, ChevronLeft, ChevronRight, Pencil, Clock } from "lucide-react";
import { Dropdown } from "@/components/Dropdown";
import {
  createAvailability,
  updateAvailability,
  deleteAvailability,
  getAvailabilityLockInfo,
  getClosedDaysForMonth,
  type AvailabilityLockInfo,
} from "@/lib/availabilities.functions";
import {
  addMonthsYM,
  brusselsDeadlineDate,
  daysInMonth as getDaysInMonth,
  formatBrusselsDateTime,
  formatBrusselsMonthLabel,
  formatBrusselsShortDayMonth,
  getBrusselsDateParts,
} from "@/lib/brussels-time";


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
    const now = getBrusselsDateParts();
    return addMonthsYM(now.year, now.month, monthOffset);
  }, [monthOffset]);
  const year = monthRef.year;
  const month = monthRef.month - 1;
  const daysInMonth = getDaysInMonth(year, monthRef.month);
  const monthLabel = formatBrusselsMonthLabel(year, monthRef.month);

  // Jour sélectionné (1..daysInMonth)
  const [selectedDay, setSelectedDay] = useState(1);
  useEffect(() => {
    setSelectedDay(1);
  }, [year, month]);

  const [ranges, setRanges] = useState<Record<number, Range[]>>({});
  const [loading, setLoading] = useState(true);
  const [validated, setValidated] = useState(false);
  const [lockInfo, setLockInfo] = useState<AvailabilityLockInfo | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [closedDays, setClosedDays] = useState<Set<number>>(new Set());
  const [minShiftHours, setMinShiftHours] = useState<number>(3);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("ai_planning_settings")
      .select("min_shift_hours")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const v = Number((data as any)?.min_shift_hours);
        if (Number.isFinite(v) && v > 0) setMinShiftHours(v);
      });
  }, [open]);

  const createFn = useServerFn(createAvailability);
  const updateFn = useServerFn(updateAvailability);
  const deleteFn = useServerFn(deleteAvailability);
  const lockInfoFn = useServerFn(getAvailabilityLockInfo);
  const closedDaysFn = useServerFn(getClosedDaysForMonth);


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
    closedDaysFn({ data: { year, month: month + 1 } })
      .then((r: any) => {
        const set = new Set<number>(r?.closedDays ?? []);
        setClosedDays(set);
        setSelectedDay((cur) => {
          if (!set.has(cur)) return cur;
          for (let d = 1; d <= daysInMonth; d++) if (!set.has(d)) return d;
          return cur;
        });
      })
      .catch(() => setClosedDays(new Set()));

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
  }, [open, userId, year, month, daysInMonth, refreshLockInfo, closedDaysFn]);


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
    const deadlineMonth = addMonthsYM(year, month + 1, -1);
    return brusselsDeadlineDate(deadlineMonth.year, deadlineMonth.month, lockInfo.lockDay);
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

  const formatCountdownShort = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (days > 0) return `${days}j ${h}h`;
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
    const sec = s % 60;
    return `${m}m ${String(sec).padStart(2, "0")}s`;
  };

  const countdownColor = (ms: number) => {
    const days = ms / 86_400_000;
    if (days > 7) return "#16a34a"; // vert
    if (days >= 1) return "#ea580c"; // orange
    return "#dc2626"; // rouge
  };

  const fmtDateFR = (d: Date) => formatBrusselsDateTime(d);

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
    const MIN = Math.round(minShiftHours * 60);
    const DAY_START = 6 * 60;
    const DAY_END = 23 * 60 + 30;
    const list = (ranges[day] ?? [])
      .map(r => ({ s: toMin(r.start), e: toMin(r.end) }))
      .sort((a, b) => a.s - b.s);
    let cursor = DAY_START;
    for (const r of list) {
      if (r.s - cursor >= MIN) {
        const start = cursor;
        const end = Math.min(start + MIN, r.s);
        return { start: fmtMin(start), end: fmtMin(end) };
      }
      cursor = Math.max(cursor, r.e);
    }
    if (DAY_END - cursor >= MIN) {
      const start = cursor;
      const end = Math.min(start + MIN, DAY_END);
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
    const current = list[idx];
    if (!current?.id) return;
    const updated: Range = { ...current, ...patch };

    // Toujours refléter le choix de l'utilisateur dans l'UI, même si invalide.
    setRanges((p) => ({ ...p, [day]: list.map((r, i) => (i === idx ? updated : r)) }));

    const MIN = Math.round(minShiftHours * 60);
    const s = toMin(updated.start);
    const e = toMin(updated.end);

    if (e <= s) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return; // pas de sauvegarde, l'utilisateur corrigera
    }
    if (e - s < MIN) {
      toast.error(`Un créneau doit durer au moins ${minShiftHours}h`);
      return;
    }
    const conflict = overlapsExisting(day, updated.start, updated.end, idx);
    if (conflict === "overlap") {
      toast.error("Cette plage chevauche une autre plage du même jour");
      return;
    }

    try {
      await updateFn({ data: { id: updated.id, start_time: updated.start, end_time: updated.end } });
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur");
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

  const showValidate = !loading && !locked;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Mes disponibilités"
      footer={<PrimaryButton onClick={validate} disabled={!showValidate}>Valider mes dispos</PrimaryButton>}
    >
      {/* Countdown global vers la prochaine deadline */}
      {msLeftGlobal !== null && nextDeadlineMs && (
        <div
          className="rounded-xl px-3 py-2 mb-3 flex items-center gap-2 whitespace-nowrap overflow-hidden"
          style={{ backgroundColor: "var(--muted)" }}
        >
          <Clock size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis" }}>
            Dispos <span style={{ textTransform: "capitalize", fontWeight: 600, color: "var(--foreground)" }}>{monthLabel}</span>
            <span style={{ margin: "0 4px" }}>à soumettre avant</span>
            <strong style={{ color: "var(--foreground)" }}>{new Date(nextDeadlineMs).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</strong>
          </span>
          <span
            className="ml-auto"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: countdownColor(msLeftGlobal),
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {formatCountdownShort(msLeftGlobal)}
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
      ) : null}

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
        <div style={{ opacity: locked ? 0.6 : 1 }}>
          {/* Mini-calendrier */}
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((d) => (
              <div key={d} className="text-center" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", paddingBottom: 2 }}>{d}</div>
            ))}
            {/* Offset (lundi = colonne 1) */}
            {Array.from({ length: (new Date(year, month, 1).getDay() + 6) % 7 }).map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const isClosed = closedDays.has(day);
              const hasDispo = (ranges[day] ?? []).length > 0;
              const isSelected = day === selectedDay;
              return (
                <button
                  key={day}
                  onClick={() => { if (!isClosed) setSelectedDay(day); }}
                  disabled={isClosed}
                  title={isClosed ? "Studio fermé ce jour-là" : undefined}
                  className="aspect-square rounded-xl relative flex items-center justify-center transition-all"
                  style={{
                    backgroundColor: isClosed
                      ? "rgba(0,0,0,0.04)"
                      : isSelected ? "#fff" : "#fff",
                    border: isClosed
                      ? "1px dashed rgba(0,0,0,0.12)"
                      : isSelected
                        ? "1.5px solid var(--coral)"
                        : hasDispo
                          ? "1px solid color-mix(in oklab, var(--coral) 35%, transparent)"
                          : "1px solid rgba(0,0,0,0.06)",
                    color: isClosed
                      ? "rgba(0,0,0,0.3)"
                      : "var(--foreground)",
                    fontSize: 12,
                    fontWeight: hasDispo || isSelected ? 600 : 400,
                    cursor: isClosed ? "not-allowed" : "pointer",
                  }}
                  aria-label={`Jour ${day}${isClosed ? " — fermé" : ""}`}
                >
                  {day}
                  {hasDispo && !isClosed && (
                    <span
                      className="absolute"
                      style={{
                        bottom: 4,
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        backgroundColor: "var(--coral)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>


          {/* Détail du jour sélectionné */}
          {(() => {
            const dayRanges = ranges[selectedDay] ?? [];
            const dateLong = new Date(year, month, selectedDay).toLocaleDateString("fr-FR", {
              weekday: "long", day: "numeric", month: "long",
            });
            return (
              <div className="rounded-2xl mt-4 p-4" style={{ backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", letterSpacing: "0.08em" }}>
                      Détail du jour
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 500, textTransform: "capitalize" }}>{dateLong}</div>
                  </div>
                  <div
                    className="rounded-full px-2.5 py-0.5"
                    style={{
                      backgroundColor: dayRanges.length > 0 ? "color-mix(in oklab, var(--coral) 12%, transparent)" : "rgba(0,0,0,0.05)",
                      fontSize: 10,
                      fontWeight: 500,
                      color: dayRanges.length > 0 ? "var(--coral)" : "var(--muted-foreground)",
                    }}
                  >
                    {dayRanges.length > 0 ? `${dayRanges.length} créneau${dayRanges.length > 1 ? "x" : ""}` : "À configurer"}
                  </div>
                </div>

                {dayRanges.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center py-5 rounded-xl"
                    style={{ border: "1.5px dashed rgba(0,0,0,0.1)" }}
                  >
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>Aucune disponibilité définie</div>
                    {!locked && (
                      <button
                        onClick={() => addRange(selectedDay)}
                        className="flex items-center gap-1.5 rounded-full px-5 py-2"
                        style={{ backgroundColor: "var(--coral)", color: "var(--coral-text)", fontSize: 12, fontWeight: 500 }}
                      >
                        <Plus size={13} /> Ajouter un créneau
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {dayRanges.map((r, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-xl px-3 py-2"
                        style={{ backgroundColor: "rgba(0,0,0,0.025)" }}
                      >
                        {locked ? (
                          <span style={{ fontSize: 12, color: "var(--foreground)" }}>
                            {r.start} → {r.end}
                          </span>
                        ) : (
                          <>
                            <span
                              style={{
                                width: 5, height: 5, borderRadius: "50%",
                                backgroundColor: "var(--coral)", flexShrink: 0,
                              }}
                            />
                            <Dropdown
                              value={r.start}
                              options={HOURS}
                              onChange={(v) => updateRange(selectedDay, idx, { start: v })}
                              minWidth={72}
                            />
                            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>→</span>
                            <Dropdown
                              value={r.end}
                              options={HOURS}
                              onChange={(v) => updateRange(selectedDay, idx, { end: v })}
                              minWidth={72}
                            />
                            <button
                              onClick={() => removeRange(selectedDay, idx)}
                              className="ml-auto rounded-md p-1"
                              style={{ color: "var(--muted-foreground)" }}
                              aria-label="Supprimer"
                            >
                              <X size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                    {!locked && (
                      <button
                        onClick={() => addRange(selectedDay)}
                        className="flex items-center justify-center gap-1.5 rounded-xl py-2 mt-1"
                        style={{
                          fontSize: 12, fontWeight: 500, color: "var(--coral)",
                          border: "1px dashed color-mix(in oklab, var(--coral) 40%, transparent)",
                        }}
                      >
                        <Plus size={13} /> Ajouter un créneau
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Progression du mois */}
          {!locked && (
            <div className="mt-5 mb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Progression du mois</span>
                <span style={{ fontSize: 11, fontWeight: 500 }}>{configured} / {daysInMonth} jours</span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 4, backgroundColor: "rgba(0,0,0,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(configured / daysInMonth) * 100}%`, backgroundColor: "var(--coral)" }}
                />
              </div>
            </div>
          )}
        </div>
      )}

    </Sheet>
  );
}
