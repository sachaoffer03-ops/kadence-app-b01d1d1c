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
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);

  const computePos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 10;
    const gap = 4;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const width = Math.min(Math.max(minWidth, 160, r.width), viewportWidth - margin * 2);
    const rawLeft = align === "right" ? r.right - width : r.left;
    const left = Math.min(Math.max(margin, rawLeft), Math.max(margin, viewportWidth - width - margin));
    const idealHeight = Math.min(320, options.length * 30 + 8);
    const spaceBelow = Math.max(0, viewportHeight - (r.bottom + gap) - margin);
    const spaceAbove = Math.max(0, r.top - gap - margin);
    const openAbove = spaceBelow < idealHeight && spaceAbove > spaceBelow;
    const availableHeight = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(72, Math.min(idealHeight, availableHeight));

    if (openAbove) {
      setPos({
        bottom: window.innerHeight - r.top + gap,
        left,
        width,
        maxHeight,
      });
    } else {
      setPos({
        top: r.bottom + gap,
        left,
        width,
        maxHeight,
      });
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
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      computePos();
    };
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
            bottom: pos.bottom,
            left: pos.left,
            width: pos.width,
            zIndex: 1000,
            backgroundColor: "var(--card)",
            border: "0.5px solid var(--border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            padding: 4,
            maxHeight: pos.maxHeight,
            overflowY: "auto",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
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
