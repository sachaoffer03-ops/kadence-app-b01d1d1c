import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, AlertTriangle, ChevronRight, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRoleStyle, hhmm } from "@/lib/staff-helpers";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Kadence" }] }),
});

interface ShiftRow {
  id: string;
  start_time: string;
  end_time: string;
  business_role: string;
  status: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  user_id: string | null;
  studio_id: string | null;
}

interface DashData {
  todayShifts: ShiftRow[];
  weekCount: number;
  totalHours: number;
  studios: Map<string, string>;
  profiles: Map<string, { first_name: string; last_name: string }>;
  pendingRequests: number;
  pendingSignalements: number;
  monthShifts: number;
  monthAssigned: number;
}

function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashData | null>(null);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().split("T")[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split("T")[0];

      const [
        { data: todayS },
        { data: weekS },
        { data: monthS },
        { data: studios },
        { data: profiles },
        { count: reqCount },
        { count: sigCount },
      ] = await Promise.all([
        supabase.from("shifts").select("*").eq("shift_date", today).order("start_time"),
        supabase.from("shifts").select("start_time,end_time").gte("shift_date", weekAgo),
        supabase.from("shifts").select("user_id,shift_date").gte("shift_date", monthStart).lte("shift_date", monthEnd),
        supabase.from("studios").select("id,name").is("deleted_at", null),
        supabase.from("profiles").select("id,first_name,last_name"),
        supabase.from("modification_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("signalements").select("id", { count: "exact", head: true }).eq("resolved", false),
      ]);

      const totalHours = (weekS || []).reduce((sum, s) => {
        const [h1, m1] = s.start_time.split(":").map(Number);
        const [h2, m2] = s.end_time.split(":").map(Number);
        return sum + (h2 + m2 / 60 - h1 - m1 / 60);
      }, 0);

      setData({
        todayShifts: (todayS || []) as ShiftRow[],
        weekCount: weekS?.length || 0,
        totalHours: Math.round(totalHours),
        studios: new Map((studios || []).map((s) => [s.id, s.name])),
        profiles: new Map((profiles || []).map((p) => [p.id, { first_name: p.first_name, last_name: p.last_name }])),
        pendingRequests: reqCount || 0,
        pendingSignalements: sigCount || 0,
        monthShifts: monthS?.length || 0,
        monthAssigned: (monthS || []).filter((s) => s.user_id).length,
      });
    };
    load();
    const ch = supabase
      .channel("dashboard-shifts")
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (!data) return <div className="p-4 md:p-6" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</div>;

  const inProgress = data.todayShifts.filter((s) => s.clocked_in_at && !s.clocked_out_at).length;
  const done = data.todayShifts.filter((s) => s.clocked_out_at).length;
  const upcoming = data.todayShifts.filter((s) => !s.clocked_in_at).length;
  const coverage = data.todayShifts.length === 0 ? 100 : Math.round(((data.todayShifts.length - data.todayShifts.filter((s) => !s.user_id).length) / data.todayShifts.length) * 100);

  return (
    <div className="p-4 md:p-6">
      <div className="rounded-xl border p-6 md:p-8" style={{ backgroundColor: "var(--coral-light)", borderColor: "transparent", borderRadius: 14 }}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="animate-pulse-dot rounded-full" style={{ width: 6, height: 6, backgroundColor: "var(--coral)" }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Aujourd'hui · {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              {data.todayShifts.length} shift{data.todayShifts.length > 1 ? "s" : ""} aujourd'hui
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>
              {data.studios.size} studio{data.studios.size > 1 ? "s" : ""} · {new Set(data.todayShifts.map((s) => s.user_id).filter(Boolean)).size} employé{data.todayShifts.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 md:gap-8">
            <HeroStat value={inProgress.toString()} label="En cours" accent />
            <HeroStat value={done.toString()} label="Terminés" />
            <HeroStat value={upcoming.toString()} label="À venir" />
            <div className="hidden md:block" style={{ width: 1, height: 36, backgroundColor: "var(--border)" }} />
            <div>
              <div className="flex items-baseline gap-1">
                <span style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}>{coverage}</span>
                <span style={{ fontSize: 14, color: "var(--muted-foreground)" }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: coverage === 100 ? "var(--success-text)" : "var(--warning-text)", marginTop: 2 }}>
                {coverage === 100 ? "Couverture complète" : "Trous à combler"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-5">
        <KpiCard label="7 derniers jours" value={data.weekCount.toString()} unit="shifts" change="Plage glissante" changeColor="var(--muted-foreground)" />
        <KpiCard label="Heures prestées" value={data.totalHours.toString()} unit="h" change="7 derniers jours" changeColor="var(--muted-foreground)" />
        <KpiCard label="Demandes en attente" value={data.pendingRequests.toString()} unit="" change="À traiter" changeColor={data.pendingRequests > 0 ? "var(--warning-text)" : "var(--success-text)"} onClick={() => navigate({ to: "/demandes" })} />
        <KpiCard label="Signalements ouverts" value={data.pendingSignalements.toString()} unit="" change="À résoudre" changeColor={data.pendingSignalements > 0 ? "var(--warning-text)" : "var(--success-text)"} onClick={() => navigate({ to: "/signalements" })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mt-5">
        <div className="md:col-span-3">
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Activité du jour</h2>
            {data.todayShifts.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", padding: "24px 0", textAlign: "center" }}>
                Aucun shift programmé aujourd'hui.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {data.todayShifts.map((s) => {
                  const profile = s.user_id ? data.profiles.get(s.user_id) : null;
                  const studioName = s.studio_id ? data.studios.get(s.studio_id) || "—" : "—";
                  const name = profile ? `${profile.first_name} ${profile.last_name}` : "Non assigné";
                  const status = !s.user_id ? { bg: "var(--danger-bg)", text: "var(--danger-text)", label: "Trou" }
                    : s.clocked_out_at ? { bg: "var(--success-bg)", text: "var(--success-text)", label: "Terminé" }
                    : s.clocked_in_at ? { bg: "var(--coral-light)", text: "var(--coral-dark)", label: "En cours" }
                    : { bg: "var(--info-bg)", text: "var(--info-text)", label: "À venir" };
                  return <ShiftRowItem key={s.id} name={name} role={s.business_role} studio={studioName} startHour={hhmm(s.start_time)} endHour={hhmm(s.end_time)} status={status} />;
                })}
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col gap-5">
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--coral-light)" }}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={15} style={{ color: "var(--coral-dark)" }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--coral-text)" }}>Actions en attente</span>
              <span className="rounded-full inline-flex items-center justify-center" style={{ width: 20, height: 20, fontSize: 10, fontWeight: 500, backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}>
                {data.pendingRequests + data.pendingSignalements}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {data.pendingRequests > 0 && <ActionRow title={`${data.pendingRequests} demande${data.pendingRequests > 1 ? "s" : ""} de modification`} subtitle="À valider ou refuser" onClick={() => navigate({ to: "/demandes" })} />}
              {data.pendingSignalements > 0 && <ActionRow title={`${data.pendingSignalements} signalement${data.pendingSignalements > 1 ? "s" : ""} ouvert${data.pendingSignalements > 1 ? "s" : ""}`} subtitle="Stock, matériel, hygiène" onClick={() => navigate({ to: "/signalements" })} />}
              {data.pendingRequests + data.pendingSignalements === 0 && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Tout est à jour.</div>}
            </div>
          </div>

          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontSize: 14, fontWeight: 500 }}>Planning du mois</h2>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
            </div>
            <div className="flex flex-col gap-2" style={{ fontSize: 13 }}>
              <div>Shifts attribués : <span style={{ fontWeight: 500 }}>{data.monthAssigned} / {data.monthShifts}</span></div>
              <div style={{ color: "var(--muted-foreground)" }}>{data.monthShifts - data.monthAssigned} trou{data.monthShifts - data.monthAssigned > 1 ? "s" : ""} à combler</div>
            </div>
            <div className="flex gap-2 mt-4">
              <Link to="/planning" className="flex-1 flex items-center justify-center gap-1.5 rounded-md border py-2" style={{ fontSize: 12, fontWeight: 500, borderColor: "var(--border)", color: "var(--foreground)", textDecoration: "none" }}>
                Voir le planning <ArrowRight size={13} />
              </Link>
              <Link to="/trous" className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-2" style={{ fontSize: 12, fontWeight: 500, color: "var(--card)", backgroundColor: "var(--foreground)", textDecoration: "none" }}>
                Combler les trous
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 500, color: accent ? "var(--coral)" : "var(--foreground)", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function KpiCard({ label, value, unit, change, changeColor, onClick }: { label: string; value: string; unit: string; change: string; changeColor: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className="rounded-xl border p-4 transition-colors"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", cursor: onClick ? "pointer" : undefined }}
      onMouseEnter={onClick ? (e) => (e.currentTarget.style.backgroundColor = "var(--muted)") : undefined}
      onMouseLeave={onClick ? (e) => (e.currentTarget.style.backgroundColor = "var(--card)") : undefined}
    >
      <div className="flex items-start justify-between" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
        {onClick && <ArrowUpRight size={13} style={{ color: "var(--muted-foreground)", marginTop: -1 }} />}
      </div>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 24, fontWeight: 500 }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 11, color: changeColor, marginTop: 4 }}>{change}</div>
    </div>
  );
}

