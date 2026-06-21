import { useMemo } from "react";
import { Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { validateRoleSegments, type RoleSegment } from "@/lib/role-segments";
import { getRoleStyle } from "@/lib/staff-helpers";
import { Dropdown } from "@/components/Dropdown";

interface Props {
  shiftStart: string; // "HH:MM"
  shiftEnd: string; // "HH:MM"
  segments: RoleSegment[];
  onChange: (segs: RoleSegment[]) => void;
  knownRoles: string[];
  disabled?: boolean;
}

const toHHMM = (t: string) => (t ? t.slice(0, 5) : "");
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const minToHHMM = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};
// Snap au quart d'heure le plus proche
const snap15 = (m: number) => Math.round(m / 15) * 15;

export function RoleSegmentsEditor({
  shiftStart,
  shiftEnd,
  segments,
  onChange,
  knownRoles,
  disabled = false,
}: Props) {
  const start = toHHMM(shiftStart);
  const end = toHHMM(shiftEnd);
  const startM = toMin(start);
  const endM = toMin(end);
  const totalMin = Math.max(1, endM - startM);

  const validation = useMemo(
    () => validateRoleSegments(segments, start, end, knownRoles),
    [segments, start, end, knownRoles.join("|")],
  );

  const update = (next: RoleSegment[]) => {
    if (disabled) return;
    // S'assure que le 1er segment commence à start et le dernier finit à end
    if (next.length > 0) {
      next[0] = { ...next[0], start_time: start };
      next[next.length - 1] = { ...next[next.length - 1], end_time: end };
    }
    onChange(next);
  };

  const setEnd = (idx: number, value: string) => {
    if (disabled) return;
    if (idx === segments.length - 1) return; // dernier verrouillé sur shift end
    const snapped = minToHHMM(snap15(toMin(value)));
    const prevSeg = segments[idx];
    const nextSeg = segments[idx + 1];
    const prevStartM = toMin(prevSeg.start_time);
    const nextEndM = toMin(nextSeg.end_time);
    const newM = toMin(snapped);
    if (newM <= prevStartM || newM >= nextEndM) return;
    const next = segments.map((s, i) => {
      if (i === idx) return { ...s, end_time: snapped };
      if (i === idx + 1) return { ...s, start_time: snapped };
      return s;
    });
    update(next);
  };

  const setRole = (idx: number, role: string) => {
    if (disabled) return;
    update(segments.map((s, i) => (i === idx ? { ...s, role } : s)));
  };

  const addSegment = () => {
    if (disabled) return;
    // Insère un nouveau segment AVANT le dernier, en coupant ce dernier à mi-chemin
    if (segments.length === 0) {
      const mid = minToHHMM(snap15(startM + totalMin / 2));
      update([
        { role: knownRoles[0] ?? "", start_time: start, end_time: mid },
        { role: knownRoles[1] ?? knownRoles[0] ?? "", start_time: mid, end_time: end },
      ]);
      return;
    }
    const lastIdx = segments.length - 1;
    const lastSeg = segments[lastIdx];
    const lastStart = toMin(lastSeg.start_time);
    const lastEnd = toMin(lastSeg.end_time);
    if (lastEnd - lastStart < 30) return; // pas assez de place
    const mid = minToHHMM(snap15(lastStart + (lastEnd - lastStart) / 2));
    const newSeg: RoleSegment = {
      role: knownRoles.find((r) => !segments.some((s) => s.role === r)) ?? knownRoles[0] ?? "",
      start_time: mid,
      end_time: lastSeg.end_time,
    };
    const next = [...segments];
    next[lastIdx] = { ...lastSeg, end_time: mid };
    next.splice(lastIdx + 1, 0, newSeg);
    update(next);
  };

  const removeSegment = (idx: number) => {
    if (disabled || segments.length <= 2) return;
    // Le précédent absorbe le créneau du segment supprimé
    const next = segments.filter((_, i) => i !== idx);
    if (idx > 0 && idx < segments.length) {
      // segments[idx-1].end_time devient l'ancien segments[idx+1]?.start_time ou shiftEnd
      const newEnd = segments[idx].end_time;
      next[idx - 1] = { ...next[idx - 1], end_time: newEnd };
    }
    update(next);
  };

  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
      {/* Timeline mini */}
      <div className="px-3 pt-3">
        <div className="flex items-center justify-between" style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
          <span>{start}</span>
          <span>{end}</span>
        </div>
        <div className="flex w-full overflow-hidden mt-1" style={{ height: 8, borderRadius: 4, backgroundColor: "var(--muted)" }}>
          {segments.map((s, i) => {
            const segStartM = toMin(s.start_time);
            const segEndM = toMin(s.end_time);
            const w = ((segEndM - segStartM) / totalMin) * 100;
            const st = getRoleStyle(s.role || "");
            return (
              <div
                key={i}
                style={{
                  width: `${Math.max(0, w)}%`,
                  backgroundColor: st.dot,
                  borderRight: i < segments.length - 1 ? "1px solid var(--card)" : "none",
                }}
                title={`${s.role} · ${s.start_time}–${s.end_time}`}
              />
            );
          })}
        </div>
      </div>

      {/* Liste des segments */}
      <div className="px-3 py-3 flex flex-col gap-2">
        {segments.map((seg, i) => {
          const isFirst = i === 0;
          const isLast = i === segments.length - 1;
          const st = getRoleStyle(seg.role || "");
          return (
            <div key={i} className="flex items-center gap-2">
              {/* Heure de début */}
              <div
                className="rounded-md px-2 py-1.5 tabular-nums"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  minWidth: 60,
                  textAlign: "center",
                  backgroundColor: "var(--muted)",
                  color: "var(--muted-foreground)",
                }}
              >
                {seg.start_time}
              </div>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>→</span>
              {/* Heure de fin (input pour les segments intermédiaires) */}
              {isLast ? (
                <div
                  className="rounded-md px-2 py-1.5 tabular-nums"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    minWidth: 60,
                    textAlign: "center",
                    backgroundColor: "var(--muted)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {seg.end_time}
                </div>
              ) : (
                <input
                  type="time"
                  step={900}
                  value={seg.end_time}
                  onChange={(e) => setEnd(i, e.target.value)}
                  disabled={disabled}
                  className="rounded-md px-2 py-1.5 outline-none tabular-nums"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    width: 100,
                    border: "0.5px solid var(--border)",
                    backgroundColor: "var(--background)",
                  }}
                />
              )}

              {/* Rôle */}
              <div className="flex-1">
                <Dropdown
                  value={seg.role}
                  options={
                    seg.role && !knownRoles.includes(seg.role)
                      ? [seg.role, ...knownRoles]
                      : knownRoles
                  }
                  onChange={(v) => setRole(i, v)}
                  placeholder="Choisir un rôle…"
                  fullWidth
                />
              </div>

              {/* Trash */}
              <button
                type="button"
                onClick={() => removeSegment(i)}
                disabled={disabled || segments.length <= 2}
                title={segments.length <= 2 ? "Au moins 2 segments requis" : "Supprimer ce segment"}
                className="rounded-md p-1.5"
                style={{
                  color: "var(--muted-foreground)",
                  opacity: disabled || segments.length <= 2 ? 0.3 : 1,
                  cursor: disabled || segments.length <= 2 ? "not-allowed" : "pointer",
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addSegment}
          disabled={disabled || knownRoles.length === 0}
          className="self-start rounded-md px-2.5 py-1.5 flex items-center gap-1.5 mt-1"
          style={{
            fontSize: 11,
            fontWeight: 500,
            border: "0.5px solid var(--border)",
            backgroundColor: "var(--background)",
            opacity: disabled || knownRoles.length === 0 ? 0.5 : 1,
            cursor: disabled || knownRoles.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          <Plus size={12} /> Ajouter un segment
        </button>
      </div>

      {/* Validation */}
      <div
        className="px-3 py-2 flex items-start gap-1.5"
        style={{
          fontSize: 11,
          borderTop: "0.5px solid var(--border)",
          backgroundColor: validation.ok ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
          color: validation.ok ? "rgb(21,128,61)" : "var(--danger-text, rgb(185,28,28))",
        }}
      >
        {validation.ok ? (
          <>
            <CheckCircle2 size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Segments valides · couvre {start} → {end}
            </span>
          </>
        ) : (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <AlertCircle size={12} />
              <span style={{ fontWeight: 500 }}>{validation.errors.length} problème{validation.errors.length > 1 ? "s" : ""}</span>
            </div>
            {validation.errors.slice(0, 3).map((err, i) => (
              <div key={i} style={{ marginLeft: 18, lineHeight: 1.4 }}>
                · {err}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
