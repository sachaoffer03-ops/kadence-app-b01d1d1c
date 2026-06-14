import { useEffect, useState } from "react";

import { AIChatPanel } from "./AIChatPanel";
import kadenceAvatar from "@/assets/kadence-avatar.png";

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
          className={`kadence-fab ${pulse ? "kadence-fab-pulse" : ""}`}
        >
          <span className="kadence-fab-inner">
            <img
              src={kadenceAvatar}
              alt="Kadence"
              style={{ width: 44, height: 44, objectFit: "contain", display: "block" }}
            />
          </span>
          {unread > 0 && <span className="kadence-fab-badge" />}
        </button>
      )}

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <AIChatPanel onClose={() => setOpen(false)} />
        </div>
      )}

      <style>{`
        .kadence-fab {
          position: fixed;
          bottom: calc(80px + env(safe-area-inset-bottom));
          right: max(16px, calc(50vw - 215px + 16px));
          width: 60px;
          height: 60px;
          padding: 0;
          border: none;
          border-radius: 50%;
          background: transparent;
          cursor: pointer;
          z-index: 45;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .kadence-fab:hover { transform: translateY(-2px) scale(1.04); }
        .kadence-fab:active { transform: translateY(0) scale(0.98); }
        .kadence-fab-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 25%, #FFFFFF 0%, #FAFAF8 55%, #F5F0EA 100%);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.9) inset,
            0 0 0 1px rgba(240,153,123,0.22),
            0 10px 24px -8px rgba(60,30,15,0.22),
            0 4px 10px -4px rgba(60,30,15,0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .kadence-fab-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--coral, #F0997B);
          box-shadow: 0 0 0 2px #FAFAF8;
        }
        @keyframes kadence-fab-pulse-kf {
          0%, 100% { box-shadow: 0 0 0 0 rgba(240,153,123,0.45); }
          50% { box-shadow: 0 0 0 14px rgba(240,153,123,0); }
        }
        .kadence-fab-pulse .kadence-fab-inner {
          animation: kadence-fab-pulse-kf 1.8s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
