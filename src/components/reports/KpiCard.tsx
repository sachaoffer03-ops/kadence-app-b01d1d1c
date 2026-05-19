import { ReactNode } from "react";

export function KpiCard({ label, value, subtext, accent, footer, children }: {
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
  accent?: "good" | "warn" | "bad" | null;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const accentColor =
    accent === "good" ? "var(--success-text)" :
    accent === "warn" ? "var(--warning-text)" :
    accent === "bad"  ? "var(--danger-text)" :
    "var(--foreground)";
  return (
    <div
      className="rounded-lg p-4 border flex flex-col gap-2"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 500, color: accentColor, lineHeight: 1.1 }}>{value}</div>
      {subtext && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{subtext}</div>}
      {children}
      {footer && <div className="pt-1">{footer}</div>}
    </div>
  );
}
