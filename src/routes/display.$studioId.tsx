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
  const [totalSeconds, setTotalSeconds] = useState(60);
  const [now, setNow] = useState(() => new Date());

  const fetchCode = useCallback(async () => {
    try {
      const r = await fetch(`/api/public/studio-qr/${studioId}`, { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j: QrData = await r.json();
      setData(j);
      setSecondsLeft(j.expiresInSec);
      setTotalSeconds(j.renewalSeconds || j.expiresInSec || 60);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Erreur réseau");
    }
  }, [studioId]);

  useEffect(() => { fetchCode(); }, [fetchCode]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      setSecondsLeft((s) => {
        if (s <= 1) { fetchCode(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [fetchCode]);

  // Wakelock — empêcher la tablette de s'endormir
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
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#FAFAF8",
        color: "#1a1a1a",
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Header — discret */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "28px 40px",
          fontSize: 13,
          color: "rgba(26,26,26,0.5)",
          fontWeight: 500,
          letterSpacing: "0.02em",
        }}
      >
        <div style={{ textTransform: "capitalize" }}>{dateStr}</div>
        <div style={{ fontVariantNumeric: "tabular-nums" }}>{timeStr}</div>
      </div>

      {/* Bloc central */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 40px 60px",
        }}
      >
        {error ? (
          <div
            style={{
              padding: "14px 22px",
              borderRadius: 12,
              backgroundColor: "rgba(176,0,0,0.06)",
              color: "#b00",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        ) : !data ? (
          <div style={{ fontSize: 14, color: "rgba(26,26,26,0.4)" }}>Chargement…</div>
        ) : (
          <>
            {/* Nom du studio */}
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "rgba(26,26,26,0.55)",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                marginBottom: 14,
              }}
            >
              {data.studioName}
            </div>

            {/* Titre */}
            <h1
              style={{
                fontSize: 38,
                fontWeight: 400,
                margin: 0,
                marginBottom: 44,
                letterSpacing: "-0.02em",
                color: "#1a1a1a",
              }}
            >
              Pointage du jour
            </h1>

            {/* QR avec anneau de progression */}
            <div style={{ position: "relative", marginBottom: 44 }}>
              {/* Anneau de progression */}
              <svg
                width={460}
                height={460}
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: "rotate(-90deg)",
                  pointerEvents: "none",
                }}
              >
                <circle
                  cx={230}
                  cy={230}
                  r={224}
                  fill="none"
                  stroke="rgba(26,26,26,0.06)"
                  strokeWidth={2}
                />
                <circle
                  cx={230}
                  cy={230}
                  r={224}
                  fill="none"
                  stroke="#F0997B"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 224}
                  strokeDashoffset={2 * Math.PI * 224 * (1 - progress)}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>

              {/* Carte QR */}
              <div
                style={{
                  width: 460,
                  height: 460,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#fff",
                  borderRadius: 28,
                  boxShadow:
                    "0 1px 2px rgba(0,0,0,0.03), 0 8px 24px rgba(0,0,0,0.04), inset 0 0 0 0.5px rgba(0,0,0,0.04)",
                }}
              >
                <QRCodeSVG
                  value={qrPayload}
                  size={360}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#1a1a1a"
                />
              </div>
            </div>

            {/* Code manuel */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(26,26,26,0.45)",
                  marginBottom: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                ou saisis le code
              </div>
              <div
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 52,
                  letterSpacing: "0.28em",
                  fontWeight: 400,
                  paddingLeft: "0.28em",
                  color: "#1a1a1a",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {data.code}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer minimal */}
      <div
        style={{
          padding: "0 40px 28px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          color: "rgba(26,26,26,0.35)",
          letterSpacing: "0.04em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 5,
            height: 5,
            borderRadius: "50%",
            backgroundColor: data ? "#F0997B" : "rgba(26,26,26,0.2)",
          }}
        />
        {data ? `Nouveau code dans ${secondsLeft}s` : "En attente"}
      </div>
    </div>
  );
}
