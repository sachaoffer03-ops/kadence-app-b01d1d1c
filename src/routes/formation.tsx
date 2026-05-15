import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, MoreVertical, Pencil, Trash2, GripVertical, ArrowUp, ArrowDown,
  GraduationCap, Video, FileText, StickyNote, LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useTrainingFolders, useFolderWithContent, useAllTrainingProgress,
  softDeleteFolder, reorderFolders, deleteStep, reorderSteps,
  deleteResource, reorderResources,
} from "@/hooks/use-training";
import { getFolderIcon, DEFAULT_FOLDER_COLOR } from "@/lib/training-presets";
import { FolderModal } from "@/components/training/FolderModal";
import { StepModal } from "@/components/training/StepModal";
import { ResourceModal } from "@/components/training/ResourceModal";
import { ProgressDashboard } from "@/components/training/ProgressDashboard";
import type { TrainingFolder, TrainingStep, TrainingResource, ResourceType } from "@/types/training";

export const Route = createFileRoute("/formation")({
  component: FormationPage,
  head: () => ({ meta: [{ title: "Formation — Kadence" }] }),
});

function FormationPage() {
  const { folders, loading } = useTrainingFolders();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: folderDetail, reload } = useFolderWithContent(activeId);
  const { progress } = useAllTrainingProgress();

  const [folderModal, setFolderModal] = useState<{ open: boolean; folder?: TrainingFolder | null }>({ open: false });
  const [stepModal, setStepModal] = useState<{ open: boolean; step?: TrainingStep | null }>({ open: false });
  const [resourceModal, setResourceModal] = useState<{ open: boolean; stepId: string; resource?: TrainingResource | null }>({ open: false, stepId: "" });
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId && folders.length > 0) setActiveId(folders[0].id);
    if (activeId && folders.length > 0 && !folders.find((f) => f.id === activeId)) {
      setActiveId(folders[0]?.id ?? null);
    }
  }, [folders, activeId]);

  // Stats par dossier (pour la sidebar)
  const folderStats = useMemo(() => {
    const stats: Record<string, { steps: number; resources: number }> = {};
    folders.forEach((f) => { stats[f.id] = { steps: 0, resources: 0 }; });
    if (folderDetail) {
      stats[folderDetail.id] = {
        steps: folderDetail.steps.length,
        resources: folderDetail.steps.reduce((acc, s) => acc + s.resources.length, 0),
      };
    }
    return stats;
  }, [folders, folderDetail]);

  const moveFolder = async (id: string, dir: -1 | 1) => {
    const idx = folders.findIndex((f) => f.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= folders.length) return;
    const reordered = [...folders];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    await reorderFolders(reordered.map((f) => f.id));
  };

  const moveStep = async (stepId: string, dir: -1 | 1) => {
    if (!folderDetail) return;
    const steps = folderDetail.steps;
    const idx = steps.findIndex((s) => s.id === stepId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const reordered = [...steps];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    await reorderSteps(reordered.map((s) => s.id));
  };

  const moveResource = async (stepId: string, resId: string, dir: -1 | 1) => {
    const step = folderDetail?.steps.find((s) => s.id === stepId);
    if (!step) return;
    const idx = step.resources.findIndex((r) => r.id === resId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= step.resources.length) return;
    const reordered = [...step.resources];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    await reorderResources(reordered.map((r) => r.id));
  };

  const removeFolder = async (id: string) => {
    if (!confirm("Supprimer ce dossier ? Les étapes et ressources seront aussi supprimées.")) return;
    await softDeleteFolder(id);
    toast.success("Dossier supprimé");
    setOpenMenu(null);
  };

  const removeStep = async (id: string) => {
    if (!confirm("Supprimer cette étape et ses ressources ?")) return;
    await deleteStep(id);
    toast.success("Étape supprimée");
  };

  const removeResource = async (id: string) => {
    if (!confirm("Supprimer cette ressource ?")) return;
    await deleteResource(id);
    toast.success("Ressource supprimée");
  };

  const activeFolder = folders.find((f) => f.id === activeId) ?? null;

  if (loading) {
    return <div className="p-4 md:p-6" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Formation</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Plateforme de formation interne pour ton équipe.</p>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="mb-4">
          <TabsTrigger value="content">Contenu</TabsTrigger>
          <TabsTrigger value="progress">Progression</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(280px, 320px) 1fr" }}>
            {/* SIDEBAR */}
            <aside>
              <div className="flex items-center justify-between mb-3">
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Dossiers
                </div>
                <button onClick={() => setFolderModal({ open: true, folder: null })}
                  className="rounded-md p-1.5 flex items-center gap-1"
                  style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                  <Plus size={12} /> Nouveau
                </button>
              </div>

              {folders.length === 0 ? (
                <div className="rounded-xl border px-4 py-8 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                  <GraduationCap size={24} style={{ color: "var(--muted-foreground)", margin: "0 auto 8px" }} />
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Aucun dossier</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Crée ton premier dossier pour commencer.</div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {folders.map((f, idx) => {
                    const Icon = getFolderIcon(f.icon);
                    const color = f.color || DEFAULT_FOLDER_COLOR;
                    const active = activeId === f.id;
                    const stats = folderStats[f.id] || { steps: 0, resources: 0 };
                    return (
                      <div key={f.id} className="rounded-xl border relative"
                        style={{
                          backgroundColor: active ? "var(--coral-light)" : "var(--card)",
                          borderColor: active ? "var(--coral)" : "var(--border)",
                        }}>
                        <button onClick={() => setActiveId(f.id)} className="w-full text-left p-3 flex items-start gap-2.5">
                          <div className="rounded-lg flex items-center justify-center shrink-0"
                            style={{ width: 32, height: 32, backgroundColor: color, color: "#fff" }}>
                            <Icon size={16} />
                          </div>
                          <div className="flex-1 min-w-0 pr-6">
                            <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }} className="truncate">{f.name}</div>
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                              {stats.steps} étape{stats.steps !== 1 ? "s" : ""} · {stats.resources} ressource{stats.resources !== 1 ? "s" : ""}
                            </div>
                            {f.required_for_roles.length > 0 && (
                              <span className="inline-block mt-1.5 rounded-full px-1.5 py-0.5"
                                style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}>
                                Requis
                              </span>
                            )}
                          </div>
                        </button>

                        <button onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === f.id ? null : f.id); }}
                          className="absolute top-2 right-2 rounded p-1 hover:bg-muted">
                          <MoreVertical size={13} />
                        </button>

                        {openMenu === f.id && (
                          <div className="absolute top-9 right-2 z-10 rounded-lg shadow-lg py-1 min-w-[140px]"
                            style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                            <button onClick={() => { setFolderModal({ open: true, folder: f }); setOpenMenu(null); }}
                              className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2"
                              style={{ fontSize: 12 }}>
                              <Pencil size={11} /> Modifier
                            </button>
                            {idx > 0 && (
                              <button onClick={() => { moveFolder(f.id, -1); setOpenMenu(null); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2"
                                style={{ fontSize: 12 }}>
                                <ArrowUp size={11} /> Monter
                              </button>
                            )}
                            {idx < folders.length - 1 && (
                              <button onClick={() => { moveFolder(f.id, 1); setOpenMenu(null); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2"
                                style={{ fontSize: 12 }}>
                                <ArrowDown size={11} /> Descendre
                              </button>
                            )}
                            <button onClick={() => removeFolder(f.id)}
                              className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2"
                              style={{ fontSize: 12, color: "var(--danger-text)" }}>
                              <Trash2 size={11} /> Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>

            {/* MAIN ZONE */}
            <main>
              {!activeFolder ? (
                <div className="rounded-xl border px-6 py-12 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                  <GraduationCap size={32} style={{ color: "var(--muted-foreground)", margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucun dossier sélectionné</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Crée ou sélectionne un dossier dans la liste à gauche.</div>
                </div>
              ) : (
                <FolderContent
                  folder={activeFolder}
                  detail={folderDetail}
                  progress={progress}
                  onEditFolder={() => setFolderModal({ open: true, folder: activeFolder })}
                  onAddStep={() => setStepModal({ open: true, step: null })}
                  onEditStep={(s) => setStepModal({ open: true, step: s })}
                  onDeleteStep={removeStep}
                  onMoveStep={moveStep}
                  onAddResource={(stepId) => setResourceModal({ open: true, stepId, resource: null })}
                  onEditResource={(stepId, r) => setResourceModal({ open: true, stepId, resource: r })}
                  onDeleteResource={removeResource}
                  onMoveResource={moveResource}
                />
              )}
            </main>
          </div>
        </TabsContent>

        <TabsContent value="progress">
          <ProgressDashboard />
        </TabsContent>
      </Tabs>

      <FolderModal open={folderModal.open} onOpenChange={(v) => setFolderModal({ open: v })}
        folder={folderModal.folder} onSaved={() => {}} />
      {activeFolder && (
        <StepModal open={stepModal.open} onOpenChange={(v) => setStepModal({ open: v })}
          folderId={activeFolder.id} step={stepModal.step} onSaved={reload} />
      )}
      {activeFolder && resourceModal.stepId && (
        <ResourceModal open={resourceModal.open} onOpenChange={(v) => setResourceModal({ ...resourceModal, open: v })}
          folderId={activeFolder.id} stepId={resourceModal.stepId}
          resource={resourceModal.resource} onSaved={reload} />
      )}
    </div>
  );
}

// ============= FOLDER CONTENT =============

const RESOURCE_ICONS: Record<ResourceType, React.ElementType> = {
  video: Video, pdf: FileText, note: StickyNote, link: LinkIcon,
};
const RESOURCE_LABELS: Record<ResourceType, string> = {
  video: "Vidéo", pdf: "PDF", note: "Note", link: "Lien",
};

interface FolderContentProps {
  folder: TrainingFolder;
  detail: ReturnType<typeof useFolderWithContent>["data"];
  progress: ReturnType<typeof useAllTrainingProgress>["progress"];
  onEditFolder: () => void;
  onAddStep: () => void;
  onEditStep: (s: TrainingStep) => void;
  onDeleteStep: (id: string) => void;
  onMoveStep: (id: string, dir: -1 | 1) => void;
  onAddResource: (stepId: string) => void;
  onEditResource: (stepId: string, r: TrainingResource) => void;
  onDeleteResource: (id: string) => void;
  onMoveResource: (stepId: string, resId: string, dir: -1 | 1) => void;
}

function FolderContent({
  folder, detail, progress, onEditFolder, onAddStep, onEditStep, onDeleteStep,
  onMoveStep, onAddResource, onEditResource, onDeleteResource, onMoveResource,
}: FolderContentProps) {
  const Icon = getFolderIcon(folder.icon);
  const color = folder.color || DEFAULT_FOLDER_COLOR;
  const steps = detail?.steps || [];
  const totalResources = steps.reduce((acc, s) => acc + s.resources.length, 0);

  const allResIds = steps.flatMap((s) => s.resources.map((r) => r.id));
  const usersStarted = new Set(progress.filter((p) => allResIds.includes(p.resource_id)).map((p) => p.user_id));
  const completionsPerResource: Record<string, number> = {};
  progress.forEach((p) => {
    if (p.status === "completed") completionsPerResource[p.resource_id] = (completionsPerResource[p.resource_id] || 0) + 1;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-start gap-3">
          <div className="rounded-xl flex items-center justify-center shrink-0"
            style={{ width: 48, height: 48, backgroundColor: color, color: "#fff" }}>
            <Icon size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 style={{ fontSize: 16, fontWeight: 500 }}>{folder.name}</h2>
              {folder.required_for_roles.length > 0 && (
                <span className="rounded-full px-2 py-0.5"
                  style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}>
                  Requis : {folder.required_for_roles.join(", ")}
                </span>
              )}
            </div>
            {folder.description && (
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{folder.description}</div>
            )}
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 8 }}>
              {steps.length} étape{steps.length !== 1 ? "s" : ""} · {totalResources} ressource{totalResources !== 1 ? "s" : ""} · {usersStarted.size} employé{usersStarted.size !== 1 ? "s" : ""} ont commencé
            </div>
          </div>
          <button onClick={onEditFolder} className="rounded-md p-2" style={{ border: "0.5px solid var(--border)" }}>
            <Pencil size={13} />
          </button>
        </div>
      </div>

      {/* Steps */}
      {steps.length === 0 ? (
        <div className="rounded-xl border px-6 py-10 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Aucune étape</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>Ajoute une première étape à ce dossier.</div>
          <button onClick={onAddStep} className="rounded-md px-3 py-2 inline-flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            <Plus size={12} /> Ajouter une étape
          </button>
        </div>
      ) : (
        <>
          {steps.map((step, sIdx) => (
            <div key={step.id} className="rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3 p-3" style={{ borderBottom: step.resources.length > 0 ? "0.5px solid var(--border)" : "none" }}>
                <div className="rounded-md flex items-center justify-center shrink-0"
                  style={{ width: 24, height: 24, backgroundColor: "var(--muted)", fontSize: 11, fontWeight: 500 }}>
                  {sIdx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{step.title}</div>
                  {step.description && (
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{step.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {sIdx > 0 && (
                    <button onClick={() => onMoveStep(step.id, -1)} className="rounded p-1 hover:bg-muted"><ArrowUp size={12} /></button>
                  )}
                  {sIdx < steps.length - 1 && (
                    <button onClick={() => onMoveStep(step.id, 1)} className="rounded p-1 hover:bg-muted"><ArrowDown size={12} /></button>
                  )}
                  <button onClick={() => onEditStep(step)} className="rounded p-1 hover:bg-muted"><Pencil size={12} /></button>
                  <button onClick={() => onDeleteStep(step.id)} className="rounded p-1 hover:bg-muted" style={{ color: "var(--danger-text)" }}><Trash2 size={12} /></button>
                </div>
              </div>

              {step.resources.length > 0 && (
                <div className="flex flex-col">
                  {step.resources.map((r, rIdx) => {
                    const RIcon = RESOURCE_ICONS[r.type];
                    const completedCount = completionsPerResource[r.id] || 0;
                    return (
                      <div key={r.id} className="flex items-center gap-3 px-3 py-2.5"
                        style={{ borderTop: rIdx > 0 ? "0.5px solid var(--border)" : "none" }}>
                        <RIcon size={14} style={{ color: "var(--muted-foreground)" }} />
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{r.title}</div>
                          <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>
                            {RESOURCE_LABELS[r.type]} · {completedCount} complété{completedCount !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {rIdx > 0 && (
                            <button onClick={() => onMoveResource(step.id, r.id, -1)} className="rounded p-1 hover:bg-muted"><ArrowUp size={11} /></button>
                          )}
                          {rIdx < step.resources.length - 1 && (
                            <button onClick={() => onMoveResource(step.id, r.id, 1)} className="rounded p-1 hover:bg-muted"><ArrowDown size={11} /></button>
                          )}
                          <button onClick={() => onEditResource(step.id, r)} className="rounded p-1 hover:bg-muted"><Pencil size={11} /></button>
                          <button onClick={() => onDeleteResource(r.id)} className="rounded p-1 hover:bg-muted" style={{ color: "var(--danger-text)" }}><Trash2 size={11} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="px-3 py-2" style={{ borderTop: "0.5px solid var(--border)" }}>
                <button onClick={() => onAddResource(step.id)} className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted"
                  style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  <Plus size={11} /> Ajouter une ressource
                </button>
              </div>
            </div>
          ))}

          <button onClick={onAddStep} className="rounded-xl py-3 flex items-center justify-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, border: "1px dashed var(--border)", backgroundColor: "var(--card)" }}>
            <Plus size={12} /> Ajouter une étape
          </button>
        </>
      )}
    </div>
  );
}
