import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { AIChatPanel } from "./AIChatPanel";

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function AssistantFab({ unread = 0 }: { unread?: number }) {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);

  // Open via ?openAssistant=1 (legacy deeplink) or custom event
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("openAssistant") === "1") {
      setOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("openAssistant");
      window.history.replaceState({}, "", url.toString());
    }
    const onOpen = () => setOpen(true);
    window.addEventListener("kadence:open-assistant", onOpen);
    return () => window.removeEventListener("kadence:open-assistant", onOpen);
  }, []);


  // Pulse au premier affichage du mois
  useEffect(() => {
    if (typeof window === "undefined") return;
    const k = `assistant-pulse-shown-${monthKey()}`;
    try {
      if (!window.localStorage.getItem(k)) {
        setPulse(true);
        const t = setTimeout(() => {
          setPulse(false);
          try { window.localStorage.setItem(k, "1"); } catch {}
        }, 3000);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  // Verrouille le scroll du body quand ouvert
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l'assistant Kadence"
          className={pulse ? "kadence-fab-pulse" : ""}
          style={{
            position: "fixed",
            bottom: "calc(80px + env(safe-area-inset-bottom))",
            right: "max(16px, calc(50vw - 215px + 16px))",
            width: 56,
            height: 56,
            borderRadius: "50%",
            backgroundColor: "var(--coral)",
            color: "var(--coral-text)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 45,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 150ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <Bot size={24} strokeWidth={2} />
          {unread > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: "#c2410c",
                border: "2px solid #fff",
              }}
            />
          )}
        </button>
      )}

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <AIChatPanel onClose={() => setOpen(false)} />
        </div>
      )}

      <style>{`
        @keyframes kadence-fab-pulse-kf {
          0%, 100% { box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 0 rgba(240,153,123,0.6); }
          50% { box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 12px rgba(240,153,123,0); }
        }
        .kadence-fab-pulse { animation: kadence-fab-pulse-kf 1.4s ease-in-out infinite; }
      `}</style>
    </>
  );
}
