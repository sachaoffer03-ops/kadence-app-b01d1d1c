import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { GraduationCap, Play, ChevronDown, ChevronUp, Bell, Check, Plus, Pencil, Trash2, X, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trainingPaths as seedPaths, roleColors, employees, type TrainingPath, type TrainingModule, type Role } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { Dropdown } from "@/components/Dropdown";

type VideoItem = TrainingModule["videos"][number] & { url?: string; storagePath?: string };

const formatDuration = (sec: number): string => {
  if (!isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
};

const probeDuration = (file: File): Promise<number> => new Promise((resolve) => {
  try {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
  } catch { resolve(0); }
});

export const Route = createFileRoute("/formation")({
  component: FormationPage,
  head: () => ({ meta: [{ title: "Formation — Kadence" }] }),
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
  const lateEmployees = employees.slice(0, 4).map((e, i) => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    role: e.roles[0],
    studio: e.studio,
    progress: [35, 50, 20, 60][i] ?? 40,
    lastSeen: ["Il y a 8j", "Il y a 5j", "Il y a 12j", "Il y a 3j"][i] ?? "Récent",
  }));
  const lateCount = lateEmployees.length;
  const [showLate, setShowLate] = useState(false);

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

  // ── Video upload ────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTarget = useRef<{ pathId: string; modId: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null); // module id being uploaded to
  const [playing, setPlaying] = useState<{ url: string; title: string } | null>(null);

  const triggerUpload = (pathId: string, modId: string) => {
    pendingTarget.current = { pathId, modId };
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = pendingTarget.current;
    if (!file || !target) return;
    if (!file.type.startsWith("video/")) { toast.error("Le fichier doit être une vidéo"); return; }

    setUploading(target.modId);
    try {
      const duration = await probeDuration(file);
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${target.pathId}/${target.modId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("formation-videos").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("formation-videos").getPublicUrl(path);
      const baseTitle = file.name.replace(/\.[^.]+$/, "");
      const newVideo: VideoItem = {
        id: `vid-${Date.now()}`,
        title: baseTitle,
        duration: formatDuration(duration),
        url: data.publicUrl,
        storagePath: path,
      };
      setPaths((prev) => prev.map((p) => p.id !== target.pathId ? p : recount({
        ...p,
        modules: p.modules.map((m) => m.id !== target.modId ? m : { ...m, videos: [...m.videos, newVideo] }),
      })));
      toast.success(`"${baseTitle}" uploadée`);
    } catch (err) {
      console.error(err);
      toast.error("Échec de l'upload");
    } finally {
      setUploading(null);
      pendingTarget.current = null;
    }
  };

  const playVideo = (url: string | undefined, title: string) => {
    if (!url) { toast.info("Aucune vidéo associée — utilise le mode édition pour en uploader une"); return; }
    setPlaying({ url, title });
  };

  return (
    <div className="p-6">
      <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFile} style={{ display: "none" }} />
      {playing && <VideoPlayerModal url={playing.url} title={playing.title} onClose={() => setPlaying(null)} />}
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
        <MiniKpi label="En retard" value={lateCount.toString()} color="var(--warning-text)" sub="employés" onClick={() => setShowLate(true)} />
      </div>

      {showLate && (
        <LateEmployeesModal
          employees={lateEmployees}
          onClose={() => setShowLate(false)}
          onRemind={(name) => toast.success(`Rappel envoyé à ${name}`)}
          onRemindAll={() => { toast.success(`Rappel envoyé à ${lateCount} employés`); setShowLate(false); }}
        />
      )}

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
            completed={completed} onToggleVideo={toggleVideo}
            uploading={uploading} onUpload={(modId) => triggerUpload(path.id, modId)}
            onPlayVideo={playVideo} />
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
            completed={completed} onToggleVideo={toggleVideo}
            uploading={uploading} onUpload={(modId: string) => triggerUpload(path.id, modId)}
            onPlayVideo={playVideo} />
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
          <Dropdown value={role} options={allRoles} onChange={(v) => setRole(v as Role)} minWidth={180} />
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
  uploading, onUpload, onPlayVideo,
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
  uploading: string | null;
  onUpload: (modId: string) => void;
  onPlayVideo: (url: string | undefined, title: string) => void;
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
  const renameVideo = (modId: string, vidId: string, current: string) => {
    const t = window.prompt("Titre de la vidéo", current);
    if (t && t.trim()) onUpdate((p) => ({
      ...p,
      modules: p.modules.map((m) => m.id === modId
        ? { ...m, videos: m.videos.map((v) => v.id === vidId ? { ...v, title: t.trim() } : v) }
        : m),
    }));
  };
  const deleteVideo = async (modId: string, video: VideoItem) => {
    const sp = video.storagePath;
    if (sp) { try { await supabase.storage.from("formation-videos").remove([sp]); } catch (e) { console.error(e); } }
    onUpdate((p) => ({
      ...p,
      modules: p.modules.map((m) => m.id === modId
        ? { ...m, videos: m.videos.filter((v) => v.id !== video.id) }
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
                    <button onClick={() => onUpload(mod.id)} disabled={uploading === mod.id} className="rounded-md p-1 flex items-center gap-1" style={{ fontSize: 10, color: "var(--coral-dark)" }}>
                      {uploading === mod.id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} {uploading === mod.id ? "Upload..." : "vidéo"}
                    </button>
                    <button onClick={() => deleteModule(mod.id)} className="rounded-md p-1" style={{ color: "var(--danger-text)" }}><Trash2 size={11} /></button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 ml-4">
                {mod.videos.length === 0 && !editing && (
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", padding: "4px 8px" }}>Aucune vidéo</div>
                )}
                {mod.videos.map((rawVideo) => {
                  const video = rawVideo as VideoItem;
                  const isDone = completed.has(video.id);
                  return (
                    <div key={video.id} className="flex items-center gap-2 rounded-md px-2 py-1.5"
                      style={{ backgroundColor: isDone ? "var(--success-bg)" : "transparent" }}>
                      <button
                        onClick={() => { onPlayVideo(video.url, video.title); if (video.url) onToggleVideo(video.id, video.title); }}
                        className="flex items-center gap-2 flex-1 text-left">
                        {isDone ? <Check size={12} style={{ color: "var(--success-text)" }} /> : <Play size={12} style={{ color: "var(--coral)" }} />}
                        <span style={{ fontSize: 12, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--success-text)" : "var(--foreground)" }}>{video.title}</span>
                        {!video.url && <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>sans fichier</span>}
                        <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: "auto" }}>{video.duration}</span>
                      </button>
                      {editing && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => renameVideo(mod.id, video.id, video.title)} className="rounded-md p-1" style={{ color: "var(--muted-foreground)" }}><Pencil size={10} /></button>
                          <button onClick={() => deleteVideo(mod.id, video)} className="rounded-md p-1" style={{ color: "var(--danger-text)" }}><Trash2 size={10} /></button>
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

function MiniKpi({ label, value, sub, color, onClick }: { label: string; value: string; sub?: string; color?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl border p-4"
      style={{
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 120ms",
      }}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--coral)"; }}
      onMouseLeave={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}
    >
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 22, fontWeight: 500, color: color || "var(--foreground)" }}>{value}</span>
        {sub && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{sub}</span>}
        {onClick && <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: "auto" }}>Voir →</span>}
      </div>
    </div>
  );
}

type LateEmp = { id: string; name: string; role: Role; studio: string; progress: number; lastSeen: string };

function LateEmployeesModal({ employees, onClose, onRemind, onRemindAll }: {
  employees: LateEmp[];
  onClose: () => void;
  onRemind: (name: string) => void;
  onRemindAll: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="rounded-xl overflow-hidden w-full max-w-md mx-4" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Employés en retard</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{employees.length} personnes à relancer</div>
          </div>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}><X size={16} /></button>
        </div>
        <div className="flex flex-col">
          {employees.map((e) => {
            const rc = roleColors[e.role];
            return (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</span>
                    <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: rc.bg, color: rc.text }}>{e.role}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    <span>{e.studio.replace("Skult ", "")}</span>
                    <span>·</span>
                    <span>{e.progress}% complété</span>
                    <span>·</span>
                    <span>{e.lastSeen}</span>
                  </div>
                </div>
                <button onClick={() => onRemind(e.name)} className="rounded-md px-2.5 py-1 flex items-center gap-1"
                  style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)" }}>
                  <Bell size={11} /> Rappel
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-3" style={{ backgroundColor: "var(--background)" }}>
          <button onClick={onClose} className="rounded-md px-3 py-1.5" style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>Fermer</button>
          <button onClick={onRemindAll} className="rounded-md px-3 py-1.5 flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            <Bell size={12} /> Rappel à tous
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoPlayerModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="rounded-xl overflow-hidden w-full max-w-3xl mx-4" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}><X size={16} /></button>
        </div>
        <video src={url} controls autoPlay style={{ width: "100%", maxHeight: "70vh", backgroundColor: "#000" }} />
      </div>
    </div>
  );
}
