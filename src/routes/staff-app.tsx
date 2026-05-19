import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { toast } from "sonner";
import {
  Home, Calendar, User, ChevronRight, Clock, GraduationCap, ArrowLeft, CheckSquare,
  AlertCircle, Replace, Inbox, MessageCircle, CalendarCheck, CheckCircle2, Phone,
  MapPin, Cake, CreditCard, Hash, Mail, Bell, Sparkles
} from "lucide-react";
import { roleColors, getQuotaStatus, type Role } from "@/lib/role-colors";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ClosureFlow } from "@/components/staff-app/ClosureFlow";
import { SignalementSheet, RequestModificationSheet, MyRequestsSheet } from "@/components/staff-app/StaffActionsSheets";
import { ShiftDetailSheet, DocumentsSheet, NotificationsSheet } from "@/components/staff-app/ProfileSheets";
import { EditProfileSheet, type EditableProfile } from "@/components/staff-app/EditProfileSheet";
import { DisposSheet, disposKey } from "@/components/staff-app/DisposSheet";
import { FormationPanel } from "@/components/staff-app/FormationPanel";
import { ChatPanel } from "@/components/staff-app/ChatPanel";
import { useStaffNotifications } from "@/hooks/use-staff-notifications";
import { ProposalsSheet, useProposals } from "@/components/staff-app/ProposalsSheet";
import { WorkedHoursEmployeeCard, EmployeeLastShifts } from "@/components/WorkedHoursCard";

export const Route = createFileRoute("/staff-app")({
  component: StaffAppPage,
});

type Tab = "accueil" | "planning" | "pointage" | "formation" | "chat" | "profil";

interface ProfileRow {
  first_name: string; last_name: string; email: string; phone: string | null;
  birth_date: string | null; address: string | null; city: string | null;
  contract: string | null; studio_id: string | null;
  hire_date: string | null; niss: string | null; iban: string | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null;
  emergency_contact_relation: string | null; nationality: string | null;
  avatar_url: string | null;
  quota_used: number | null; quota_max: number | null; score: number | null;
  hourly_rate: number | null;
}
interface ShiftRow {
  id: string; shift_date: string; start_time: string; end_time: string;
  business_role: string; studio_id: string | null; notes?: string | null;
  clocked_in_at?: string | null; clocked_out_at?: string | null; minutes_late?: number | null;
}

