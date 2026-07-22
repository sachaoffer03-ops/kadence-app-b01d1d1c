import { useMemo } from "react";

/**
 * Sélecteur d'heure 24h robuste (Heure + Minutes en select natif).
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
}: {
  value: string; // "HH:MM" (24h)
  onChange: (v: string) => void;
  step?: 5 | 10 | 15 | 30;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [hh, mm] = (value || "00:00").slice(0, 5).split(":");
  const hour = Math.max(0, Math.min(23, parseInt(hh || "0", 10) || 0));
  const minute = Math.max(0, Math.min(59, parseInt(mm || "0", 10) || 0));

  const minuteOptions = useMemo(() => {
    const arr: number[] = [];
    for (let m = 0; m < 60; m += step) arr.push(m);
    if (!arr.includes(minute)) arr.push(minute);
    return arr.sort((a, b) => a - b);
  }, [step, minute]);

  const set = (h: number, m: number) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    onChange(`${pad(h)}:${pad(m)}`);
  };

  const selectCls =
    "rounded-md border bg-transparent px-1.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-[var(--ring)]";

  return (
    <div className={`flex items-center gap-1 ${className || ""}`} style={style}>
      <select
        aria-label="Heures"
        value={hour}
        onChange={(e) => set(parseInt(e.target.value, 10), minute)}
        className={selectCls}
        required={required}
        style={{ flex: 1 }}
      >
        {Array.from({ length: 24 }).map((_, h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, "0")}
          </option>
        ))}
      </select>
      <span style={{ color: "var(--muted-foreground)", fontSize: 13 }}>h</span>
      <select
        aria-label="Minutes"
        value={minute}
        onChange={(e) => set(hour, parseInt(e.target.value, 10))}
        className={selectCls}
        required={required}
        style={{ flex: 1 }}
      >
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
    </div>
  );
}
