import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

interface DropdownProps {
  label?: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  minWidth?: number;
  align?: "left" | "right";
  fullWidth?: boolean;
  placeholder?: string;
}

export function Dropdown({ label, value, options, onChange, minWidth = 140, align = "left", fullWidth = false, placeholder }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const computePos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(minWidth, 160, r.width);
    const left = align === "right" ? r.right - width : r.left;
    const margin = 12;
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;
    // Flip vers le haut si pas assez de place en bas mais plus de place en haut
    const preferAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
    if (preferAbove) {
      const maxHeight = Math.max(160, spaceAbove);
      setPos({ top: Math.max(margin, r.top - 4 - Math.min(maxHeight, 320)), left, width, maxHeight });
    } else {
      const maxHeight = Math.max(160, spaceBelow);
      setPos({ top: r.bottom + 4, left, width, maxHeight });
    }
  };

  useLayoutEffect(() => {
    if (open) computePos();
  }, [open]);


  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onScroll = () => computePos();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${fullWidth ? "flex w-full" : "inline-flex"} items-center gap-2`} style={{ fontSize: 12 }}>
      {label && <span style={{ color: "var(--muted-foreground)" }}>{label}</span>}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between gap-2 rounded-md transition-colors ${fullWidth ? "w-full px-3 py-2" : "px-2.5 py-1.5"}`}
        style={{
          fontSize: fullWidth ? 13 : 12,
          fontWeight: value ? 500 : 400,
          border: "0.5px solid var(--border)",
          backgroundColor: open ? "var(--muted)" : "var(--card)",
          minWidth: fullWidth ? undefined : minWidth,
          color: value ? "var(--foreground)" : "var(--muted-foreground)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || placeholder || "Sélectionner..."}</span>
        <ChevronDown size={fullWidth ? 14 : 12} style={{ color: "var(--muted-foreground)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="rounded-lg"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            minWidth: pos.width,
            zIndex: 1000,
            backgroundColor: "var(--card)",
            border: "0.5px solid var(--border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            padding: 4,
            maxHeight: Math.max(160, window.innerHeight - pos.top - 16),
            overflowY: "auto",
            overscrollBehavior: "contain",
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
        </div>,
        document.body
      )}
    </div>
  );
}
