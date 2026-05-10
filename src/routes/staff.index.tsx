import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { employees, roleColors, getQuotaStatus, getInitials, type Employee, type Role } from "@/lib/mock-data";
import { Search, X, ArrowLeft, ArrowRight, Mail, Phone, MapPin, Star, Clock, Edit, FileText, Download, UserX, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { InviteEmployeeModal } from "@/components/InviteEmployeeModal";
import { InvitationsList } from "@/components/InvitationsList";


export const Route = createFileRoute("/staff/")({
  component: StaffPage,
  head: () => ({
    meta: [{ title: "Staff — Kadence" }],
  }),
});

type ContractFilter = "Étudiant" | "Flexi" | "CDI";
type StudioFilter = "Skult Rhodes" | "Skult Châtelain";

function StaffPage() {
  const [tab, setTab] = useState<"employees" | "invitations">("employees");
  const [contractFilters, setContractFilters] = useState<Set<ContractFilter>>(new Set());
  const [studioFilters, setStudioFilters] = useState<Set<StudioFilter>>(new Set());
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  

  const toggleContract = (f: ContractFilter) => {
    setContractFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };
  const toggleStudio = (f: StudioFilter) => {
    setStudioFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };

  const filtered = employees.filter((e) => {
    if (search) {
      const q = search.toLowerCase();
      if (!`${e.firstName} ${e.lastName}`.toLowerCase().includes(q)) return false;
    }
    if (contractFilters.size > 0 && !contractFilters.has(e.contract as ContractFilter)) return false;
    if (studioFilters.size > 0 && !studioFilters.has(e.studio as StudioFilter)) return false;
    return true;
  });

  const studentCount = employees.filter((e) => e.contract === "Étudiant").length;
  const flexiCount = employees.filter((e) => e.contract === "Flexi").length;
  const cdiCount = employees.filter((e) => e.contract === "CDI").length;
  const rhodesCount = employees.filter((e) => e.studio === "Skult Rhodes").length;
  const chatelainCount = employees.filter((e) => e.studio === "Skult Châtelain").length;

  const contractOptions: { key: ContractFilter; label: string; count: number }[] = [
    { key: "Étudiant", label: "Étudiants", count: studentCount },
    { key: "Flexi", label: "Flexis", count: flexiCount },
    { key: "CDI", label: "CDI", count: cdiCount },
  ];
  const studioOptions: { key: StudioFilter; label: string; count: number }[] = [
    { key: "Skult Rhodes", label: "Rhodes", count: rhodesCount },
    { key: "Skult Châtelain", label: "Châtelain", count: chatelainCount },
  ];

  return (
    <div className="p-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b" style={{ borderColor: "var(--border)" }}>
        {[
          { key: "employees" as const, label: "Employés", Icon: Users },
          { key: "invitations" as const, label: "Invitations", Icon: Mail },
        ].map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="inline-flex items-center gap-1.5 px-3 py-2 transition-colors"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: active ? "var(--foreground)" : "var(--muted-foreground)",
                borderBottom: active ? "2px solid var(--coral)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              <Icon size={13} strokeWidth={1.8} /> {label}
            </button>
          );
        })}
      </div>

      <InviteEmployeeModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      {tab === "invitations" ? (
        <InvitationsList onInviteClick={() => setInviteOpen(true)} />
      ) : (
        <>
      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex items-center gap-2 rounded-md border px-3"
          style={{ height: 32, borderColor: "var(--border)", backgroundColor: "var(--card)", width: 220 }}
        >
          <Search size={14} style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 bg-transparent outline-none flex-1"
            style={{ fontSize: 12, color: "var(--foreground)" }}
          />
        </div>
        <div className="flex items-center gap-1">
          {contractOptions.map((f) => (
            <button
              key={f.key}
              onClick={() => toggleContract(f.key)}
              className="rounded-full px-2.5 py-1 transition-colors"
              style={{
                fontSize: 12,
                fontWeight: contractFilters.has(f.key) ? 500 : 400,
                backgroundColor: contractFilters.has(f.key) ? "var(--foreground)" : "transparent",
                color: contractFilters.has(f.key) ? "var(--card)" : "var(--muted-foreground)",
                border: contractFilters.has(f.key) ? "none" : "0.5px solid var(--border)",
              }}
            >
              {f.label} · {f.count}
            </button>
          ))}
          <span className="mx-2" style={{ width: 1, height: 16, backgroundColor: "var(--border)", display: "inline-block" }} />
          {studioOptions.map((f) => (
            <button
              key={f.key}
              onClick={() => toggleStudio(f.key)}
              className="rounded-full px-2.5 py-1 transition-colors"
              style={{
                fontSize: 12,
                fontWeight: studioFilters.has(f.key) ? 500 : 400,
                backgroundColor: studioFilters.has(f.key) ? "var(--foreground)" : "transparent",
                color: studioFilters.has(f.key) ? "var(--card)" : "var(--muted-foreground)",
                border: studioFilters.has(f.key) ? "none" : "0.5px solid var(--border)",
              }}
            >
              {f.label} · {f.count}
            </button>
          ))}
          {(contractFilters.size > 0 || studioFilters.size > 0) && (
            <button
              onClick={() => { setContractFilters(new Set()); setStudioFilters(new Set()); }}
              className="rounded-full px-2 py-1 ml-1 transition-colors"
              style={{ fontSize: 11, color: "var(--muted-foreground)" }}
            >
              Effacer
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {filtered.length} employé{filtered.length > 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
          >
            <UserPlus size={13} /> Inviter
          </button>
        </div>
      </div>
      <InviteEmployeeModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              {["Nom", "Contrat", "Postes", "Score", "Contingent", "Shifts / mois", "Ponctualité"].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2.5"
                  style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => (
              <EmployeeRow key={emp.id} employee={emp} onClick={() => setSelectedEmployee(emp)} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Employee slide-over */}
      {selectedEmployee && (
        <EmployeeSlideOver employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
      )}
        </>
      )}
    </div>
  );
}

function EmployeeRow({ employee: e, onClick }: { employee: Employee; onClick: () => void }) {
  const quotaStatus = getQuotaStatus(e.quotaUsed, e.quotaMax);
  const quotaPct = e.quotaUsed !== null && e.quotaMax !== null ? (e.quotaUsed / e.quotaMax) * 100 : 0;

  const quotaBarColor =
    quotaStatus === "danger" ? "var(--danger-text)" :
    quotaStatus === "warning" ? "var(--warning-text)" :
    quotaStatus === "safe" ? "var(--success-text)" : "var(--muted-foreground)";

  const scoreColor =
    e.score >= 9 ? "var(--success-text)" :
    e.score >= 8 ? "var(--foreground)" :
    e.score >= 7 ? "var(--warning-text)" : "var(--danger-text)";

  const punctColor =
    (e.punctuality || 0) >= 9 ? "var(--success-text)" :
    (e.punctuality || 0) >= 8 ? "var(--foreground)" :
    (e.punctuality || 0) >= 7 ? "var(--warning-text)" : "var(--danger-text)";

  return (
    <tr
      className="transition-colors"
      style={{ borderBottom: "0.5px solid var(--border)", cursor: "pointer" }}
      onClick={onClick}
      onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
      onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 30, height: 30, backgroundColor: roleColors[e.roles[0]].bg, color: roleColors[e.roles[0]].text, fontSize: 10, fontWeight: 500 }}
          >
            {getInitials(e.firstName, e.lastName)}
          </div>
          <div>
            <div style={{ fontWeight: 500, color: "var(--foreground)" }}>{e.firstName} {e.lastName}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{e.studio.replace("Skult ", "")}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className="rounded-full px-2 py-0.5"
          style={{
            fontSize: 11,
            backgroundColor: e.contract === "CDI" ? "var(--info-bg)" : e.contract === "Flexi" ? "var(--warning-bg)" : "var(--muted)",
            color: e.contract === "CDI" ? "var(--info-text)" : e.contract === "Flexi" ? "var(--warning-text)" : "var(--muted-foreground)",
          }}
        >
          {e.contract}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          {e.roles.map((r) => (
            <span key={r} className="rounded-full px-1.5 py-0.5 flex items-center gap-1" style={{ fontSize: 10, backgroundColor: roleColors[r].bg, color: roleColors[r].text }}>
              <span className="rounded-full" style={{ width: 5, height: 5, backgroundColor: roleColors[r].dot }} />
              {r}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 500, color: scoreColor }}>{e.score}</span>
          <div style={{ width: 40, height: 3, borderRadius: 2, backgroundColor: "var(--muted)" }}>
            <div style={{ width: `${(e.score / 10) * 100}%`, height: "100%", borderRadius: 2, backgroundColor: scoreColor }} />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {e.quotaUsed !== null && e.quotaMax !== null ? (
          <div>
            <div style={{ fontSize: 12, color: quotaBarColor, fontWeight: 500 }}>{e.quotaUsed}/{e.quotaMax}h</div>
            <div style={{ width: 60, height: 3, borderRadius: 2, backgroundColor: "var(--muted)", marginTop: 3 }}>
              <div style={{ width: `${Math.min(quotaPct, 100)}%`, height: "100%", borderRadius: 2, backgroundColor: quotaBarColor }} />
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>
        )}
      </td>
      <td className="px-4 py-3" style={{ fontWeight: 500 }}>{e.shiftsCount}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 500, color: punctColor }}>{e.punctuality || "—"}</span>
          {e.punctuality && (
            <div style={{ width: 40, height: 3, borderRadius: 2, backgroundColor: "var(--muted)" }}>
              <div style={{ width: `${((e.punctuality || 0) / 10) * 100}%`, height: "100%", borderRadius: 2, backgroundColor: punctColor }} />
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Employee Slide-Over Panel ──────────────────────────────
function EmployeeSlideOver({ employee: emp, onClose }: { employee: Employee; onClose: () => void }) {
  const navigate = useNavigate();
  const goToDetail = (modal?: "roles" | "score" | "deactivate") => {
    onClose();
    navigate({ to: "/staff/$id", params: { id: emp.id }, search: modal ? { modal } : undefined });
  };
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(emp, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${emp.firstName}-${emp.lastName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const quotaStatus = getQuotaStatus(emp.quotaUsed, emp.quotaMax);
  const quotaPct = emp.quotaUsed !== null && emp.quotaMax !== null ? Math.round((emp.quotaUsed / emp.quotaMax) * 100) : 0;
  const quotaColor = quotaStatus === "danger" ? "var(--danger-text)" : quotaStatus === "warning" ? "var(--warning-text)" : "var(--success-text)";
  const scoreColor = (s: number) => s >= 9 ? "var(--success-text)" : s >= 8 ? "var(--foreground)" : s >= 7 ? "var(--warning-text)" : "var(--danger-text)";

  const criteria = [
    { label: "Ponctualité", value: emp.punctuality || 0 },
    { label: "Présentation", value: emp.presentation || 0 },
    { label: "Autonomie", value: emp.autonomy || 0 },
    { label: "Rapidité", value: emp.speed || 0 },
    { label: "Qualité service", value: emp.serviceQuality || 0 },
    { label: "Communication", value: emp.communication || 0 },
  ];

  const recentShifts = [
    { date: "Aujourd'hui", time: "07h — 12h", role: emp.roles[0], studio: emp.studio },
    { date: "Hier", time: "14h — 19h", role: emp.roles[0], studio: emp.studio },
    { date: "Lundi", time: "10h — 15h", role: emp.roles[emp.roles.length - 1], studio: emp.studio },
    { date: "Vendredi", time: "17h — 23h", role: emp.roles[0], studio: emp.studio },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: "rgba(0,0,0,0.25)" }} onClick={onClose}>
      <div
        className="h-full overflow-y-auto"
        style={{ width: 520, backgroundColor: "var(--card)", borderLeft: "0.5px solid var(--border)", animation: "slideIn 0.2s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ backgroundColor: "var(--card)", borderBottom: "0.5px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-full" style={{ width: 42, height: 42, backgroundColor: roleColors[emp.roles[0]].bg, color: roleColors[emp.roles[0]].text, fontSize: 14, fontWeight: 500 }}>
              {getInitials(emp.firstName, emp.lastName)}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{emp.firstName} {emp.lastName}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="rounded-full px-2 py-0.5" style={{
                  fontSize: 10,
                  backgroundColor: emp.contract === "CDI" ? "var(--info-bg)" : emp.contract === "Flexi" ? "var(--warning-bg)" : "var(--muted)",
                  color: emp.contract === "CDI" ? "var(--info-text)" : emp.contract === "Flexi" ? "var(--warning-text)" : "var(--muted-foreground)",
                }}>
                  {emp.contract}
                </span>
                {emp.roles.map((r) => (
                  <span key={r} className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, backgroundColor: roleColors[r].bg, color: roleColors[r].text }}>{r}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToDetail()}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 transition-opacity"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--card)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            >
              Voir toute la fiche <ArrowRight size={13} />
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 transition-colors" style={{ color: "var(--muted-foreground)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Contact info */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              <MapPin size={13} /> {emp.age} ans · {emp.city}
            </div>
            {emp.phone && <div className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}><Phone size={13} /> {emp.phone}</div>}
            {emp.email && <div className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}><Mail size={13} /> {emp.email}</div>}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--muted)" }}>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 2 }}>Score</div>
              <div className="flex items-baseline gap-0.5">
                <span style={{ fontSize: 20, fontWeight: 500, color: scoreColor(emp.score) }}>{emp.score}</span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>/10</span>
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--muted)" }}>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 2 }}>Shifts / mois</div>
              <span style={{ fontSize: 20, fontWeight: 500 }}>{emp.shiftsCount}</span>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--muted)" }}>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 2 }}>Ponctualité</div>
              <div className="flex items-baseline gap-0.5">
                <span style={{ fontSize: 20, fontWeight: 500, color: scoreColor(emp.punctuality || 0) }}>{emp.punctuality || "—"}</span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>/10</span>
              </div>
            </div>
          </div>

          {/* Contingent */}
          {emp.quotaUsed !== null && emp.quotaMax !== null && (
            <div className="rounded-lg p-4" style={{ backgroundColor: "var(--muted)" }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 12, fontWeight: 500 }}>Contingent 650h</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: quotaColor }}>{emp.quotaUsed}h / {emp.quotaMax}h ({quotaPct}%)</span>
              </div>
              <div style={{ width: "100%", height: 5, borderRadius: 3, backgroundColor: "var(--border)" }}>
                <div style={{ width: `${Math.min(quotaPct, 100)}%`, height: "100%", borderRadius: 3, backgroundColor: quotaColor }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>{emp.quotaMax - emp.quotaUsed}h restantes</div>
            </div>
          )}

          {/* Score par rôle */}
          {emp.roleScores && Object.keys(emp.roleScores).length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Score par rôle</div>
              <div className="flex gap-2">
                {Object.entries(emp.roleScores).map(([role, score]) => {
                  const rc = roleColors[role as Role];
                  return (
                    <div key={role} className="flex items-center gap-2 rounded-lg px-3 py-2.5 flex-1" style={{ backgroundColor: rc.bg }}>
                      <span className="rounded-full" style={{ width: 7, height: 7, backgroundColor: rc.dot }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: rc.text }}>{role}</span>
                      <span style={{ fontSize: 16, fontWeight: 500, color: rc.text, marginLeft: "auto" }}>{score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Critères détaillés */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Critères détaillés</div>
            <div className="grid grid-cols-2 gap-2">
              {criteria.map((c) => (
                <div key={c.label} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "var(--muted)" }}>
                  <span style={{ fontSize: 11 }}>{c.label}</span>
                  <div className="flex items-center gap-2">
                    <div style={{ width: 40, height: 3, borderRadius: 2, backgroundColor: "var(--border)" }}>
                      <div style={{ width: `${(c.value / 10) * 100}%`, height: "100%", borderRadius: 2, backgroundColor: scoreColor(c.value) }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: scoreColor(c.value), minWidth: 20, textAlign: "right" }}>{c.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conformité légale */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Conformité légale</div>
            <div className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: "var(--muted)" }}>
              <div className="flex justify-between"><span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>NISS</span><span style={{ fontSize: 11, fontWeight: 500, fontFamily: "monospace" }}>{emp.niss || "—"}</span></div>
              <div className="flex justify-between"><span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>IBAN</span><span style={{ fontSize: 11, fontWeight: 500, fontFamily: "monospace" }}>{emp.iban || "—"}</span></div>
              <div className="flex justify-between"><span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Nationalité</span><span style={{ fontSize: 11, fontWeight: 500 }}>{emp.nationality || "—"}</span></div>
              {emp.contract === "Étudiant" && (
                <div className="flex justify-between">
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Carte étudiant</span>
                  <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: emp.studentCardValid ? "var(--success-bg)" : "var(--warning-bg)", color: emp.studentCardValid ? "var(--success-text)" : "var(--warning-text)" }}>
                    {emp.studentCardValid ? "Valide" : "Non fournie"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Shifts récents */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Shifts récents</div>
            <div className="flex flex-col gap-1">
              {recentShifts.map((s, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--muted)" }}>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", minWidth: 65 }}>{s.date}</span>
                  <span style={{ fontSize: 11, fontWeight: 500 }}>{s.time}</span>
                  <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, backgroundColor: roleColors[s.role].bg, color: roleColors[s.role].text }}>{s.role}</span>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: "auto" }}>{s.studio.replace("Skult ", "")}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Actions</div>
            <div className="flex flex-col gap-1.5">
              {[
                { icon: <Edit size={13} />, label: "Modifier les rôles", onClick: () => goToDetail("roles") },
                { icon: <Star size={13} />, label: "Ajuster le score", onClick: () => goToDetail("score") },
                { icon: <FileText size={13} />, label: "Voir la formation", onClick: () => { onClose(); navigate({ to: "/formation" }); } },
                { icon: <Download size={13} />, label: "Exporter les données", onClick: handleExport },
              ].map((a) => (
                <button key={a.label} onClick={a.onClick} className="flex items-center gap-2 rounded-md px-3 py-2 text-left transition-colors w-full" style={{ fontSize: 12, border: "0.5px solid var(--border)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  {a.icon} {a.label}
                </button>
              ))}
              <button onClick={() => goToDetail("deactivate")} className="flex items-center gap-2 rounded-md px-3 py-2 text-left transition-colors w-full" style={{ fontSize: 12, border: "0.5px solid var(--border)", color: "var(--danger-text)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                <UserX size={13} /> Désactiver le compte
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
