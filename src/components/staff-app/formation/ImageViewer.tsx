import { useEffect } from "react";

interface Props {
  url: string;
  description?: string | null;
  onComplete: () => void;
  alreadyCompleted?: boolean;
}

export function ImageViewer({ url, description, onComplete, alreadyCompleted }: Props) {
  useEffect(() => {
    if (alreadyCompleted) return;
    const t = setTimeout(() => onComplete(), 3000);
    return () => clearTimeout(t);
  }, [alreadyCompleted, onComplete]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl overflow-hidden flex items-center justify-center" style={{ backgroundColor: "var(--muted)", border: "0.5px solid var(--border)" }}>
        <img src={url} alt="" className="max-w-full max-h-[70vh] object-contain" />
      </div>
      {description && (
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>{description}</div>
      )}
    </div>
  );
}
