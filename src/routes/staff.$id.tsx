import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { employees, roleColors, getQuotaStatus, getInitials, type Employee, type Role } from "@/lib/mock-data";
import { ArrowLeft, Mail, Phone, MapPin, Star, Edit, FileText, Download, UserX, X, Check } from "lucide-react";

type ModalParam = "roles" | "score" | "deactivate";

export const Route = createFileRoute("/staff/$id")({
  component: EmployeeDetailPage,
  head: () => ({ meta: [{ title: "Profil employé — Shyft" }] }),
  validateSearch: (s: Record<string, unknown>): { modal?: ModalParam } => {
    const m = s.modal;
    return m === "roles" || m === "score" || m === "deactivate" ? { modal: m } : {};
  },
});

const ALL_ROLES: Role[] = ["Barista", "Accueil", "Host", "Cuisine"];

type Modal = null | "roles" | "score" | "deactivate";

function EmployeeDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const initial = employees.find(e => e.id === id);
  const search = Route.useSearch();
  const [emp, setEmp] = useState<Employee | undefined>(initial);
  const [active, setActive] = useState(true);
  const [modal, setModal] = useState<Modal>(search.modal ?? null);

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

  const recentShifts = useMemo(() => [
    { date: "Aujourd'hui", time: '07h — 12h', role: emp.roles[0], studio: emp.studio },
    { date: 'Hier', time: '14h — 19h', role: emp.roles[0], studio: emp.studio },
    { date: 'Lundi', time: '10h — 15h', role: emp.roles[emp.roles.length - 1], studio: emp.studio },
    { date: 'Vendredi', time: '17h — 23h', role: emp.roles[0], studio: emp.studio },
    { date: 'Jeudi', time: '07h — 12h', role: emp.roles[0], studio: emp.studio },
  ], [emp]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(emp, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${emp.firstName}_${emp.lastName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Données exportées");
  };

  return (
    <div className="p-6">
      <Link to="/staff" className="flex items-center gap-1 mb-4 transition-colors" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={14} /> Retour au staff
      </Link>

      {!active && (
        <div className="rounded-lg border px-3 py-2 mb-4 flex items-center justify-between" style={{ backgroundColor: "var(--warning-bg)", borderColor: "var(--border)", color: "var(--warning-text)", fontSize: 12 }}>
          <span>Compte désactivé — l'employé n'apparaît plus dans les plannings.</span>
          <button onClick={() => { setActive(true); toast.success("Compte réactivé"); }} className="rounded-md px-2 py-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--card)" }}>Réactiver</button>
        </div>
      )}

      <div className="grid grid-cols-5 gap-5">
        {/* LEFT */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center justify-center rounded-full" style={{ width: 56, height: 56, backgroundColor: roleColors[emp.roles[0]].bg, color: roleColors[emp.roles[0]].text, fontSize: 18, fontWeight: 500 }}>
                {getInitials(emp.firstName, emp.lastName)}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{emp.firstName} {emp.lastName}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="rounded-full px-2 py-0.5" style={{
                    fontSize: 11,
                    backgroundColor: emp.contract === 'CDI' ? "var(--info-bg)" : emp.contract === 'Flexi' ? "var(--warning-bg)" : "var(--muted)",
                    color: emp.contract === 'CDI' ? "var(--info-text)" : emp.contract === 'Flexi' ? "var(--warning-text)" : "var(--muted-foreground)",
                  }}>{emp.contract}</span>
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

          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Actions</div>
            <div className="flex flex-col gap-2">
              <ActionBtn icon={<Edit size={13} />} label="Modifier les rôles" onClick={() => setModal("roles")} />
              <ActionBtn icon={<Star size={13} />} label="Ajuster le score" onClick={() => setModal("score")} />
              <ActionBtn icon={<FileText size={13} />} label="Voir la formation" onClick={() => navigate({ to: "/formation" })} />
              <ActionBtn icon={<Download size={13} />} label="Exporter les données" onClick={handleExport} />
              <ActionBtn icon={<UserX size={13} />} label={active ? "Désactiver le compte" : "Compte désactivé"} danger onClick={() => active && setModal("deactivate")} />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col-span-3 flex flex-col gap-4">
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

          {emp.roleScores && Object.keys(emp.roleScores).length > 0 && (
            <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Score par rôle</div>
              <div className="flex items-center gap-4 flex-wrap">
                {Object.entries(emp.roleScores).map(([role, score]) => {
                  const rc = roleColors[role as keyof typeof roleColors];
                  return (
                    <div key={role} className="flex items-center gap-3 rounded-lg px-4 py-3 flex-1" style={{ backgroundColor: rc.bg, minWidth: 160 }}>
                      <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: rc.dot }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: rc.text }}>{role}</span>
                      <span style={{ fontSize: 18, fontWeight: 500, color: rc.text, marginLeft: "auto" }}>{score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <div style={{ fontSize: 13, fontWeight: 500 }}>Critères détaillés</div>
              <button onClick={() => setModal("score")} className="flex items-center gap-1 rounded-md px-2 py-1" style={{ fontSize: 11, border: "0.5px solid var(--border)" }}>
                <Edit size={11} /> Ajuster
              </button>
            </div>
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

      {modal === "roles" && (
        <RolesModal emp={emp} onClose={() => setModal(null)} onSave={(roles, primary) => {
          const ordered: Role[] = [primary, ...roles.filter(r => r !== primary)];
          const newRoleScores: Record<string, number> = {};
          ordered.forEach(r => { newRoleScores[r] = emp.roleScores?.[r] ?? Math.round(emp.score * 10) / 10; });
          setEmp({ ...emp, roles: ordered, roleScores: newRoleScores });
          toast.success("Rôles mis à jour");
          setModal(null);
        }} />
      )}

      {modal === "score" && (
        <ScoreModal emp={emp} onClose={() => setModal(null)} onSave={(patch) => {
          const next = { ...emp, ...patch };
          const avg = ((next.punctuality ?? 0) + (next.presentation ?? 0) + (next.autonomy ?? 0) + (next.speed ?? 0) + (next.serviceQuality ?? 0) + (next.communication ?? 0)) / 6;
          next.score = Math.round(avg * 10) / 10;
          setEmp(next);
          toast.success("Score ajusté");
          setModal(null);
        }} />
      )}

      {modal === "deactivate" && (
        <ConfirmModal
          title="Désactiver le compte ?"
          message={`${emp.firstName} ${emp.lastName} ne sera plus assigné aux plannings et n'aura plus accès à l'application.`}
          confirmLabel="Désactiver"
          danger
          onClose={() => setModal(null)}
          onConfirm={() => { setActive(false); setModal(null); toast.success("Compte désactivé"); }}
        />
      )}
    </div>
  );
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
      {icon}<span>{label}</span>
    </div>
  );
}

function LegalRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, fontFamily: value.includes('-') ? 'monospace' : undefined, color: ok === false ? "var(--warning-text)" : "var(--foreground)" }}>{value}</span>
    </div>
  );
}

