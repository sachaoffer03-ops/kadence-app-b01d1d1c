import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, MapPin, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { roleColors, type Role } from "@/lib/role-colors";
import type { RoleSegment } from "@/lib/role-segments";

interface ShiftRow {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  business_role: string;
  studio_id: string | null;
  status: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  role_segments: RoleSegment[] | null;
}

interface Props {
  userId: string;
}

type Filter = "all" | "upcoming" | "past";

const fmtTime = (t: string) => t.slice(0, 5).replace(":", "h");
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthKey = (d: string) => d.slice(0, 7);
const fmtMonth = (key: string) => {
  const [y, m] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

const statusLabel = (s: string) => {
  switch (s) {
    case "scheduled": return "Prévu";
    case "completed": return "Terminé";
    case "cancelled": return "Annulé";
    case "no_show": return "Absent";
    case "draft": return "Brouillon";
    default: return s;
  }
};
const statusColor = (s: string) => {
  switch (s) {
    case "completed": return { bg: "var(--success-bg, rgba(34,197,94,0.1))", text: "var(--success-text, rgb(21,128,61))" };
    case "cancelled":
    case "no_show": return { bg: "var(--danger-bg, rgba(239,68,68,0.08))", text: "var(--danger-text, rgb(185,28,28))" };
    case "draft": return { bg: "var(--muted)", text: "var(--muted-foreground)" };
    default: return { bg: "var(--muted)", text: "var(--foreground)" };
  }
};

export function EmployeeShiftsHistoryTab({ userId }: Props) {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [studios, setStudios] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [{ data: sh }, { data: sts }] = await Promise.all([
        supabase
          .from("shifts")
          .select("id,shift_date,start_time,end_time,business_role,studio_id,status,clocked_in_at,clocked_out_at,role_segments")
          .eq("user_id", userId)
          .order("shift_date", { ascending: false })
          .order("start_time", { ascending: false }),
        supabase.from("studios").select("id,name"),
      ]);
      if (!active) return;
      setShifts((sh || []) as ShiftRow[]);
      setStudios(Object.fromEntries((sts || []).map((s) => [s.id, s.name])));
      setLoading(false);
    };
    setLoading(true);
    load();

    // Temps réel : tout changement sur un shift de cet employé déclenche un reload
    const channel = supabase
      .channel(`shifts-history-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts", filter: `user_id=eq.${userId}` },
        () => { load(); },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const today = todayStr();

  const filtered = useMemo(() => {
    if (filter === "upcoming") return shifts.filter((s) => s.shift_date >= today);
    if (filter === "past") return shifts.filter((s) => s.shift_date < today);
    return shifts;
  }, [shifts, filter, today]);

  const stats = useMemo(() => {
    const past = shifts.filter((s) => s.shift_date < today);
    const upcoming = shifts.filter((s) => s.shift_date >= today && s.status !== "cancelled");
    const completed = past.filter((s) => s.status === "completed").length;
    const totalHours = past.reduce((acc, s) => {
      const [h1, m1] = s.start_time.split(":").map(Number);
      const [h2, m2] = s.end_time.split(":").map(Number);
      return acc + (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
    }, 0);
    return {
      total: shifts.length,
      past: past.length,
      upcoming: upcoming.length,
      completed,
      totalHours: Math.round(totalHours),
    };
  }, [shifts, today]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShiftRow[]>();
    for (const s of filtered) {
      const key = monthKey(s.shift_date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Par défaut : ouvrir le mois courant + le suivant
  useEffect(() => {
    if (grouped.length === 0) return;
    setOpenMonths((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, boolean> = {};
      grouped.slice(0, 2).forEach(([k]) => { next[k] = true; });
      return next;
    });
  }, [grouped.length]);

  const toggle = (k: string) => setOpenMonths((p) => ({ ...p, [k]: !p[k] }));

  if (loading) {
    return <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement de l'historique…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stats compactes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Shifts à venir" value={stats.upcoming} accent="var(--coral)" />
        <StatCard label="Shifts effectués" value={stats.completed} />
        <StatCard label="Total passés" value={stats.past} />
        <StatCard label="Heures travaillées" value={`${stats.totalHours}h`} />
      </div>

      {/* Filtre */}
      <div className="flex items-center gap-1 self-start rounded-lg p-1" style={{ backgroundColor: "var(--muted)" }}>
        {([
          { v: "all" as const, label: `Tous (${shifts.length})` },
          { v: "upcoming" as const, label: `À venir (${stats.upcoming})` },
          { v: "past" as const, label: `Passés (${stats.past})` },
        ]).map((opt) => (
          <button
            key={opt.v}
            onClick={() => setFilter(opt.v)}
            className="rounded-md px-3 py-1.5"
            style={{
              fontSize: 12,
              fontWeight: 500,
              backgroundColor: filter === opt.v ? "var(--card)" : "transparent",
              color: filter === opt.v ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: filter === opt.v ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Liste par mois */}
      {grouped.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <Calendar size={20} style={{ color: "var(--muted-foreground)", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            {filter === "upcoming" ? "Aucun shift à venir" : filter === "past" ? "Aucun shift passé" : "Aucun shift"}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {grouped.map(([key, items]) => {
            const isOpen = !!openMonths[key];
            const isFuture = key >= today.slice(0, 7);
            return (
              <div key={key} className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <button
                  onClick={() => toggle(key)}
                  className="w-full flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: isOpen ? "0.5px solid var(--border)" : "none" }}
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={14} style={{ color: "var(--muted-foreground)" }} /> : <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />}
                    <span style={{ fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>{fmtMonth(key)}</span>
                    {isFuture && (
                      <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, backgroundColor: "var(--coral-bg, rgba(240,153,123,0.15))", color: "var(--coral)" }}>
                        À venir
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{items.length} shift{items.length > 1 ? "s" : ""}</span>
                </button>
                {isOpen && (
                  <div className="flex flex-col">
                    {items.map((s) => (
                      <ShiftLine key={s.id} shift={s} studioName={s.studio_id ? studios[s.studio_id] : undefined} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: accent || "var(--foreground)", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function ShiftLine({ shift: s, studioName }: { shift: ShiftRow; studioName?: string }) {
  const segs = Array.isArray(s.role_segments) && s.role_segments.length >= 2 ? s.role_segments : null;
  const stCol = statusColor(s.status);
  const primaryRole = (segs?.[0]?.role || s.business_role) as Role;
  const rc = roleColors[primaryRole] || { bg: "var(--muted)", text: "var(--foreground)", dot: "var(--muted-foreground)" };

  return (
    <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
      {/* Date */}
      <div className="flex flex-col items-center justify-center rounded-md px-2 py-1.5" style={{ minWidth: 56, backgroundColor: "var(--background)" }}>
        <div style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "capitalize" }}>
          {new Date(s.shift_date).toLocaleDateString("fr-FR", { weekday: "short" })}
        </div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{new Date(s.shift_date).getDate()}</div>
        <div style={{ fontSize: 9, color: "var(--muted-foreground)", textTransform: "capitalize" }}>
          {new Date(s.shift_date).toLocaleDateString("fr-FR", { month: "short" })}
        </div>
      </div>

      {/* Détails */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 500 }}>
            <Clock size={11} style={{ color: "var(--muted-foreground)" }} />
            {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
          </span>
          {studioName && (
            <span className="inline-flex items-center gap-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              <MapPin size={10} />
              {studioName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {segs ? (
            segs.map((seg, i) => {
              const r = seg.role as Role;
              const c = roleColors[r] || { bg: "var(--muted)", text: "var(--foreground)" };
              return (
                <span key={i} className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: c.bg, color: c.text }}>
                  {seg.role} · {fmtTime(seg.start_time)}–{fmtTime(seg.end_time)}
                </span>
              );
            })
          ) : (
            <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: rc.bg, color: rc.text }}>
              {s.business_role}
            </span>
          )}
          {segs && (
            <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
              multi-rôles
            </span>
          )}
        </div>
      </div>

      {/* Statut */}
      <div className="flex flex-col items-end gap-1">
        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: stCol.bg, color: stCol.text }}>
          {statusLabel(s.status)}
        </span>
        {s.clocked_in_at && (
          <span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>
            Pointé {new Date(s.clocked_in_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}
