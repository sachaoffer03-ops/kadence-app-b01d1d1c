import { useEffect } from "react";

interface Props {
  url: string;
  onComplete: () => void;
  alreadyCompleted?: boolean;
}

export function PdfViewer({ url, onComplete, alreadyCompleted }: Props) {
  useEffect(() => {
    if (alreadyCompleted) return;
    const t = setTimeout(() => onComplete(), 30000);
    return () => clearTimeout(t);
  }, [alreadyCompleted, onComplete]);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid var(--border)", aspectRatio: "3/4", maxHeight: "70vh" }}>
      <iframe src={url} className="w-full h-full" title="PDF" />
    </div>
  );
}
