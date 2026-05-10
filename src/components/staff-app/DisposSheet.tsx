import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, PrimaryButton } from "./shared";
import { CheckCircle2 } from "lucide-react";

type Slot = "matin" | "midi" | "soir";

const SLOTS: { key: Slot; label: string; short: string }[] = [
  { key: "matin", label: "Matin", short: "M" },
  { key: "midi", label: "Midi", short: "Mi" },
  { key: "soir", label: "Soir", short: "S" },
];
const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

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

  const [availability, setAvailability] = useState<Record<number, Set<Slot>>>({});
  const [loading, setLoading] = useState(true);
  const [validated, setValidated] = useState(false);

  const dateISO = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  useEffect(() => {
    if (!open) return;
    const flag = typeof window !== "undefined" ? localStorage.getItem(disposKey(userId, year, month)) : null;
    setValidated(!!flag);
    (async () => {
      setLoading(true);
      const start = dateISO(1);
      const end = dateISO(daysInMonth);
      const { data } = await supabase
        .from("availabilities")
        .select("avail_date,slot")
        .eq("user_id", userId)
        .gte("avail_date", start)
        .lte("avail_date", end);
      const map: Record<number, Set<Slot>> = {};
      data?.forEach((r) => {
        const d = parseInt(r.avail_date.slice(8, 10), 10);
        if (!map[d]) map[d] = new Set();
        map[d].add(r.slot as Slot);
      });
      setAvailability(map);
      setLoading(false);
    })();
  }, [open, userId, year, month, daysInMonth]);

  const toggleSlot = async (day: number, slot: Slot) => {
    if (validated) return;
    const current = availability[day] || new Set<Slot>();
    const has = current.has(slot);
    const next = new Set(current);
    if (has) next.delete(slot);
    else next.add(slot);
    setAvailability((p) => ({ ...p, [day]: next }));

    if (has) {
      const { error } = await supabase
        .from("availabilities")
        .delete()
        .eq("user_id", userId)
        .eq("avail_date", dateISO(day))
        .eq("slot", slot);
      if (error) toast.error("Erreur de sauvegarde");
    } else {
      const { error } = await supabase
        .from("availabilities")
        .insert({ user_id: userId, avail_date: dateISO(day), slot });
      if (error) toast.error("Erreur de sauvegarde");
    }
  };

  const configured = Object.values(availability).filter((s) => s.size > 0).length;

  const validate = () => {
    if (configured === 0) {
      toast.error("Indique au moins une disponibilité");
      return;
    }
    localStorage.setItem(disposKey(userId, year, month), new Date().toISOString());
    setValidated(true);
    toast.success("Planning validé pour " + monthLabel);
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Dispos · ${monthLabel}`}>
      {validated ? (
        <div className="rounded-xl px-4 py-6 flex flex-col items-center gap-3 mb-3" style={{ backgroundColor: "var(--success-bg)" }}>
          <CheckCircle2 size={36} style={{ color: "var(--success-text)" }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--success-text)" }}>Planning validé</div>
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
            Coche les créneaux où tu es disponible pour <span style={{ textTransform: "capitalize" }}>{monthLabel}</span>. Tu valides une seule fois pour tout le mois.
          </div>
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
        <div className="flex flex-col gap-1 mb-3" style={{ opacity: validated ? 0.6 : 1, pointerEvents: validated ? "none" : "auto" }}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dow = DAY_NAMES[new Date(year, month, day).getDay()];
            const daySlots = availability[day] || new Set<Slot>();
            return (
              <div key={day} className="rounded-lg border px-3 py-2.5 flex items-center gap-3" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
                <div style={{ minWidth: 50, fontSize: 12, fontWeight: 500 }}>{dow} {day}</div>
                <div className="flex items-center gap-1 flex-1">
                  {SLOTS.map((sl) => {
                    const active = daySlots.has(sl.key);
                    return (
                      <button
                        key={sl.key}
                        onClick={() => toggleSlot(day, sl.key)}
                        className="rounded-md px-2.5 py-1 transition-colors"
                        style={{
                          fontSize: 10,
                          fontWeight: active ? 500 : 400,
                          backgroundColor: active ? "var(--coral)" : "transparent",
                          color: active ? "var(--coral-text)" : "var(--muted-foreground)",
                          border: active ? "none" : "0.5px solid var(--border)",
                        }}
                      >
                        {sl.short}
                      </button>
                    );
                  })}
                </div>
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