function ShiftRowItem({ name, role, studio, startHour, endHour, status }: { name: string; role: string; studio: string; startHour: string; endHour: string; status: { bg: string; text: string; label: string } }) {
  const rc = getRoleStyle(role);
  const ini = name.split(" ").map((n) => n[0]).filter(Boolean).join("").slice(0, 2);
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
      <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 32, height: 32, backgroundColor: rc.bg, color: rc.text, fontSize: 11, fontWeight: 500 }}>{ini}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 13, fontWeight: 500 }}>{name}</span>
          <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: rc.bg, color: rc.text }}>{role}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>{studio} · {startHour} — {endHour}</div>
      </div>
      <span className="rounded-full px-2.5 py-1 shrink-0" style={{ fontSize: 11, fontWeight: 500, backgroundColor: status.bg, color: status.text }}>{status.label}</span>
    </div>
  );
}

function ActionRow({ title, subtitle, onClick }: { title: string; subtitle: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} role="button" tabIndex={0}
      className="flex items-center justify-between rounded-lg px-3 py-2"
      style={{ cursor: "pointer", backgroundColor: "rgba(255,255,255,0.5)" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--coral-text)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{subtitle}</div>
      </div>
      <ChevronRight size={14} style={{ color: "var(--coral-dark)" }} />
    </div>
  );
}
