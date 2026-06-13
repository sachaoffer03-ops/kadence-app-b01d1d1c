import { useMemo } from "react";
import { roleColors, type Role } from "@/lib/role-colors";

interface ShiftLite {
  shift_date: string;
  business_role: string;
  clocked_out_at?: string | null;
}

interface Props {
  monthCursor: Date;            // n'importe quelle date dans le mois affiché
  shifts: ShiftLite[];
  selectedISO: string | null;
  onSelect: (iso: string | null) => void;
}

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/** Mini grille mensuelle 7×6 avec points colorés par rôle */
export function MonthCalendar({ monthCursor, shifts, selectedISO, onSelect }: Props) {
  const today = toISO(new Date());

  const cells = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // 0 = lundi
    const start = new Date(first); start.setDate(first.getDate() - offset);
    const arr: { iso: string; date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      arr.push({ iso: toISO(d), date: d, inMonth: d.getMonth() === monthCursor.getMonth() });
    }
    return arr;
  }, [monthCursor]);

  const byDay = useMemo(() => {
    const map: Record<string, ShiftLite[]> = {};
    for (const s of shifts) (map[s.shift_date] ||= []).push(s);
    return map;
  }, [shifts]);

  const weekdayLabels = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div
      className="rounded-2xl mb-3"
      style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", padding: 10 }}
    >
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {weekdayLabels.map((l, i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textAlign: "center", paddingTop: 2 }}>
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const dayShifts = byDay[c.iso] || [];
          const isToday = c.iso === today;
          const isSelected = selectedISO === c.iso;
          const dots = dayShifts.slice(0, 3);
          return (
            <button
              key={c.iso}
              onClick={() => onSelect(isSelected ? null : c.iso)}
              className="flex flex-col items-center justify-start gap-1 rounded-lg transition-colors"
              style={{
                paddingTop: 6,
                paddingBottom: 4,
                minHeight: 44,
                backgroundColor: isSelected ? "var(--coral-light)" : "transparent",
                border: isToday && !isSelected ? "0.5px solid var(--coral)" : "0.5px solid transparent",
                cursor: "pointer",
                opacity: c.inMonth ? 1 : 0.3,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: isToday ? 500 : 400,
                  color: isToday ? "var(--coral-dark)" : "var(--foreground)",
                  lineHeight: 1,
                }}
              >
                {c.date.getDate()}
              </span>
              <div className="flex items-center gap-0.5" style={{ height: 5 }}>
                {dots.map((s, i) => {
                  const rc = roleColors[s.business_role as Role];
                  const done = !!s.clocked_out_at;
                  return (
                    <span
                      key={i}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        backgroundColor: done ? "rgba(0,0,0,0.25)" : (rc?.dot || "var(--coral)"),
                      }}
                    />
                  );
                })}
                {dayShifts.length > 3 && (
                  <span style={{ fontSize: 8, color: "var(--muted-foreground)", lineHeight: 1 }}>+{dayShifts.length - 3}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
