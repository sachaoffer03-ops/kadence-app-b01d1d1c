import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Zap, Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/staff-app/shared";
import { getOpenShiftsForMe, claimOpenShifts } from "@/lib/open-shifts.functions";

export interface OpenShift {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  businessRole: string;
  studioId: string | null;
  studioName: string;
  message: string | null;
}

export function useOpenShifts() {
  const listFn = useServerFn(getOpenShiftsForMe);
  const [shifts, setShifts] = useState<OpenShift[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const r = await listFn({});
      setShifts((r?.shifts ?? []) as OpenShift[]);
    } catch {
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { shifts, loading, reload };
}

function dateLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Carte compacte sur l'accueil + page dédiée (sheet) pour choisir les shifts. */
export function OpenShiftsInline() {
  const { shifts, loading, reload } = useOpenShifts();
  const claimFn = useServerFn(claimOpenShifts);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const message = useMemo(
    () => shifts.find((s) => s.message)?.message ?? null,
    [shifts],
  );

  const groups = useMemo(() => {
    const map = new Map<string, OpenShift[]>();
    for (const s of shifts) {
      const arr = map.get(s.shiftDate) ?? [];
      arr.push(s);
      map.set(s.shiftDate, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [shifts]);

  if (loading || shifts.length === 0) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const claim = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const r = await claimFn({ data: { shiftIds: Array.from(selected) } });
      if (r.claimed > 0) {
        toast.success(
          `${r.claimed} shift${r.claimed > 1 ? "s" : ""} ajouté${r.claimed > 1 ? "s" : ""} à ton planning`,
        );
      }
      if (r.taken > 0) {
        toast.error(
          `${r.taken} shift${r.taken > 1 ? "s" : ""} déjà pris par quelqu'un d'autre`,
        );
      }
      setSelected(new Set());
      await reload();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Carte compacte accueil */}
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl px-4 py-3.5 mb-4 flex items-center gap-3 text-left"
        style={{ backgroundColor: "#fff", border: "1px solid var(--coral)" }}
      >
        <span
          className="shrink-0 rounded-full flex items-center justify-center"
          style={{ width: 32, height: 32, backgroundColor: "var(--coral-light)" }}
        >
          <Zap size={15} style={{ color: "var(--coral-dark)" }} />
        </span>
        <span className="flex-1 min-w-0">
          <span style={{ fontSize: 14, fontWeight: 500, display: "block" }}>
            {shifts.length} shift{shifts.length > 1 ? "s" : ""} à prendre
          </span>
          <span
            className="block truncate"
            style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}
          >
            {message ?? "Premier arrivé, premier servi"}
          </span>
        </span>
        <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Shifts disponibles"
        footer={
          <button
            onClick={claim}
            disabled={busy || selected.size === 0}
            className="w-full rounded-xl py-3 flex items-center justify-center gap-2"
            style={{
              fontSize: 14,
              fontWeight: 500,
              border: "none",
              backgroundColor: selected.size === 0 ? "var(--muted)" : "var(--coral)",
              color:
                selected.size === 0 ? "var(--muted-foreground)" : "var(--coral-text)",
            }}
          >
            <Check size={16} />
            {selected.size === 0
              ? "Sélectionne un shift"
              : `Prendre ${selected.size} shift${selected.size > 1 ? "s" : ""}`}
          </button>
        }
      >
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 14 }}>
          {message ?? "Coche les shifts que tu veux prendre. Premier arrivé, premier servi."}
        </div>

        {groups.map(([date, list]) => (
          <div key={date} className="mb-4">
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--muted-foreground)",
                marginBottom: 6,
              }}
            >
              {dateLabel(date)}
            </div>
            <div className="flex flex-col gap-2">
              {list.map((s) => {
                const on = selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className="w-full rounded-xl px-3 py-3 flex items-center gap-3 text-left"
                    style={{
                      border: on
                        ? "1.5px solid var(--coral)"
                        : "1px solid rgba(0,0,0,0.12)",
                      backgroundColor: on ? "var(--coral-light)" : "#fff",
                    }}
                  >
                    <span
                      className="shrink-0 rounded-md flex items-center justify-center"
                      style={{
                        width: 24,
                        height: 24,
                        border: on ? "none" : "1.5px solid rgba(0,0,0,0.25)",
                        backgroundColor: on ? "var(--coral)" : "#fff",
                        color: "var(--coral-text)",
                      }}
                    >
                      {on && <Check size={15} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span style={{ fontSize: 14, fontWeight: 500, display: "block" }}>
                        {s.startTime} — {s.endTime}
                      </span>
                      <span
                        className="block truncate"
                        style={{ fontSize: 12, color: "var(--muted-foreground)" }}
                      >
                        {s.businessRole} · {s.studioName.replace("Skult ", "")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Sheet>
    </>
  );
}
