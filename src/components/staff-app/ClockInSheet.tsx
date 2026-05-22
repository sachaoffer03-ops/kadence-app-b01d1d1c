import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, X, QrCode, Loader2 } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useServerFn } from "@tanstack/react-start";
import { validateClockInFn } from "@/lib/shift-clock.functions";
import { OpeningFlow } from "./OpeningFlow";

export interface ClockInShiftRow {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  business_role: string;
  studio_id: string | null;
  clocked_in_at?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shift: ClockInShiftRow | null;
  studios: Record<string, string>;
  userId: string;
  firstName?: string | null;
  onCompleted?: (info: { clockedInAt: string; minutesLate: number }) => void;
}

export function ClockInSheet({ open, onClose, shift, studios, userId, firstName, onCompleted }: Props) {
  const validateClockIn = useServerFn(validateClockInFn);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState<string[]>(["", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ minutesLate: number; clockedInAt: string } | null>(null);

  useEffect(() => {
    if (open) {
      setManual(false);
      setCode(["", "", "", "", ""]);
      setDone(null);
    }
  }, [open, shift?.id]);

  if (!open || !shift) return null;

  const studioName = (shift.studio_id && studios[shift.studio_id]) || "—";
  const startDt = new Date(`${shift.shift_date}T${shift.start_time}`);
  const now = new Date();
  const diffMin = Math.round((now.getTime() - startDt.getTime()) / 60_000);
  const isLate = diffMin > 0;

  async function submitCode(raw: string) {
    if (loading || !shift) return;
    const clean = (raw ?? "").trim();
    if (!clean) return;
    setLoading(true);
    try {
      let lat: number | null = null, lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error("Géolocalisation indisponible"));
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
        });
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch {
        // non-bloquant
      }
      const r = await validateClockIn({ data: { shiftId: shift.id, qrCode: clean, lat, lng } });
      const minutesLate = (r as any).minutesLate ?? 0;
      const clockedInAt = (r as any).clockedInAt ?? new Date().toISOString();
      setDone({ minutesLate, clockedInAt });
      toast.success("Arrivée pointée");
      onCompleted?.({ clockedInAt, minutesLate });
    } catch (e: any) {
      toast.error("Pointage refusé", { description: e?.message ?? "Code invalide" });
    } finally {
      setLoading(false);
    }
  }

  const handleManualSubmit = () => {
    const full = code.join("").trim();
    if (full.length < 3) {
      toast.error("Code incomplet");
      return;
    }
    submitCode(full);
  };

  if (done) {
    return (
      <OpeningFlow
        open={true}
        onClose={onClose}
        shift={shift}
        userId={userId}
        studios={studios}
        firstName={firstName ?? null}
        clockedInAt={done.clockedInAt}
        minutesLate={done.minutesLate}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#FAF8F4" }}>
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "rgba(0,0,0,0.06)", paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <button onClick={onClose} aria-label="Fermer" className="rounded-full p-2 -ml-2">
          <ArrowLeft size={20} />
        </button>
        <div style={{ fontSize: 13, fontWeight: 500 }}>Pointer mon arrivée</div>
        <div style={{ width: 36 }} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        {(
          <>
            <span
              className="inline-block rounded-full px-2.5 py-1 mb-3"
              style={{
                fontSize: 10, fontWeight: 500,
                backgroundColor: "var(--coral-light)", color: "var(--coral-dark)",
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}
            >
              Scan obligatoire
            </span>
            <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 6 }}>Scanne le QR de la tablette</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {studioName.replace("Skult ", "")} · {shift.business_role} · début {shift.start_time.slice(0, 5).replace(":", "h")}
              {isLate ? ` · retard ${diffMin} min` : ""}
            </div>

            <div
              className="mt-3 rounded-xl p-3"
              style={{ backgroundColor: "#EAF4FB", border: "0.5px solid #BCD8EC", fontSize: 12, color: "#1F4E6E", lineHeight: 1.5 }}
            >
              Le QR est affiché sur la tablette à l'accueil. Si tu ne l'as pas sous la main, tu peux entrer le code à 5 caractères manuellement.
            </div>

            {!manual ? (
              <>
                <div
                  className="mt-4 rounded-xl overflow-hidden relative"
                  style={{ backgroundColor: "#000", aspectRatio: "1/1" }}
                >
                  <Scanner
                    onScan={(results) => {
                      const c = results?.[0]?.rawValue;
                      if (c && !loading) submitCode(c);
                    }}
                    onError={(e) => console.error("[clockin-scanner]", e)}
                    constraints={{ facingMode: "environment" }}
                    styles={{ container: { width: "100%", height: "100%" } }}
                  />
                  {loading && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "#fff" }}
                    >
                      <Loader2 size={28} className="animate-spin" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setManual(true)}
                  className="mt-3 w-full rounded-md py-2.5 border"
                  style={{ fontSize: 13, fontWeight: 500, borderColor: "rgba(0,0,0,0.12)", backgroundColor: "#fff" }}
                >
                  <QrCode size={14} className="inline-block mr-1.5" />
                  Entrer le code manuellement
                </button>
              </>
            ) : (
              <div className="mt-4">
                <div className="flex justify-center gap-2 mb-4">
                  {code.map((c, i) => (
                    <input
                      key={i}
                      value={c}
                      maxLength={1}
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase();
                        const next = [...code]; next[i] = v; setCode(next);
                        if (v && i < 4) (document.getElementById(`clockin-otp-${i + 1}`) as HTMLInputElement)?.focus();
                      }}
                      id={`clockin-otp-${i}`}
                      inputMode="text"
                      autoCapitalize="characters"
                      className="rounded-lg text-center"
                      style={{ width: 44, height: 56, fontSize: 22, fontWeight: 500, border: "1.5px solid rgba(0,0,0,0.15)", backgroundColor: "#fff" }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleManualSubmit}
                  disabled={loading}
                  className="w-full rounded-md py-3 disabled:opacity-50"
                  style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
                >
                  {loading ? "Validation…" : "Valider mon arrivée"}
                </button>
                <button
                  onClick={() => setManual(false)}
                  className="mt-2 w-full rounded-md py-2.5"
                  style={{ fontSize: 13, color: "var(--muted-foreground)" }}
                >
                  Revenir au scanner
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
