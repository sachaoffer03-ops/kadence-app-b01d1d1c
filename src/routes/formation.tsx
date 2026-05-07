import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Play, ChevronRight, Users, Clock, ChevronDown, ChevronUp, Bell } from "lucide-react";
import { trainingPaths, roleColors, employees, type TrainingPath } from "@/lib/mock-data";

export const Route = createFileRoute("/formation")({
  component: FormationPage,
  head: () => ({ meta: [{ title: "Formation — Shifty" }] }),
});

function FormationPage() {
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const commonPaths = trainingPaths.filter(p => p.type === 'commun');
  const rolePaths = trainingPaths.filter(p => p.type === 'role');

  return (
    <div className="p-6" style={{}}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Formation</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            {trainingPaths.reduce((s, p) => s + p.videoCount, 0)} vidéos · {trainingPaths.length} parcours · Suivi de progression
          </p>
        </div>
        <button className="rounded-md px-4 py-2 flex items-center gap-1.5 transition-colors" style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>
          <Bell size={13} /> Envoyer un rappel
        </button>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MiniKpi label="Complétion moyenne" value={`${Math.round(trainingPaths.reduce((s, p) => s + p.avgCompletion, 0) / trainingPaths.length)}%`} />
        <MiniKpi label="Staff formé (commun)" value={`${Math.round(employees.length * 0.78)}`} sub={`/ ${employees.length}`} />
        <MiniKpi label="Vidéos totales" value={trainingPaths.reduce((s, p) => s + p.videoCount, 0).toString()} />
        <MiniKpi label="En retard" value="4" color="var(--warning-text)" sub="employés" />
      </div>

      {/* Common path */}
      <SectionLabel label="Parcours commun" sub="Obligatoire pour tout le staff" />
      <div className="flex flex-col gap-3 mb-6">
        {commonPaths.map(path => (
          <PathCard key={path.id} path={path} expanded={expandedPath === path.id} onToggle={() => setExpandedPath(expandedPath === path.id ? null : path.id)} />
        ))}
      </div>

      {/* Role paths */}
      <SectionLabel label="Parcours par rôle" sub="Recommandé selon les postes attribués" />
      <div className="grid grid-cols-2 gap-3">
        {rolePaths.map(path => (
          <PathCard key={path.id} path={path} expanded={expandedPath === path.id} onToggle={() => setExpandedPath(expandedPath === path.id ? null : path.id)} />
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="mb-3">
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{sub}</div>
    </div>
  );
}

function PathCard({ path, expanded, onToggle }: { path: TrainingPath; expanded: boolean; onToggle: () => void }) {
  const roleColor = path.role ? roleColors[path.role] : null;
  const completionColor = path.avgCompletion >= 75 ? "var(--success-text)" : path.avgCompletion >= 50 ? "var(--warning-text)" : "var(--danger-text)";

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 text-left">
        <div className="rounded-lg flex items-center justify-center shrink-0" style={{
          width: 40, height: 40,
          backgroundColor: roleColor?.bg || "var(--coral-light)",
          color: roleColor?.text || "var(--coral-dark)",
        }}>
          <GraduationCap size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14, fontWeight: 500 }}>{path.title}</span>
            {path.role && (
              <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColor?.bg, color: roleColor?.text }}>
                {path.role}
              </span>
            )}
            {path.type === 'commun' && (
              <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)" }}>
                Obligatoire
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            <span>{path.moduleCount} modules</span>
            <span>{path.videoCount} vidéos</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div style={{ fontSize: 18, fontWeight: 500, color: completionColor }}>{path.avgCompletion}%</div>
            <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>complétion</div>
          </div>
          <div style={{ width: 50, height: 4, borderRadius: 2, backgroundColor: "var(--muted)" }}>
            <div style={{ width: `${path.avgCompletion}%`, height: "100%", borderRadius: 2, backgroundColor: completionColor }} />
          </div>
          {expanded ? <ChevronUp size={16} style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown size={16} style={{ color: "var(--muted-foreground)" }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4" style={{ borderTop: "0.5px solid var(--border)" }}>
          {path.modules.map((mod, mi) => (
            <div key={mod.id} className="py-3" style={{ borderBottom: mi < path.modules.length - 1 ? "0.5px solid var(--border)" : "none" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{mod.title}</span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{mod.duration}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 ml-4">
                {mod.videos.map(video => (
                  <div key={video.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors" style={{ cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                  >
                    <Play size={12} style={{ color: "var(--coral)" }} />
                    <span style={{ fontSize: 12 }}>{video.title}</span>
                    <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: "auto" }}>{video.duration}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniKpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 22, fontWeight: 500, color: color || "var(--foreground)" }}>{value}</span>
        {sub && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{sub}</span>}
      </div>
    </div>
  );
}
