import { useState } from "react";
import { MapPinOff, Loader2, RefreshCw, Settings } from "lucide-react";
import { isMedianApp, isIOS, isAndroid } from "@/lib/is-median-app";
import { getCurrentPositionSafe, type GeoResult } from "@/lib/geolocation";

interface Props {
  /** Rappelé quand la position est de nouveau accessible. */
  onRetrySuccess?: (result: Extract<GeoResult, { ok: true }>) => void;
  /** Rappelé à chaque tentative, quel que soit le résultat. */
  onRetry?: (result: GeoResult) => void;
}

export function GeolocationDeniedScreen({ onRetrySuccess, onRetry }: Props) {
  const [checking, setChecking] = useState(false);
  const [stillDenied, setStillDenied] = useState(false);

  const inApp = isMedianApp();
  const instructions = inApp && isIOS()
    ? "Pour activer : Réglages iPhone > Kadence > Position > Autoriser"
    : inApp && isAndroid()
      ? "Pour activer : Réglages Android > Applications > Kadence > Autorisations > Position > Autoriser"
      : "Pour activer : clique sur l'icône cadenas dans la barre d'adresse et autorise la localisation";

  const retry = async () => {
    if (checking) return;
    setChecking(true);
    setStillDenied(false);
    try {
      const r = await getCurrentPositionSafe();
      onRetry?.(r);
      if (r.ok) onRetrySuccess?.(r);
      else setStillDenied(true);
    } finally {
      setChecking(false);
    }
  };

  const openSettings = () => {
    const median = (window as any).median;
    if (typeof median?.opensettings === "function") median.opensettings();
    else if (typeof median?.open?.settings === "function") median.open.settings();
    else setStillDenied(true);
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}
    >
      <div
        className="rounded-full flex items-center justify-center mb-4"
        style={{ width: 56, height: 56, backgroundColor: "var(--coral-light)" }}
      >
        <MapPinOff size={26} color="var(--coral-dark)" strokeWidth={1.8} />
      </div>

      <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em" }}>
        Localisation nécessaire pour pointer
      </div>

      <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 8, lineHeight: 1.5 }}>
        Kadence a besoin d'accéder à votre position uniquement au moment du pointage, pour vérifier
        votre présence sur le lieu de travail. Cette autorisation a été refusée.
      </div>

      <div
        className="mt-4 rounded-lg px-3 py-2.5"
        style={{ backgroundColor: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}
      >
        {instructions}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {inApp && (
          <button
            onClick={openSettings}
            className="w-full rounded-md py-3 flex items-center justify-center gap-2"
            style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
          >
            <Settings size={15} /> Ouvrir les réglages
          </button>
        )}
        <button
          onClick={retry}
          disabled={checking}
          className="w-full rounded-md py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          style={{
            fontSize: 14,
            fontWeight: 500,
            backgroundColor: inApp ? "transparent" : "var(--coral)",
            color: inApp ? "var(--foreground)" : "var(--coral-text)",
            border: inApp ? "0.5px solid rgba(0,0,0,0.12)" : "none",
          }}
        >
          {checking ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Réessayer
        </button>
      </div>

      {stillDenied && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 10, textAlign: "center" }}>
          Toujours refusée — vérifie les réglages puis réessaie.
        </div>
      )}
    </div>
  );
}
