import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTrainingFolders, useAllTrainingProgress } from "@/hooks/use-training";
import { useStudios } from "@/hooks/use-studios";
import { useBusinessRoles } from "@/hooks/use-business-roles";
import type { TrainingResource } from "@/types/training";

interface EmployeeRow {
  id: string;
  first_name: string;
  last_name: string;
  studio_id: string | null;
  contract: string | null;
  business_roles: string[];
}

const CONTRACTS = ["CDI", "Étudiant", "Flexi"];

export function ProgressDashboard() {
  const { folders } = useTrainingFolders();
  const { progress } = useAllTrainingProgress();
  const { studios } = useStudios();
  const { names: allRoles } = useBusinessRoles({ onlyActive: true });

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [resourcesByFolder, setResourcesByFolder] = useState<Record<string, TrainingResource[]>>({});
  const [filterStudios, setFilterStudios] = useState<string[]>([]);
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterContracts, setFilterContracts] = useState<string[]>([]);

  // Charge les employés actifs + leurs rôles métier
  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: ubr }] = await Promise.all([
        supabase.from("profiles").select("id,first_name,last_name,studio_id,contract").eq("status", "active"),
        supabase.from("user_business_roles").select("user_id,role"),
      ]);
      const rolesByUser: Record<string, string[]> = {};
      ((ubr as any[]) ?? []).forEach((r) => {
        rolesByUser[r.user_id] = [...(rolesByUser[r.user_id] || []), r.role];
      });
      setEmployees(((profiles as any[]) ?? []).map((p) => ({
        ...p, business_roles: rolesByUser[p.id] || [],
      })));
    })();
  }, []);

  // Charge les ressources de chaque dossier (pour calculer le total)
  useEffect(() => {
    if (folders.length === 0) return;
    (async () => {
      const folderIds = folders.map((f) => f.id);
      const { data: steps } = await supabase
        .from("training_steps" as any).select("id,folder_id").in("folder_id", folderIds);
      const stepIds = ((steps as any[]) ?? []).map((s) => s.id);
      if (stepIds.length === 0) { setResourcesByFolder({}); return; }
      const { data: resources } = await supabase
        .from("training_resources" as any).select("id,step_id").in("step_id", stepIds);
      const stepToFolder: Record<string, string> = {};
      ((steps as any[]) ?? []).forEach((s) => { stepToFolder[s.id] = s.folder_id; });
      const map: Record<string, TrainingResource[]> = {};
      ((resources as any[]) ?? []).forEach((r) => {
        const fid = stepToFolder[r.step_id];
        if (!fid) return;
        (map[fid] ||= []).push(r);
      });
      setResourcesByFolder(map);
    })();
  }, [folders]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (filterStudios.length && !filterStudios.includes(e.studio_id || "")) return false;
      if (filterContracts.length && !filterContracts.includes(e.contract || "")) return false;
      if (filterRoles.length && !e.business_roles.some((r) => filterRoles.includes(r))) return false;
      return true;
    });
  }, [employees, filterStudios, filterContracts, filterRoles]);

  const completionPct = (userId: string, folderId: string): number => {
    const resources = resourcesByFolder[folderId] || [];
    if (resources.length === 0) return 0;
    const userProgress = progress.filter((p) => p.user_id === userId && p.status === "completed");
    const completedResIds = new Set(userProgress.map((p) => p.resource_id));
    const done = resources.filter((r) => completedResIds.has(r.id)).length;
    return Math.round((done / resources.length) * 100);
  };

  const cellColor = (pct: number) => {
    if (pct === 0) return { bg: "var(--muted)", text: "var(--muted-foreground)" };
    if (pct >= 100) return { bg: "#dcfce7", text: "#166534" };
    return { bg: "#fed7aa", text: "#9a3412" };
  };

  const stats = useMemo(() => {
    const totalEmps = filteredEmployees.length;
    const activeFolders = folders.length;
    if (totalEmps === 0 || activeFolders === 0) return { totalEmps, activeFolders, avgPct: 0, upToDate: 0 };
    let sum = 0; let upToDate = 0;
    for (const e of filteredEmployees) {
      let empSum = 0; let empComplete = 0;
      for (const f of folders) {
        const p = completionPct(e.id, f.id);
        empSum += p;
        if (p >= 100) empComplete++;
      }
      sum += empSum / activeFolders;
      // "À jour" = a complété tous les dossiers qui sont obligatoires pour ses rôles
      const requiredFolders = folders.filter((f) =>
        f.required_for_roles.length > 0 && e.business_roles.some((r) => f.required_for_roles.includes(r))
      );
      const requiredDone = requiredFolders.every((f) => completionPct(e.id, f.id) >= 100);
      if (requiredDone) upToDate++;
    }
    return { totalEmps, activeFolders, avgPct: Math.round(sum / totalEmps), upToDate };
  }, [filteredEmployees, folders, progress, resourcesByFolder]);

  const exportCSV = () => {
    const header = ["Employé", "Studio", "Contrat", ...folders.map((f) => f.name)];
    const studioName = (id: string | null) => studios.find((s) => s.id === id)?.short_name || studios.find((s) => s.id === id)?.name || "—";
    const rows = filteredEmployees.map((e) => [
      `${e.first_name} ${e.last_name}`,
      studioName(e.studio_id),
      e.contract || "",
      ...folders.map((f) => `${completionPct(e.id, f.id)}%`),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `formation-progression-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  return (
    <div className="flex flex-col gap-5">
      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Employés concernés" value={stats.totalEmps} />
        <Kpi label="Dossiers actifs" value={stats.activeFolders} />
        <Kpi label="Complétion moyenne" value={`${stats.avgPct}%`} />
        <Kpi label="Employés à jour" value={stats.upToDate} />
      </div>

      {/* Filtres */}
      <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex flex-col gap-3">
          <FilterRow label="Studios">
            {studios.map((s) => (
              <Chip key={s.id} active={filterStudios.includes(s.id)} onClick={() => toggle(filterStudios, setFilterStudios, s.id)}>
                {s.short_name || s.name}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Rôles métier">
            {allRoles.map((r) => (
              <Chip key={r} active={filterRoles.includes(r)} onClick={() => toggle(filterRoles, setFilterRoles, r)}>{r}</Chip>
            ))}
          </FilterRow>
          <FilterRow label="Contrats">
            {CONTRACTS.map((c) => (
              <Chip key={c} active={filterContracts.includes(c)} onClick={() => toggle(filterContracts, setFilterContracts, c)}>{c}</Chip>
            ))}
          </FilterRow>
        </div>
      </div>

      {/* Tableau */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between p-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            Progression ({filteredEmployees.length} employé{filteredEmployees.length > 1 ? "s" : ""})
          </div>
          <button onClick={exportCSV} className="rounded-md px-2.5 py-1.5 flex items-center gap-1.5"
            style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)" }}>
            <Download size={12} /> Exporter CSV
          </button>
        </div>
        {filteredEmployees.length === 0 ? (
          <div className="p-8 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Aucun employé correspondant.
          </div>
        ) : folders.length === 0 ? (
          <div className="p-8 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Aucun dossier de formation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}>
                  <th className="text-left p-2 font-medium sticky left-0" style={{ backgroundColor: "var(--background)", color: "var(--muted-foreground)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Employé</th>
                  {folders.map((f) => (
                    <th key={f.id} className="p-2 font-medium" style={{ color: "var(--muted-foreground)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 80 }}>
                      {f.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((e) => (
                  <tr key={e.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                    <td className="p-2 sticky left-0" style={{ backgroundColor: "var(--card)", fontWeight: 500 }}>
                      {e.first_name} {e.last_name}
                    </td>
                    {folders.map((f) => {
                      const pct = completionPct(e.id, f.id);
                      const c = cellColor(pct);
                      return (
                        <td key={f.id} className="p-2 text-center">
                          <span className="inline-block rounded px-2 py-0.5"
                            style={{ backgroundColor: c.bg, color: c.text, fontWeight: 500, minWidth: 42 }}>
                            {pct}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <span style={{ fontSize: 22, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 flex-wrap">
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", paddingTop: 6, minWidth: 90 }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5 flex-1">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-full px-2.5 py-1"
      style={{
        fontSize: 11, fontWeight: active ? 500 : 400,
        backgroundColor: active ? "var(--foreground)" : "transparent",
        color: active ? "var(--card)" : "var(--muted-foreground)",
        border: active ? "none" : "0.5px solid var(--border)",
      }}>
      {children}
    </button>
  );
}
