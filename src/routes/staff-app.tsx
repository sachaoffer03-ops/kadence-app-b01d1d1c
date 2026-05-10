import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Home, Calendar, User, ChevronRight, Clock, GraduationCap, ArrowLeft, CheckSquare,
  AlertCircle, Replace, Inbox, MessageCircle, CalendarCheck, CheckCircle2, Phone,
  MapPin, Cake, CreditCard, Hash, Mail, Bell, Sparkles
} from "lucide-react";
import { roleColors, getQuotaStatus, type Role } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { EndShiftSheet } from "@/components/staff-app/EndShiftSheet";
import { SignalementSheet, RequestModificationSheet, MyRequestsSheet } from "@/components/staff-app/StaffActionsSheets";
import { ShiftDetailSheet, DocumentsSheet, NotificationsSheet } from "@/components/staff-app/ProfileSheets";
import { DisposSheet, disposKey } from "@/components/staff-app/DisposSheet";
import { FormationPanel } from "@/components/staff-app/FormationPanel";
import { ChatPanel } from "@/components/staff-app/ChatPanel";

export const Route = createFileRoute("/staff-app")({
  component: StaffAppPage,
});

type Tab = "accueil" | "planning" | "formation" | "chat" | "profil";

interface ProfileRow {
  first_name: string; last_name: string; email: string; phone: string | null;
  birth_date: string | null; address: string | null; city: string | null;
  contract: string | null; studio_id: string | null;
  hire_date: string | null; niss: string | null; iban: string | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null;
  emergency_contact_relation: string | null; nationality: string | null;
  quota_used: number | null; quota_max: number | null; score: number | null;
}
interface ShiftRow {
  id: string; shift_date: string; start_time: string; end_time: string;
  business_role: string; studio_id: string | null; notes?: string | null;
}

