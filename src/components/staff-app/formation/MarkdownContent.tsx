import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
  onComplete: () => void;
  alreadyCompleted?: boolean;
}

export function MarkdownContent({ content, onComplete, alreadyCompleted }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (alreadyCompleted) return;
    const t = setTimeout(() => onComplete(), 30000);
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.bottom - window.innerHeight < 100) onComplete();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener("scroll", onScroll); };
  }, [alreadyCompleted, onComplete]);

  return (
    <div ref={ref} className="prose prose-sm max-w-none" style={{ fontSize: 14, lineHeight: 1.7, color: "var(--foreground)" }}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
