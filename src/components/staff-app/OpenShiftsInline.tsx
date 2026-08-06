import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Zap, Check } from "lucide-react";
import { toast } from "sonner";
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

/** Bloc affiché sur l'accueil employé : shifts ouverts à tous, à cocher. */
export function OpenShiftsInline() {
  const { shifts, loading, reload } = useOpenShifts();
  const claimFn = useServerFn(claimOpenShifts);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const message = useMemo(
    () => shifts.find((s) => s.message)?.message ?? null,
    [shifts],
  );

  if (loading || shifts.length === 0) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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
      reload();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl border p-4 mb-4"
      style={{ backgroundColor: "#fff", borderColor: "var(--coral)" }}
    >
      <div
        className="flex items-center gap-2 mb-1"
        style={{
          fontSize: 11,
          color: "var(--coral-dark)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <Zap size={11} /> Shifts disponibles
      </div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 10 }}>
        {message
          ? message
          : "Coche les shifts que tu veux prendre. Premier arrivé, premier servi."}
      </div>

      <div className="flex flex-col gap-2">
        {shifts.map((s) => {
          const on = selected.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className="w-full rounded-xl px-3 py-3 flex items-center gap-3 text-left"
              style={{
                border: on ? "1px solid var(--coral)" : "0.5px solid var(--border)",
                backgroundColor: on ? "var(--coral-light)" : "transparent",
              }}
            >
              <span
                className="shrink-0 rounded-md flex items-center justify-center"
                style={{
                  width: 20,
                  height: 20,
                  border: on ? "none" : "0.5px solid var(--border)",
                  backgroundColor: on ? "var(--coral)" : "transparent",
                  color: "var(--coral-text)",
                }}
              >
                {on && <Check size={13} />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate"
                  style={{ fontSize: 14, fontWeight: 500, textTransform: "capitalize" }}
                >
                  {dateLabel(s.shiftDate)}
                </span>
                <span
                  className="block truncate"
                  style={{ fontSize: 12, color: "var(--muted-foreground)" }}
                >
                  {s.startTime} — {s.endTime} · {s.businessRole} ·{" "}
                  {s.studioName.replace("Skult ", "")}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={claim}
        disabled={busy || selected.size === 0}
        className="w-full rounded-xl py-3 mt-3 flex items-center justify-center gap-2"
        style={{
          fontSize: 14,
          fontWeight: 500,
          border: "none",
          backgroundColor:
            selected.size === 0 ? "var(--muted)" : "var(--coral)",
          color:
            selected.size === 0 ? "var(--muted-foreground)" : "var(--coral-text)",
        }}
      >
        <Check size={16} />
        {selected.size === 0
          ? "Sélectionne un shift"
          : `Prendre ${selected.size} shift${selected.size > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