function ActionBtn({ icon, label, danger, onClick }: { icon: React.ReactNode; label: string; danger?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-md px-3 py-2 text-left transition-colors w-full" style={{
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

/* ============== MODALS ============== */

function ModalShell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="rounded-xl border w-full max-w-md" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
          <button onClick={onClose} className="rounded p-1" style={{ color: "var(--muted-foreground)" }}><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: "var(--border)" }}>{footer}</div>}
      </div>
    </div>
  );
}

function RolesModal({ emp, onClose, onSave }: { emp: Employee; onClose: () => void; onSave: (roles: Role[], primary: Role) => void }) {
  const [selected, setSelected] = useState<Role[]>(emp.roles);
  const [primary, setPrimary] = useState<Role>(emp.roles[0]);

  const toggle = (r: Role) => {
    setSelected(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  return (
    <ModalShell title="Modifier les rôles" onClose={onClose} footer={
      <>
        <button onClick={onClose} className="rounded-md px-3 py-1.5" style={{ fontSize: 12, border: "0.5px solid var(--border)" }}>Annuler</button>
        <button disabled={selected.length === 0 || !selected.includes(primary)} onClick={() => onSave(selected, primary)} className="rounded-md px-3 py-1.5" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--primary)", color: "var(--primary-foreground)", opacity: selected.length === 0 || !selected.includes(primary) ? 0.5 : 1 }}>Enregistrer</button>
      </>
    }>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>Sélectionne les rôles que peut couvrir l'employé.</div>
      <div className="flex flex-col gap-2 mb-5">
        {ALL_ROLES.map(r => {
          const on = selected.includes(r);
          const rc = roleColors[r];
          return (
            <button key={r} onClick={() => toggle(r)} className="flex items-center justify-between rounded-md px-3 py-2" style={{ border: `1px solid ${on ? rc.dot : "var(--border)"}`, backgroundColor: on ? rc.bg : "transparent" }}>
              <div className="flex items-center gap-2">
                <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: rc.dot }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: on ? rc.text : "var(--foreground)" }}>{r}</span>
              </div>
              {on && <Check size={14} style={{ color: rc.text }} />}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Rôle préféré</div>
      <div className="flex gap-2 flex-wrap">
        {selected.map(r => (
          <button key={r} onClick={() => setPrimary(r)} className="rounded-full px-3 py-1" style={{ fontSize: 11, fontWeight: 500, border: `1px solid ${primary === r ? roleColors[r].dot : "var(--border)"}`, backgroundColor: primary === r ? roleColors[r].bg : "transparent", color: primary === r ? roleColors[r].text : "var(--foreground)" }}>{r}</button>
        ))}
        {selected.length === 0 && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Aucun rôle sélectionné</span>}
      </div>
    </ModalShell>
  );
}

function ScoreModal({ emp, onClose, onSave }: { emp: Employee; onClose: () => void; onSave: (patch: Partial<Employee>) => void }) {
  const [vals, setVals] = useState({
    punctuality: emp.punctuality ?? 8,
    presentation: emp.presentation ?? 8,
    autonomy: emp.autonomy ?? 8,
    speed: emp.speed ?? 8,
    serviceQuality: emp.serviceQuality ?? 8,
    communication: emp.communication ?? 8,
  });
  const labels: Record<keyof typeof vals, string> = {
    punctuality: "Ponctualité", presentation: "Présentation", autonomy: "Autonomie",
    speed: "Rapidité", serviceQuality: "Qualité service", communication: "Communication",
  };
  const avg = Math.round(Object.values(vals).reduce((a, b) => a + b, 0) / 6 * 10) / 10;

  return (
    <ModalShell title="Ajuster le score" onClose={onClose} footer={
      <>
        <button onClick={onClose} className="rounded-md px-3 py-1.5" style={{ fontSize: 12, border: "0.5px solid var(--border)" }}>Annuler</button>
        <button onClick={() => onSave(vals)} className="rounded-md px-3 py-1.5" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Enregistrer</button>
      </>
    }>
      <div className="flex items-center justify-between mb-4 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--muted)" }}>
        <span style={{ fontSize: 12, fontWeight: 500 }}>Score global calculé</span>
        <span style={{ fontSize: 18, fontWeight: 500 }}>{avg}<span style={{ fontSize: 11, color: "var(--muted-foreground)" }}> /10</span></span>
      </div>
      <div className="flex flex-col gap-3">
        {(Object.keys(vals) as Array<keyof typeof vals>).map(k => (
          <div key={k}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 12 }}>{labels[k]}</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{vals[k].toFixed(1)}</span>
            </div>
            <input type="range" min={0} max={10} step={0.1} value={vals[k]} onChange={e => setVals({ ...vals, [k]: parseFloat(e.target.value) })} style={{ width: "100%" }} />
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function ConfirmModal({ title, message, confirmLabel, danger, onClose, onConfirm }: { title: string; message: string; confirmLabel: string; danger?: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <ModalShell title={title} onClose={onClose} footer={
      <>
        <button onClick={onClose} className="rounded-md px-3 py-1.5" style={{ fontSize: 12, border: "0.5px solid var(--border)" }}>Annuler</button>
        <button onClick={onConfirm} className="rounded-md px-3 py-1.5" style={{ fontSize: 12, fontWeight: 500, backgroundColor: danger ? "var(--danger-text)" : "var(--primary)", color: "white" }}>{confirmLabel}</button>
      </>
    }>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{message}</div>
    </ModalShell>
  );
}
