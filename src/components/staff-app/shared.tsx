import { roleColors as rc, type Role } from "@/lib/mock-data";
import { X } from "lucide-react";
import { useEffect } from "react";

export const roleColors = rc;
export type { Role };

export function fmtTime(t: string) { return t.slice(0, 5).replace(":", "h"); }
export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
export function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export interface ProfileRow {
  first_name: string; last_name: string; email: string; contract: string | null;
  studio_id: string | null; quota_used: number | null; quota_max: number | null;
  score: number | null;
}
export interface ShiftRow {
  id: string; shift_date: string; start_time: string; end_time: string;
  business_role: string; studio_id: string | null;
  clocked_in_at?: string | null; clocked_out_at?: string | null;
}

/** Bottom sheet (mobile-first modal) */
export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full flex flex-col"
        style={{
          maxWidth: 430,
          maxHeight: "92vh",
          backgroundColor: "#FAF8F4",
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          animation: "slideUp 220ms ease-out",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{title}</div>
          <button onClick={onClose} className="rounded-full p-1.5" style={{ backgroundColor: "var(--muted)" }}>
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t shrink-0" style={{ borderColor: "rgba(0,0,0,0.06)", backgroundColor: "#fff" }}>{footer}</div>}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled, type = "button" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit";
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="w-full rounded-md py-3 transition-opacity disabled:opacity-50"
      style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full rounded-md py-3 border transition-opacity disabled:opacity-50"
      style={{ fontSize: 13, fontWeight: 500, backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)", color: "var(--foreground)" }}>
      {children}
    </button>
  );
}

export function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function TextArea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full rounded-md border px-3 py-2.5 outline-none focus:border-[var(--foreground)] resize-none"
      style={{ fontSize: 13, borderColor: "rgba(0,0,0,0.12)", backgroundColor: "#fff", lineHeight: 1.5 }} />
  );
}
