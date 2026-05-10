import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Play, ChevronDown, ChevronUp, Bell, Check, Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trainingPaths as seedPaths, roleColors, employees, type TrainingPath, type TrainingModule, type Role } from "@/lib/mock-data";

export const Route = createFileRoute("/formation")({
  component: FormationPage,
  head: () => ({ meta: [{ title: "Formation — Shifty" }] }),
});

const allRoles: Role[] = ["Barista", "Accueil", "Host", "Cuisine"];

const clone = (p: TrainingPath[]): TrainingPath[] =>
  p.map((x) => ({ ...x, modules: x.modules.map((m) => ({ ...m, videos: m.videos.map((v) => ({ ...v })) })) }));

const recount = (p: TrainingPath): TrainingPath => ({
  ...p,
  moduleCount: p.modules.length,
  videoCount: p.modules.reduce((s, m) => s + m.videos.length, 0),
});

function FormationPage() {
  const [paths, setPaths] = useState<TrainingPath[]>(() => clone(seedPaths));
  const [expandedPath, setExpandedPath] = useState<string | null>(seedPaths[0]?.id || null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const commonPaths = paths.filter((p) => p.type === "commun");
  const rolePaths = paths.filter((p) => p.type === "role");
  const totalVideos = paths.reduce((s, p) => s + p.videoCount, 0);
  const lateCount = 4;

  const toggleVideo = (id: string, title: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast.info(`"${title}" marquée non vue`); }
      else { next.add(id); toast.success(`"${title}" marquée comme vue`); }
      return next;
    });
  };

  const sendReminder = () => toast.success(`Rappel envoyé à ${lateCount} employés en retard`);

  const updatePath = (id: string, fn: (p: TrainingPath) => TrainingPath) =>
    setPaths((prev) => prev.map((p) => p.id === id ? recount(fn(p)) : p));

  const deletePath = (id: string) => {
    setPaths((prev) => prev.filter((p) => p.id !== id));
    toast.success("Parcours supprimé");
  };

  const addPath = (data: { title: string; type: "commun" | "role"; role?: Role }) => {
    const id = `path-${Date.now()}`;
    const newPath: TrainingPath = {
      id, title: data.title, type: data.type, role: data.role,
      moduleCount: 0, videoCount: 0, avgCompletion: 0, modules: [],
    };
    setPaths((prev) => [...prev, newPath]);
    setExpandedPath(id);
    setEditingPath(id);
    setCreating(false);
    toast.success("Parcours créé");
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Formation</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            {totalVideos} vidéos · {paths.length} parcours · {completed.size} vidéos vues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={sendReminder} className="rounded-md px-4 py-2 flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>
            <Bell size={13} /> Rappel ({lateCount})
          </button>
          <button onClick={() => setCreating(true)} className="rounded-md px-4 py-2 flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            <Plus size={13} /> Nouveau parcours
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MiniKpi label="Complétion moyenne" value={paths.length ? `${Math.round(paths.reduce((s, p) => s + p.avgCompletion, 0) / paths.length)}%` : "—"} />
        <MiniKpi label="Staff formé (commun)" value={`${Math.round(employees.length * 0.78)}`} sub={`/ ${employees.length}`} />
        <MiniKpi label="Vidéos totales" value={totalVideos.toString()} />
        <MiniKpi label="En retard" value={lateCount.toString()} color="var(--warning-text)" sub="employés" />
      </div>

      {creating && <CreatePathForm onCancel={() => setCreating(false)} onCreate={addPath} />}

      <SectionLabel label="Parcours commun" sub="Obligatoire pour tout le staff" />
      <div className="flex flex-col gap-3 mb-6">
        {commonPaths.length === 0 && <EmptyHint label="Aucun parcours commun. Crée-en un avec “Nouveau parcours”." />}
        {commonPaths.map((path) => (
          <PathCard key={path.id} path={path}
            expanded={expandedPath === path.id}
            editing={editingPath === path.id}
            onToggle={() => setExpandedPath(expandedPath === path.id ? null : path.id)}
            onToggleEdit={() => setEditingPath(editingPath === path.id ? null : path.id)}
            onUpdate={(fn) => updatePath(path.id, fn)}
            onDelete={() => deletePath(path.id)}
            completed={completed} onToggleVideo={toggleVideo} />
        ))}
      </div>

      <SectionLabel label="Parcours par rôle" sub="Recommandé selon les postes attribués" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rolePaths.length === 0 && <EmptyHint label="Aucun parcours par rôle." />}
        {rolePaths.map((path) => (
          <PathCard key={path.id} path={path}
            expanded={expandedPath === path.id}
            editing={editingPath === path.id}
            onToggle={() => setExpandedPath(expandedPath === path.id ? null : path.id)}
            onToggleEdit={() => setEditingPath(editingPath === path.id ? null : path.id)}
            onUpdate={(fn) => updatePath(path.id, fn)}
            onDelete={() => deletePath(path.id)}
            completed={completed} onToggleVideo={toggleVideo} />
        ))}
      </div>
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="rounded-xl border px-5 py-4" style={{ borderColor: "var(--border)", borderStyle: "dashed", fontSize: 12, color: "var(--muted-foreground)" }}>
      {label}
    </div>
  );
}

function CreatePathForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: (d: { title: string; type: "commun" | "role"; role?: Role }) => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"commun" | "role">("commun");
  const [role, setRole] = useState<Role>("Barista");

  return (
    <div className="rounded-xl border p-5 mb-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontSize: 13, fontWeight: 500 }}>Nouveau parcours</div>
        <button onClick={onCancel} style={{ color: "var(--muted-foreground)" }}><X size={14} /></button>
      </div>
      <div className="flex flex-col gap-3">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du parcours"
          className="rounded-md px-3 py-2 outline-none" style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
        <div className="flex gap-2">
          <button onClick={() => setType("commun")} className="flex-1 rounded-md px-3 py-2"
            style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: type === "commun" ? "var(--foreground)" : "transparent", color: type === "commun" ? "var(--card)" : "var(--foreground)" }}>
            Commun
          </button>
          <button onClick={() => setType("role")} className="flex-1 rounded-md px-3 py-2"
            style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: type === "role" ? "var(--foreground)" : "transparent", color: type === "role" ? "var(--card)" : "var(--foreground)" }}>
            Par rôle
          </button>
        </div>
        {type === "role" && (
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-md px-3 py-2 outline-none" style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}>
            {allRoles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-md px-3 py-2" style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>Annuler</button>
          <button
            onClick={() => title.trim() && onCreate({ title: title.trim(), type, role: type === "role" ? role : undefined })}
            disabled={!title.trim()}
            className="flex-1 rounded-md px-3 py-2"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)", opacity: title.trim() ? 1 : 0.4 }}>
            Créer
          </button>
        </div>
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

function PathCard({
  path, expanded, editing, onToggle, onToggleEdit, onUpdate, onDelete, completed, onToggleVideo,
}: {
  path: TrainingPath;
  expanded: boolean;
  editing: boolean;
  onToggle: () => void;
  onToggleEdit: () => void;
  onUpdate: (fn: (p: TrainingPath) => TrainingPath) => void;
  onDelete: () => void;
  completed: Set<string>;
  onToggleVideo: (id: string, title: string) => void;
}) {
  const roleColor = path.role ? roleColors[path.role] : null;
  const completionColor = path.avgCompletion >= 75 ? "var(--success-text)" : path.avgCompletion >= 50 ? "var(--warning-text)" : "var(--danger-text)";

  const renamePath = () => {
    const t = window.prompt("Nouveau titre du parcours", path.title);
    if (t && t.trim()) onUpdate((p) => ({ ...p, title: t.trim() }));
  };
  const changeRole = () => {
    const choice = window.prompt(`Rôle (${allRoles.join(", ")}) ou vide pour commun`, path.role || "");
    if (choice === null) return;
    const v = choice.trim();
    if (v === "") onUpdate((p) => ({ ...p, type: "commun", role: undefined }));
    else if ((allRoles as string[]).includes(v)) onUpdate((p) => ({ ...p, type: "role", role: v as Role }));
    else toast.error("Rôle invalide");
  };

  const addModule = () => {
    const t = window.prompt("Titre du module");
    if (!t || !t.trim()) return;
    const m: TrainingModule = { id: `mod-${Date.now()}`, title: t.trim(), duration: "0min", videos: [] };
    onUpdate((p) => ({ ...p, modules: [...p.modules, m] }));
  };
  const renameModule = (modId: string, current: string) => {
    const t = window.prompt("Titre du module", current);
    if (t && t.trim()) onUpdate((p) => ({ ...p, modules: p.modules.map((m) => m.id === modId ? { ...m, title: t.trim() } : m) }));
  };
  const deleteModule = (modId: string) => {
    if (!window.confirm("Supprimer ce module ?")) return;
    onUpdate((p) => ({ ...p, modules: p.modules.filter((m) => m.id !== modId) }));
  };
  const addVideo = (modId: string) => {
    const t = window.prompt("Titre de la vidéo");
    if (!t || !t.trim()) return;
    const d = window.prompt("Durée (ex: 4min)", "5min") || "5min";
    onUpdate((p) => ({
      ...p,
      modules: p.modules.map((m) => m.id === modId
        ? { ...m, videos: [...m.videos, { id: `vid-${Date.now()}`, title: t.trim(), duration: d }] }
        : m),
    }));
  };
  const renameVideo = (modId: string, vidId: string, current: string) => {
    const t = window.prompt("Titre de la vidéo", current);
    if (t && t.trim()) onUpdate((p) => ({
      ...p,
      modules: p.modules.map((m) => m.id === modId
        ? { ...m, videos: m.videos.map((v) => v.id === vidId ? { ...v, title: t.trim() } : v) }
        : m),
    }));
  };
  const deleteVideo = (modId: string, vidId: string) => {
    onUpdate((p) => ({
      ...p,
      modules: p.modules.map((m) => m.id === modId
        ? { ...m, videos: m.videos.filter((v) => v.id !== vidId) }
        : m),
    }));
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: editing ? "var(--coral)" : "var(--border)" }}>
      <div className="w-full flex items-center gap-4 px-5 py-4">
        <button onClick={onToggle} className="flex items-center gap-4 flex-1 min-w-0 text-left">
          <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 40, height: 40, backgroundColor: roleColor?.bg || "var(--coral-light)", color: roleColor?.text || "var(--coral-dark)" }}>
            <GraduationCap size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontSize: 14, fontWeight: 500 }}>{path.title}</span>
              {path.role && <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColor?.bg, color: roleColor?.text }}>{path.role}</span>}
              {path.type === "commun" && <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)" }}>Obligatoire</span>}
            </div>
            <div className="flex items-center gap-3 mt-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              <span>{path.moduleCount} modules</span>
              <span>{path.videoCount} vidéos</span>
            </div>
          </div>
        </button>
        <div className="flex items-center gap-3 shrink-0">
          {!editing && (
            <>
              <div className="text-right">
                <div style={{ fontSize: 18, fontWeight: 500, color: completionColor }}>{path.avgCompletion}%</div>
                <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>complétion</div>
              </div>
              <div style={{ width: 50, height: 4, borderRadius: 2, backgroundColor: "var(--muted)" }}>
                <div style={{ width: `${path.avgCompletion}%`, height: "100%", borderRadius: 2, backgroundColor: completionColor }} />
              </div>
            </>
          )}
          <button onClick={onToggleEdit} className="rounded-md p-1.5" title={editing ? "Terminer" : "Modifier"}
            style={{ color: editing ? "var(--coral-dark)" : "var(--muted-foreground)", backgroundColor: editing ? "var(--coral-light)" : "transparent" }}>
            {editing ? <Check size={14} /> : <Pencil size={14} />}
          </button>
          {editing && (
            <button onClick={onDelete} className="rounded-md p-1.5" title="Supprimer le parcours" style={{ color: "var(--danger-text)" }}>
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={onToggle} style={{ color: "var(--muted-foreground)" }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4" style={{ borderTop: "0.5px solid var(--border)" }}>
          {editing && (
            <div className="flex gap-2 py-3 flex-wrap" style={{ borderBottom: "0.5px solid var(--border)" }}>
              <button onClick={renamePath} className="rounded-md px-2.5 py-1 flex items-center gap-1.5" style={{ fontSize: 11, border: "0.5px solid var(--border)" }}>
                <Pencil size={11} /> Renommer
              </button>
              <button onClick={changeRole} className="rounded-md px-2.5 py-1 flex items-center gap-1.5" style={{ fontSize: 11, border: "0.5px solid var(--border)" }}>
                Type / rôle
              </button>
              <button onClick={addModule} className="rounded-md px-2.5 py-1 flex items-center gap-1.5" style={{ fontSize: 11, border: "0.5px solid var(--border)" }}>
                <Plus size={11} /> Ajouter un module
              </button>
            </div>
          )}

          {path.modules.length === 0 && (
            <div className="py-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Aucun module. {editing ? "Clique sur “Ajouter un module”." : ""}
            </div>
          )}

          {path.modules.map((mod, mi) => (
            <div key={mod.id} className="py-3" style={{ borderBottom: mi < path.modules.length - 1 ? "0.5px solid var(--border)" : "none" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{mod.title}</span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{mod.videos.length} vidéo{mod.videos.length > 1 ? "s" : ""}</span>
                </div>
                {editing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => renameModule(mod.id, mod.title)} className="rounded-md p-1" style={{ color: "var(--muted-foreground)" }}><Pencil size={11} /></button>
                    <button onClick={() => addVideo(mod.id)} className="rounded-md p-1 flex items-center gap-1" style={{ fontSize: 10, color: "var(--coral-dark)" }}><Plus size={11} /> vidéo</button>
                    <button onClick={() => deleteModule(mod.id)} className="rounded-md p-1" style={{ color: "var(--danger-text)" }}><Trash2 size={11} /></button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 ml-4">
                {mod.videos.length === 0 && !editing && (
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", padding: "4px 8px" }}>Aucune vidéo</div>
                )}
                {mod.videos.map((video) => {
                  const isDone = completed.has(video.id);
                  return (
                    <div key={video.id} className="flex items-center gap-2 rounded-md px-2 py-1.5"
                      style={{ backgroundColor: isDone ? "var(--success-bg)" : "transparent" }}>
                      <button onClick={() => onToggleVideo(video.id, video.title)} className="flex items-center gap-2 flex-1 text-left">
                        {isDone ? <Check size={12} style={{ color: "var(--success-text)" }} /> : <Play size={12} style={{ color: "var(--coral)" }} />}
                        <span style={{ fontSize: 12, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--success-text)" : "var(--foreground)" }}>{video.title}</span>
                        <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: "auto" }}>{video.duration}</span>
                      </button>
                      {editing && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => renameVideo(mod.id, video.id, video.title)} className="rounded-md p-1" style={{ color: "var(--muted-foreground)" }}><Pencil size={10} /></button>
                          <button onClick={() => deleteVideo(mod.id, video.id)} className="rounded-md p-1" style={{ color: "var(--danger-text)" }}><Trash2 size={10} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
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
