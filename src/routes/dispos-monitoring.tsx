import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Send } from "lucide-react";
import {
  getMonthlyDispoMonitoring,
  remindLateEmployees,
} from "@/lib/availabilities.functions";
import { useStudios } from "@/hooks/use-studios";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/dispos-monitoring")({
  component: DisposMonitoringPage,
});

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

function nextMonth(): { year: number; month: number } {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DisposMonitoringPage() {
  const init = nextMonth();
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);
  const [contractFilter, setContractFilter] = useState<string>("all");
  const [studioFilter, setStudioFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const { studios } = useStudios();
  const navigate = useNavigate();
  const fetchMonitoring = useServerFn(getMonthlyDispoMonitoring);
  const sendReminders = useServerFn(remindLateEmployees);

  const { data, isLoading } = useQuery({
    queryKey: ["dispo-monitoring", year, month],
    queryFn: () => fetchMonitoring({ data: { year, month } }),
    refetchInterval: 30_000,
  });

  const rows = data?.rows ?? [];
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (contractFilter !== "all" && (r.contract ?? "") !== contractFilter) return false;
      if (studioFilter.length > 0 && !r.studioIds.some((s) => studioFilter.includes(s))) return false;
      return true;
    });
  }, [rows, contractFilter, studioFilter]);

  const total = data?.total ?? 0;
  const complete = data?.complete ?? 0;
  const partial = data?.partial ?? 0;
  const empty = data?.empty ?? 0;
  const completion = total > 0 ? Math.round((complete / total) * 100) : 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAllEmpty = () => {
    setSelected(new Set(filteredRows.filter((r) => r.status !== "complete").map((r) => r.userId)));
  };

  const clearSelection = () => setSelected(new Set());

  const handleRemind = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      const res = await sendReminders({
        data: { year, month, userIds: Array.from(selected) },
      });
      toast.success(`Rappel envoyé à ${res.sent} employé${res.sent > 1 ? "s" : ""}`);
      clearSelection();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const years = [year - 1, year, year + 1];
  const studioName = (id: string) => studios.find((s) => s.id === id)?.short_name ?? studios.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ color: "var(--foreground)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <CalendarCheck size={20} style={{ color: "var(--coral)" }} />
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>Monitoring des disponibilités</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 24 }}>
        Suivi des employés qui ont rempli leurs dispos pour le mois sélectionné.
      </p>

      {/* Month selector */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS_FR.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Total employés" value={total} color="var(--foreground)" />
        <Kpi label="Ont rempli" value={complete} color="var(--success-text, #2f7a4d)" />
        <Kpi label="Partiel" value={partial} color="#c97a2b" />
        <Kpi label="Vide" value={empty} color="var(--danger-text, #b3261e)" />
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between mb-1.5" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          <span>Complétion</span>
          <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{completion}%</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: "var(--muted)" }}>
          <div
            style={{
              width: `${completion}%`,
              height: "100%",
              backgroundColor: "var(--coral)",
              transition: "width 250ms ease",
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous contrats</SelectItem>
            <SelectItem value="cdi">CDI</SelectItem>
            <SelectItem value="etudiant">Étudiant</SelectItem>
            <SelectItem value="flexi">Flexi</SelectItem>
            <SelectItem value="extra">Extra</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1.5 flex-wrap">
          {studios.map((s) => {
            const active = studioFilter.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() =>
                  setStudioFilter((prev) =>
                    prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                  )
                }
                className="rounded-full border px-3 py-1"
                style={{
                  fontSize: 12,
                  borderColor: active ? "var(--coral)" : "var(--border)",
                  backgroundColor: active ? "var(--coral)" : "transparent",
                  color: active ? "#fff" : "var(--foreground)",
                }}
              >
                {s.short_name ?? s.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <button
          onClick={selectAllEmpty}
          className="rounded-md border px-3 py-1.5"
          style={{ fontSize: 12, borderColor: "var(--border)" }}
        >
          Tout sélectionner les non-remplis
        </button>
        {selected.size > 0 && (
          <button
            onClick={clearSelection}
            className="rounded-md px-3 py-1.5"
            style={{ fontSize: 12, color: "var(--muted-foreground)" }}
          >
            Désélectionner ({selected.size})
          </button>
        )}
        <div className="ml-auto" />
        <button
          onClick={handleRemind}
          disabled={selected.size === 0 || sending}
          className="rounded-md px-4 py-2 flex items-center gap-2"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            backgroundColor: selected.size === 0 || sending ? "var(--muted)" : "var(--coral)",
            opacity: selected.size === 0 || sending ? 0.6 : 1,
          }}
        >
          <Send size={14} />
          {sending ? "Envoi…" : `Relancer (${selected.size})`}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead style={{ backgroundColor: "var(--muted)" }}>
            <tr>
              <th className="text-left px-3 py-2" style={{ width: 36 }}></th>
              <th className="text-left px-3 py-2" style={{ fontWeight: 500 }}>Nom</th>
              <th className="text-left px-3 py-2" style={{ fontWeight: 500 }}>Contrat</th>
              <th className="text-left px-3 py-2" style={{ fontWeight: 500 }}>Studios</th>
              <th className="text-left px-3 py-2" style={{ fontWeight: 500 }}>Status</th>
              <th className="text-left px-3 py-2" style={{ fontWeight: 500 }}>Dispos</th>
              <th className="text-left px-3 py-2" style={{ fontWeight: 500 }}>Dernière saisie</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center" style={{ color: "var(--muted-foreground)" }}>Chargement…</td></tr>
            )}
            {!isLoading && filteredRows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center" style={{ color: "var(--muted-foreground)" }}>Aucun employé</td></tr>
            )}
            {filteredRows.map((r) => (
              <tr
                key={r.userId}
                style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                className="hover:bg-[var(--muted)]/40 transition-colors"
                onClick={() =>
                  navigate({ to: "/dispo-detail/$userId", params: { userId: r.userId }, search: { year, month } })
                }
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(r.userId)}
                    onChange={() => toggle(r.userId)}
                  />
                </td>
                <td className="px-3 py-2" style={{ fontWeight: 500 }}>{r.firstName} {r.lastName}</td>
                <td className="px-3 py-2" style={{ color: "var(--muted-foreground)" }}>
                  {r.contract ?? "—"}
                </td>
                <td className="px-3 py-2" style={{ color: "var(--muted-foreground)" }}>
                  {r.studioIds.length === 0 ? "—" : r.studioIds.map(studioName).join(", ")}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} count={r.availsCount} />
                </td>
                <td className="px-3 py-2">{r.availsCount}</td>
                <td className="px-3 py-2" style={{ color: "var(--muted-foreground)" }}>
                  {formatDateTime(r.lastSubmittedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
    >
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 500, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status, count }: { status: "complete" | "partial" | "empty"; count: number }) {
  if (status === "empty") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--danger-bg, #fbe9e7)", color: "var(--danger-text, #b3261e)" }}>
        Aucune dispo
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "#fcebd6", color: "#c97a2b" }}>
        {count} dispo{count > 1 ? "s" : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "#dff0e2", color: "#2f7a4d" }}>
      {count} dispos ✓
    </span>
  );
}
