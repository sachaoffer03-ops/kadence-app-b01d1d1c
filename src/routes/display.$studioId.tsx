import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/display/$studioId")({
  component: DisplayPage,
});

type QrData = {
  studioId: string;
  studioName: string;
  code: string;
  renewalSeconds: number;
  generatedAt: string;
  expiresInSec: number;
};

function DisplayPage() {
  const { studioId } = Route.useParams();
  const [data, setData] = useState<QrData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [now, setNow] = useState(() => new Date());

  const fetchCode = useCallback(async () => {
    try {
      const r = await fetch(`/api/public/studio-qr/${studioId}`, { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j: QrData = await r.json();
      setData(j);
      setSecondsLeft(j.expiresInSec);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Erreur réseau");
    }
  }, [studioId]);

  useEffect(() => {
    fetchCode();
  }, [fetchCode]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      setSecondsLeft((s) => {
        if (s <= 1) {
          fetchCode();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [fetchCode]);

  // wakelock to keep tablet screen on
  useEffect(() => {
    let wl: any = null;
    (async () => {
      try {
        // @ts-ignore
        if (navigator.wakeLock) wl = await navigator.wakeLock.request("screen");
      } catch {}
    })();
    return () => { try { wl?.release?.(); } catch {} };
  }, []);

  const qrPayload = data?.code ?? "";
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#FAFAF8",
        color: "#1a1a1a",
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <div style={{ position: "absolute", top: 24, left: 32, fontSize: 14, color: "#666" }}>
        {dateStr} · {timeStr}
      </div>

      {error && (
        <div style={{ color: "#b00", fontSize: 16, marginBottom: 24 }}>
          Erreur : {error}
        </div>
      )}

      {data ? (
        <>
          <div style={{ fontSize: 18, color: "#666", marginBottom: 8, fontWeight: 500 }}>
            {data.studioName}
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 500, margin: 0, marginBottom: 32 }}>
            Scanne pour pointer
          </h1>

          <div
            style={{
              backgroundColor: "#fff",
              padding: 32,
              borderRadius: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)",
            }}
          >
            <QRCodeSVG
              value={qrPayload}
              size={380}
              level="M"
              bgColor="#ffffff"
              fgColor="#1a1a1a"
            />
          </div>

          <div style={{ marginTop: 32, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Code manuel
            </div>
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 56,
                letterSpacing: "0.3em",
                fontWeight: 500,
                paddingLeft: "0.3em",
              }}
            >
              {data.code}
            </div>
          </div>

          <div style={{ marginTop: 24, fontSize: 12, color: "#999" }}>
            Nouveau code dans {secondsLeft}s
          </div>
        </>
      ) : (
        !error && <div style={{ fontSize: 14, color: "#888" }}>Chargement…</div>
      )}
    </div>
  );
}