function fmtTime(t: string) { return t.slice(0, 5).replace(":", "h"); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

function StaffAppPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("accueil");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [businessRoles, setBusinessRoles] = useState<Role[]>([]);
  const [studios, setStudios] = useState<Record<string, string>>({});
  const [studioClockOut, setStudioClockOut] = useState<Record<string, { before: number; grace: number }>>({});
  const [adminId, setAdminId] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string>("Administrateur");
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: br }, { data: st }, { data: admin }] = await Promise.all([
        supabase.from("profiles").select(
          "first_name,last_name,email,phone,birth_date,address,city,contract,studio_id,hire_date,niss,iban,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,nationality,avatar_url,quota_used,quota_max,score,hourly_rate"
        ).eq("id", user.id).maybeSingle(),
        supabase.from("user_business_roles").select("role").eq("user_id", user.id),
        supabase.from("studios").select("id,name,clock_out_button_appears_before_min,clock_out_grace_period_min"),
        supabase.rpc("get_default_admin").maybeSingle(),
      ]);
      if (p) setProfile(p as ProfileRow);
      if (br) setBusinessRoles(br.map((r) => r.role as Role));
      if (st) {
        setStudios(Object.fromEntries(st.map((s: any) => [s.id, s.name])));
        setStudioClockOut(Object.fromEntries(st.map((s: any) => [s.id, {
          before: s.clock_out_button_appears_before_min ?? 15,
          grace: s.clock_out_grace_period_min ?? 20,
        }])));
      }
      const a = admin as { user_id?: string; first_name?: string | null; last_name?: string | null } | null;
      if (a?.user_id) {
        setAdminId(a.user_id);
        const name = `${a.first_name || ""} ${a.last_name || ""}`.trim();
        setAdminName(name || "Administrateur");
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) return <div className="p-8" style={{ fontSize: 13 }}>Chargement…</div>;

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#FAF8F4", maxWidth: 430, margin: "0 auto", position: "relative" }}>
      {/* Cloche notifications globale — l'onglet Accueil a sa propre cloche inline */}
      {tab !== "accueil" && <BellButton userId={user.id} onOpen={() => setNotifOpen(true)} />}

      <div className="flex-1 overflow-y-auto pb-20">
        {tab === "accueil" && <AccueilTab profile={profile} studios={studios} userId={user.id} onOpenNotifs={() => setNotifOpen(true)} />}
        {tab === "planning" && <PlanningTab studios={studios} userId={user.id} />}
        {tab === "pointage" && <PointageTab studios={studios} userId={user.id} />}
        {tab === "formation" && <FormationPanel userId={user.id} />}
        {tab === "chat" && <ChatPanel meId={user.id} peerId={adminId} peerName={adminName} />}
        {tab === "profil" && <ProfilTab profile={profile} businessRoles={businessRoles} studios={studios} userId={user.id} onProfileChange={(patch) => setProfile((p) => p ? { ...p, ...patch } : p)} onNavigate={setTab} />}
      </div>

      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} userId={user.id} />

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 flex items-center justify-around border-t"
        style={{ width: "100%", maxWidth: 430, height: 64, backgroundColor: "#FFFFFF", borderColor: "rgba(0,0,0,0.08)" }}>
        {([
          { id: "accueil" as Tab, label: "Accueil", icon: Home },
          { id: "planning" as Tab, label: "Planning", icon: Calendar },
          { id: "pointage" as Tab, label: "Pointage", icon: Clock },
          { id: "formation" as Tab, label: "Formation", icon: GraduationCap },
          { id: "chat" as Tab, label: "Chat", icon: MessageCircle },
          { id: "profil" as Tab, label: "Profil", icon: User },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="flex flex-col items-center gap-0.5 py-2 px-1">
            <t.icon size={18} strokeWidth={1.6} style={{ color: tab === t.id ? "var(--coral)" : "var(--muted-foreground)" }} />
            <span style={{ fontSize: 9, fontWeight: tab === t.id ? 500 : 400, color: tab === t.id ? "var(--coral-dark)" : "var(--muted-foreground)" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── ACCUEIL ─── */
function AccueilTab({ profile, studios, userId, onOpenNotifs }: { profile: ProfileRow | null; studios: Record<string, string>; userId: string; onOpenNotifs: () => void }) {
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
  const [proposalsOpen, setProposalsOpen] = useState(false);
  const { proposals, reload: reloadProposals } = useProposals(userId);
  const navigate = useNavigate();
  // tick toutes les 1s pour le timer "en service"
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function handleClockIn(s: ShiftRow) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("shifts")
      .update({ clocked_in_at: nowIso })
      .eq("id", s.id);
    if (error) { toast.error("Impossible de pointer", { description: error.message }); return; }
    toast.success("Arrivée enregistrée");
  }

  async function handleEndShift(s: ShiftRow) {
    if (s.clocked_out_at) { toast.info("Ce shift est déjà clôturé"); return; }
    if (!s.clocked_in_at) { toast.error("Tu dois d'abord pointer ton arrivée"); return; }
    setEndShift(s);
  }

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
        .select("id,shift_date,start_time,end_time,business_role,studio_id,notes,clocked_in_at,clocked_out_at,minutes_late")
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
  const initial = (firstName.charAt(0) || "?").toUpperCase();
  const today = todayISO();
  const { unread } = useStaffNotifications(userId);

  // Jours de la semaine (7 prochains jours) — marque ceux où l'employé a un shift
  const weekDays = useMemo(() => {
    const labels = ["L", "M", "M", "J", "V", "S", "D"]; // lundi=0
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const monday = new Date(today0);
    const dow = (today0.getDay() + 6) % 7; // 0 = lundi
    monday.setDate(today0.getDate() - dow);
    const shiftDates = new Set(shifts.map(s => s.shift_date));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return { label: labels[i], iso, hasShift: shiftDates.has(iso), isToday: iso === today, isPast: d < today0 };
    });
  }, [shifts, today]);

  return (
    <div className="px-5 pt-5">
      {/* Header inline : avatar initiale + bonjour + cloche */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: 40, height: 40,
              backgroundColor: "var(--coral-light)",
              border: "0.5px solid var(--coral)",
              color: "var(--coral-dark)",
              fontSize: 14, fontWeight: 500,
            }}
          >
            {initial}
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.2 }}>Bonjour</div>
            <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.2 }}>{firstName || "—"}</div>
          </div>
        </div>
        <button
          onClick={onOpenNotifs}
          aria-label="Notifications"
          className="relative rounded-full flex items-center justify-center transition-colors hover:bg-black/5"
          style={{ width: 40, height: 40 }}
        >
          <Bell size={20} strokeWidth={1.6} style={{ color: "var(--foreground)" }} />
          {unread > 0 && (
            <span
              style={{
                position: "absolute", top: 8, right: 8,
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: "var(--coral)",
                border: "1.5px solid #FAF8F4",
              }}
            />
          )}
        </button>
      </div>

      {/* Carte sombre — prochain shift en vedette */}
      {(() => {
        const next = shifts[0];
        let kicker = "Prochain shift";
        let bigLine = "Aucun shift planifié";
        let subLine: string | null = null;
        let isToday = false;
        // États : B = à venir, C = en service, D = terminé
        type CardState = "none" | "future" | "today_before" | "in_service" | "done";
        let state: CardState = next ? "future" : "none";
        let lateMinAtStart = 0;
        let liveLateMin = 0;
        let serviceElapsedMs = 0;
        let plannedDurMin = 0;
        let workedMin = 0;
        if (next) {
          const role = next.business_role as Role;
          const studioName = (next.studio_id && studios[next.studio_id]) || "—";
          const d = new Date(next.shift_date);
          const t0 = new Date(); t0.setHours(0, 0, 0, 0);
          const diffDays = Math.round((d.getTime() - t0.getTime()) / 86400000);
          isToday = diffDays === 0;
          const when = diffDays === 0 ? "Aujourd'hui" : diffDays === 1 ? "Demain" : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
          const [sh, sm] = next.start_time.split(":").map(Number);
          const [eh, em] = next.end_time.split(":").map(Number);
          plannedDurMin = (eh * 60 + em) - (sh * 60 + sm);
          const startDt = new Date(next.shift_date + "T" + next.start_time);
          if (isToday) {
            if (next.clocked_out_at) {
              state = "done";
              const ci = next.clocked_in_at ? new Date(next.clocked_in_at) : startDt;
              const co = new Date(next.clocked_out_at);
              workedMin = Math.max(0, Math.round((co.getTime() - ci.getTime()) / 60000));
              lateMinAtStart = next.minutes_late ?? 0;
            } else if (next.clocked_in_at) {
              state = "in_service";
              const ci = new Date(next.clocked_in_at);
              serviceElapsedMs = Math.max(0, nowTs - ci.getTime());
              lateMinAtStart = next.minutes_late ?? Math.max(0, Math.round((ci.getTime() - startDt.getTime()) / 60000));
            } else {
              state = "today_before";
              liveLateMin = Math.max(0, Math.round((nowTs - startDt.getTime()) / 60000));
            }
          }
          if (state === "in_service") {
            kicker = "En service";
            const ci = new Date(next.clocked_in_at!);
            bigLine = `Arrivé à ${ci.toTimeString().slice(0, 5).replace(":", "h")}${lateMinAtStart > 0 ? ` (+${lateMinAtStart} min)` : ""}`;
            const totS = Math.floor(serviceElapsedMs / 1000);
            const hh = String(Math.floor(totS / 3600)).padStart(2, "0");
            const mm = String(Math.floor((totS % 3600) / 60)).padStart(2, "0");
            const ss = String(totS % 60).padStart(2, "0");
            subLine = `${hh}:${mm}:${ss} en service · fin prévue ${fmtTime(next.end_time)} · ${role} · ${studioName.replace("Skult ", "")}`;
          } else if (state === "done") {
            kicker = "Shift terminé";
            const ci = next.clocked_in_at ? new Date(next.clocked_in_at) : startDt;
            const co = new Date(next.clocked_out_at!);
            bigLine = `${ci.toTimeString().slice(0, 5).replace(":", "h")} → ${co.toTimeString().slice(0, 5).replace(":", "h")}`;
            const h = Math.floor(workedMin / 60); const m = workedMin % 60;
            subLine = `${h}h${String(m).padStart(2, "0")} net${lateMinAtStart > 0 ? ` · +${lateMinAtStart} min de retard` : ""} · ${role} · ${studioName.replace("Skult ", "")}`;
          } else {
            kicker = isToday ? "Aujourd'hui" : "Prochain shift";
            bigLine = `${when} · ${fmtTime(next.start_time)}`;
            subLine = `${fmtTime(next.start_time)} — ${fmtTime(next.end_time)} · ${role} · ${studioName.replace("Skult ", "")}`;
          }
        }
        const cardBg =
          state === "in_service" ? "linear-gradient(135deg, #3A1F12, #5C2E18)" :
          state === "done" ? "linear-gradient(135deg, #1F1F1F, #2E2E2E)" :
          "linear-gradient(135deg, #1A1614, #2A2624)";
        return (
          <div
            className="relative overflow-hidden rounded-3xl p-6 mb-5"
            style={{ background: cardBg }}
          >
            <div
              style={{
                position: "absolute", top: -64, right: -64,
                width: 180, height: 180, borderRadius: "50%",
                backgroundColor: "rgba(240,153,123,0.12)", filter: "blur(40px)",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative" }}>
              <div
                style={{
                  fontSize: 10, color: "rgba(250,248,244,0.55)",
                  fontWeight: 500, letterSpacing: "0.18em",
                  textTransform: "uppercase", marginBottom: 14,
                }}
              >
                {kicker}
              </div>

              <div
                style={{
                  fontSize: 28, fontWeight: 500, color: "#FAF8F4",
                  lineHeight: 1.15, textTransform: "capitalize",
                  letterSpacing: "-0.01em",
                }}
              >
                {bigLine}
              </div>
              {subLine && (
                <div style={{ fontSize: 12, color: "rgba(250,248,244,0.55)", marginTop: 6 }}>
                  {subLine}
                </div>
              )}

              {state === "today_before" && next && (
                <button
                  onClick={() => handleClockIn(next)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2"
                  style={{
                    fontSize: 12, fontWeight: 500,
                    backgroundColor: liveLateMin > 0 ? "#E07A3E" : "var(--coral)",
                    color: "#1A1614",
                  }}
                >
                  <Clock size={13} /> {liveLateMin > 0 ? `Pointer mon arrivée — en retard de ${liveLateMin} min` : "Pointer mon arrivée"}
                </button>
              )}
              {state === "in_service" && next && (
                <button
                  onClick={() => handleEndShift(next)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2"
                  style={{ fontSize: 12, fontWeight: 500, backgroundColor: "#E04E3E", color: "#fff" }}
                >
                  <CheckSquare size={13} /> Pointer ma sortie
                </button>
              )}
              {state === "future" && next && !isToday && (
                <button
                  onClick={() => setShiftDetail(next)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2"
                  style={{ fontSize: 12, fontWeight: 500, backgroundColor: "rgba(255,255,255,0.08)", color: "#FAF8F4", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  Voir le détail <ChevronRight size={13} />
                </button>
              )}

              <div
                className="flex items-center justify-between mt-5 pt-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div style={{ fontSize: 11, color: "rgba(250,248,244,0.55)" }}>
                  <span style={{ color: "#FAF8F4", fontWeight: 500 }}>{weekStats.hours}h</span>
                  <span style={{ margin: "0 6px" }}>·</span>
                  {weekStats.count} {weekStats.count > 1 ? "shifts" : "shift"} cette semaine
                </div>
                <div className="flex items-center gap-1">
                  {weekDays.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-full flex items-center justify-center"
                      style={{
                        width: 22, height: 22,
                        fontSize: 9, fontWeight: 500,
                        backgroundColor: d.hasShift ? "var(--coral)" : "transparent",
                        color: d.hasShift ? "#1A1614" : d.isPast ? "rgba(250,248,244,0.22)" : "rgba(250,248,244,0.55)",
                        border: d.hasShift ? "none" : d.isToday ? "1px solid rgba(240,153,123,0.6)" : "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {d.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bandeau propositions de shift */}
      {proposals.length > 0 && (
        <button
          onClick={() => setProposalsOpen(true)}
          className="w-full rounded-xl px-4 py-4 mb-3 flex items-center gap-3 text-left"
          style={{ backgroundColor: "var(--coral-light)", border: "1px solid var(--coral)" }}
        >
          <div className="rounded-lg flex items-center justify-center" style={{ width: 40, height: 40, backgroundColor: "var(--coral)", color: "#fff" }}>
            <Inbox size={18} />
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--coral-dark)" }}>
              {proposals.length} proposition{proposals.length > 1 ? "s" : ""} de shift
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Touchez pour accepter ou refuser</div>
          </div>
          <ChevronRight size={16} style={{ color: "var(--coral-dark)" }} />
        </button>
      )}

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
              {disposValidated ? "Dispos envoyées" : "Indique tes dispos"}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {disposValidated ? `En attente du planning généré par l'admin` : <>Pour <span style={{ textTransform: "capitalize" }}>{nextMonthLabel}</span> — une seule fois</>}
          </div>
        </div>
        {!disposValidated && <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />}
      </button>

      {shifts.length > 1 && (
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Shifts suivants</div>
      )}
      {shifts.slice(1).map((s) => {
        const role = s.business_role as Role;
        const rc = roleColors[role];
        const active = s.shift_date === today && !s.clocked_out_at;
        const dateLabel = s.shift_date === today ? "Aujourd'hui" : new Date(s.shift_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" });
        const studioName = (s.studio_id && studios[s.studio_id]) || "—";
        const done = !!s.clocked_out_at;
        return (
          <button key={s.id} onClick={() => setShiftDetail(s)} className="w-full rounded-xl border px-4 py-3.5 flex items-center gap-3 mb-2 text-left" style={{ backgroundColor: active ? "var(--coral-light)" : "#fff", borderColor: active ? "var(--coral)" : "rgba(0,0,0,0.08)", opacity: done ? 0.7 : 1 }}>
            <div className="rounded-lg flex items-center justify-center" style={{ width: 36, height: 36, backgroundColor: rc?.bg }}>
              <Clock size={16} style={{ color: rc?.text }} />
            </div>
            <div className="flex-1">
              <div style={{ fontSize: 13, fontWeight: 500 }}>{dateLabel} · {fmtTime(s.start_time)} — {fmtTime(s.end_time)}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{role} · {studioName.replace("Skult ", "")}{done ? " · terminé" : ""}</div>
            </div>
            {active && !done && (
              <span className="rounded-md px-2 py-1" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)" }}>
                {s.clocked_in_at ? "En cours" : "Aujourd'hui"}
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
        onClockIn={() => { if (shiftDetail) { const s = shiftDetail; setShiftDetail(null); handleClockIn(s); } }}
        onEndShift={() => { if (shiftDetail) { const s = shiftDetail; setShiftDetail(null); handleEndShift(s); } }}
        onRequestModif={() => { if (shiftDetail) { setReqShiftId(shiftDetail.id); setShiftDetail(null); setReqOpen(true); } }}
      />
      <ClosureFlow
        open={!!endShift}
        onClose={() => setEndShift(null)}
        shift={endShift}
        userId={userId}
        studios={studios}
        onCompleted={() => {
          if (!endShift) return;
          const completedAt = new Date().toISOString();
          setShifts((prev) => prev.map((s) => s.id === endShift.id ? { ...s, clocked_out_at: completedAt } : s));
        }}
      />
      <SignalementSheet open={signalOpen} onClose={() => setSignalOpen(false)} userId={userId} studioId={profile?.studio_id ?? null} />
      <RequestModificationSheet open={reqOpen} onClose={() => { setReqOpen(false); setReqShiftId(null); }} userId={userId} shiftId={reqShiftId} />
      <MyRequestsSheet open={myReqOpen} onClose={() => setMyReqOpen(false)} userId={userId} />
      <DisposSheet open={disposOpen} onClose={() => setDisposOpen(false)} userId={userId} />
      <ProposalsSheet
        open={proposalsOpen}
        onClose={() => setProposalsOpen(false)}
        studios={studios}
        proposals={proposals}
        reload={reloadProposals}
      />
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
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftDetail, setShiftDetail] = useState<ShiftRow | null>(null);
  const [endShift, setEndShift] = useState<ShiftRow | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqShiftId, setReqShiftId] = useState<string | null>(null);

  async function handleEndShift(s: ShiftRow) {
    if (s.clocked_out_at) { toast.info("Ce shift est déjà clôturé"); return; }
    if (!s.clocked_in_at) { toast.error("Tu dois d'abord pointer ton arrivée"); return; }
    setEndShift(s);
  }

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
        .select("id,shift_date,start_time,end_time,business_role,studio_id,notes,published_at,clocked_in_at,clocked_out_at,minutes_late")
        .eq("user_id", userId)
        .not("published_at", "is", null)
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

  const hasAnyShift = shifts.length > 0;

  const latestPub = shifts.reduce<string | null>((acc, s: any) => {
    const p = s.published_at as string | null;
    if (!p) return acc;
    return !acc || p > acc ? p : acc;
  }, null);

  return (
    <div className="px-5 pt-6">
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Mon planning</div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span style={{ fontSize: 12, color: "var(--muted-foreground)", textTransform: "capitalize" }}>{monthLabel}</span>
        {latestPub && (
          <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
            Publié le {new Date(latestPub).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
          </span>
        )}
      </div>

      {loading ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div> : !hasAnyShift ? (
        <div className="rounded-xl px-5 py-6 flex flex-col items-center text-center gap-2" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <div className="rounded-full flex items-center justify-center" style={{ width: 44, height: 44, backgroundColor: "var(--coral-light)" }}>
            <Sparkles size={20} style={{ color: "var(--coral-dark)" }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>Aucun planning publié</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, maxWidth: 280 }}>
            Tes shifts s'afficheront ici dès que l'admin aura publié le planning du mois.
          </div>
        </div>
      ) : (
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
                  const done = !!s.clocked_out_at;
                  const inService = !done && !!s.clocked_in_at;
                  return (
                    <button key={s.id} onClick={() => setShiftDetail(s)} className="w-full rounded-xl border px-4 py-3 flex items-center gap-3 mb-1 text-left" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)", opacity: done ? 0.65 : 1 }}>
                      <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: done ? "rgba(0,0,0,0.25)" : rc?.dot }} />
                      <div className="flex-1">
                        <span style={{ fontSize: 13, fontWeight: 500, textDecoration: done ? "line-through" : "none" }}>{fmtTime(s.start_time)} — {fmtTime(s.end_time)}</span>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 8 }}>{s.business_role} · {studioName.replace("Skult ", "")}</span>
                      </div>
                      {done && (
                        <span className="rounded-md px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>Effectué</span>
                      )}
                      {inService && (
                        <span className="rounded-md px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)" }}>En cours</span>
                      )}
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
        onClockIn={async () => {
          if (!shiftDetail) return;
          const s = shiftDetail; setShiftDetail(null);
          const { error } = await supabase.from("shifts").update({ clocked_in_at: new Date().toISOString() }).eq("id", s.id);
          if (error) toast.error("Impossible de pointer", { description: error.message });
          else toast.success("Arrivée enregistrée");
        }}
        onEndShift={() => { if (shiftDetail) { const s = shiftDetail; setShiftDetail(null); handleEndShift(s); } }}
        onRequestModif={() => { if (shiftDetail) { setReqShiftId(shiftDetail.id); setShiftDetail(null); setReqOpen(true); } }}
      />
      <ClosureFlow
        open={!!endShift}
        onClose={() => setEndShift(null)}
        shift={endShift}
        userId={userId}
        studios={studios}
        onCompleted={() => {
          if (!endShift) return;
          const completedAt = new Date().toISOString();
          setShifts((prev) => prev.map((s) => s.id === endShift.id ? { ...s, clocked_out_at: completedAt } : s));
        }}
      />
      <RequestModificationSheet open={reqOpen} onClose={() => { setReqOpen(false); setReqShiftId(null); }} userId={userId} shiftId={reqShiftId} />
    </div>
  );
}

/* ─── PROFIL ─── */
function ProfilTab({ profile, businessRoles, studios, userId, onProfileChange, onNavigate }: { profile: ProfileRow | null; businessRoles: Role[]; studios: Record<string, string>; userId: string; onProfileChange: (patch: Partial<ProfileRow>) => void; onNavigate: (t: Tab) => void }) {
  const { signOut } = useAuth();
  const [docsOpen, setDocsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (!profile) return <div className="px-5 pt-6" style={{ fontSize: 13 }}>Chargement…</div>;

  const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();

  const quotaUsed = profile.quota_used; const quotaMax = profile.quota_max;
  const quotaPct = quotaUsed !== null && quotaMax ? Math.round((quotaUsed / quotaMax) * 100) : 0;
  const quotaColor = getQuotaStatus(quotaUsed, quotaMax);
  const barColor = quotaColor === "danger" ? "var(--danger-text)" : quotaColor === "warning" ? "var(--warning-text)" : "var(--success-text)";
  const studioName = profile.studio_id ? studios[profile.studio_id] : null;
  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";

  return (
    <div className="px-5 pt-12">
      {/* Hero profil */}
      <div className="rounded-2xl overflow-hidden mb-4 relative" style={{ background: "linear-gradient(160deg, #1A1A1A 0%, #2A2A28 100%)", padding: 22 }}>
        <button
          onClick={() => setEditOpen(true)}
          className="absolute rounded-full px-3 py-1.5"
          style={{ top: 14, right: 14, fontSize: 11, fontWeight: 500, backgroundColor: "rgba(255,255,255,0.12)", color: "#fff", border: "0.5px solid rgba(255,255,255,0.18)" }}
        >
          Modifier
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="rounded-full overflow-hidden flex items-center justify-center mb-3" style={{
            width: 80, height: 80,
            background: `linear-gradient(135deg, var(--coral) 0%, var(--coral-dark) 100%)`,
            color: "#fff", fontSize: 26, fontWeight: 500,
            boxShadow: "0 8px 24px rgba(240,153,123,0.35)",
          }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (initials || "—")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "#fff" }}>{profile.first_name} {profile.last_name}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{profile.email}</div>
          <div className="flex items-center gap-1.5 mt-3 flex-wrap justify-center">
            {profile.contract && (
              <span className="rounded-full px-2.5 py-1" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", border: "0.5px solid rgba(255,255,255,0.12)" }}>{profile.contract}</span>
            )}
            {businessRoles.map(r => (
              <span key={r} className="rounded-full px-2 py-1" style={{ fontSize: 10, fontWeight: 500, backgroundColor: roleColors[r].bg, color: roleColors[r].text }}>{r}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Contingent */}
      {quotaUsed !== null && quotaMax !== null && quotaMax > 0 && (
        <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 12, fontWeight: 500 }}>Contingent étudiant</span>
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
        <InfoRow icon={<CreditCard size={14} />} label="IBAN" value={profile.iban || "—"} />
        <InfoRow
          icon={<Hash size={14} />}
          label="Taux horaire"
          value={profile.hourly_rate !== null && profile.hourly_rate !== undefined ? `${Number(profile.hourly_rate).toFixed(2).replace(".", ",")} €/h (brut)` : "Non renseigné"}
          last
        />
      </Card>

      <WorkedHoursEmployeeCard userId={userId} hourlyRate={profile.hourly_rate} />
      <EmployeeLastShifts userId={userId} />

      {/* Liens utiles */}
      <div className="rounded-xl border overflow-hidden mt-4" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
        {[
          { label: "Mes formations", icon: GraduationCap, action: () => onNavigate("formation") },
          { label: "Mes documents", icon: Inbox, action: () => setDocsOpen(true) },
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
      <EditProfileSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        userId={userId}
        profile={{
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          birth_date: profile.birth_date,
          address: profile.address,
          city: profile.city,
          nationality: profile.nationality,
          niss: profile.niss,
          iban: profile.iban,
          emergency_contact_name: profile.emergency_contact_name,
          emergency_contact_phone: profile.emergency_contact_phone,
          emergency_contact_relation: profile.emergency_contact_relation,
          avatar_url: profile.avatar_url,
        }}
        onSaved={(patch: EditableProfile) => onProfileChange(patch)}
      />
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

function BellButton({ userId, onOpen }: { userId: string; onOpen: () => void }) {
  const { unread } = useStaffNotifications(userId);
  return (
    <button onClick={onOpen} aria-label="Notifications"
      className="rounded-full flex items-center justify-center"
      style={{ position: "fixed", top: 14, right: 14, zIndex: 50, width: 38, height: 38, backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      <Bell size={16} strokeWidth={1.6} style={{ color: "var(--foreground)" }} />
      {unread > 0 && (
        <span style={{
          position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, padding: "0 4px",
          borderRadius: 8, backgroundColor: "var(--coral)", color: "var(--coral-text)",
          fontSize: 9, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center",
          border: "1.5px solid #fff",
        }}>{unread > 9 ? "9+" : unread}</span>
      )}
    </button>
  );
}

/* ─── POINTAGE ─── */
interface PointageShiftRow extends ShiftRow {
  checklist_status?: string | null;
}
function PointageTab({ studios, userId }: { studios: Record<string, string>; userId: string }) {
  const [todayShift, setTodayShift] = useState<PointageShiftRow | null>(null);
  const [last, setLast] = useState<PointageShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [endShift, setEndShift] = useState<ShiftRow | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const navigate = useNavigate();
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    const today = todayISO();
    const [{ data: t }, { data: history }] = await Promise.all([
      supabase.from("shifts")
        .select("id,shift_date,start_time,end_time,business_role,studio_id,notes,clocked_in_at,clocked_out_at,minutes_late")
        .eq("user_id", userId).eq("shift_date", today)
        .order("start_time").limit(1),
      supabase.from("shifts")
        .select("id,shift_date,start_time,end_time,business_role,studio_id,notes,clocked_in_at,clocked_out_at,minutes_late")
        .eq("user_id", userId).lt("shift_date", today)
        .order("shift_date", { ascending: false }).limit(10),
    ]);
    setTodayShift((t && t[0]) as PointageShiftRow | null ?? null);
    const hist = (history || []) as PointageShiftRow[];
    if (hist.length) {
      const ids = hist.map(s => s.id);
      const { data: subs } = await supabase.from("checklist_submissions")
        .select("shift_id,status").in("shift_id", ids);
      const map = new Map((subs || []).map((s: any) => [s.shift_id, s.status]));
      hist.forEach(s => { s.checklist_status = map.get(s.id) ?? null; });
    }
    setLast(hist);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`pointage-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function clockIn(s: ShiftRow) {
    const { error } = await supabase.from("shifts").update({ clocked_in_at: new Date().toISOString() }).eq("id", s.id);
    if (error) toast.error("Impossible de pointer", { description: error.message });
    else toast.success("Arrivée enregistrée");
  }

  async function clockOut(s: ShiftRow) {
    if (s.clocked_out_at) { toast.info("Ce shift est déjà clôturé"); return; }
    if (!s.clocked_in_at) { toast.error("Tu dois d'abord pointer ton arrivée"); return; }
    setEndShift(s);
  }

  const fmtHHMM = (iso: string) => new Date(iso).toTimeString().slice(0, 5).replace(":", "h");
  const checklistBadge = (status: string | null | undefined) => {
    if (!status) return <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>—</span>;
    if (status === "completed" || status === "submitted" || status === "reviewed" || status === "incomplete_submitted")
      return <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>✓</span>;
    return <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>!</span>;
  };

  return (
    <div className="px-5 pt-6">
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Pointage</div>

      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Aujourd'hui</div>
      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : !todayShift ? (
        <div className="rounded-xl border px-4 py-5 text-center" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)", fontSize: 13, color: "var(--muted-foreground)" }}>
          Aucun shift aujourd'hui.
        </div>
      ) : (() => {
        const s = todayShift;
        const studioName = (s.studio_id && studios[s.studio_id]) || "—";
        const startDt = new Date(s.shift_date + "T" + s.start_time);
        let state: "before" | "in" | "done" = "before";
        if (s.clocked_out_at) state = "done";
        else if (s.clocked_in_at) state = "in";
        const liveLate = Math.max(0, Math.round((nowTs - startDt.getTime()) / 60000));
        let timer = "";
        if (state === "in" && s.clocked_in_at) {
          const el = Math.max(0, nowTs - new Date(s.clocked_in_at).getTime());
          const totS = Math.floor(el / 1000);
          timer = `${String(Math.floor(totS / 3600)).padStart(2, "0")}:${String(Math.floor((totS % 3600) / 60)).padStart(2, "0")}:${String(totS % 60).padStart(2, "0")}`;
        }
        return (
          <div className="rounded-xl border p-4" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{s.business_role} · {studioName.replace("Skult ", "")}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
              Prévu {fmtTime(s.start_time)} → {fmtTime(s.end_time)}
            </div>
            {state === "in" && (
              <div className="mt-3 rounded-md px-3 py-2" style={{ backgroundColor: "var(--coral-light)", fontSize: 12, color: "var(--coral-dark)" }}>
                ⏱ {timer} en service {s.minutes_late ? `· +${s.minutes_late} min retard` : ""}
              </div>
            )}
            {state === "done" && s.clocked_in_at && s.clocked_out_at && (
              <div className="mt-3 rounded-md px-3 py-2" style={{ backgroundColor: "var(--muted)", fontSize: 12 }}>
                {fmtHHMM(s.clocked_in_at)} → {fmtHHMM(s.clocked_out_at)} {s.minutes_late ? `· +${s.minutes_late} min retard` : ""}
              </div>
            )}
            <div className="mt-3">
              {state === "before" && (
                <button onClick={() => clockIn(s)}
                  className="rounded-md px-4 py-2"
                  style={{ fontSize: 13, fontWeight: 500, backgroundColor: liveLate > 0 ? "#E07A3E" : "var(--coral)", color: "#1A1614" }}>
                  Pointer mon arrivée {liveLate > 0 ? `· en retard de ${liveLate} min` : ""}
                </button>
              )}
              {state === "in" && (
                <button onClick={() => clockOut(s)}
                  className="rounded-md px-4 py-2"
                  style={{ fontSize: 13, fontWeight: 500, backgroundColor: "#E04E3E", color: "#fff" }}>
                  Pointer ma sortie
                </button>
              )}
              {state === "done" && (
                <div style={{ fontSize: 12, color: "var(--success-text)", fontWeight: 500 }}>✓ Shift terminé</div>
              )}
            </div>
          </div>
        );
      })()}

      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 20, marginBottom: 8 }}>Mes derniers shifts</div>
      {last.length === 0 ? (
        <div className="rounded-xl border px-4 py-5 text-center" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)", fontSize: 12, color: "var(--muted-foreground)" }}>
          Aucun historique pour le moment.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
          <table className="w-full" style={{ fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                <th className="text-left px-3 py-2" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)" }}>Date</th>
                <th className="text-left px-2 py-2" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)" }}>Arr.</th>
                <th className="text-left px-2 py-2" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)" }}>Retard</th>
                <th className="text-left px-2 py-2" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)" }}>Durée</th>
                <th className="text-left px-2 py-2" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)" }}>Check</th>
              </tr>
            </thead>
            <tbody>
              {last.map(s => {
                const arr = s.clocked_in_at ? fmtHHMM(s.clocked_in_at) : "—";
                const late = s.minutes_late ?? 0;
                const lateColor = late === 0 ? "var(--success-text)" : late <= 15 ? "var(--warning-text)" : "var(--danger-text)";
                let dur = "—";
                if (s.clocked_in_at && s.clocked_out_at) {
                  const m = Math.round((new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 60000);
                  dur = `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
                }
                return (
                  <tr key={s.id} style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                    <td className="px-3 py-2">{new Date(s.shift_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</td>
                    <td className="px-2 py-2">{arr}</td>
                    <td className="px-2 py-2" style={{ color: lateColor, fontWeight: 500 }}>{s.clocked_in_at ? `+${late}` : "—"}</td>
                    <td className="px-2 py-2">{dur}</td>
                    <td className="px-2 py-2">{checklistBadge(s.checklist_status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ClosureFlow
        open={!!endShift}
        onClose={() => setEndShift(null)}
        shift={endShift}
        userId={userId}
        studios={studios}
        onCompleted={() => {
          if (!endShift) return;
          const completedAt = new Date().toISOString();
          setTodayShift((prev) => prev?.id === endShift.id ? { ...prev, clocked_out_at: completedAt } : prev);
        }}
      />
    </div>
  );
}
