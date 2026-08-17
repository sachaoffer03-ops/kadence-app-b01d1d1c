import { useEffect, useState } from "react";
import { X, Share, MoreVertical, PlusSquare, Check } from "lucide-react";
import { isMedianApp, isIOS, isAndroid } from "@/lib/is-median-app";

const DISMISS_KEY = "kadence_install_banner_dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Bandeau discret « Installer l'app » affiché au-dessus de la barre d'onglets.
 * Purement visuel : explique en 3 étapes l'ajout à l'écran d'accueil (PWA).
 * Masqué dans l'app Median, en mode standalone, sur desktop, ou si fermé.
 */
export function InstallAppBanner() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android">("ios");

  useEffect(() => {
    if (isMedianApp() || isStandalone()) return;
    const ios = isIOS();
    const android = isAndroid();
    if (!ios && !android) return;
    setPlatform(ios ? "ios" : "android");
    try {
      if (window.localStorage?.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // storage indisponible → on affiche quand même
    }
    setVisible(true);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setOpen(false);
    try {
      window.localStorage?.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  if (!visible) return null;

  const steps =
    platform === "ios"
      ? [
          { icon: Share, text: "Appuie sur Partager en bas de Safari" },
          { icon: PlusSquare, text: "Choisis « Sur l'écran d'accueil »" },
          { icon: Check, text: "Appuie sur Ajouter — c'est fait" },
        ]
      : [
          { icon: MoreVertical, text: "Ouvre le menu ⋮ de Chrome" },
          { icon: PlusSquare, text: "Choisis « Installer l'application »" },
          { icon: Check, text: "Confirme Installer — c'est fait" },
        ];

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-30"
      style={{
        width: "100%",
        maxWidth: 430,
        bottom: "calc(72px + env(safe-area-inset-bottom))",
        pointerEvents: "none",
      }}
    >
      <div
        className="mx-3 rounded-xl overflow-hidden"
        style={{
          backgroundColor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
          pointerEvents: "auto",
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <img
            src="/app-icon-192.png"
            alt=""
            width={22}
            height={22}
            loading="lazy"
            style={{ borderRadius: 6, flexShrink: 0 }}
          />
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex-1 text-left min-w-0"
            style={{ fontSize: 12, color: "var(--foreground)" }}
          >
            Installer Kadence sur ton téléphone
            <span style={{ color: "var(--coral-dark, #C97A5E)", marginLeft: 6, fontWeight: 500 }}>
              {open ? "Masquer" : "Voir"}
            </span>
          </button>
          <button
            onClick={dismiss}
            aria-label="Ne plus afficher"
            className="p-1 -mr-1"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X size={14} />
          </button>
        </div>

        {open && (
          <div className="px-3 pb-3" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)", paddingTop: 10 }}>
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="flex items-center gap-2" style={{ marginBottom: i === 2 ? 0 : 8 }}>
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      backgroundColor: "var(--coral-light, #FCEDE7)",
                      color: "var(--coral-dark, #C97A5E)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={12} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--foreground)" }}>
                    <span style={{ color: "var(--muted-foreground)", marginRight: 4 }}>{i + 1}.</span>
                    {s.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
