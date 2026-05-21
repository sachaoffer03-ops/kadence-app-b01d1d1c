import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPointageTodayFn, type PointageShift } from "@/lib/pointage.functions";
import { getRoleStyle, initials } from "@/lib/staff-helpers";

interface Studio { id: string; name: string; short_name: string | null; }

const pad2 = (n: number) => n.toString().padStart(2, "0");
const fmtHM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const fmtHMS = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const fmtTime = (t: string) => t.slice(0, 5);
const fmtClock = (iso: string) => fmtHM(new Date(iso));

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${pad2(m)}`;
}

type VisualStatus =
  | { kind: "completed"; label: string; bg: string; text: string }
  | { kind: "in_progress"; label: string; bg: string; text: string }
  | { kind: "late_no_in"; label: string; bg: string; text: string }
  | { kind: "soon"; label: string; bg: string; text: string }
  | { kind: "upcoming"; label: string; bg: string; text: string }
  | { kind: "no_show"; label: string; bg: string; text: string };

function deriveStatus(shift: PointageShift, now: Date): VisualStatus {
  const start = new Date(`${shift.shift_date}T${shift.start_time}`);
  const cs = shift.computed_status;

  if (cs === "no_show") {
    return { kind: "no_show", label: "No-show", bg: "var(--danger-bg)", text: "var(--danger-text)" };
  }
  if (cs === "completed") {
    return { kind: "completed", label: "✓ Terminé", bg: "var(--success-bg)", text: "var(--success-text)" };
  }
  if (cs === "in_progress" || cs === "late_in") {
    return { kind: "in_progress", label: "En cours", bg: "#EEF2FF", text: "#4338CA" };
  }
  if (cs === "late_no_in") {
    return { kind: "late_no_in", label: "⚠ En retard", bg: "var(--warning-bg)", text: "var(--warning-text)" };
  }
  const minutesUntilStart = Math.floor((start.getTime() - now.getTime()) / 60_000);
  if (minutesUntilStart <= 30 && minutesUntilStart >= 0) {
    return {
      kind: "soon",
      label: "📍 Bientôt",
      bg: "color-mix(in oklab, var(--coral) 16%, white)",
      text: "var(--coral-dark)",
    };
  }
  return { kind: "upcoming", label: "À venir", bg: "var(--muted)", text: "var(--muted-foreground)" };
}

function buildInfoLine(shift: PointageShift, now: Date, status: VisualStatus): string {
  const start = new Date(`${shift.shift_date}T${shift.start_time}`);
  switch (status.kind) {
    case "completed":
      if (shift.clocked_in_at && shift.clocked_out_at) {
        const late = (shift.minutes_late ?? 0) > 0 ? ` · ⚠ retard ${shift.minutes_late} min` : " · à l'heure";
        return `Pointage ${fmtClock(shift.clocked_in_at)} → ${fmtClock(shift.clocked_out_at)}${late}`;
      }
      return "Terminé";
    case "in_progress":
      if (shift.clocked_in_at) {
        const late = (shift.minutes_late ?? 0) > 0 ? ` · retard ${shift.minutes_late} min` : " · en service";
        return `Pointage ${fmtClock(shift.clocked_in_at)}${late}`;
      }
      return "En service";
    case "late_no_in": {
      const minLate = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 60_000));
      return `Non pointé · ${minLate} min de retard`;
    }
    case "soon": {
      const minutesUntilStart = Math.max(0, Math.floor((start.getTime() - now.getTime()) / 60_000));
      return minutesUntilStart === 0 ? "Confirmé · arrive" : `Confirmé · arrive dans ${minutesUntilStart} min`;
    }
    case "upcoming":
      return "Confirmé";
    case "no_show":
      return "No-show";
  }
}

function durationText(shift: PointageShift, now: Date, status: VisualStatus): string {
  const start = new Date(`${shift.shift_date}T${shift.start_time}`);
  const end = new Date(`${shift.shift_date}T${shift.end_time}`);
  const plannedMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));

  if (status.kind === "completed" && shift.clocked_in_at && shift.clocked_out_at) {
    const min = Math.max(
      0,
      Math.round((new Date(shift.clocked_out_at).getTime() - new Date(shift.clocked_in_at).getTime()) / 60_000),
    );
    return fmtDuration(min);
  }
  if (status.kind === "in_progress" && shift.clocked_in_at) {
    const min = Math.max(0, Math.floor((now.getTime() - new Date(shift.clocked_in_at).getTime()) / 60_000));
    return `+${fmtDuration(min)}`;
  }
  if (status.kind === "in_progress") {
    return `Fin ${fmtTime(shift.end_time)}`;
  }
  return fmtDuration(plannedMin);
}

export function RealtimeTimeline() {
  const navigate = useNavigate();
  const loadFn = useServerFn(getPointageTodayFn);
  const [shifts, setShifts] = useState<PointageShift[] | null>(null);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [activeStudio, setActiveStudio] = useState<string>("all");
  const [now, setNow] = useState(() => new Date());
  const nowLineRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didAutoScroll = useRef(false);

  useEffect(() => {
    supabase
      .from("studios")
      .select("id,name,short_name")
      .is("deleted_at", null)
      .order("name")
      .then(({ data }) => setStudios((data ?? []) as Studio[]));
  }, []);

  const reload = async () => {
    try {
      const r = await loadFn({ data: {} });
      setShifts(r.shifts);
    } catch {
      setShifts([]);
    }
  };

  useEffect(() => {
    reload();
    const ch = supabase
      .channel("dashboard-timeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_clock_audit" }, reload)
      .subscribe();
    const id = setInterval(reload, 60_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    if (!shifts) return null;
    if (activeStudio === "all") return shifts;
    return shifts.filter((s) => s.studio_id === activeStudio);
  }, [shifts, activeStudio]);

  const nowInsertIndex = useMemo(() => {
    if (!filtered) return 0;
    const t = now.getTime();
    let idx = 0;
    for (let i = 0; i < filtered.length; i++) {
      const s = filtered[i];
      const start = new Date(`${s.shift_date}T${s.start_time}`).getTime();
      const end = new Date(`${s.shift_date}T${s.end_time}`).getTime();
      if (end <= t) {
        idx = i + 1;
      } else if (start <= t && t < end) {
        idx = i + 1;
      } else {
        break;
      }
    }
    return idx;
  }, [filtered, now]);

  useEffect(() => {
    if (didAutoScroll.current || !filtered || filtered.length === 0) return;
    if (nowLineRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const line = nowLineRef.current;
      const top = line.offsetTop - container.clientHeight / 2 + line.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      didAutoScroll.current = true;
    }
  }, [filtered, nowInsertIndex]);

  const showStudioTabs = studios.length > 1;

  return (
    <div
      className="rounded-xl border"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 py-4"
        style={{ borderBottom: "0.5px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Timer size={16} style={{ color: "var(--coral-dark)" }} />
          <h2 style={{ fontSize: 14, fontWeight: 500 }}>
            Timeline temps réel · aujourd'hui
          </h2>
          <span className="flex items-center gap-1.5 ml-2" title="Mise à jour en direct">
            <span
              className="animate-pulse-dot rounded-full"
              style={{ width: 6, height: 6, backgroundColor: "var(--success-text)" }}
            />
            <span style={{ fontSize: 10, color: "var(--success-text)", fontWeight: 500 }}>Live</span>
          </span>
        </div>

        {showStudioTabs && (
          <div className="flex items-center gap-1">
            <StudioPill
              label="Tous"
              active={activeStudio === "all"}
              onClick={() => setActiveStudio("all")}
            />
            {studios.map((s) => (
              <StudioPill
                key={s.id}
                label={(s.short_name || s.name).replace(/^Skult\s+/i, "")}
                active={activeStudio === s.id}
                onClick={() => setActiveStudio(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="overflow-y-auto px-3 md:px-5 py-4"
        style={{ maxHeight: 640, minHeight: 360 }}
      >
        {filtered === null ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <div
            className="text-center py-12"
            style={{ fontSize: 13, color: "var(--muted-foreground)" }}
          >
            Aucun shift programmé aujourd'hui.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((shift, i) => (
              <ShiftRow
                key={shift.id}
                shift={shift}
                now={now}
                onClick={() => navigate({ to: "/pointage", search: { shift: shift.id } as any })}
                isCurrent={(() => {
                  const t = now.getTime();
                  const start = new Date(`${shift.shift_date}T${shift.start_time}`).getTime();
                  const end = new Date(`${shift.shift_date}T${shift.end_time}`).getTime();
                  return start <= t && t < end;
                })()}
                separator={i === nowInsertIndex - 1 ? (
                  <NowLine ref={nowLineRef} now={now} />
                ) : null}
              />
            ))}
            {nowInsertIndex === filtered.length && (
              <NowLine ref={nowLineRef} now={now} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StudioPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md px-3 py-1.5 transition-colors"
      style={{
        fontSize: 11,
        fontWeight: 500,
        backgroundColor: active ? "var(--foreground)" : "transparent",
        color: active ? "var(--card)" : "var(--muted-foreground)",
        border: active ? "0.5px solid var(--foreground)" : "0.5px solid var(--border)",
      }}
    >
      {label}
    </button>
  );
}

const NowLine = (() => {
  function Inner(
    { now }: { now: Date },
    ref: React.Ref<HTMLDivElement>,
  ) {
    return (
      <div ref={ref} className="flex items-center gap-2 py-1 my-1">
        <span
          className="rounded-md px-2.5 py-1 shrink-0"
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.06em",
            backgroundColor: "var(--coral)",
            color: "white",
            textTransform: "uppercase",
          }}
        >
          Maintenant · {fmtHMS(now)}
        </span>
        <div className="flex-1" style={{ height: 1, backgroundColor: "var(--coral)", opacity: 0.6 }} />
      </div>
    );
  }
  return (require("react") as any).forwardRef(Inner) as (props: { now: Date } & { ref?: React.Ref<HTMLDivElement> }) => JSX.Element;
})();

function ShiftRow({
  shift,
  now,
  onClick,
  isCurrent,
  separator,
}: {
  shift: PointageShift;
  now: Date;
  onClick: () => void;
  isCurrent: boolean;
  separator: React.ReactNode;
}) {
  const status = deriveStatus(shift, now);
  const info = buildInfoLine(shift, now, status);
  const duration = durationText(shift, now, status);
  const role = shift.business_role || "—";
  const rc = getRoleStyle(role);

  const [first = "", last = ""] = (shift.user_name || "").split(" ");
  const ini = initials(first, last);
  const displayName = shift.user_name || "Non assigné";

  const bg = isCurrent ? "color-mix(in oklab, var(--coral) 8%, var(--card))" : "var(--card)";

  return (
    <>
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        className="grid items-center gap-3 rounded-lg px-3 md:px-4 py-3 transition-colors cursor-pointer"
        style={{
          gridTemplateColumns: "70px 44px 1fr auto",
          backgroundColor: bg,
          border: "0.5px solid var(--border)",
        }}
        onMouseEnter={(e) => {
          if (!isCurrent) e.currentTarget.style.backgroundColor = "var(--muted)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = bg;
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.1 }}>{fmtTime(shift.start_time)}</div>
          <div className="hidden md:block" style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
            {fmtTime(shift.end_time)}
          </div>
        </div>

        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{
            width: 36,
            height: 36,
            backgroundColor: shift.user_id ? rc.bg : "var(--muted)",
            color: shift.user_id ? rc.text : "var(--muted-foreground)",
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {shift.user_id ? ini : "—"}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span style={{ fontSize: 13, fontWeight: 500 }} className="truncate">
              {displayName}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>·</span>
            <span style={{ fontSize: 12, color: rc.text }}>{role}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }} className="truncate">
            {info}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className="rounded-full px-2.5 py-1"
            style={{
              fontSize: 11,
              fontWeight: 500,
              backgroundColor: status.bg,
              color: status.text,
              whiteSpace: "nowrap",
            }}
          >
            {status.label}
          </span>
          <span
            className="hidden md:inline"
            style={{ fontSize: 12, color: "var(--muted-foreground)", minWidth: 48, textAlign: "right" }}
          >
            {duration}
          </span>
        </div>
      </div>
      {separator}
    </>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg"
          style={{ height: 64, backgroundColor: "var(--muted)" }}
        />
      ))}
    </div>
  );
}
