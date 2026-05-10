import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

interface DropdownProps {
  label?: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  minWidth?: number;
  align?: "left" | "right";
}

export function Dropdown({ label, value, options, onChange, minWidth = 140, align = "left" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center gap-2" style={{ fontSize: 12 }}>
      {label && <span style={{ color: "var(--muted-foreground)" }}>{label}</span>}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 transition-colors"
        style={{
          fontSize: 12,
          fontWeight: 500,
          border: "0.5px solid var(--border)",
          backgroundColor: open ? "var(--muted)" : "var(--card)",
          minWidth,
          color: "var(--foreground)",
        }}
      >
        <span>{value}</span>
        <ChevronDown size={12} style={{ color: "var(--muted-foreground)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div
          className="absolute z-30 rounded-lg overflow-hidden"
          style={{
            top: "calc(100% + 4px)",
            [align === "right" ? "right" : "left"]: 0,
            minWidth: Math.max(minWidth, 160),
            backgroundColor: "var(--card)",
            border: "0.5px solid var(--border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            padding: 4,
          }}
        >
          {options.map(o => {
            const sel = o === value;
            return (
              <button
                key={o}
                type="button"
                onClick={() => { onChange(o); setOpen(false); }}
                className="flex items-center justify-between w-full rounded-md px-2.5 py-1.5 text-left transition-colors"
                style={{
                  fontSize: 12,
                  fontWeight: sel ? 500 : 400,
                  backgroundColor: sel ? "var(--muted)" : "transparent",
                  color: "var(--foreground)",
                }}
                onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
                onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                <span>{o}</span>
                {sel && <Check size={12} style={{ color: "var(--muted-foreground)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
