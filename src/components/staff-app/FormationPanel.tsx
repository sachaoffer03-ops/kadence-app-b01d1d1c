import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check, ChevronLeft, ChevronRight, GraduationCap, Play, FileText,
  StickyNote, Link as LinkIcon, ExternalLink, Sparkles,
} from "lucide-react";
import {
  useTrainingFolders, useFolderWithContent, useMyTrainingProgress,
  markResourceStatus, getTrainingFileUrl,
} from "@/hooks/use-training";
import { getFolderIcon, detectVideoEmbed, DEFAULT_FOLDER_COLOR } from "@/lib/training-presets";
import { supabase } from "@/integrations/supabase/client";
import type { TrainingResource } from "@/types/training";

export function FormationPanel({ userId }: { userId: string }) {
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeResource, setActiveResource] = useState<TrainingResource | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("user_business_roles").select("role").eq("user_id", userId);
      setUserRoles((data ?? []).map((r: any) => r.role as string));
    })();
  }, [userId]);

  const { folders, loading } = useTrainingFolders();
  const { progress } = useMyTrainingProgress();
  const completedIds = useMemo(
    () => new Set(progress.filter(p => p.status === "completed").map(p => p.resource_id)),
    [progress]
  );

  if (activeResource) {
    return (
      <ResourceViewer
        resource={activeResource}
        completed={completedIds.has(activeResource.id)}
        onBack={() => setActiveResource(null)}
        onComplete={async () => {
          try {
            await markResourceStatus(activeResource.id, "completed");
            toast.success("Ressource validée ✓");
            setActiveResource(null);
          } catch { toast.error("Erreur"); }
        }}
      />
    );
  }

  if (activeFolderId) {
    return (
      <FolderDetail
        folderId={activeFolderId}
        completedIds={completedIds}
        onBack={() => setActiveFolderId(null)}
        onOpenResource={setActiveResource}
      />
    );
  }

  return (
    <FolderList
      loading={loading}
      folders={folders}
      userRoles={userRoles}
      completedIds={completedIds}
      onOpen={setActiveFolderId}
    />
  );
}

/* ─── Folder list (home) ─── */

