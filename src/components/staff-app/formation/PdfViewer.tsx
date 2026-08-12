import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

interface Props {
  url: string;
  onComplete: () => void;
  alreadyCompleted?: boolean;
}

export function PdfViewer({ url, onComplete, alreadyCompleted }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (alreadyCompleted) return;
    const t = setTimeout(() => onComplete(), 30000);
    return () => clearTimeout(t);
  }, [alreadyCompleted, onComplete]);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";
    setLoading(true);
    setFailed(false);

    (async () => {
      try {
        const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const PdfWorker: any = (await import("pdfjs-dist/legacy/build/pdf.worker.mjs?worker")).default;
        pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();

        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        setPages(doc.numPages);

        const width = el.clientWidth || 320;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          const viewport = page.getViewport({ scale: scale * dpr });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.style.borderRadius = "8px";
          canvas.style.marginBottom = "10px";
          canvas.style.border = "0.5px solid var(--border)";
          el.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (i === 1) setLoading(false);
        }
        setLoading(false);
      } catch {
        if (!cancelled) { setFailed(true); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  return (
    <div className="flex flex-col gap-2">
      {pages > 1 && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {pages} pages · fais défiler pour tout lire
        </div>
      )}
      <div ref={containerRef} className="w-full" />
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          <Loader2 size={14} className="animate-spin" /> Chargement du document…
        </div>
      )}
      {failed && (
        <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid var(--border)", aspectRatio: "3/4", maxHeight: "70vh" }}>
          <iframe src={url} className="w-full h-full" title="PDF" />
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 self-start underline"
        style={{ fontSize: 11, color: "var(--muted-foreground)" }}
      >
        <ExternalLink size={11} /> Ouvrir le PDF
      </a>
    </div>
  );
}
