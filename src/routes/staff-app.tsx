import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Home, Calendar, CalendarCheck, User, ChevronRight, Clock, Star, GraduationCap, QrCode, ClipboardCheck } from "lucide-react";
import { employees, roleColors, getQuotaStatus, type Role } from "@/lib/mock-data";

export const Route = createFileRoute("/staff-app")({
  component: StaffAppPage,
});

type Tab = 'accueil' | 'planning' | 'dispos' | 'profil';

const emp = employees[0]; // Clara Martens as the logged-in user

function StaffAppPage() {
  const [tab, setTab] = useState<Tab>('accueil');

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#FAF8F4", maxWidth: 430, margin: "0 auto", position: "relative" }}>
      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {tab === 'accueil' && <AccueilTab onNavigate={setTab} />}
        {tab === 'planning' && <PlanningTab />}
        {tab === 'dispos' && <DisposTab />}
        {tab === 'profil' && <ProfilTab onNavigate={setTab} />}
      </div>

      {/* Bottom tab bar */}
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
function AccueilTab() {
  const shifts = [
    { date: "Aujourd'hui", time: '07h — 12h', role: 'Barista' as Role, studio: 'Skult Rhodes', active: true },
    { date: 'Demain', time: '10h — 15h', role: 'Barista' as Role, studio: 'Skult Rhodes', active: false },
    { date: 'Samedi', time: '14h — 19h', role: 'Accueil' as Role, studio: 'Skult Rhodes', active: false },
  ];

  return (
    <div className="px-5 pt-6">
      <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Bonjour,</div>
      <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 20 }}>Clara</div>

      {/* This week hero */}
      <div className="rounded-xl p-5 mb-5" style={{ background: "linear-gradient(135deg, #1A1A1A, #2A2A28)" }}>
        <div style={{ fontSize: 11, color: "var(--coral)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Cette semaine</div>
        <div className="flex items-center gap-6">
          <div>
            <div style={{ fontSize: 28, fontWeight: 500, color: "#fff" }}>24h</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Heures prévues</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 500, color: "#fff" }}>5</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Shifts</div>
          </div>
        </div>
      </div>

      {/* Today's shift */}
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Prochain shift</div>
      {shifts.map((s, i) => {
        const rc = roleColors[s.role];
        return (
          <div key={i} className="rounded-xl border px-4 py-3.5 flex items-center gap-3 mb-2" style={{ backgroundColor: s.active ? "var(--coral-light)" : "#fff", borderColor: s.active ? "var(--coral)" : "rgba(0,0,0,0.08)" }}>
            <div className="rounded-lg flex items-center justify-center" style={{ width: 36, height: 36, backgroundColor: rc.bg }}>
              <Clock size={16} style={{ color: rc.text }} />
            </div>
            <div className="flex-1">
              <div style={{ fontSize: 13, fontWeight: 500 }}>{s.date} · {s.time}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.role} · {s.studio.replace('Skult ', '')}</div>
            </div>
            {s.active && (
              <button onClick={() => toast.success("Pointage enregistré", { description: `${s.role} · ${s.studio}` })} className="rounded-md px-3 py-1.5 flex items-center gap-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "#fff" }}>
                <QrCode size={12} /> Pointer
              </button>
            )}
            <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />
          </div>
        );
      })}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <QuickLink icon={<CalendarCheck size={18} />} label="Mes disponibilités" sub="Juin 2026" onClick={() => { /* tab change handled below */ window.dispatchEvent(new CustomEvent('staff-app-tab', { detail: 'dispos' })); }} />
        <QuickLink icon={<GraduationCap size={18} />} label="Formation" sub="3 vidéos restantes" onClick={() => toast("Formation à venir", { description: "Cette section sera bientôt disponible" })} />
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
function PlanningTab() {
  const days = [
    { date: 'Lundi 11 mai', shifts: [{ time: '10h — 15h', role: 'Barista' as Role, studio: 'Rhodes' }] },
    { date: 'Mardi 12 mai', shifts: [{ time: '07h — 12h', role: 'Barista' as Role, studio: 'Rhodes' }] },
    { date: 'Mercredi 13 mai', shifts: [] },
    { date: 'Jeudi 14 mai', shifts: [{ time: '14h — 19h', role: 'Accueil' as Role, studio: 'Rhodes' }] },
    { date: 'Vendredi 15 mai', shifts: [{ time: '17h — 23h', role: 'Barista' as Role, studio: 'Rhodes' }] },
    { date: 'Samedi 16 mai', shifts: [{ time: '10h — 15h', role: 'Barista' as Role, studio: 'Rhodes' }, { time: '17h — 23h', role: 'Accueil' as Role, studio: 'Rhodes' }] },
    { date: 'Dimanche 17 mai', shifts: [] },
  ];

  return (
    <div className="px-5 pt-6">
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Mon planning</div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Mai 2026</div>

      <div className="flex flex-col gap-2">
        {days.map(day => (
          <div key={day.date}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 4, marginTop: 8 }}>{day.date}</div>
            {day.shifts.length === 0 ? (
              <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "var(--muted)", fontSize: 12, color: "var(--muted-foreground)" }}>Repos</div>
            ) : (
              day.shifts.map((s, i) => {
                const rc = roleColors[s.role];
                return (
                  <div key={i} className="rounded-xl border px-4 py-3 flex items-center gap-3 mb-1" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
                    <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: rc.dot }} />
                    <div className="flex-1">
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{s.time}</span>
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 8 }}>{s.role} · {s.studio}</span>
                    </div>
                    <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── DISPOS ─── */
function DisposTab() {
  const [availability, setAvailability] = useState<Record<number, string[]>>({});
  const slots = ['Matin (6h-13h)', 'Midi (11h-17h)', 'Soir (16h-23h)'];
  const daysInMonth = 30;
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const configured = Object.keys(availability).length;

  const toggleSlot = (day: number, slot: string) => {
    setAvailability(prev => {
      const current = prev[day] || [];
      const has = current.includes(slot);
      return { ...prev, [day]: has ? current.filter(s => s !== slot) : [...current, slot] };
    });
  };

  return (
    <div className="px-5 pt-6">
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Mes disponibilités</div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 4 }}>Juin 2026</div>

      <div className="rounded-xl px-4 py-2.5 flex items-center justify-between mb-4" style={{ backgroundColor: configured >= 20 ? "var(--success-bg)" : "var(--warning-bg)" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: configured >= 20 ? "var(--success-text)" : "var(--warning-text)" }}>
          {configured} / {daysInMonth} jours configurés
        </span>
        <span style={{ fontSize: 11, color: "var(--danger-text)", fontWeight: 500 }}>
          Date limite : 25 mai
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {Array.from({ length: Math.min(14, daysInMonth) }, (_, i) => i + 1).map(day => {
          const dayOfWeek = dayNames[(day + 0) % 7]; // simplified
          const daySlots = availability[day] || [];
          return (
            <div key={day} className="rounded-lg border px-3 py-2.5 flex items-center gap-3" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
              <div style={{ minWidth: 50 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{dayOfWeek} {day}</div>
              </div>
              <div className="flex items-center gap-1 flex-1">
                {['M', 'Mi', 'S'].map((label, si) => {
                  const slot = slots[si];
                  const active = daySlots.includes(slot);
                  return (
                    <button key={si} onClick={() => toggleSlot(day, slot)} className="rounded-md px-2.5 py-1 transition-colors" style={{
                      fontSize: 10, fontWeight: active ? 500 : 400,
                      backgroundColor: active ? "var(--coral)" : "transparent",
                      color: active ? "#fff" : "var(--muted-foreground)",
                      border: active ? "none" : "0.5px solid var(--border)",
                    }}>
                      {label}
                    </button>
                  );
                })}
              </div>
              {daySlots.length > 0 && <span style={{ fontSize: 10, color: "var(--success-text)" }}>{daySlots.length} slot{daySlots.length > 1 ? 's' : ''}</span>}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", marginTop: 12 }}>
        Affichage des 14 premiers jours. Scrollez pour voir la suite.
      </div>
    </div>
  );
}

/* ─── PROFIL ─── */
function ProfilTab() {
  const quotaPct = Math.round(((emp.quotaUsed || 0) / (emp.quotaMax || 1)) * 100);
  const quotaColor = getQuotaStatus(emp.quotaUsed, emp.quotaMax);
  const barColor = quotaColor === 'danger' ? "var(--danger-text)" : quotaColor === 'warning' ? "var(--warning-text)" : "var(--success-text)";

  return (
    <div className="px-5 pt-6">
      {/* Avatar & name */}
      <div className="flex items-center gap-4 mb-6">
        <div className="rounded-full flex items-center justify-center" style={{ width: 56, height: 56, backgroundColor: roleColors[emp.roles[0]].bg, color: roleColors[emp.roles[0]].text, fontSize: 18, fontWeight: 500 }}>
          CM
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{emp.firstName} {emp.lastName}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>{emp.contract}</span>
            {emp.roles.map(r => (
              <span key={r} className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColors[r].bg, color: roleColors[r].text }}>{r}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Quota */}
      {emp.quotaUsed !== null && (
        <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 12, fontWeight: 500 }}>Contingent 650h</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: barColor }}>{emp.quotaUsed}h / {emp.quotaMax}h</span>
          </div>
          <div style={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "var(--muted)" }}>
            <div style={{ width: `${quotaPct}%`, height: "100%", borderRadius: 3, backgroundColor: barColor }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>{(emp.quotaMax || 0) - (emp.quotaUsed || 0)}h restantes</div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard label="Shifts ce mois" value={emp.shiftsCount.toString()} />
        <StatCard label="Score" value={emp.score.toString()} sub="/10" />
      </div>

      {/* Menu */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
        {[
          { label: 'Mes informations', icon: User },
          { label: 'Formation', icon: GraduationCap },
          { label: 'Mes documents', icon: ClipboardCheck },
          { label: 'Notifications', icon: Calendar },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: i < 3 ? "0.5px solid rgba(0,0,0,0.06)" : "none", cursor: "pointer" }}>
            <item.icon size={16} style={{ color: "var(--muted-foreground)" }} />
            <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>
            <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
          </div>
        ))}
      </div>

      <button className="w-full rounded-xl border px-4 py-3 mt-4 text-center" style={{ fontSize: 13, color: "var(--danger-text)", backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
        Se déconnecter
      </button>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div className="flex items-baseline gap-0.5">
        <span style={{ fontSize: 20, fontWeight: 500 }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{sub}</span>}
      </div>
    </div>
  );
}
