import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Send, UserPlus, Sparkles, ChevronDown, ChevronUp, Check, Search, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { holeShifts, employees, roleColors, type HoleShift, type Role, type Studio } from "@/lib/mock-data";

export const Route = createFileRoute("/trous")({
  component: TrousPage,
  head: () => ({ meta: [{ title: "Trous à combler — Shyft" }] }),
});

const allRoles: Role[] = ["Barista", "Accueil", "Host", "Cuisine"];
const allStudios: Studio[] = ["Skult Rhodes", "Skult Châtelain"];
function TrousPage() {
  const [studioFilter, setStudioFilter] = useState<Studio | "tous">("tous");
  const [roleFilter, setRoleFilter] = useState<Role | "tous">("tous");
  const [expandedHole, setExpandedHole] = useState<string | null>(holeShifts[0]?.id || null);

  const filtered = useMemo(() => {
    return holeShifts.filter((h) => {
      if (studioFilter !== "tous" && h.studio !== studioFilter) return false;
      if (roleFilter !== "tous" && h.role !== roleFilter) return false;
      return true;
    });
  }, [studioFilter, roleFilter]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} style={{ color: "var(--danger-text)" }} />
            <h1 style={{ fontSize: 18, fontWeight: 500 }}>
              {filtered.length} trou{filtered.length > 1 ? "s" : ""} à combler
              {filtered.length !== holeShifts.length && (
                <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 400 }}> sur {holeShifts.length}</span>
              )}
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Sélectionnez un trou et assignez directement un employé.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-4">
        <FilterRow
          label="Centre"
          options={[{ value: "tous", label: "Tous" }, ...allStudios.map((s) => ({ value: s, label: s.replace("Skult ", "") }))]}
          value={studioFilter}
          onChange={(v) => setStudioFilter(v as Studio | "tous")}
        />
        <FilterRow
          label="Rôle"
          options={[{ value: "tous", label: "Tous" }, ...allRoles.map((r) => ({ value: r, label: r }))]}
          value={roleFilter}
          onChange={(v) => setRoleFilter(v as Role | "tous")}
          dotColor={(v) => (v !== "tous" ? roleColors[v as Role].dot : undefined)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border px-6 py-10 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Aucun trou avec ces filtres</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Essayez d'élargir les critères.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((hole) => (
            <HoleCard
              key={hole.id}
              hole={hole}
              expanded={expandedHole === hole.id}
              onToggle={() => setExpandedHole(expandedHole === hole.id ? null : hole.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
  dotColor,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  dotColor?: (v: string) => string | undefined;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500, width: 60 }}>{label}</span>
      {options.map((opt) => {
        const active = value === opt.value;
        const dot = dotColor?.(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="rounded-full px-2.5 py-1 flex items-center gap-1.5 transition-colors"
            style={{
              fontSize: 11,
              fontWeight: active ? 500 : 400,
              backgroundColor: active ? "var(--foreground)" : "transparent",
              color: active ? "var(--card)" : "var(--muted-foreground)",
              border: active ? "none" : "0.5px solid var(--border)",
            }}
          >
            {dot && <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: dot }} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function HoleCard({ hole, expanded, onToggle }: { hole: HoleShift; expanded: boolean; onToggle: () => void }) {
  const roleColor = roleColors[hole.role];

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all"
      style={{ backgroundColor: "var(--card)", borderColor: expanded ? "var(--coral)" : "var(--border)", borderWidth: expanded ? 1.5 : 1 }}
    >
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 text-left">
        <span className="rounded-full shrink-0" style={{ width: 10, height: 10, backgroundColor: roleColor.dot }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 14, fontWeight: 500 }}>{hole.role}</span>
            <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>·</span>
            <span style={{ fontSize: 13 }}>{hole.dateLabel}</span>
            <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>·</span>
            <span style={{ fontSize: 13 }}>{hole.time}</span>
            <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>·</span>
            <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{hole.studio}</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown size={16} style={{ color: "var(--muted-foreground)" }} />}
      </button>

      {expanded && <HoleAssign hole={hole} />}
    </div>
  );
}

function HoleAssign({ hole }: { hole: HoleShift }) {
  const [query, setQuery] = useState("");
  const [actionState, setActionState] = useState<Record<string, string>>({});
  const recommendedIds = useMemo(() => new Set(hole.eligible.filter((e) => e.aiRecommended).map((e) => e.employeeId)), [hole]);
  const eligibleMap = useMemo(() => Object.fromEntries(hole.eligible.map((e) => [e.employeeId, e])), [hole]);

  const recommended = hole.eligible.filter((e) => e.aiRecommended);

  const filteredEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter((e) => !recommendedIds.has(e.id))
      .filter((e) => {
        if (!q) return true;
        const full = `${e.firstName} ${e.lastName}`.toLowerCase();
        return full.includes(q) || e.roles.some((r) => r.toLowerCase().includes(q));
      })
      .sort((a, b) => b.score - a.score);
  }, [query, recommendedIds]);

  const setStatus = (id: string, label: string, name: string) => {
    setActionState((s) => ({ ...s, [id]: label }));
    toast.success(`${name} ${label.toLowerCase()} pour ce shift`);
  };

  return (
    <div className="px-5 pb-5" style={{ borderTop: "0.5px solid var(--border)" }}>
      {/* Recommandations */}
      {recommended.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={12} style={{ color: "var(--coral)" }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Recommandés par l'IA
            </span>
          </div>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {recommended.map((emp, i) => {
              const full = employees.find((e) => e.id === emp.employeeId);
              return (
                <EmployeeRow
                  key={emp.employeeId}
                  id={emp.employeeId}
                  name={emp.name}
                  roles={full?.roles ?? []}
                  score={emp.score}
                  hoursLeft={emp.hoursLeft}
                  contract={full?.contract}
                  studio={full?.studio}
                  available={emp.available}
                  recommended
                  isLast={i === recommended.length - 1}
                  status={actionState[emp.employeeId]}
                  onPropose={() => setStatus(emp.employeeId, "Proposé", emp.name)}
                  onAssign={() => setStatus(emp.employeeId, "Assigné", emp.name)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Tous les employés */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Tous les employés ({filteredEmployees.length})
          </span>
          <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}>
            <Search size={13} style={{ color: "var(--muted-foreground)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un employé ou un rôle…"
              style={{ fontSize: 12, background: "transparent", outline: "none", border: "none", width: 240 }}
            />
          </div>
        </div>
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          {filteredEmployees.length === 0 ? (
            <div className="px-4 py-6 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Aucun employé trouvé.
            </div>
          ) : (
            filteredEmployees.map((e, i) => {
              const eligible = eligibleMap[e.id];
              return (
                <EmployeeRow
                  key={e.id}
                  id={e.id}
                  name={`${e.firstName} ${e.lastName}`}
                  roles={e.roles}
                  primaryRole={hole.role}
                  score={e.score}
                  hoursLeft={eligible?.hoursLeft}
                  contract={e.contract}
                  studio={e.studio}
                  available={eligible ? eligible.available : true}
                  isLast={i === filteredEmployees.length - 1}
                  status={actionState[e.id]}
                  onPropose={() => setStatus(e.id, "Proposé", `${e.firstName} ${e.lastName}`)}
                  onAssign={() => setStatus(e.id, "Assigné", `${e.firstName} ${e.lastName}`)}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function EmployeeRow({
  id,
  name,
  roles,
  primaryRole,
  score,
  hoursLeft,
  contract,
  studio,
  available,
  recommended,
  isLast,
  status,
  onPropose,
  onAssign,
}: {
  id: string;
  name: string;
  roles: Role[];
  primaryRole?: Role;
  score: number;
  hoursLeft?: number;
  contract?: string;
  studio?: string;
  available: boolean;
  recommended?: boolean;
  isLast: boolean;
  status?: string;
  onPropose: () => void;
  onAssign: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: isLast ? "none" : "0.5px solid var(--border)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/staff/$id"
            params={{ id }}
            className="hover:underline flex items-center gap-1"
            style={{ fontSize: 13, fontWeight: 500 }}
          >
            {name}
            <ExternalLink size={11} style={{ color: "var(--muted-foreground)" }} />
          </Link>
          {roles.map((r) => {
            const c = roleColors[r];
            const match = primaryRole && r === primaryRole;
            return (
              <span
                key={r}
                className="rounded-full px-1.5 py-0.5"
                style={{
                  fontSize: 9,
                  fontWeight: 500,
                  backgroundColor: c.bg,
                  color: c.text,
                  outline: match ? `1px solid ${c.dot}` : "none",
                }}
              >
                {r}
              </span>
            );
          })}
          {recommended && (
            <span className="rounded-full px-1.5 py-0.5 flex items-center gap-1" style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)" }}>
              <Sparkles size={8} /> IA
            </span>
          )}
          {!available && (
            <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
              Non dispo
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
          Score {score.toFixed(1)}/10
          {contract ? ` · ${contract}` : ""}
          {hoursLeft != null ? ` · ${hoursLeft}h restantes` : ""}
          {studio ? ` · ${studio}` : ""}
        </div>
      </div>
      {status ? (
        <span className="rounded-full px-2.5 py-1 flex items-center gap-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
          <Check size={12} /> {status}
        </span>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onPropose}
            className="rounded-md px-2.5 py-1.5 flex items-center gap-1 transition-colors"
            style={{ fontSize: 11, fontWeight: 500, backgroundColor: "transparent", color: "var(--foreground)", border: "0.5px solid var(--border)" }}
          >
            <Send size={11} />
            Proposer
          </button>
          <button
            onClick={onAssign}
            className="rounded-md px-2.5 py-1.5 flex items-center gap-1 transition-colors"
            style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
          >
            <UserPlus size={11} />
            Assigner
          </button>
        </div>
      )}
    </div>
  );
}
