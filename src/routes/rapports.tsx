import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { FiltersBar, presetToRange, type Preset } from "@/components/reports/FiltersBar";
import { KpiCard } from "@/components/reports/KpiCard";
import { Sparkline } from "@/components/reports/Sparkline";
import { EmployeeDetailSheet } from "@/components/reports/EmployeeDetailSheet";
import { ShiftDetailSheet } from "@/components/reports/ShiftDetailSheet";
import {
  getOverviewKpisFn, getTopAndBottomPerformersFn, getRecentActivityFn,
  getEmployeesReportFn, getShiftsReportFn,
} from "@/lib/reports.functions";
import { downloadCsv, toCsv } from "@/lib/csv";

const searchSchema = z.object({
  preset: z.enum(["today", "yesterday", "week", "month", "30d", "custom"]).default("30d"),
  from: z.string().optional(),
  to: z.string().optional(),
  studios: z.string().optional(),
  roles: z.string().optional(),
  view: z.enum(["overview", "employees", "shifts"]).default("overview"),
  userId: z.string().optional(),
});

export const Route = createFileRoute("/rapports")({
  validateSearch: (s) => searchSchema.parse(s),
  component: RapportsPage,
  head: () => ({ meta: [{ title: "Rapports — Kadence" }] }),
});