function fmtTime(t: string) { return t.slice(0, 5).replace(":", "h"); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

function StaffAppPage() {
  const { user, appRole } = useAuth();
  const isAdminPreviewing = appRole === "admin" || appRole === "manager";
  const [tab, setTab] = useState<Tab>("accueil");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [businessRoles, setBusinessRoles] = useState<Role[]>([]);
  const [studios, setStudios] = useState<Record<string, string>>({});
  const [adminId, setAdminId] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string>("Administrateur");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: br }, { data: st }, { data: admins }] = await Promise.all([
        supabase.from("profiles").select(
          "first_name,last_name,email,phone,birth_date,address,city,contract,studio_id,hire_date,niss,iban,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,nationality,quota_used,quota_max,score"
        ).eq("id", user.id).maybeSingle(),
        supabase.from("user_business_roles").select("role").eq("user_id", user.id),
        supabase.from("studios").select("id,name"),
        supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1),
      ]);
      if (p) setProfile(p as ProfileRow);
      if (br) setBusinessRoles(br.map((r) => r.role as Role));
      if (st) setStudios(Object.fromEntries(st.map((s) => [s.id, s.name])));
      if (admins && admins.length > 0) {
        const aid = admins[0].user_id as string;
        setAdminId(aid);
        const { data: ap } = await supabase.from("profiles").select("first_name,last_name").eq("id", aid).maybeSingle();
        if (ap) setAdminName(`${ap.first_name || ""} ${ap.last_name || ""}`.trim() || "Administrateur");
      }
    })();
  }, [user]);

  if (!user) return <div className="p-8" style={{ fontSize: 13 }}>Chargement…</div>;

  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#FAF8F4", maxWidth: 430, margin: "0 auto", position: "relative" }}>
      {isAdminPreviewing && (
        <Link to="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md"
          style={{ position: "fixed", top: 12, left: 12, zIndex: 50, fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          <ArrowLeft size={12} /> Retour admin
        </Link>
      )}
      {/* Cloche notifications globale */}
      <button onClick={() => setNotifOpen(true)} aria-label="Notifications"
        className="rounded-full flex items-center justify-center"
        style={{ position: "fixed", top: 14, right: 14, zIndex: 50, width: 38, height: 38, backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <Bell size={16} strokeWidth={1.6} style={{ color: "var(--foreground)" }} />
      </button>

      <div className="flex-1 overflow-y-auto pb-20">
        {tab === "accueil" && <AccueilTab profile={profile} studios={studios} userId={user.id} />}
        {tab === "planning" && <PlanningTab studios={studios} userId={user.id} />}
        {tab === "formation" && <FormationPanel userId={user.id} />}
        {tab === "chat" && <ChatPanel meId={user.id} peerId={adminId} peerName={adminName} />}
        {tab === "profil" && <ProfilTab profile={profile} businessRoles={businessRoles} studios={studios} onNavigate={setTab} />}
      </div>

      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 flex items-center justify-around border-t"
        style={{ width: "100%", maxWidth: 430, height: 64, backgroundColor: "#FFFFFF", borderColor: "rgba(0,0,0,0.08)" }}>
        {([
          { id: "accueil" as Tab, label: "Accueil", icon: Home },
          { id: "planning" as Tab, label: "Planning", icon: Calendar },
          { id: "formation" as Tab, label: "Formation", icon: GraduationCap },
          { id: "chat" as Tab, label: "Chat", icon: MessageCircle },
          { id: "profil" as Tab, label: "Profil", icon: User },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="flex flex-col items-center gap-0.5 py-2 px-2">
            <t.icon size={20} strokeWidth={1.6} style={{ color: tab === t.id ? "var(--coral)" : "var(--muted-foreground)" }} />
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 500 : 400, color: tab === t.id ? "var(--coral-dark)" : "var(--muted-foreground)" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── ACCUEIL ─── */
function AccueilTab({ profile, studios, userId }: { profile: ProfileRow | null; studios: Record<string, string>; userId: string }) {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [weekStats, setWeekStats] = useState({ hours: 0, count: 0 });
  const [endShift, setEndShift] = useState<ShiftRow | null>(null);
  const [signalOpen, setSignalOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqShiftId, setReqShiftId] = useState<string | null>(null);
  const [myReqOpen, setMyReqOpen] = useState(false);
  const [shiftDetail, setShiftDetail] = useState<ShiftRow | null>(null);
  const [disposOpen, setDisposOpen] = useState(false);
  const [disposValidated, setDisposValidated] = useState(false);

  // Mois suivant
  const nextMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d;
  }, []);
  const nextMonthLabel = nextMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  useEffect(() => {
    setDisposValidated(!!localStorage.getItem(disposKey(userId, nextMonth.getFullYear(), nextMonth.getMonth())));
  }, [userId, disposOpen, nextMonth]);

  useEffect(() => {
    const today = todayISO();
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const weekEnd = in7.toISOString().slice(0, 10);
    const load = async () => {
      const { data: next } = await supabase.from("shifts")
        .select("id,shift_date,start_time,end_time,business_role,studio_id,notes")
        .eq("user_id", userId).gte("shift_date", today).order("shift_date").order("start_time").limit(3);
      if (next) setShifts(next);

      const { data: week } = await supabase.from("shifts")
        .select("start_time,end_time").eq("user_id", userId)
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

    const channel = supabase.channel(`shifts-accueil-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `user_id=eq.${userId}` }, () => {
        load();
        toast("Planning mis à jour", { description: "Ton admin vient de modifier tes shifts" });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

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

      {/* Bandeau dispos */}
      <button
        onClick={() => !disposValidated && setDisposOpen(true)}
        className="w-full rounded-xl px-4 py-4 mb-5 flex items-center gap-3 text-left"
        style={{
          backgroundColor: disposValidated ? "var(--success-bg)" : "#fff",
          border: `0.5px solid ${disposValidated ? "var(--success-text)" : "var(--coral)"}`,
          cursor: disposValidated ? "default" : "pointer",
        }}
      >
        <div className="rounded-lg flex items-center justify-center" style={{ width: 40, height: 40, backgroundColor: disposValidated ? "var(--success-text)" : "var(--coral-light)", color: disposValidated ? "#fff" : "var(--coral-dark)" }}>
          {disposValidated ? <CheckCircle2 size={18} /> : <CalendarCheck size={18} />}
        </div>
        <div className="flex-1">
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {disposValidated ? "Planning validé" : "Indique tes dispos"}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "capitalize" }}>
            {disposValidated ? `Tes dispos pour ${nextMonthLabel} sont envoyées` : `Pour ${nextMonthLabel} — une seule fois`}
          </div>
        </div>
        {!disposValidated && <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />}
      </button>

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
          <button key={s.id} onClick={() => setShiftDetail(s)} className="w-full rounded-xl border px-4 py-3.5 flex items-center gap-3 mb-2 text-left" style={{ backgroundColor: active ? "var(--coral-light)" : "#fff", borderColor: active ? "var(--coral)" : "rgba(0,0,0,0.08)" }}>
            <div className="rounded-lg flex items-center justify-center" style={{ width: 36, height: 36, backgroundColor: rc?.bg }}>
              <Clock size={16} style={{ color: rc?.text }} />
            </div>
            <div className="flex-1">
              <div style={{ fontSize: 13, fontWeight: 500 }}>{dateLabel} · {fmtTime(s.start_time)} — {fmtTime(s.end_time)}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{role} · {studioName.replace("Skult ", "")}</div>
            </div>
            {active && (
              <span onClick={(e) => { e.stopPropagation(); setEndShift(s); }} className="rounded-md px-3 py-1.5 flex items-center gap-1 cursor-pointer" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "#fff" }}>
                <CheckSquare size={12} /> Fin de shift
              </span>
            )}
            <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />
          </button>
        );
      })}

      <div style={{ fontSize: 13, fontWeight: 500, marginTop: 20, marginBottom: 8 }}>Actions rapides</div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <QuickLink icon={<AlertCircle size={18} />} label="Signaler" sub="Stock, matériel, hygiène" onClick={() => setSignalOpen(true)} />
        <QuickLink icon={<Replace size={18} />} label="Demande" sub="Échange, annulation…" onClick={() => setReqOpen(true)} />
        <QuickLink icon={<Inbox size={18} />} label="Mes demandes" sub="Suivi des réponses" onClick={() => setMyReqOpen(true)} />
        <QuickLink icon={<CalendarCheck size={18} />} label="Mes dispos" sub={disposValidated ? "Validées" : "À envoyer"} onClick={() => setDisposOpen(true)} />
      </div>

      <ShiftDetailSheet
        open={!!shiftDetail} onClose={() => setShiftDetail(null)}
        shift={shiftDetail} studios={studios}
        onEndShift={() => { if (shiftDetail) { setEndShift(shiftDetail); setShiftDetail(null); } }}
        onRequestModif={() => { if (shiftDetail) { setReqShiftId(shiftDetail.id); setShiftDetail(null); setReqOpen(true); } }}
      />
      <EndShiftSheet open={!!endShift} onClose={() => setEndShift(null)} shift={endShift} userId={userId} />
      <SignalementSheet open={signalOpen} onClose={() => setSignalOpen(false)} userId={userId} studioId={profile?.studio_id ?? null} />
      <RequestModificationSheet open={reqOpen} onClose={() => { setReqOpen(false); setReqShiftId(null); }} userId={userId} shiftId={reqShiftId} />
      <MyRequestsSheet open={myReqOpen} onClose={() => setMyReqOpen(false)} userId={userId} />
      <DisposSheet open={disposOpen} onClose={() => setDisposOpen(false)} userId={userId} />
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
function PlanningTab({ studios, userId }: { studios: Record<string, string>; userId: string }) {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftDetail, setShiftDetail] = useState<ShiftRow | null>(null);
  const [endShift, setEndShift] = useState<ShiftRow | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqShiftId, setReqShiftId] = useState<string | null>(null);

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
    const load = async () => {
      const { data } = await supabase.from("shifts")
        .select("id,shift_date,start_time,end_time,business_role,studio_id,notes")
        .eq("user_id", userId)
        .gte("shift_date", days[0].iso).lte("shift_date", days[days.length - 1].iso)
        .order("shift_date").order("start_time");
      if (data) setShifts(data);
      setLoading(false);
    };
    setLoading(true);
    load();

    const channel = supabase.channel(`shifts-planning-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

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
                    <button key={s.id} onClick={() => setShiftDetail(s)} className="w-full rounded-xl border px-4 py-3 flex items-center gap-3 mb-1 text-left" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
                      <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: rc?.dot }} />
                      <div className="flex-1">
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{fmtTime(s.start_time)} — {fmtTime(s.end_time)}</span>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 8 }}>{s.business_role} · {studioName.replace("Skult ", "")}</span>
                      </div>
                      <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <ShiftDetailSheet
        open={!!shiftDetail} onClose={() => setShiftDetail(null)}
        shift={shiftDetail} studios={studios}
        onEndShift={() => { if (shiftDetail) { setEndShift(shiftDetail); setShiftDetail(null); } }}
        onRequestModif={() => { if (shiftDetail) { setReqShiftId(shiftDetail.id); setShiftDetail(null); setReqOpen(true); } }}
      />
      <EndShiftSheet open={!!endShift} onClose={() => setEndShift(null)} shift={endShift} userId={userId} />
      <RequestModificationSheet open={reqOpen} onClose={() => { setReqOpen(false); setReqShiftId(null); }} userId={userId} shiftId={reqShiftId} />
    </div>
  );
}

/* ─── PROFIL ─── */
function ProfilTab({ profile, businessRoles, studios, onNavigate }: { profile: ProfileRow | null; businessRoles: Role[]; studios: Record<string, string>; onNavigate: (t: Tab) => void }) {
  const { signOut } = useAuth();
  const [docsOpen, setDocsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  if (!profile) return <div className="px-5 pt-6" style={{ fontSize: 13 }}>Chargement…</div>;

  const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();
  const primaryRole = businessRoles[0];
  const rc = primaryRole ? roleColors[primaryRole] : { bg: "var(--muted)", text: "var(--foreground)", dot: "" };

  const quotaUsed = profile.quota_used; const quotaMax = profile.quota_max;
  const quotaPct = quotaUsed !== null && quotaMax ? Math.round((quotaUsed / quotaMax) * 100) : 0;
  const quotaColor = getQuotaStatus(quotaUsed, quotaMax);
  const barColor = quotaColor === "danger" ? "var(--danger-text)" : quotaColor === "warning" ? "var(--warning-text)" : "var(--success-text)";
  const studioName = profile.studio_id ? studios[profile.studio_id] : null;
  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";

  return (
    <div className="px-5 pt-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="rounded-full flex items-center justify-center" style={{ width: 64, height: 64, backgroundColor: rc.bg, color: rc.text, fontSize: 20, fontWeight: 500 }}>
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

      {/* Contingent */}
      {quotaUsed !== null && quotaMax !== null && quotaMax > 0 && (
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

      {/* Informations personnelles */}
      <SectionTitle>Informations personnelles</SectionTitle>
      <Card>
        <InfoRow icon={<Mail size={14} />} label="Email" value={profile.email} />
        <InfoRow icon={<Phone size={14} />} label="Téléphone" value={profile.phone || "—"} />
        <InfoRow icon={<Cake size={14} />} label="Date de naissance" value={fmtDate(profile.birth_date)} />
        <InfoRow icon={<MapPin size={14} />} label="Adresse" value={profile.address ? `${profile.address}${profile.city ? `, ${profile.city}` : ""}` : "—"} last />
      </Card>

      {/* Informations contrat */}
      <SectionTitle>Contrat</SectionTitle>
      <Card>
        <InfoRow icon={<User size={14} />} label="Studio" value={studioName?.replace("Skult ", "") || "—"} />
        <InfoRow icon={<Calendar size={14} />} label="Date d'embauche" value={fmtDate(profile.hire_date)} />
        <InfoRow icon={<Hash size={14} />} label="NISS" value={profile.niss || "—"} />
        <InfoRow icon={<CreditCard size={14} />} label="IBAN" value={profile.iban || "—"} last />
      </Card>

      {/* Contact urgence */}
      <SectionTitle>Contact d'urgence</SectionTitle>
      <Card>
        {profile.emergency_contact_name ? (
          <>
            <InfoRow icon={<AlertTriangle size={14} />} label="Nom" value={`${profile.emergency_contact_name}${profile.emergency_contact_relation ? ` (${profile.emergency_contact_relation})` : ""}`} />
            <InfoRow icon={<Phone size={14} />} label="Téléphone" value={profile.emergency_contact_phone || "—"} last />
          </>
        ) : (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", padding: "12px 0" }}>
            Aucun contact d'urgence renseigné.
          </div>
        )}
      </Card>

      {/* Liens utiles */}
      <div className="rounded-xl border overflow-hidden mt-4" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
        {[
          { label: "Mes formations", icon: GraduationCap, action: () => onNavigate("formation") },
          { label: "Mes documents", icon: Inbox, action: () => setDocsOpen(true) },
          { label: "Notifications", icon: AlertCircle, action: () => setNotifOpen(true) },
          { label: "Conversation admin", icon: MessageCircle, action: () => onNavigate("chat") },
        ].map((item, i, arr) => (
          <button key={i} onClick={item.action} className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            style={{ borderBottom: i < arr.length - 1 ? "0.5px solid rgba(0,0,0,0.06)" : "none", cursor: "pointer" }}>
            <item.icon size={16} style={{ color: "var(--muted-foreground)" }} />
            <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>
            <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
          </button>
        ))}
      </div>

      <button onClick={async () => { await signOut(); onNavigate("accueil"); toast.success("Déconnecté"); }}
        className="w-full rounded-xl border px-4 py-3 mt-4 text-center"
        style={{ fontSize: 13, color: "var(--danger-text)", backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
        Se déconnecter
      </button>

      <DocumentsSheet open={docsOpen} onClose={() => setDocsOpen(false)} />
      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 16, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: last ? "none" : "0.5px solid rgba(0,0,0,0.06)" }}>
      <span style={{ color: "var(--muted-foreground)" }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 500, wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}
