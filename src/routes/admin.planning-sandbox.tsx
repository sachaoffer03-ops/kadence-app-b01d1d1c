import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FlaskConical, Loader2, AlertCircle, Check, Download } from "lucide-react";
import { toast } from "sonner";
import { generatePlanning } from "@/lib/generate-planning.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/planning-sandbox")({
  component: SandboxPage,
  head: () => ({ meta: [{ title: "Simulation planning — Kadence" }] }),
});

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

interface StudioRow { id: string; name: string; }
interface EmpRow { id: string; first_name: string; last_name: string; }
interface Hole { studio_name?: string; date: string; start_time: string; end_time: string; business_role: string; reason: string; }
interface Alert { severity: "info"|"warning"|"error"; user_name?: string; message: string; }
interface GenShift {
  user_id: string | null;
  studio_id: string;
  business_role: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
}
interface SimResult {
  planning_run_id: string | null;
  silent: boolean;
  status: "success"|"partial"|"failed";
  coverage_rate: number;
  shifts_generated: number;
  total_slots_needed: number;
  total_slots_covered: number;
  duration_ms: number;
  holes: Hole[];
  alerts: Alert[];
  shifts?: GenShift[];
  solver_logs?: any;
}

function SandboxPage() {
  const generate = useServerFn(generatePlanning);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [studioIds, setStudioIds] = useState<Set<string>>(new Set());
  const [employees, setEmployees] = useState<EmpRow[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [whitelist, setWhitelist] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [{ data: st }, { data: pr }] = await Promise.all([
        supabase.from("studios").select("id, name").order("name"),
        supabase.from("profiles").select("id, first_name, last_name").eq("status", "active").order("first_name"),
      ]);
      setStudios((st ?? []) as StudioRow[]);
      setEmployees((pr ?? []) as EmpRow[]);
      const rhode = (st ?? []).find((s: any) => /rhode/i.test(s.name));
      if (rhode) setStudioIds(new Set([rhode.id]));
      else if (st?.[0]) setStudioIds(new Set([st[0].id]));
    })();
  }, []);

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const toggleWhitelist = (id: string) =>
    setWhitelist((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const run = async () => {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const res: any = await generate({
        data: {
          month_start_date: monthStart,
          studio_ids: studioIds.size > 0 ? Array.from(studioIds) : undefined,
          preserve_manual: false,
          preserve_locked: false,
          dry_run: true,
          silent: true,
          exclude_user_ids: Array.from(excluded),
          whitelist_user_ids: Array.from(whitelist).filter((id) => !excluded.has(id)),
        },
      });
      setResult(res as SimResult);
      toast.success(`Simulation OK — ${res.shifts_generated} shifts, ${Math.round(res.coverage_rate * 100)}% de couverture`);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
      toast.error(e?.message ?? "Erreur");
    } finally {
      setRunning(false);
    }
  };

  const holesByRole = useMemo(() => {
    if (!result) return [];
    const m = new Map<string, number>();
    for (const h of result.holes) m.set(h.business_role, (m.get(h.business_role) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [result]);

  return (
    <div className="p-4 md:p-6" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/planning" className="flex items-center gap-1" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          <ArrowLeft size={14} /> Retour
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <FlaskConical size={22} style={{ color: "var(--coral, #F0997B)" }} />
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Simulation planning</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 24, maxWidth: 640 }}>
        Lance une génération en mémoire uniquement. Rien n'est écrit dans l'app, rien n'apparaît dans l'historique,
        aucun employé ne voit quoi que ce soit. Idéal pour tester l'impact d'un employé absent ou d'un changement d'équipe.
      </p>

      <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0,320px) minmax(0,1fr)" }}>
        {/* Config */}
        <div className="space-y-4">
          <Card title={`Studios (${studioIds.size})`} subtitle="Multi-sélection : l'algo optimise conjointement pour éviter les doubles-bookings des employés multi-studios.">
            <div className="flex flex-col gap-1">
              {studios.map((s) => {
                const on = studioIds.has(s.id);
                return (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                    style={{ fontSize: 13, borderRadius: 6, background: on ? "color-mix(in oklab, var(--coral, #F0997B) 10%, transparent)" : "transparent" }}>
                    <input type="checkbox" checked={on}
                      onChange={() => setStudioIds((prev) => {
                        const n = new Set(prev);
                        if (n.has(s.id)) n.delete(s.id); else n.add(s.id);
                        return n;
                      })} />
                    <span>{s.name}</span>
                  </label>
                );
              })}
            </div>
          </Card>

          <Card title="Mois">
            <div className="flex gap-2">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", fontSize: 13 }}>
                {MONTHS_FR.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
                style={{ width: 90, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", fontSize: 13 }} />
            </div>
          </Card>

          <Card title={`Employés prioritaires (${whitelist.size})`} subtitle="Leurs dispos sont servies en premier, le reste est comblé ensuite.">
            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
              {employees.map((e) => {
                const isExcl = excluded.has(e.id);
                const on = whitelist.has(e.id);
                return (
                  <label key={e.id} className="flex items-center gap-2 px-2 py-1.5"
                    style={{
                      fontSize: 13, borderBottom: "1px solid var(--border)",
                      background: on ? "color-mix(in oklab, #16a34a 10%, transparent)" : "transparent",
                      opacity: isExcl ? 0.4 : 1,
                      cursor: isExcl ? "not-allowed" : "pointer",
                    }}>
                    <input type="checkbox" checked={on} disabled={isExcl} onChange={() => toggleWhitelist(e.id)} />
                    <span>{e.first_name} {e.last_name}</span>
                    {isExcl && <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: "auto" }}>ignoré</span>}
                  </label>
                );
              })}
            </div>
          </Card>

          <Card title={`Employés à ignorer (${excluded.size})`} subtitle="Comme s'ils n'existaient pas.">
            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
              {employees.map((e) => {
                const on = excluded.has(e.id);
                return (
                  <label key={e.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                    style={{ fontSize: 13, borderBottom: "1px solid var(--border)", background: on ? "color-mix(in oklab, var(--coral, #F0997B) 8%, transparent)" : "transparent" }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(e.id)} />
                    <span>{e.first_name} {e.last_name}</span>
                  </label>
                );
              })}
            </div>
          </Card>

          <button
            onClick={run}
            disabled={running || !studioId}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8,
              background: "var(--coral, #F0997B)", color: "white", border: "none",
              fontSize: 14, fontWeight: 500, cursor: running ? "wait" : "pointer",
              opacity: running || !studioId ? 0.6 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {running ? <><Loader2 size={16} className="animate-spin" /> Simulation…</> : <>Lancer la simulation</>}
          </button>
        </div>

        {/* Result */}
        <div>
          {error && (
            <div className="p-3 rounded flex gap-2 mb-4" style={{ background: "color-mix(in oklab, #dc2626 10%, transparent)", fontSize: 13 }}>
              <AlertCircle size={16} style={{ color: "#dc2626" }} /> {error}
            </div>
          )}
          {!result && !error && !running && (
            <div className="rounded-xl border p-8 text-center" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted-foreground)", fontSize: 13 }}>
              Configure à gauche puis lance la simulation. Le résultat s'affichera ici sans rien enregistrer.
            </div>
          )}
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Couverture" value={`${Math.round(result.coverage_rate * 100)}%`} tone={result.coverage_rate >= 0.95 ? "good" : result.coverage_rate >= 0.5 ? "warn" : "bad"} />
                <Stat label="Shifts générés" value={result.shifts_generated.toString()} />
                <Stat label="Trous" value={result.holes.length.toString()} tone={result.holes.length === 0 ? "good" : result.holes.length < 5 ? "warn" : "bad"} />
              </div>

              <Card title="Statut" >
                <div className="flex items-center gap-2" style={{ fontSize: 13 }}>
                  <Check size={14} style={{ color: result.status === "success" ? "#16a34a" : result.status === "partial" ? "#d97706" : "#dc2626" }} />
                  <span>
                    {result.status === "success" ? "Succès" : result.status === "partial" ? "Partiel" : "Échec"} — {result.total_slots_covered}/{result.total_slots_needed} créneaux couverts en {Math.round(result.duration_ms / 100) / 10}s
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>
                  Aucune trace enregistrée. Fermer la page = tout disparaît.
                </div>
              </Card>

              {result.shifts && result.shifts.length > 0 && (
                <>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => downloadPlanningPDF(result, employees, studios.find((s) => s.id === studioId)?.name ?? "", MONTHS_FR[month], year, excluded, employees)}
                      style={{
                        padding: "8px 12px", borderRadius: 6,
                        background: "var(--foreground)", color: "var(--background)",
                        border: "none", fontSize: 13, fontWeight: 500,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <Download size={14} /> Télécharger PDF
                    </button>
                    <button
                      onClick={() => downloadPlanningHTML(result, employees, studios.find((s) => s.id === studioId)?.name ?? "", MONTHS_FR[month], year, excluded, employees)}
                      style={{
                        padding: "8px 12px", borderRadius: 6,
                        background: "transparent", color: "var(--foreground)",
                        border: "1px solid var(--border)", fontSize: 13, fontWeight: 500,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <Download size={14} /> HTML
                    </button>
                    <button
                      onClick={() => downloadPlanningCSV(result, employees, MONTHS_FR[month], year)}
                      style={{
                        padding: "8px 12px", borderRadius: 6,
                        background: "transparent", color: "var(--foreground)",
                        border: "1px solid var(--border)", fontSize: 13, fontWeight: 500,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <Download size={14} /> CSV
                    </button>
                  </div>
                  <WeekView shifts={result.shifts} employees={employees} />
                </>
              )}

              {holesByRole.length > 0 && (
                <Card title="Trous par rôle">
                  <div className="space-y-1">
                    {holesByRole.map(([role, n]) => (
                      <div key={role} className="flex justify-between" style={{ fontSize: 13 }}>
                        <span>{role}</span>
                        <span style={{ color: "var(--muted-foreground)" }}>{n} créneau{n > 1 ? "x" : ""}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {result.holes.length > 0 && (
                <Card title={`Détail des trous (${result.holes.length})`}>
                  <div style={{ maxHeight: 320, overflowY: "auto", fontSize: 12 }}>
                    {result.holes.slice(0, 100).map((h, i) => (
                      <div key={i} className="py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 500 }}>{h.date} · {h.start_time}–{h.end_time} · {h.business_role}</div>
                        <div style={{ color: "var(--muted-foreground)" }}>{h.reason}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {result.alerts && result.alerts.length > 0 && (
                <Card title={`Alertes (${result.alerts.length})`}>
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    {result.alerts.map((a, i) => (
                      <div key={i} className="py-1.5" style={{ fontSize: 12, borderBottom: "1px solid var(--border)" }}>
                        <span style={{
                          fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em",
                          color: a.severity === "error" ? "#dc2626" : a.severity === "warning" ? "#d97706" : "#64748b",
                          marginRight: 6,
                        }}>{a.severity}</span>
                        {a.user_name && <span style={{ fontWeight: 500 }}>{a.user_name} · </span>}
                        {a.message}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: subtitle ? 2 : 10 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good"|"warn"|"bad" }) {
  const color = tone === "good" ? "#16a34a" : tone === "warn" ? "#d97706" : tone === "bad" ? "#dc2626" : "var(--foreground)";
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color }}>{value}</div>
    </div>
  );
}

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const ROLE_COLORS: Record<string, string> = {
  Barista: "#F0997B",
  Accueil: "#3BAFA3",
  Host: "#A78BC7",
  Cuisine: "#E8A0BF",
};

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getUTCDay() + 6) % 7; // 0=Mon
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  return monday.toISOString().slice(0, 10);
}

function fmtTime(t: string) {
  return t.slice(0, 5);
}

function WeekView({ shifts, employees }: { shifts: GenShift[]; employees: EmpRow[] }) {
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, `${e.first_name} ${e.last_name}`);
    return m;
  }, [employees]);

  const weeks = useMemo(() => {
    const byWeek = new Map<string, Map<string, GenShift[]>>();
    for (const sh of shifts) {
      const wk = isoWeekKey(sh.shift_date);
      if (!byWeek.has(wk)) byWeek.set(wk, new Map());
      const byDay = byWeek.get(wk)!;
      if (!byDay.has(sh.shift_date)) byDay.set(sh.shift_date, []);
      byDay.get(sh.shift_date)!.push(sh);
    }
    const sortedWeeks = Array.from(byWeek.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sortedWeeks.map(([wk, byDay]) => {
      const days = Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, list]) => ({
          date,
          shifts: list.slice().sort((a, b) =>
            a.start_time.localeCompare(b.start_time) ||
            a.business_role.localeCompare(b.business_role),
          ),
        }));
      return { wk, days };
    });
  }, [shifts]);

  return (
    <Card title={`Planning généré — ${shifts.length} shifts`} subtitle="Créneaux vides = trous non pourvus.">
      <div className="space-y-4">
        {weeks.map(({ wk, days }) => {
          const wkDate = new Date(wk + "T00:00:00");
          const end = new Date(wkDate);
          end.setUTCDate(wkDate.getUTCDate() + 6);
          const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
          return (
            <div key={wk}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--muted-foreground)" }}>
                Semaine du {fmt(wkDate)} au {fmt(end)}
              </div>
              <div className="rounded-lg border" style={{ borderColor: "var(--border)", overflow: "hidden" }}>
                {days.map(({ date, shifts: dayShifts }, di) => {
                  const d = new Date(date + "T00:00:00");
                  return (
                    <div key={date} style={{ display: "grid", gridTemplateColumns: "90px 1fr", borderTop: di === 0 ? "none" : "1px solid var(--border)" }}>
                      <div style={{ padding: "8px 10px", background: "color-mix(in oklab, var(--muted) 40%, transparent)", fontSize: 12 }}>
                        <div style={{ fontWeight: 500 }}>{DAYS_FR[d.getUTCDay()]}</div>
                        <div style={{ color: "var(--muted-foreground)" }}>
                          {String(d.getUTCDate()).padStart(2, "0")}/{String(d.getUTCMonth() + 1).padStart(2, "0")}
                        </div>
                      </div>
                      <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
                        {dayShifts.map((sh, i) => {
                          const hole = sh.user_id === null;
                          const color = ROLE_COLORS[sh.business_role] ?? "#64748b";
                          const name = hole
                            ? "— TROU —"
                            : (sh.user_id && nameById.get(sh.user_id)) || sh.user_id;
                          return (
                            <div key={i} style={{
                              display: "flex", alignItems: "center", gap: 8, fontSize: 12,
                              padding: "3px 6px", borderRadius: 4,
                              background: hole ? "color-mix(in oklab, #dc2626 8%, transparent)" : "transparent",
                            }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                              <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--muted-foreground)", minWidth: 90 }}>
                                {fmtTime(sh.start_time)}–{fmtTime(sh.end_time)}
                              </span>
                              <span style={{ minWidth: 70, color: "var(--muted-foreground)" }}>{sh.business_role}</span>
                              <span style={{ fontWeight: hole ? 500 : 400, color: hole ? "#dc2626" : "var(--foreground)" }}>
                                {name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Exports ────────────────────────────────────────────────────────────────

function nameOf(id: string | null, employees: EmpRow[]): string {
  if (!id) return "— TROU —";
  const e = employees.find((x) => x.id === id);
  return e ? `${e.first_name} ${e.last_name}` : id;
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);

  try {
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    toast.success("Téléchargement lancé");
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    toast.info("Le planning s'ouvre dans un nouvel onglet. Tu peux l'enregistrer depuis là.");
  } finally {
    window.setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 30000);
  }
}

function openHtmlExport(filename: string, html: string) {
  const doc = window.open("", "_blank");

  if (!doc) {
    triggerDownload(filename, html, "text/html;charset=utf-8");
    return;
  }

  const escapedFilename = JSON.stringify(filename);
  const escapedHtml = JSON.stringify(html);
  const saveControls = `<div style="position:sticky;top:0;z-index:9999;margin:-32px -32px 24px;padding:12px 32px;background:#FAFAF8;border-bottom:1px solid #e5e5e5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;gap:10px;align-items:center;">
    <button onclick='const blob=new Blob([${escapedHtml}],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=${escapedFilename};document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);' style="border:0;background:#1a1a1a;color:#FAFAF8;border-radius:6px;padding:8px 12px;font-size:13px;cursor:pointer;">Enregistrer le fichier</button>
    <button onclick="window.print()" style="border:1px solid #d8d8d4;background:transparent;color:#1a1a1a;border-radius:6px;padding:8px 12px;font-size:13px;cursor:pointer;">Imprimer / PDF</button>
  </div>`;

  doc.document.open();
  doc.document.write(html.replace("<body>", `<body>${saveControls}`));
  doc.document.close();
  doc.opener = null;
  toast.success("Planning ouvert dans un nouvel onglet");
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function downloadPlanningHTML(
  result: SimResult,
  employees: EmpRow[],
  studioName: string,
  monthLabel: string,
  year: number,
  excludedSet: Set<string>,
  allEmployees: EmpRow[],
) {
  const shifts = result.shifts ?? [];
  // Group by ISO week → date
  const byWeek = new Map<string, Map<string, GenShift[]>>();
  for (const sh of shifts) {
    const wk = isoWeekKey(sh.shift_date);
    if (!byWeek.has(wk)) byWeek.set(wk, new Map());
    const byDay = byWeek.get(wk)!;
    if (!byDay.has(sh.shift_date)) byDay.set(sh.shift_date, []);
    byDay.get(sh.shift_date)!.push(sh);
  }
  const weeks = Array.from(byWeek.entries()).sort(([a], [b]) => a.localeCompare(b));
  const excludedNames = Array.from(excludedSet)
    .map((id) => allEmployees.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => `${e!.first_name} ${e!.last_name}`);

  const roleColor = (r: string) => ROLE_COLORS[r] ?? "#64748b";

  const weekBlocks = weeks.map(([wk, byDay]) => {
    const wkDate = new Date(wk + "T00:00:00");
    const end = new Date(wkDate);
    end.setUTCDate(wkDate.getUTCDate() + 6);
    const fmtD = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
    const rows = days.map(([date, list]) => {
      const d = new Date(date + "T00:00:00");
      const sorted = list.slice().sort((a, b) =>
        a.start_time.localeCompare(b.start_time) || a.business_role.localeCompare(b.business_role),
      );
      const items = sorted.map((sh) => {
        const hole = sh.user_id === null;
        const name = escHtml(nameOf(sh.user_id, employees));
        return `<tr class="${hole ? "hole" : ""}">
          <td class="tm">${sh.start_time.slice(0, 5)}–${sh.end_time.slice(0, 5)}</td>
          <td><span class="dot" style="background:${roleColor(sh.business_role)}"></span>${escHtml(sh.business_role)}</td>
          <td class="nm">${name}</td>
        </tr>`;
      }).join("");
      return `<tr class="day-head"><td colspan="3">${DAYS_FR[d.getUTCDay()]} ${fmtD(d)}</td></tr>${items}`;
    }).join("");
    return `<section class="week">
      <h3>Semaine du ${fmtD(wkDate)} au ${fmtD(end)}</h3>
      <table><tbody>${rows}</tbody></table>
    </section>`;
  }).join("");

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Simulation planning — ${escHtml(studioName)} — ${escHtml(monthLabel)} ${year}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; margin: 32px; color: #1a1a1a; background: #FAFAF8; }
  h1 { font-size: 22px; font-weight: 500; margin: 0 0 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 20px; }
  .stats { display: flex; gap: 16px; margin: 16px 0 24px; }
  .stat { border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px 14px; background: white; min-width: 120px; }
  .stat b { display: block; font-size: 20px; font-weight: 500; }
  .stat span { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
  .meta { font-size: 12px; color: #666; margin-bottom: 24px; }
  .meta b { color: #1a1a1a; }
  section.week { margin-bottom: 22px; page-break-inside: avoid; }
  section.week h3 { font-size: 13px; font-weight: 500; color: #666; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; background: white; font-size: 13px; }
  td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
  tr.day-head td { background: #f5f5f2; font-weight: 500; font-size: 12px; padding: 6px 10px; }
  td.tm { font-family: ui-monospace, Menlo, monospace; color: #555; width: 110px; }
  td .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
  tr.hole td.nm { color: #dc2626; font-weight: 500; }
  tr.hole { background: #fef2f2; }
  .foot { margin-top: 32px; font-size: 11px; color: #999; border-top: 1px solid #e5e5e5; padding-top: 12px; }
  @media print { body { margin: 16mm; background: white; } .stat, table { break-inside: avoid; } }
</style>
</head><body>
<h1>Simulation planning — ${escHtml(studioName)}</h1>
<div class="sub">${escHtml(monthLabel)} ${year} · Généré le ${new Date().toLocaleString("fr-BE")}</div>

<div class="stats">
  <div class="stat"><span>Couverture</span><b>${Math.round(result.coverage_rate * 100)}%</b></div>
  <div class="stat"><span>Shifts</span><b>${result.shifts_generated}</b></div>
  <div class="stat"><span>Trous</span><b>${result.holes.length}</b></div>
  <div class="stat"><span>Créneaux</span><b>${result.total_slots_covered}/${result.total_slots_needed}</b></div>
</div>

${excludedNames.length ? `<div class="meta"><b>Employés ignorés dans la simulation :</b> ${escHtml(excludedNames.join(", "))}</div>` : ""}

${weekBlocks}

<div class="foot">Simulation — ce document n'a jamais été enregistré dans Kadence. Fichier généré localement.</div>
</body></html>`;

  const fname = `planning-simu-${studioName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${monthLabel.toLowerCase()}-${year}.html`;
  openHtmlExport(fname, html);
}

function downloadPlanningCSV(result: SimResult, employees: EmpRow[], monthLabel: string, year: number) {
  const shifts = (result.shifts ?? []).slice().sort((a, b) =>
    a.shift_date.localeCompare(b.shift_date) ||
    a.start_time.localeCompare(b.start_time) ||
    a.business_role.localeCompare(b.business_role),
  );
  const rows = [
    ["Date", "Jour", "Début", "Fin", "Rôle", "Employé", "Statut"].join(","),
    ...shifts.map((sh) => {
      const d = new Date(sh.shift_date + "T00:00:00");
      const jour = DAYS_FR[d.getUTCDay()];
      const emp = sh.user_id === null ? "TROU" : nameOf(sh.user_id, employees);
      return [sh.shift_date, jour, sh.start_time.slice(0, 5), sh.end_time.slice(0, 5), sh.business_role, `"${emp.replace(/"/g, '""')}"`, sh.status].join(",");
    }),
  ].join("\n");
  triggerDownload(`planning-simu-${monthLabel.toLowerCase()}-${year}.csv`, "\ufeff" + rows, "text/csv;charset=utf-8");
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

async function downloadPlanningPDF(
  result: SimResult,
  employees: EmpRow[],
  studioName: string,
  monthLabel: string,
  year: number,
  excludedSet: Set<string>,
  allEmployees: EmpRow[],
) {
  try {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 36;

    // Header
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, pageW, 90, "F");
    doc.setTextColor(250, 250, 248);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("KADENCE  ·  Simulation planning", margin, 32);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(`${studioName} — ${monthLabel} ${year}`, margin, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(`Généré le ${new Date().toLocaleString("fr-BE")}`, margin, 78);

    // Stats cards
    let y = 110;
    doc.setTextColor(26, 26, 26);
    const stats = [
      { label: "COUVERTURE", value: `${Math.round(result.coverage_rate * 100)}%` },
      { label: "SHIFTS", value: `${result.shifts_generated}` },
      { label: "TROUS", value: `${result.holes.length}` },
      { label: "CRÉNEAUX", value: `${result.total_slots_covered}/${result.total_slots_needed}` },
    ];
    const cardW = (pageW - margin * 2 - 12 * 3) / 4;
    stats.forEach((s, i) => {
      const x = margin + i * (cardW + 12);
      doc.setDrawColor(230, 230, 230);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, cardW, 54, 6, 6, "FD");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(s.label, x + 10, y + 18);
      doc.setFontSize(18);
      doc.setTextColor(26, 26, 26);
      doc.setFont("helvetica", "bold");
      doc.text(s.value, x + 10, y + 42);
      doc.setFont("helvetica", "normal");
    });
    y += 74;

    // Excluded employees
    const excludedNames = Array.from(excludedSet)
      .map((id) => allEmployees.find((e) => e.id === id))
      .filter(Boolean)
      .map((e) => `${e!.first_name} ${e!.last_name}`);
    if (excludedNames.length) {
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      const txt = `Employés ignorés : ${excludedNames.join(", ")}`;
      const lines = doc.splitTextToSize(txt, pageW - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 12 + 8;
    }

    // Group by week
    const shifts = result.shifts ?? [];
    const byWeek = new Map<string, Map<string, GenShift[]>>();
    for (const sh of shifts) {
      const wk = isoWeekKey(sh.shift_date);
      if (!byWeek.has(wk)) byWeek.set(wk, new Map());
      const byDay = byWeek.get(wk)!;
      if (!byDay.has(sh.shift_date)) byDay.set(sh.shift_date, []);
      byDay.get(sh.shift_date)!.push(sh);
    }
    const weeks = Array.from(byWeek.entries()).sort(([a], [b]) => a.localeCompare(b));
    const fmtD = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

    for (const [wk, byDay] of weeks) {
      const wkDate = new Date(wk + "T00:00:00");
      const end = new Date(wkDate);
      end.setUTCDate(wkDate.getUTCDate() + 6);

      if (y > pageH - 120) { doc.addPage(); y = margin; }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 26, 26);
      doc.text(`Semaine du ${fmtD(wkDate)} au ${fmtD(end)}`, margin, y);
      y += 8;

      const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
      const body: Array<Array<{ content: string; styles?: Record<string, unknown> }>> = [];
      for (const [date, list] of days) {
        const d = new Date(date + "T00:00:00");
        body.push([
          {
            content: `${DAYS_FR[d.getUTCDay()]} ${fmtD(d)}`,
            styles: { fillColor: [245, 245, 242], fontStyle: "bold", textColor: [60, 60, 60], fontSize: 9 },
          },
          { content: "", styles: { fillColor: [245, 245, 242] } },
          { content: "", styles: { fillColor: [245, 245, 242] } },
        ]);
        const sorted = list.slice().sort((a, b) =>
          a.start_time.localeCompare(b.start_time) || a.business_role.localeCompare(b.business_role),
        );
        for (const sh of sorted) {
          const hole = sh.user_id === null;
          const color = ROLE_COLORS[sh.business_role] ?? "#64748b";
          const rgb = hexToRgb(color);
          body.push([
            { content: `${sh.start_time.slice(0, 5)}–${sh.end_time.slice(0, 5)}`, styles: { font: "courier", textColor: [90, 90, 90] } },
            { content: sh.business_role, styles: { textColor: rgb, fontStyle: "bold" } },
            {
              content: hole ? "⚠  TROU À COMBLER" : nameOf(sh.user_id, employees),
              styles: hole
                ? { textColor: [220, 38, 38], fillColor: [254, 242, 242], fontStyle: "bold" }
                : { textColor: [26, 26, 26] },
            },
          ]);
        }
      }

      autoTable(doc, {
        startY: y,
        head: [["Horaire", "Rôle", "Employé"]],
        body: body as never,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 5, lineColor: [235, 235, 235], lineWidth: 0.5 },
        headStyles: { fillColor: [26, 26, 26], textColor: [250, 250, 248], fontSize: 8, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 130 }, 2: { cellWidth: "auto" } },
        theme: "grid",
      });
      // @ts-expect-error autoTable adds lastAutoTable to the doc instance
      y = (doc.lastAutoTable?.finalY ?? y) + 18;
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(
        `Simulation Kadence — document local, non enregistré · Page ${i}/${pageCount}`,
        margin,
        pageH - 16,
      );
    }

    const fname = `planning-${studioName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${monthLabel.toLowerCase()}-${year}.pdf`;
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      // Fallback: if download was blocked (sandboxed iframe), open in new tab so user can save manually
      window.open(url, "_blank");
    }, 100);
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 30000);
    toast.success("PDF prêt — si rien ne se télécharge, il s'ouvre dans un onglet");
  } catch (e) {
    console.error(e);
    toast.error("Erreur lors de la génération du PDF");
  }
}
