import { createFileRoute, Link } from "@tanstack/react-router";
import { employees, roleColors, getQuotaStatus, getInitials, type Employee } from "@/lib/mock-data";
import { Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/staff")({
  component: StaffPage,
  head: () => ({
    meta: [{ title: "Staff — Shifty" }],
  }),
});

type Filter = "tous" | "étudiants" | "flexis" | "cdi" | "rhodes" | "châtelain";

function StaffPage() {
  const [filter, setFilter] = useState<Filter>("tous");
  const [search, setSearch] = useState("");

  const filtered = employees.filter((e) => {
    if (search) {
      const q = search.toLowerCase();
      if (!`${e.firstName} ${e.lastName}`.toLowerCase().includes(q)) return false;
    }
    switch (filter) {
      case "étudiants": return e.contract === "Étudiant";
      case "flexis": return e.contract === "Flexi";
      case "cdi": return e.contract === "CDI";
      case "rhodes": return e.studio === "Skult Rhodes";
      case "châtelain": return e.studio === "Skult Châtelain";
      default: return true;
    }
  });

  const studentCount = employees.filter((e) => e.contract === "Étudiant").length;
  const flexiCount = employees.filter((e) => e.contract === "Flexi").length;
  const cdiCount = employees.filter((e) => e.contract === "CDI").length;
  const rhodesCount = employees.filter((e) => e.studio === "Skult Rhodes").length;
  const chatelainCount = employees.filter((e) => e.studio === "Skult Châtelain").length;
  const avgScore = (employees.reduce((s, e) => s + e.score, 0) / employees.length).toFixed(1);
  const quotaAtRisk = employees.filter((e) => getQuotaStatus(e.quotaUsed, e.quotaMax) === "danger").length;

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "tous", label: "Tous", count: employees.length },
    { key: "étudiants", label: "Étudiants", count: studentCount },
    { key: "flexis", label: "Flexis", count: flexiCount },
    { key: "cdi", label: "CDI", count: cdiCount },
    { key: "rhodes", label: "Rhodes", count: rhodesCount },
    { key: "châtelain", label: "Châtelain", count: chatelainCount },
  ];

  return (
    <div className="p-6" style={{ maxWidth: 1200 }}>
      {/* KPI mini cards */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <MiniKpi label="Actifs" value={employees.length.toString()} />
        <MiniKpi label="Étudiants" value={`${studentCount}`} sub={`${Math.round((studentCount / employees.length) * 100)}%`} />
        <MiniKpi label="Score moyen" value={avgScore} sub="/10" />
        <MiniKpi label="Quota à risque" value={quotaAtRisk.toString()} color={quotaAtRisk > 0 ? "var(--danger-text)" : undefined} />
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex items-center gap-2 rounded-md border px-3"
          style={{ height: 32, borderColor: "var(--border)", backgroundColor: "var(--card)", width: 220 }}
        >
          <Search size={14} style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 bg-transparent outline-none flex-1"
            style={{ fontSize: 12, color: "var(--foreground)" }}
          />
        </div>
        <div className="flex items-center gap-1">
          {filters.map((f, i) => (
            <span key={f.key} className="flex items-center">
              {i === 4 && (
                <span
                  className="mx-2"
                  style={{ width: 1, height: 16, backgroundColor: "var(--border)", display: "inline-block" }}
                />
              )}
              <button
                onClick={() => setFilter(f.key)}
                className="rounded-full px-2.5 py-1 transition-colors"
                style={{
                  fontSize: 12,
                  fontWeight: filter === f.key ? 500 : 400,
                  backgroundColor: filter === f.key ? "var(--foreground)" : "transparent",
                  color: filter === f.key ? "var(--card)" : "var(--muted-foreground)",
                }}
              >
                {f.label} · {f.count}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              {["Nom", "Contrat", "Postes", "Score", "Contingent", "Shifts", "Dernier"].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2.5"
                  style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => (
              <EmployeeRow key={emp.id} employee={emp} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniKpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 22, fontWeight: 500, color: color || "var(--foreground)" }}>{value}</span>
        {sub && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{sub}</span>}
      </div>
    </div>
  );
}

function EmployeeRow({ employee: e }: { employee: Employee }) {
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

  return (
    <tr
      className="transition-colors"
      style={{ borderBottom: "0.5px solid var(--border)", cursor: "pointer" }}
      onClick={() => window.location.href = `/staff/${e.id}`}
      onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
      onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{
              width: 30, height: 30,
              backgroundColor: roleColors[e.roles[0]].bg,
              color: roleColors[e.roles[0]].text,
              fontSize: 10, fontWeight: 500,
            }}
          >
            {getInitials(e.firstName, e.lastName)}
          </div>
          <div>
            <div style={{ fontWeight: 500, color: "var(--foreground)" }}>
              {e.firstName} {e.lastName}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {e.age} ans · {e.city}
            </div>
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
            <span
              key={r}
              className="rounded-full px-1.5 py-0.5 flex items-center gap-1"
              style={{ fontSize: 10, backgroundColor: roleColors[r].bg, color: roleColors[r].text }}
            >
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
            <div style={{ fontSize: 12, color: quotaBarColor, fontWeight: 500 }}>
              {e.quotaUsed}/{e.quotaMax}h
            </div>
            <div style={{ width: 60, height: 3, borderRadius: 2, backgroundColor: "var(--muted)", marginTop: 3 }}>
              <div style={{ width: `${Math.min(quotaPct, 100)}%`, height: "100%", borderRadius: 2, backgroundColor: quotaBarColor }} />
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>
        )}
      </td>
      <td className="px-4 py-3" style={{ fontWeight: 500 }}>{e.shiftsCount}</td>
      <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{e.lastShift}</td>
    </tr>
  );
}
