import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { employees, roleColors, type Role, type Studio } from "@/lib/mock-data";

export const Route = createFileRoute("/planning")({
  component: PlanningPage,
  head: () => ({
    meta: [{ title: "Planning — Shifty" }],
  }),
});

const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const timeSlots = ["07h", "10h", "14h", "17h"];
const roles: Role[] = ["Barista", "Accueil", "Host", "Cuisine"];
const studios: Studio[] = ["Skult Rhodes", "Skult Châtelain"];

interface MockShift {
  id: string;
  day: number;
  slot: number;
  name: string;
  role: Role;
  studio: Studio;
  time: string;
  hole?: boolean;
}

function generateShifts(): MockShift[] {
  const shifts: MockShift[] = [];
  let id = 0;
  const names = employees.slice(0, 16);

  for (let day = 0; day < 7; day++) {
    for (let slot = 0; slot < 4; slot++) {
      const count = slot === 0 || slot === 3 ? 2 : 3;
      for (let i = 0; i < count; i++) {
        const emp = names[(id + day * 3 + slot) % names.length];
        const role = emp.roles[0];
        const studio = day < 4 ? "Skult Rhodes" : "Skult Châtelain";
        const times = ["07h — 12h", "10h — 15h", "14h — 19h", "17h — 23h"];
        shifts.push({
          id: String(id++),
          day, slot,
          name: `${emp.firstName} ${emp.lastName.charAt(0)}.`,
          role, studio,
          time: times[slot],
        });
      }
    }
  }

  // Add holes
  shifts.push({ id: "hole1", day: 2, slot: 1, name: "", role: "Barista", studio: "Skult Rhodes", time: "10h — 15h", hole: true });
  shifts.push({ id: "hole2", day: 5, slot: 2, name: "", role: "Host", studio: "Skult Châtelain", time: "14h — 19h", hole: true });
  shifts.push({ id: "hole3", day: 1, slot: 3, name: "", role: "Accueil", studio: "Skult Rhodes", time: "17h — 23h", hole: true });
  shifts.push({ id: "hole4", day: 6, slot: 0, name: "", role: "Cuisine", studio: "Skult Châtelain", time: "07h — 12h", hole: true });

  return shifts;
}

function PlanningPage() {
  const [roleFilter, setRoleFilter] = useState<Role | "tous">("tous");
  const [studioFilter, setStudioFilter] = useState<Studio | "tous">("tous");
  const shifts = useMemo(() => generateShifts(), []);
  const todayIdx = 3; // Thursday

  const filtered = shifts.filter((s) => {
    if (roleFilter !== "tous" && s.role !== roleFilter) return false;
    if (studioFilter !== "tous" && s.studio !== studioFilter) return false;
    return true;
  });

  return (
    <div className="p-6" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button className="rounded-md p-1 transition-colors" style={{ border: "0.5px solid var(--border)" }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 500 }}>Mai 2026</span>
          <button className="rounded-md p-1 transition-colors" style={{ border: "0.5px solid var(--border)" }}>
            <ChevronRight size={16} />
          </button>
          <button
            className="rounded-md px-3 py-1 ml-2"
            style={{ fontSize: 12, border: "0.5px solid var(--border)", color: "var(--foreground)" }}
          >
            Aujourd'hui
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        {(["tous", ...roles] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r as Role | "tous")}
            className="rounded-full px-2.5 py-1 flex items-center gap-1.5 transition-colors"
            style={{
              fontSize: 11,
              fontWeight: roleFilter === r ? 500 : 400,
              backgroundColor: roleFilter === r ? (r === "tous" ? "var(--foreground)" : roleColors[r as Role].bg) : "transparent",
              color: roleFilter === r ? (r === "tous" ? "var(--card)" : roleColors[r as Role].text) : "var(--muted-foreground)",
              border: roleFilter === r ? "none" : "0.5px solid var(--border)",
            }}
          >
            {r !== "tous" && (
              <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: roleColors[r as Role].dot }} />
            )}
            {r === "tous" ? "Tous les rôles" : r}
          </button>
        ))}
        <span style={{ width: 1, height: 16, backgroundColor: "var(--border)", display: "inline-block", margin: "0 4px" }} />
        {(["tous", ...studios] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStudioFilter(s as Studio | "tous")}
            className="rounded-full px-2.5 py-1 transition-colors"
            style={{
              fontSize: 11,
              fontWeight: studioFilter === s ? 500 : 400,
              backgroundColor: studioFilter === s ? "var(--foreground)" : "transparent",
              color: studioFilter === s ? "var(--card)" : "var(--muted-foreground)",
              border: studioFilter === s ? "none" : "0.5px solid var(--border)",
            }}
          >
            {s === "tous" ? "Tous les studios" : s.replace("Skult ", "")}
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        {/* Day headers */}
        <div className="grid grid-cols-8" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div className="px-3 py-2" style={{ fontSize: 11, color: "var(--muted-foreground)" }} />
          {days.map((d, i) => (
            <div
              key={d}
              className="px-3 py-2 text-center"
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: i === todayIdx ? "var(--coral-dark)" : "var(--muted-foreground)",
                backgroundColor: i === todayIdx ? "var(--coral-light)" : "transparent",
              }}
            >
              {d} {8 + i}
            </div>
          ))}
        </div>

        {/* Time rows */}
        {timeSlots.map((time, slotIdx) => (
          <div key={time} className="grid grid-cols-8" style={{ borderBottom: "0.5px solid var(--border)", minHeight: 80 }}>
            <div className="px-3 py-2 flex items-start" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {time}
            </div>
            {days.map((_, dayIdx) => {
              const cellShifts = filtered.filter((s) => s.day === dayIdx && s.slot === slotIdx);
              const isToday = dayIdx === todayIdx;
              return (
                <div
                  key={dayIdx}
                  className="px-1 py-1 flex flex-col gap-1"
                  style={{
                    borderLeft: "0.5px solid var(--border)",
                    backgroundColor: isToday ? "rgba(240,153,123,0.04)" : "transparent",
                  }}
                >
                  {cellShifts.map((shift) =>
                    shift.hole ? (
                      <div
                        key={shift.id}
                        className="rounded-md px-2 py-1.5 flex items-center gap-1"
                        style={{
                          fontSize: 10,
                          backgroundColor: "var(--danger-bg)",
                          color: "var(--danger-text)",
                          border: "1px dashed var(--danger-text)",
                          cursor: "pointer",
                        }}
                      >
                        <AlertTriangle size={10} />
                        Trou · {shift.role}
                      </div>
                    ) : (
                      <div
                        key={shift.id}
                        className="rounded-md px-2 py-1.5 transition-all"
                        style={{
                          fontSize: 10,
                          backgroundColor: roleColors[shift.role].bg,
                          color: roleColors[shift.role].text,
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                      >
                        <div style={{ fontWeight: 500 }}>{shift.name}</div>
                        <div style={{ opacity: 0.7 }}>{shift.time}</div>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