function RapportsPage() {
  const { appRole, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  useEffect(() => {
    if (!loading && appRole && appRole !== "admin" && appRole !== "manager") {
      navigate({ to: "/staff-app" });
    }
  }, [loading, appRole, navigate]);

  // Resolve dates from preset if not provided
  const resolved = useMemo(() => {
    if (search.from && search.to) return { from: search.from, to: search.to };
    const r = presetToRange(search.preset);
    return r;
  }, [search.preset, search.from, search.to]);

  const studioIds = search.studios ? search.studios.split(",").filter(Boolean) : [];
  const roleIds = search.roles ? search.roles.split(",").filter(Boolean) : [];

  const filters = { from: resolved.from, to: resolved.to, studioIds, roleIds };

  const updateFilters = (n: { preset: Preset; from: string; to: string; studioIds: string[]; roleIds: string[] }) => {
    navigate({
      to: "/rapports",
      search: {
        ...search,
        preset: n.preset, from: n.from, to: n.to,
        studios: n.studioIds.length ? n.studioIds.join(",") : undefined,
        roles: n.roleIds.length ? n.roleIds.join(",") : undefined,
      },
    });
  };

  const setView = (v: "overview" | "employees" | "shifts") => navigate({ to: "/rapports", search: { ...search, view: v } });

  // Queries
  const ovFn = useServerFn(getOverviewKpisFn);
  const tbFn = useServerFn(getTopAndBottomPerformersFn);
  const raFn = useServerFn(getRecentActivityFn);
  const empFn = useServerFn(getEmployeesReportFn);
  const shFn = useServerFn(getShiftsReportFn);

  const overview = useQuery({
    queryKey: ["rep-overview", filters], queryFn: () => ovFn({ data: filters }),
    staleTime: 5 * 60_000, refetchOnWindowFocus: false, enabled: search.view === "overview",
  });
  const performers = useQuery({
    queryKey: ["rep-performers", filters], queryFn: () => tbFn({ data: filters }),
    staleTime: 5 * 60_000, refetchOnWindowFocus: false, enabled: search.view === "overview",
  });
  const recent = useQuery({
    queryKey: ["rep-recent", filters], queryFn: () => raFn({ data: { ...filters, limit: 20 } }),
    staleTime: 5 * 60_000, refetchOnWindowFocus: false, enabled: search.view === "overview",
  });
  const employees = useQuery({
    queryKey: ["rep-employees", filters], queryFn: () => empFn({ data: filters }),
    staleTime: 5 * 60_000, refetchOnWindowFocus: false, enabled: search.view === "employees",
  });
  const shifts = useQuery({
    queryKey: ["rep-shifts", filters], queryFn: () => shFn({ data: filters }),
    staleTime: 5 * 60_000, refetchOnWindowFocus: false, enabled: search.view === "shifts",
  });

  const [openEmployee, setOpenEmployee] = useState<string | null>(null);
  const [openShift, setOpenShift] = useState<string | null>(null);

  const handleExport = () => {
    const fname = `kadence-rapport-${search.view}-${filters.from}-${filters.to}.csv`;
    if (search.view === "overview" && overview.data) {
      const rows = [
        { metric: "Shifts clôturés", value: overview.data.completedCount },
        { metric: "% complétion", value: `${overview.data.completionPct}%` },
        { metric: "Score moyen équipe", value: overview.data.scoreAvg },
        { metric: "Coût payroll (€)", value: overview.data.payrollTotal },
        { metric: "Heures cumulées", value: overview.data.totalHours },
        { metric: "Employés sans tarif", value: overview.data.employeesWithoutRate },
        { metric: "% checklist", value: `${overview.data.checklistPct}%` },
      ];
      downloadCsv(fname, toCsv(rows, [{ key: "metric", label: "Indicateur" }, { key: "value", label: "Valeur" }]));
    } else if (search.view === "employees" && employees.data) {
      downloadCsv(fname, toCsv(employees.data, [
        { key: "firstName", label: "Prénom" }, { key: "lastName", label: "Nom" },
        { key: "studioName", label: "Studio" }, { key: "shifts", label: "Shifts" },
        { key: "hours", label: "Heures" }, { key: "cost", label: "Coût €" },
        { key: "score", label: "Score" }, { key: "delta", label: "Δ shifts" },
        { key: "lastClosure", label: "Dernière clôture" },
      ]));
    } else if (search.view === "shifts" && shifts.data) {
      downloadCsv(fname, toCsv(shifts.data, [
        { key: "date", label: "Date" }, { key: "firstName", label: "Prénom" }, { key: "lastName", label: "Nom" },
        { key: "businessRole", label: "Rôle" }, { key: "studioName", label: "Studio" },
        { key: "startTime", label: "Début prévu" }, { key: "endTime", label: "Fin prévue" },
        { key: "clockedIn", label: "Entrée" }, { key: "clockedOut", label: "Sortie" },
        { key: "minutesLate", label: "Retard (min)" },
        { key: "checklistPct", label: "% Checklist" }, { key: "photosValidated", label: "Photos" },
        { key: "dimonaStatus", label: "Dimona" },
      ]));
    }
  };

  return (
    <main className="p-4 md:p-6 max-w-[1400px] w-full mx-auto">
      <h1 className="text-2xl font-medium mb-1">Rapports</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-4">Vue d'ensemble de l'activité de l'équipe sur la période sélectionnée.</p>

          <FiltersBar
            preset={search.preset} from={filters.from} to={filters.to}
            studioIds={studioIds} roleIds={roleIds}
            onChange={updateFilters} onExport={handleExport}
          />

          <Tabs value={search.view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="employees">Par employé</TabsTrigger>
              <TabsTrigger value="shifts">Par shift</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Shifts clôturés" value={overview.data?.completedCount ?? "—"} subtext={overview.data ? `${overview.data.completionPct}% du planning` : ""} />
                <KpiCard label="Score moyen équipe" value={overview.data?.scoreAvg ?? "—"} accent={overview.data?.scoreColor as any}>
                  {overview.data && <Sparkline data={overview.data.sparkline} />}
                </KpiCard>
                <KpiCard label="Coût payroll" value={overview.data ? `${overview.data.payrollTotal} €` : "—"}
                  subtext={overview.data ? `${overview.data.totalHours} h cumulées` : ""}
                  footer={overview.data && overview.data.employeesWithoutRate > 0 ? (
                    <div className="text-xs" style={{ color: "var(--warning-text)" }}>⚠ {overview.data.employeesWithoutRate} employés sans tarif horaire</div>
                  ) : null}
                />
                <KpiCard label="Taux complétion checklists" value={overview.data ? `${overview.data.checklistPct}%` : "—"}>
                  {overview.data && <Sparkline data={overview.data.sparkline} />}
                </KpiCard>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <div className="text-sm font-medium mb-3">Top performers</div>
                  <div className="space-y-2">
                    {(performers.data?.top ?? []).map((p) => (
                      <button key={p.userId} onClick={() => setOpenEmployee(p.userId)} className="w-full flex items-center gap-2 text-sm py-1.5 hover:bg-[var(--muted)] rounded px-2 text-left">
                        <div className="w-7 h-7 rounded-full bg-[var(--muted)] flex items-center justify-center text-xs">{p.firstName?.[0]}{p.lastName?.[0]}</div>
                        <span className="flex-1">{p.firstName} {p.lastName}</span>
                        <span className="font-medium">{p.score.toFixed(1)}</span>
                        <span className="text-xs" style={{ color: p.delta > 0 ? "var(--success-text)" : p.delta < 0 ? "var(--danger-text)" : "var(--muted-foreground)" }}>
                          {p.delta > 0 ? "↑" : p.delta < 0 ? "↓" : "="} {Math.abs(p.delta).toFixed(1)}
                        </span>
                      </button>
                    ))}
                    {!performers.data?.top.length && <div className="text-xs text-[var(--muted-foreground)]">Pas assez de données</div>}
                  </div>
                </div>
                <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <div className="text-sm font-medium mb-3">À surveiller</div>
                  <div className="space-y-2">
                    {(performers.data?.bottom ?? []).map((p) => (
                      <button key={p.userId} onClick={() => setOpenEmployee(p.userId)} className="w-full flex items-center gap-2 text-sm py-1.5 hover:bg-[var(--muted)] rounded px-2 text-left">
                        <div className="w-7 h-7 rounded-full bg-[var(--muted)] flex items-center justify-center text-xs">{p.firstName?.[0]}{p.lastName?.[0]}</div>
                        <div className="flex-1">
                          <div>{p.firstName} {p.lastName}</div>
                          {p.reason && <div className="text-xs text-[var(--muted-foreground)]">{p.reason}</div>}
                        </div>
                        <span className="font-medium">{p.score.toFixed(1)}</span>
                      </button>
                    ))}
                    {!performers.data?.bottom.length && <div className="text-xs text-[var(--muted-foreground)]">Aucun</div>}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <div className="text-sm font-medium mb-3">Activité récente</div>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {(recent.data ?? []).map((r) => (
                    <button key={r.shiftId} onClick={() => setOpenShift(r.shiftId)} className="w-full flex items-center gap-2 text-sm py-2 hover:bg-[var(--muted)] rounded px-2 text-left">
                      <div className="w-7 h-7 rounded-full bg-[var(--muted)] flex items-center justify-center text-xs">{r.firstName?.[0]}{r.lastName?.[0]}</div>
                      <span className="flex-1">{r.firstName} {r.lastName}</span>
                      <span className="text-xs text-[var(--muted-foreground)]">{r.businessRole} · {r.studioName}</span>
                      <span className="text-xs text-[var(--muted-foreground)]">{r.shiftDate}</span>
                    </button>
                  ))}
                  {!recent.data?.length && <div className="text-xs text-[var(--muted-foreground)] py-2">Aucune activité</div>}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="employees" className="mt-4">
              <div className="rounded-lg border overflow-x-auto" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <table className="w-full text-sm">
                  <thead className="text-xs text-[var(--muted-foreground)]">
                    <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                      <th className="text-left p-2">Employé</th>
                      <th className="text-left p-2 hidden md:table-cell">Studio</th>
                      <th className="text-right p-2">Shifts</th>
                      <th className="text-right p-2">Heures</th>
                      <th className="text-right p-2 hidden md:table-cell">Coût €</th>
                      <th className="text-right p-2">Score</th>
                      <th className="text-right p-2 hidden md:table-cell">Dernière clôture</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(employees.data ?? []).map((e) => (
                      <tr key={e.userId} className="border-b last:border-0 hover:bg-[var(--muted)] cursor-pointer" style={{ borderColor: "var(--border)" }} onClick={() => setOpenEmployee(e.userId)}>
                        <td className="p-2">{e.firstName} {e.lastName}</td>
                        <td className="p-2 hidden md:table-cell text-[var(--muted-foreground)]">{e.studioName}</td>
                        <td className="p-2 text-right">{e.shifts}</td>
                        <td className="p-2 text-right">{e.hours}</td>
                        <td className="p-2 text-right hidden md:table-cell">{e.cost != null ? `${e.cost} €` : "—"}</td>
                        <td className="p-2 text-right font-medium">{e.score.toFixed(1)}</td>
                        <td className="p-2 text-right hidden md:table-cell text-[var(--muted-foreground)] text-xs">{e.lastClosure?.slice(0, 16).replace("T", " ") ?? "—"}</td>
                        <td className="p-2 text-right"><button className="text-xs text-[var(--coral)]">Détail</button></td>
                      </tr>
                    ))}
                    {employees.isLoading && <tr><td colSpan={8} className="p-4 text-center text-xs text-[var(--muted-foreground)]">Chargement…</td></tr>}
                    {employees.data?.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-xs text-[var(--muted-foreground)]">Aucun employé</td></tr>}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="shifts" className="mt-4">
              <div className="rounded-lg border overflow-x-auto" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <table className="w-full text-sm">
                  <thead className="text-xs text-[var(--muted-foreground)]">
                    <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Employé</th>
                      <th className="text-left p-2 hidden md:table-cell">Rôle</th>
                      <th className="text-left p-2 hidden md:table-cell">Studio</th>
                      <th className="text-left p-2 hidden lg:table-cell">Prévu</th>
                      <th className="text-left p-2 hidden lg:table-cell">Réel</th>
                      <th className="text-right p-2">Retard</th>
                      <th className="text-right p-2 hidden md:table-cell">Checklist</th>
                      <th className="text-right p-2 hidden md:table-cell">Photos</th>
                      <th className="text-right p-2 hidden lg:table-cell">Dimona</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(shifts.data ?? []).map((s) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-[var(--muted)] cursor-pointer" style={{ borderColor: "var(--border)" }} onClick={() => setOpenShift(s.id)}>
                        <td className="p-2">{s.date}</td>
                        <td className="p-2">{s.firstName} {s.lastName}</td>
                        <td className="p-2 hidden md:table-cell text-[var(--muted-foreground)]">{s.businessRole}</td>
                        <td className="p-2 hidden md:table-cell text-[var(--muted-foreground)]">{s.studioName}</td>
                        <td className="p-2 hidden lg:table-cell text-xs">{s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}</td>
                        <td className="p-2 hidden lg:table-cell text-xs">
                          {s.clockedIn ? new Date(s.clockedIn).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          –
                          {s.clockedOut ? new Date(s.clockedOut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td className="p-2 text-right" style={{ color: s.minutesLate > 5 ? "var(--danger-text)" : undefined }}>
                          {s.minutesLate > 0 ? `+${s.minutesLate}'` : "—"}
                        </td>
                        <td className="p-2 text-right hidden md:table-cell">{s.checklistPct != null ? `${s.checklistPct}%` : "—"}</td>
                        <td className="p-2 text-right hidden md:table-cell">{s.photosValidated ?? "—"}</td>
                        <td className="p-2 text-right hidden lg:table-cell text-xs">{s.dimonaStatus ?? "—"}</td>
                      </tr>
                    ))}
                    {shifts.isLoading && <tr><td colSpan={10} className="p-4 text-center text-xs text-[var(--muted-foreground)]">Chargement…</td></tr>}
                    {shifts.data?.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-xs text-[var(--muted-foreground)]">Aucun shift</td></tr>}
                  </tbody>
                </table>
              </div>
            </TabsContent>
      </Tabs>

      <EmployeeDetailSheet userId={openEmployee} from={filters.from} to={filters.to} onClose={() => setOpenEmployee(null)} />
      <ShiftDetailSheet shiftId={openShift} onClose={() => setOpenShift(null)} />
    </main>
  );
}
