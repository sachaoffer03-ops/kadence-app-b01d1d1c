import { useMemo } from "react";

/**
 * Sélecteur d'heure 24h — design épuré aligné DA Kadence.
 * Évite le bug des navigateurs en locale AM/PM où `<input type="time">`
 * refuse "17" et retombe sur "05" (5 AM).
 */
export function TimePicker24({
  value,
  onChange,
  step = 15,
  required,
  className,
  style,
  placeholder = "--",
}: {
  value: string; // "HH:MM" ou "" pour non sélectionné
  onChange: (v: string) => void;
  step?: 5 | 10 | 15 | 30;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const hasValue = !!value && /^\d{1,2}:\d{2}/.test(value);
  const [hh, mm] = (value || ":").slice(0, 5).split(":");
  const hour = hasValue ? Math.max(0, Math.min(23, parseInt(hh, 10) || 0)) : -1;
  const minute = hasValue ? Math.max(0, Math.min(59, parseInt(mm, 10) || 0)) : -1;

  const minuteOptions = useMemo(() => {
    const arr: number[] = [];
    for (let m = 0; m < 60; m += step) arr.push(m);
    if (minute >= 0 && !arr.includes(minute)) arr.push(minute);
    return arr.sort((a, b) => a - b);
  }, [step, minute]);

  const pad = (n: number) => String(n).padStart(2, "0");

  const setHour = (h: number) => {
    onChange(`${pad(h)}:${pad(minute >= 0 ? minute : 0)}`);
  };
  const setMinute = (m: number) => {
    onChange(`${pad(hour >= 0 ? hour : 0)}:${pad(m)}`);
  };

  const selectCls =
    "appearance-none rounded-md border bg-transparent pl-3 pr-7 py-2 text-[13px] outline-none transition-colors cursor-pointer hover:border-[var(--coral)] focus:border-[var(--coral)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--coral)_25%,transparent)]";

  const wrapCls = "relative flex-1";
  const chevron = (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
      style={{ color: "var(--muted-foreground)" }}
      aria-hidden
    >
      <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div className={`flex items-center gap-1.5 ${className || ""}`} style={style}>
      <div className={wrapCls}>
        <select
          aria-label="Heures"
          value={hour >= 0 ? String(hour) : ""}
          onChange={(e) => setHour(parseInt(e.target.value, 10))}
          className={selectCls}
          required={required}
          style={{ borderColor: "var(--border)", color: hour >= 0 ? "var(--foreground)" : "var(--muted-foreground)", width: "100%" }}
        >
          <option value="" disabled>{placeholder}</option>
          {Array.from({ length: 24 }).map((_, h) => (
            <option key={h} value={h}>{pad(h)}</option>
          ))}
        </select>
        {chevron}
      </div>
      <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>h</span>
      <div className={wrapCls}>
        <select
          aria-label="Minutes"
          value={minute >= 0 ? String(minute) : ""}
          onChange={(e) => setMinute(parseInt(e.target.value, 10))}
          className={selectCls}
          required={required}
          style={{ borderColor: "var(--border)", color: minute >= 0 ? "var(--foreground)" : "var(--muted-foreground)", width: "100%" }}
        >
          <option value="" disabled>{placeholder}</option>
          {minuteOptions.map((m) => (
            <option key={m} value={m}>{pad(m)}</option>
          ))}
        </select>
        {chevron}
      </div>
    </div>
  );
}
