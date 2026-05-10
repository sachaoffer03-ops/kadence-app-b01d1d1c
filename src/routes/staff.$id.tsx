import { createFileRoute, Link } from "@tanstack/react-router";
import { employees, roleColors, getQuotaStatus, getInitials, type Employee } from "@/lib/mock-data";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Star, Clock, Edit, FileText, Download, UserX } from "lucide-react";

export const Route = createFileRoute("/staff/$id")({
  component: EmployeeDetailPage,
  head: () => ({ meta: [{ title: "Profil employé — Shyft" }] }),
});

function EmployeeDetailPage() {
  const { id } = Route.useParams();
  const emp = employees.find(e => e.id === id);

  if (!emp) {
    return (
      <div className="p-6">
        <Link to="/staff" className="flex items-center gap-1 mb-4" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          <ArrowLeft size={14} /> Retour au staff
        </Link>
        <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Employé non trouvé</div>
        </div>
      </div>
    );
  }

  const quotaStatus = getQuotaStatus(emp.quotaUsed, emp.quotaMax);
  const quotaPct = emp.quotaUsed !== null && emp.quotaMax !== null ? Math.round((emp.quotaUsed / emp.quotaMax) * 100) : 0;
  const quotaColor = quotaStatus === 'danger' ? "var(--danger-text)" : quotaStatus === 'warning' ? "var(--warning-text)" : "var(--success-text)";

  const scoreColor = (s: number) => s >= 9 ? "var(--success-text)" : s >= 8 ? "var(--foreground)" : s >= 7 ? "var(--warning-text)" : "var(--danger-text)";

  const criteria = [
    { label: 'Ponctualité', value: emp.punctuality || 0 },
    { label: 'Présentation', value: emp.presentation || 0 },
    { label: 'Autonomie', value: emp.autonomy || 0 },
    { label: 'Rapidité', value: emp.speed || 0 },
    { label: 'Qualité service', value: emp.serviceQuality || 0 },
    { label: 'Communication', value: emp.communication || 0 },
  ];

  const recentShifts = [
    { date: 'Aujourd\'hui', time: '07h — 12h', role: emp.roles[0], studio: emp.studio },
    { date: 'Hier', time: '14h — 19h', role: emp.roles[0], studio: emp.studio },
    { date: 'Lundi', time: '10h — 15h', role: emp.roles[emp.roles.length - 1], studio: emp.studio },
    { date: 'Vendredi', time: '17h — 23h', role: emp.roles[0], studio: emp.studio },
    { date: 'Jeudi', time: '07h — 12h', role: emp.roles[0], studio: emp.studio },
  ];

  return (
    <div className="p-6">
      <Link to="/staff" className="flex items-center gap-1 mb-4 transition-colors" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={14} /> Retour au staff
      </Link>

      <div className="grid grid-cols-5 gap-5">
        {/* LEFT — Identity */}
        <div className="col-span-2 flex flex-col gap-4">
          {/* Profile card */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center justify-center rounded-full" style={{
                width: 56, height: 56, backgroundColor: roleColors[emp.roles[0]].bg, color: roleColors[emp.roles[0]].text, fontSize: 18, fontWeight: 500,
              }}>
                {getInitials(emp.firstName, emp.lastName)}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{emp.firstName} {emp.lastName}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="rounded-full px-2 py-0.5" style={{
                    fontSize: 11,
                    backgroundColor: emp.contract === 'CDI' ? "var(--info-bg)" : emp.contract === 'Flexi' ? "var(--warning-bg)" : "var(--muted)",
                    color: emp.contract === 'CDI' ? "var(--info-text)" : emp.contract === 'Flexi' ? "var(--warning-text)" : "var(--muted-foreground)",
                  }}>
                    {emp.contract}
                  </span>
                  {emp.roles.map(r => (
                    <span key={r} className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColors[r].bg, color: roleColors[r].text }}>{r}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <InfoRow icon={<MapPin size={13} />} label={`${emp.age} ans · ${emp.city}`} />
              {emp.phone && <InfoRow icon={<Phone size={13} />} label={emp.phone} />}
              {emp.email && <InfoRow icon={<Mail size={13} />} label={emp.email} />}
            </div>
          </div>

          {/* Legal compliance */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Conformité légale</div>
            <div className="flex flex-col gap-2.5">
              <LegalRow label="NISS" value={emp.niss || '—'} />
              <LegalRow label="IBAN" value={emp.iban || '—'} />
              <LegalRow label="Nationalité" value={emp.nationality || '—'} />
              {emp.contract === 'Étudiant' && (
                <LegalRow label="Carte étudiant" value={emp.studentCardValid ? 'Valide' : 'Non fournie'} ok={emp.studentCardValid} />
              )}
            </div>
          </div>

          {/* Studios & Preferences */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Studios autorisés</div>
            <div className="flex gap-2 mb-4">
              <span className="rounded-full px-2.5 py-1" style={{ fontSize: 11, backgroundColor: "var(--muted)", fontWeight: 500 }}>{emp.studio}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Préférences</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Rôle préféré : <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{emp.roles[0]}</span>
            </div>
          </div>

          {/* Admin actions */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Actions</div>
            <div className="flex flex-col gap-2">
              <ActionBtn icon={<Edit size={13} />} label="Modifier les rôles" />
              <ActionBtn icon={<Star size={13} />} label="Ajuster le score" />
              <ActionBtn icon={<FileText size={13} />} label="Voir la formation" />
              <ActionBtn icon={<Download size={13} />} label="Exporter les données" />
              <ActionBtn icon={<UserX size={13} />} label="Désactiver le compte" danger />
            </div>
          </div>
        </div>

        {/* RIGHT — Performance */}
        <div className="col-span-3 flex flex-col gap-4">
          {/* Top KPIs */}
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Score global" value={emp.score.toString()} sub="/10" color={scoreColor(emp.score)} />
            {emp.quotaUsed !== null ? (
              <KpiCard label="Heures 2026" value={emp.quotaUsed.toString()} sub={`/ ${emp.quotaMax}h`} color={quotaColor} />
            ) : (
              <KpiCard label="Shifts ce mois" value={emp.shiftsCount.toString()} />
            )}
            <KpiCard label="Shifts ce mois" value={emp.shiftsCount.toString()} />
            <KpiCard label="Ponctualité" value={`${emp.punctuality || 0}`} sub="/10" />
          </div>

          {/* Quota bar for students */}
          {emp.quotaUsed !== null && emp.quotaMax !== null && (
            <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 12, fontWeight: 500 }}>Contingent 650h</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: quotaColor }}>{emp.quotaUsed}h / {emp.quotaMax}h ({quotaPct}%)</span>
              </div>
              <div style={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "var(--muted)" }}>
                <div style={{ width: `${Math.min(quotaPct, 100)}%`, height: "100%", borderRadius: 3, backgroundColor: quotaColor }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
                {emp.quotaMax - emp.quotaUsed}h restantes cette année
              </div>
            </div>
          )}

          {/* Score per role */}
          {emp.roleScores && Object.keys(emp.roleScores).length > 0 && (
            <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Score par rôle</div>
              <div className="flex items-center gap-4">
                {Object.entries(emp.roleScores).map(([role, score]) => {
                  const rc = roleColors[role as keyof typeof roleColors];
                  return (
                    <div key={role} className="flex items-center gap-3 rounded-lg px-4 py-3 flex-1" style={{ backgroundColor: rc.bg }}>
                      <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: rc.dot }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: rc.text }}>{role}</span>
                      <span style={{ fontSize: 18, fontWeight: 500, color: rc.text, marginLeft: "auto" }}>{score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Criteria breakdown */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Critères détaillés</div>
            <div className="grid grid-cols-2 gap-3">
              {criteria.map(c => (
                <div key={c.label} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--muted)" }}>
                  <span style={{ fontSize: 12 }}>{c.label}</span>
                  <div className="flex items-center gap-2">
                    <div style={{ width: 50, height: 3, borderRadius: 2, backgroundColor: "var(--border)" }}>
                      <div style={{ width: `${(c.value / 10) * 100}%`, height: "100%", borderRadius: 2, backgroundColor: scoreColor(c.value) }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: scoreColor(c.value), minWidth: 24, textAlign: "right" }}>{c.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent shifts */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Shifts récents</div>
            <div className="flex flex-col gap-1">
              {recentShifts.map((s, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors" style={{ cursor: "pointer" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)", minWidth: 70 }}>{s.date}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{s.time}</span>
                  <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColors[s.role].bg, color: roleColors[s.role].text }}>{s.role}</span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: "auto" }}>{s.studio.replace('Skult ', '')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function LegalRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, fontFamily: value.includes('-') ? 'monospace' : undefined, color: ok === false ? "var(--warning-text)" : "var(--foreground)" }}>
        {value}
      </span>
    </div>
  );
}

function ActionBtn({ icon, label, danger }: { icon: React.ReactNode; label: string; danger?: boolean }) {
  return (
    <button className="flex items-center gap-2 rounded-md px-3 py-2 text-left transition-colors w-full" style={{
      fontSize: 12, border: "0.5px solid var(--border)", color: danger ? "var(--danger-text)" : "var(--foreground)",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
    >
      {icon} {label}
    </button>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div className="flex items-baseline gap-0.5">
        <span style={{ fontSize: 20, fontWeight: 500, color: color || "var(--foreground)" }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{sub}</span>}
      </div>
    </div>
  );
}
