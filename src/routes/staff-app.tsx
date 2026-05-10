import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Home, Calendar, CalendarCheck, User, ChevronRight, Clock, GraduationCap, QrCode, ClipboardCheck, ArrowLeft } from "lucide-react";
import { roleColors, getQuotaStatus, type Role } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/staff-app")({
  component: StaffAppPage,
});

type Tab = 'accueil' | 'planning' | 'dispos' | 'profil';

interface ProfileRow {
  first_name: string; last_name: string; email: string; contract: string | null;
  studio_id: string | null; quota_used: number | null; quota_max: number | null;
  score: number | null;
}
interface ShiftRow {
  id: string; shift_date: string; start_time: string; end_time: string;
  business_role: string; studio_id: string | null;
}

function fmtTime(t: string) { return t.slice(0, 5).replace(":", "h"); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

function StaffAppPage() {
  const { user, appRole } = useAuth();
  const isAdminPreviewing = appRole === "admin" || appRole === "manager";
  const [tab, setTab] = useState<Tab>('accueil');
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [businessRoles, setBusinessRoles] = useState<Role[]>([]);
  const [studios, setStudios] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: br }, { data: st }] = await Promise.all([
        supabase.from("profiles").select("first_name,last_name,email,contract,studio_id,quota_used,quota_max,score").eq("id", user.id).maybeSingle(),
        supabase.from("user_business_roles").select("role").eq("user_id", user.id),
        supabase.from("studios").select("id,name"),
      ]);
      if (p) setProfile(p as ProfileRow);
      if (br) setBusinessRoles(br.map((r) => r.role as Role));
      if (st) setStudios(Object.fromEntries(st.map((s) => [s.id, s.name])));
    })();
  }, [user]);

  if (!user) return <div className="p-8" style={{ fontSize: 13 }}>Chargement…</div>;

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#FAF8F4", maxWidth: 430, margin: "0 auto", position: "relative" }}>
      {isAdminPreviewing && (
        <Link
          to="/dashboard"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md"
          style={{
            position: "fixed", top: 12, left: 12, zIndex: 50,
            fontSize: 11, fontWeight: 500,
            backgroundColor: "var(--foreground)", color: "var(--card)",
          }}
        >
          <ArrowLeft size={12} /> Retour admin
        </Link>
      )}
      <div className="flex-1 overflow-y-auto pb-20">
        {tab === 'accueil' && <AccueilTab profile={profile} studios={studios} onNavigate={setTab} />}
        {tab === 'planning' && <PlanningTab studios={studios} />}
        {tab === 'dispos' && <DisposTab userId={user.id} />}
        {tab === 'profil' && <ProfilTab profile={profile} businessRoles={businessRoles} onNavigate={setTab} />}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 flex items-center justify-around border-t" style={{ width: "100%", maxWidth: 430, height: 64, backgroundColor: "#FFFFFF", borderColor: "rgba(0,0,0,0.08)" }}>
        {([
          { id: 'accueil' as Tab, label: 'Accueil', icon: Home },
          { id: 'planning' as Tab, label: 'Planning', icon: Calendar },
          { id: 'dispos' as Tab, label: 'Dispos', icon: CalendarCheck },
          { id: 'profil' as Tab, label: 'Profil', icon: User },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="flex flex-col items-center gap-0.5 py-2 px-4">
            <t.icon size={20} strokeWidth={1.6} style={{ color: tab === t.id ? "var(--coral)" : "var(--muted-foreground)" }} />
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 500 : 400, color: tab === t.id ? "var(--coral-dark)" : "var(--muted-foreground)" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── ACCUEIL ─── */
function AccueilTab({ profile, studios, onNavigate }: { profile: ProfileRow | null; studios: Record<string, string>; onNavigate: (t: Tab) => void }) {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [weekStats, setWeekStats] = useState({ hours: 0, count: 0 });

  useEffect(() => {
    if (!user) return;
    const today = todayISO();
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const weekEnd = in7.toISOString().slice(0, 10);
    const load = async () => {
      const { data: next } = await supabase.from("shifts")
        .select("id,shift_date,start_time,end_time,business_role,studio_id")
        .eq("user_id", user.id).gte("shift_date", today).order("shift_date").order("start_time").limit(3);
      if (next) setShifts(next);

      const { data: week } = await supabase.from("shifts")
        .select("start_time,end_time").eq("user_id", user.id)
        .gte("shift_date", today).lte("shift_date", weekEnd);
      if (week) {
        const hours = week.reduce((acc, s) => {
          const [h1, m1] = s.start_time.split(":").map(Number);
          const [h2, m2] = s.end_time.split(":").map(Number);
          return acc + (h2 + m2 / 60) - (h1 + m1 / 60);
        }, 0);
        setWeekStats({ hours: Math.round(hours), count: week.length });
      }
    };
    load();

    const channel = supabase.channel(`shifts-accueil-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `user_id=eq.${user.id}` }, () => {
        load();
        toast("Planning mis à jour", { description: "Ton admin vient de modifier tes shifts" });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const firstName = profile?.first_name || "";
  const today = todayISO();

  return (
    <div className="px-5 pt-6">
      <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Bonjour,</div>
      <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 20 }}>{firstName || "—"}</div>

      <div className="rounded-xl p-5 mb-5" style={{ background: "linear-gradient(135deg, #1A1A1A, #2A2A28)" }}>
        <div style={{ fontSize: 11, color: "var(--coral)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Cette semaine</div>
        <div className="flex items-center gap-6">
          <div>
            <div style={{ fontSize: 28, fontWeight: 500, color: "#fff" }}>{weekStats.hours}h</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Heures prévues</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 500, color: "#fff" }}>{weekStats.count}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Shifts</div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Prochain shift</div>
      {shifts.length === 0 ? (
        <div className="rounded-xl border px-4 py-5 text-center" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)", fontSize: 12, color: "var(--muted-foreground)" }}>
          Aucun shift planifié
        </div>
      ) : shifts.map((s) => {
        const role = s.business_role as Role;
        const rc = roleColors[role];
        const active = s.shift_date === today;
        const dateLabel = active ? "Aujourd'hui" : new Date(s.shift_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" });
        const studioName = (s.studio_id && studios[s.studio_id]) || "—";
        return (
          <div key={s.id} className="rounded-xl border px-4 py-3.5 flex items-center gap-3 mb-2" style={{ backgroundColor: active ? "var(--coral-light)" : "#fff", borderColor: active ? "var(--coral)" : "rgba(0,0,0,0.08)" }}>
            <div className="rounded-lg flex items-center justify-center" style={{ width: 36, height: 36, backgroundColor: rc?.bg }}>
              <Clock size={16} style={{ color: rc?.text }} />
            </div>
            <div className="flex-1">
              <div style={{ fontSize: 13, fontWeight: 500 }}>{dateLabel} · {fmtTime(s.start_time)} — {fmtTime(s.end_time)}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{role} · {studioName.replace("Skult ", "")}</div>
            </div>
            {active && (
              <button onClick={() => toast.success("Pointage enregistré", { description: `${role} · ${studioName}` })} className="rounded-md px-3 py-1.5 flex items-center gap-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "#fff" }}>
                <QrCode size={12} /> Pointer
              </button>
            )}
            <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-3 mt-5">
        <QuickLink icon={<CalendarCheck size={18} />} label="Mes disponibilités" sub="Configurer" onClick={() => onNavigate('dispos')} />
        <QuickLink icon={<GraduationCap size={18} />} label="Formation" sub="Bientôt disponible" onClick={() => toast("Formation à venir")} />
      </div>
    </div>
  );
}

function QuickLink({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl border px-4 py-4 text-left" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)", cursor: "pointer" }}>
      <div style={{ color: "var(--coral)", marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{sub}</div>
    </button>
  );
}

/* ─── PLANNING ─── */
function PlanningTab({ studios }: { studios: Record<string, string> }) {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 14 days starting today
  const days = useMemo(() => {
    const arr: { iso: string; label: string }[] = [];
    const d = new Date();
    for (let i = 0; i < 14; i++) {
      const di = new Date(d); di.setDate(d.getDate() + i);
      arr.push({
        iso: di.toISOString().slice(0, 10),
        label: di.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
      });
    }
    return arr;
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("shifts")
        .select("id,shift_date,start_time,end_time,business_role,studio_id")
        .eq("user_id", user.id)
        .gte("shift_date", days[0].iso).lte("shift_date", days[days.length - 1].iso)
        .order("shift_date").order("start_time");
      if (data) setShifts(data);
      setLoading(false);
    };
    setLoading(true);
    load();

    const channel = supabase.channel(`shifts-planning-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const monthLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="px-5 pt-6">
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Mon planning</div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16, textTransform: "capitalize" }}>{monthLabel}</div>

      {loading ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div> : (
        <div className="flex flex-col gap-2">
          {days.map(day => {
            const dayShifts = shifts.filter((s) => s.shift_date === day.iso);
            return (
              <div key={day.iso}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 4, marginTop: 8, textTransform: "capitalize" }}>{day.label}</div>
                {dayShifts.length === 0 ? (
                  <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "var(--muted)", fontSize: 12, color: "var(--muted-foreground)" }}>Repos</div>
                ) : dayShifts.map((s) => {
                  const rc = roleColors[s.business_role as Role];
                  const studioName = (s.studio_id && studios[s.studio_id]) || "";
                  return (
                    <div key={s.id} className="rounded-xl border px-4 py-3 flex items-center gap-3 mb-1" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
                      <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: rc?.dot }} />
                      <div className="flex-1">
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{fmtTime(s.start_time)} — {fmtTime(s.end_time)}</span>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 8 }}>{s.business_role} · {studioName.replace("Skult ", "")}</span>
                      </div>
                      <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── DISPOS ─── */
type Slot = 'matin' | 'midi' | 'soir';

function DisposTab({ userId }: { userId: string }) {
  // Next month
  const monthRef = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d;
  }, []);
  const year = monthRef.getFullYear();
  const month = monthRef.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = monthRef.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const [availability, setAvailability] = useState<Record<number, Set<Slot>>>({});
  const [loading, setLoading] = useState(true);

  const dateISO = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  useEffect(() => {
    (async () => {
      const start = dateISO(1); const end = dateISO(daysInMonth);
      const { data } = await supabase.from("availabilities")
        .select("avail_date,slot").eq("user_id", userId)
        .gte("avail_date", start).lte("avail_date", end);
      const map: Record<number, Set<Slot>> = {};
      data?.forEach((r) => {
        const d = parseInt(r.avail_date.slice(8, 10), 10);
        if (!map[d]) map[d] = new Set();
        map[d].add(r.slot as Slot);
      });
      setAvailability(map);
      setLoading(false);
    })();
  }, [userId]);

  const toggleSlot = async (day: number, slot: Slot) => {
    const current = availability[day] || new Set<Slot>();
    const has = current.has(slot);
    const next = new Set(current);
    if (has) next.delete(slot); else next.add(slot);
    setAvailability((p) => ({ ...p, [day]: next }));

    if (has) {
      const { error } = await supabase.from("availabilities").delete()
        .eq("user_id", userId).eq("avail_date", dateISO(day)).eq("slot", slot);
      if (error) toast.error("Erreur de sauvegarde");
    } else {
      const { error } = await supabase.from("availabilities").insert({
        user_id: userId, avail_date: dateISO(day), slot,
      });
      if (error) toast.error("Erreur de sauvegarde");
    }
  };

  const configured = Object.values(availability).filter((s) => s.size > 0).length;
  const slotsLabels: { key: Slot; short: string }[] = [
    { key: 'matin', short: 'M' }, { key: 'midi', short: 'Mi' }, { key: 'soir', short: 'S' },
  ];

  return (
    <div className="px-5 pt-6">
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Mes disponibilités</div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 4, textTransform: "capitalize" }}>{monthLabel}</div>

      <div className="rounded-xl px-4 py-2.5 flex items-center justify-between mb-4" style={{ backgroundColor: configured >= 20 ? "var(--success-bg)" : "var(--warning-bg)" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: configured >= 20 ? "var(--success-text)" : "var(--warning-text)" }}>
          {configured} / {daysInMonth} jours configurés
        </span>
      </div>

      {loading ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div> : (
        <div className="flex flex-col gap-1">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const dow = dayNames[new Date(year, month, day).getDay()];
            const daySlots = availability[day] || new Set<Slot>();
            return (
              <div key={day} className="rounded-lg border px-3 py-2.5 flex items-center gap-3" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
                <div style={{ minWidth: 50 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{dow} {day}</div>
                </div>
                <div className="flex items-center gap-1 flex-1">
                  {slotsLabels.map((sl) => {
                    const active = daySlots.has(sl.key);
                    return (
                      <button key={sl.key} onClick={() => toggleSlot(day, sl.key)} className="rounded-md px-2.5 py-1 transition-colors" style={{
                        fontSize: 10, fontWeight: active ? 500 : 400,
                        backgroundColor: active ? "var(--coral)" : "transparent",
                        color: active ? "#fff" : "var(--muted-foreground)",
                        border: active ? "none" : "0.5px solid var(--border)",
                      }}>
                        {sl.short}
                      </button>
                    );
                  })}
                </div>
                {daySlots.size > 0 && <span style={{ fontSize: 10, color: "var(--success-text)" }}>{daySlots.size} slot{daySlots.size > 1 ? 's' : ''}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── PROFIL ─── */
function ProfilTab({ profile, businessRoles, onNavigate }: { profile: ProfileRow | null; businessRoles: Role[]; onNavigate: (t: Tab) => void }) {
  const { signOut } = useAuth();
  if (!profile) return <div className="px-5 pt-6" style={{ fontSize: 13 }}>Chargement…</div>;

  const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();
  const primaryRole = businessRoles[0];
  const rc = primaryRole ? roleColors[primaryRole] : { bg: "var(--muted)", text: "var(--foreground)", dot: "" };

  const quotaUsed = profile.quota_used; const quotaMax = profile.quota_max;
  const quotaPct = quotaUsed !== null && quotaMax ? Math.round((quotaUsed / quotaMax) * 100) : 0;
  const quotaColor = getQuotaStatus(quotaUsed, quotaMax);
  const barColor = quotaColor === 'danger' ? "var(--danger-text)" : quotaColor === 'warning' ? "var(--warning-text)" : "var(--success-text)";

  return (
    <div className="px-5 pt-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="rounded-full flex items-center justify-center" style={{ width: 56, height: 56, backgroundColor: rc.bg, color: rc.text, fontSize: 18, fontWeight: 500 }}>
          {initials || "—"}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{profile.first_name} {profile.last_name}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {profile.contract && (
              <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>{profile.contract}</span>
            )}
            {businessRoles.map(r => (
              <span key={r} className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColors[r].bg, color: roleColors[r].text }}>{r}</span>
            ))}
          </div>
        </div>
      </div>

      {quotaUsed !== null && quotaMax !== null && (
        <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 12, fontWeight: 500 }}>Contingent</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: barColor }}>{quotaUsed}h / {quotaMax}h</span>
          </div>
          <div style={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "var(--muted)" }}>
            <div style={{ width: `${quotaPct}%`, height: "100%", borderRadius: 3, backgroundColor: barColor }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>{quotaMax - quotaUsed}h restantes</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard label="Email" value={profile.email} small />
        <StatCard label="Score" value={(profile.score ?? 0).toString()} sub="/10" />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
        {[
          { label: 'Mes informations', icon: User, action: () => toast("Mes informations", { description: "Section bientôt disponible" }) },
          { label: 'Formation', icon: GraduationCap, action: () => toast("Formation", { description: "Section bientôt disponible" }) },
          { label: 'Mes documents', icon: ClipboardCheck, action: () => toast("Mes documents", { description: "Section bientôt disponible" }) },
          { label: 'Notifications', icon: Calendar, action: () => toast("Notifications", { description: "Section bientôt disponible" }) },
        ].map((item, i) => (
          <button key={i} onClick={item.action} className="w-full flex items-center gap-3 px-4 py-3.5 text-left" style={{ borderBottom: i < 3 ? "0.5px solid rgba(0,0,0,0.06)" : "none", cursor: "pointer" }}>
            <item.icon size={16} style={{ color: "var(--muted-foreground)" }} />
            <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>
            <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
          </button>
        ))}
      </div>

      <button onClick={async () => { await signOut(); onNavigate('accueil'); toast.success("Déconnecté"); }} className="w-full rounded-xl border px-4 py-3 mt-4 text-center" style={{ fontSize: 13, color: "var(--danger-text)", backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
        Se déconnecter
      </button>
    </div>
  );
}

function StatCard({ label, value, sub, small }: { label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <div className="rounded-xl border p-3" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div className="flex items-baseline gap-0.5">
        <span style={{ fontSize: small ? 12 : 20, fontWeight: 500, wordBreak: "break-all" }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{sub}</span>}
      </div>
    </div>
  );
}
