import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

interface Props {
  url: string;
  durationHint?: number | null;
  initials: string;
  initialProgressPct?: number;
  alreadyCompleted?: boolean;
  reviewMode?: boolean;
  onProgress: (pct: number, increment: number) => void;
  onComplete: () => void;
}

export function VideoPlayer({ url, initials, initialProgressPct = 0, alreadyCompleted, reviewMode, onProgress, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTickRef = useRef<number>(Date.now());
  const lastSentRef = useRef<number>(Date.now());
  const accumRef = useRef<number>(0);
  const watchedRef = useRef<number>(initialProgressPct);
  const completedRef = useRef<boolean>(!!alreadyCompleted);
  const [pct, setPct] = useState<number>(initialProgressPct);
  const [wmPos, setWmPos] = useState<{ top: string; right: string }>({ top: "12px", right: "12px" });
  const [now, setNow] = useState<string>("00:00");

  // Move watermark every 30s
  useEffect(() => {
    const tick = () => {
      const positions = [
        { top: "12px", right: "12px" },
        { top: "12px", right: "auto" },
        { top: "auto", right: "12px" },
        { top: "auto", right: "auto" },
      ];
      setWmPos(positions[Math.floor(Math.random() * positions.length)]);
    };
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  // Live timestamp for watermark (every 2s)
  useEffect(() => {
    const t = setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      const s = Math.floor(v.currentTime);
      const m = Math.floor(s / 60);
      setNow(`${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration || reviewMode) return;
    const newPct = Math.floor((v.currentTime / v.duration) * 100);
    if (newPct > watchedRef.current) {
      watchedRef.current = newPct;
      setPct(newPct);
    }
    const dt = (Date.now() - lastTickRef.current) / 1000;
    lastTickRef.current = Date.now();
    if (!v.paused && dt < 3) accumRef.current += dt;
    // debounce push every 5s
    if (Date.now() - lastSentRef.current > 5000) {
      lastSentRef.current = Date.now();
      const inc = Math.round(accumRef.current);
      accumRef.current = 0;
      onProgress(watchedRef.current, inc);
    }
    if (!completedRef.current && watchedRef.current >= 90) {
      completedRef.current = true;
      onComplete();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
        <video
          ref={videoRef}
          src={url}
          controls
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => { lastTickRef.current = Date.now(); }}
          className="w-full h-full"
        />
        <div className="absolute pointer-events-none select-none" style={{ ...wmPos, padding: "4px 8px", borderRadius: 6, backgroundColor: "rgba(0,0,0,0.35)", color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", backdropFilter: "blur(2px)" }}>
          {initials} · {now}
        </div>
      </div>

      {!reviewMode && (
        <div className="rounded-lg flex items-start gap-2 px-3 py-2.5" style={{ backgroundColor: "color-mix(in oklch, var(--accent-blue, #2563EB) 8%, transparent)", border: "0.5px solid color-mix(in oklch, var(--accent-blue, #2563EB) 25%, transparent)" }}>
          <Info size={14} strokeWidth={1.5} style={{ color: "#2563EB", flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1" style={{ fontSize: 12, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 500 }}>Regarde 90% de la vidéo pour débloquer la suite.</div>
            <div style={{ color: "var(--muted-foreground)", marginTop: 2 }}>Pause et retour en arrière OK · Progression {pct}%</div>
          </div>
        </div>
      )}
    </div>
  );
}