function FolderList({
  loading, folders, userRoles, completedIds, onOpen,
}: {
  loading: boolean;
  folders: ReturnType<typeof useTrainingFolders>["folders"];
  userRoles: string[];
  completedIds: Set<string>;
  onOpen: (id: string) => void;
}) {
  // For each folder, fetch resource count + completed count via progress
  const [counts, setCounts] = useState<Record<string, { total: number; done: number }>>({});

  useEffect(() => {
    if (folders.length === 0) { setCounts({}); return; }
    (async () => {
      const ids = folders.map(f => f.id);
      const { data: steps } = await supabase
        .from("training_steps" as any).select("id,folder_id").in("folder_id", ids);
      const stepIds = (steps as any[] ?? []).map(s => s.id);
      if (stepIds.length === 0) { setCounts(Object.fromEntries(ids.map(id => [id, { total: 0, done: 0 }]))); return; }
      const { data: res } = await supabase
        .from("training_resources" as any).select("id,step_id").in("step_id", stepIds);
      const resByFolder: Record<string, string[]> = {};
      const stepFolder = new Map((steps as any[] ?? []).map(s => [s.id, s.folder_id]));
      for (const r of (res as any[] ?? [])) {
        const fid = stepFolder.get(r.step_id);
        if (!fid) continue;
        (resByFolder[fid] ||= []).push(r.id);
      }
      const out: Record<string, { total: number; done: number }> = {};
      for (const id of ids) {
        const list = resByFolder[id] ?? [];
        out[id] = { total: list.length, done: list.filter(rid => completedIds.has(rid)).length };
      }
      setCounts(out);
    })();
  }, [folders, completedIds]);

  if (loading) {
    return <div className="px-5 pt-12" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</div>;
  }

  const isMandatory = (roles: string[]) =>
    roles.length > 0 && roles.some(r => userRoles.includes(r));

  const totalRes = Object.values(counts).reduce((a, c) => a + c.total, 0);
  const totalDone = Object.values(counts).reduce((a, c) => a + c.done, 0);
  const totalPct = totalRes > 0 ? Math.round((totalDone / totalRes) * 100) : 0;

  return (
    <div className="px-5 pt-12">
      <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Formations</div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>
        Tes modules à suivre.
      </div>

      {totalRes > 0 && (
        <div className="rounded-xl mb-5 p-4" style={{ background: "linear-gradient(135deg, #1A1A1A, #2A2A28)" }}>
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--coral)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Progression
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{totalDone}/{totalRes}</div>
          </div>
          <div style={{ width: "100%", height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)" }}>
            <div style={{ width: `${totalPct}%`, height: "100%", borderRadius: 2, backgroundColor: "var(--coral)" }} />
          </div>
        </div>
      )}

      {folders.length === 0 ? (
        <div className="rounded-xl px-4 py-10 text-center" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <GraduationCap size={28} style={{ color: "var(--muted-foreground)", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Aucune formation pour l'instant</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Ton admin t'en assignera bientôt.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {folders.map(f => {
            const c = counts[f.id] ?? { total: 0, done: 0 };
            const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
            const done = c.total > 0 && c.done === c.total;
            const mandatory = isMandatory(f.required_for_roles ?? []);
            const Icon = getFolderIcon(f.icon);
            const color = f.color || DEFAULT_FOLDER_COLOR;
            return (
              <button
                key={f.id}
                onClick={() => onOpen(f.id)}
                className="w-full rounded-xl p-4 text-left flex items-center gap-3 transition-transform active:scale-[0.99]"
                style={{
                  backgroundColor: "#fff",
                  border: `0.5px solid ${done ? "var(--success-text)" : "rgba(0,0,0,0.08)"}`,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                <div
                  className="rounded-lg flex items-center justify-center shrink-0"
                  style={{ width: 44, height: 44, backgroundColor: `${color}22`, color }}
                >
                  <Icon size={20} strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div style={{ fontSize: 14, fontWeight: 500 }} className="truncate">{f.name}</div>
                    {mandatory && (
                      <span className="rounded-full px-1.5 py-0.5 shrink-0"
                        style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)", letterSpacing: "0.04em" }}>
                        OBLIGATOIRE
                      </span>
                    )}
                    {done && (
                      <span className="rounded-full px-1.5 py-0.5 shrink-0"
                        style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--success-text)", color: "#fff" }}>
                        Terminé ✓
                      </span>
                    )}
                  </div>
                  {f.description && (
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }} className="truncate">
                      {f.description}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.06)" }}>
                      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, backgroundColor: done ? "var(--success-text)" : color }} />
                    </div>
                    <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 500 }}>
                      {c.done}/{c.total}
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Folder detail ─── */

function FolderDetail({
  folderId, completedIds, onBack, onOpenResource,
}: {
  folderId: string;
  completedIds: Set<string>;
  onBack: () => void;
  onOpenResource: (r: TrainingResource) => void;
}) {
  const { data, loading } = useFolderWithContent(folderId);

  if (loading || !data) {
    return (
      <div className="px-5 pt-12">
        <button onClick={onBack} className="flex items-center gap-1 mb-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          <ChevronLeft size={14} /> Toutes les formations
        </button>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</div>
      </div>
    );
  }

  const allRes = data.steps.flatMap(s => s.resources);
  const done = allRes.filter(r => completedIds.has(r.id)).length;
  const pct = allRes.length > 0 ? Math.round((done / allRes.length) * 100) : 0;
  const fullyDone = allRes.length > 0 && done === allRes.length;
  const Icon = getFolderIcon(data.icon);
  const color = data.color || DEFAULT_FOLDER_COLOR;

  return (
    <div className="px-5 pt-12 pb-6">
      <button onClick={onBack} className="flex items-center gap-1 mb-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        <ChevronLeft size={14} /> Toutes les formations
      </button>

      <div className="flex items-start gap-3 mb-2">
        <div className="rounded-xl flex items-center justify-center shrink-0"
          style={{ width: 48, height: 48, backgroundColor: `${color}22`, color }}>
          <Icon size={22} strokeWidth={1.6} />
        </div>
        <div className="flex-1">
          <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.2 }}>{data.name}</div>
          {data.description && (
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{data.description}</div>
          )}
        </div>
      </div>

      {fullyDone && (
        <div className="rounded-xl p-3 my-4 flex items-center gap-2"
          style={{ backgroundColor: "var(--success-bg)", border: `0.5px solid var(--success-text)` }}>
          <Sparkles size={14} style={{ color: "var(--success-text)" }} />
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--success-text)" }}>
            Bravo, dossier complété !
          </div>
        </div>
      )}

      <div className="my-4">
        <div style={{ width: "100%", height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.06)" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, backgroundColor: fullyDone ? "var(--success-text)" : color }} />
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>{done}/{allRes.length} ressources</div>
      </div>

      <div className="flex flex-col gap-5 mt-6">
        {data.steps.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Aucune étape pour le moment.</div>
        )}
        {data.steps.map((step, i) => (
          <section key={step.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full flex items-center justify-center"
                style={{ width: 22, height: 22, backgroundColor: color, color: "#fff", fontSize: 11, fontWeight: 500 }}>
                {i + 1}
              </span>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{step.title}</div>
            </div>
            {step.description && (
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8, marginLeft: 30 }}>
                {step.description}
              </div>
            )}
            <div className="flex flex-col gap-2 ml-7" style={{ borderLeft: "1px dashed rgba(0,0,0,0.1)", paddingLeft: 12 }}>
              {step.resources.length === 0 && (
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Aucune ressource.</div>
              )}
              {step.resources.map(r => (
                <ResourceRow key={r.id} resource={r} completed={completedIds.has(r.id)} onOpen={() => onOpenResource(r)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ResourceRow({ resource, completed, onOpen }: { resource: TrainingResource; completed: boolean; onOpen: () => void }) {
  const Icon = resource.type === "video" ? Play
    : resource.type === "pdf" ? FileText
    : resource.type === "note" ? StickyNote
    : LinkIcon;
  return (
    <button
      onClick={onOpen}
      className="rounded-lg p-3 flex items-center gap-3 text-left transition-transform active:scale-[0.99]"
      style={{
        backgroundColor: completed ? "var(--success-bg)" : "#fff",
        border: `0.5px solid ${completed ? "var(--success-text)" : "rgba(0,0,0,0.08)"}`,
      }}
    >
      <div className="rounded-md flex items-center justify-center shrink-0"
        style={{
          width: 32, height: 32,
          backgroundColor: completed ? "var(--success-text)" : "var(--coral-light)",
          color: completed ? "#fff" : "var(--coral-dark)",
        }}>
        {completed ? <Check size={15} /> : <Icon size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 13, fontWeight: 500 }} className="truncate">{resource.title}</div>
        <div style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {resource.type}
        </div>
      </div>
      <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
    </button>
  );
}

/* ─── Resource viewer ─── */

function ResourceViewer({
  resource, completed, onBack, onComplete,
}: {
  resource: TrainingResource;
  completed: boolean;
  onBack: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="px-5 pt-12 pb-6">
      <button onClick={onBack} className="flex items-center gap-1 mb-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        <ChevronLeft size={14} /> Retour
      </button>

      <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 12, lineHeight: 1.2 }}>{resource.title}</div>

      <div className="mb-5">
        {resource.type === "video" && <VideoView resource={resource} />}
        {resource.type === "pdf" && <PdfView path={resource.content} />}
        {resource.type === "note" && <NoteView content={resource.content} />}
        {resource.type === "link" && <LinkView url={resource.content} />}
      </div>

      {completed ? (
        <div className="rounded-md py-3 text-center" style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
          <Check size={14} className="inline mr-1.5" /> Ressource déjà validée
        </div>
      ) : (
        <button
          onClick={onComplete}
          className="w-full rounded-md py-3 transition-transform active:scale-[0.99]"
          style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--coral)", color: "#1A1614" }}
        >
          Marquer comme terminé
        </button>
      )}
    </div>
  );
}

function VideoView({ url }: { url: string }) {
  const { embedUrl, provider } = detectVideoEmbed(url);
  if (provider === "other") {
    return (
      <div className="rounded-xl flex items-center justify-center" style={{ height: 200, backgroundColor: "var(--muted)", fontSize: 12 }}>
        <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--coral-dark)" }}>
          Ouvrir la vidéo <ExternalLink size={12} className="inline ml-1" />
        </a>
      </div>
    );
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9", backgroundColor: "#000" }}>
      <iframe src={embedUrl} className="w-full h-full" allow="accelerometer; autoplay; encrypted-media; fullscreen" />
    </div>
  );
}

function PdfView({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { (async () => {
    try { setUrl(await getTrainingFileUrl(path)); } catch { setError(true); }
  })(); }, [path]);
  if (error) return <div style={{ fontSize: 12, color: "var(--destructive)" }}>Impossible de charger le PDF.</div>;
  if (!url) return <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>;
  return (
    <div>
      <iframe src={url} className="w-full rounded-xl" style={{ height: 480, border: "0.5px solid rgba(0,0,0,0.08)" }} />
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2"
        style={{ fontSize: 12, color: "var(--coral-dark)" }}>
        Ouvrir dans un nouvel onglet <ExternalLink size={11} />
      </a>
    </div>
  );
}

function NoteView({ content }: { content: string }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--foreground)" }}>{content}</div>
    </div>
  );
}

function LinkView({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="rounded-xl p-4 flex items-center gap-3"
      style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}>
      <div className="rounded-md flex items-center justify-center"
        style={{ width: 40, height: 40, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)" }}>
        <LinkIcon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 2 }}>Lien externe</div>
        <div style={{ fontSize: 13, color: "var(--foreground)" }} className="truncate">{url}</div>
      </div>
      <ExternalLink size={14} style={{ color: "var(--muted-foreground)" }} />
    </a>
  );
}
