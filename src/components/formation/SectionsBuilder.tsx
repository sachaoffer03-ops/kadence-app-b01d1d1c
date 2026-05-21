import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Video, FileText, Image as ImageIcon, HelpCircle, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import {
  createSection, updateSection, deleteSection, reorderSections,
  createModule, updateModule, deleteModule, reorderModules,
  deleteContent, reorderContents,
} from "@/lib/formation.functions";
import { ContentEditModal } from "./ContentEditModal";
import { QuizEditModal } from "./QuizEditModal";
import { PromptDialog, type PromptVariant } from "./PromptDialog";
import { TYPE_COLOR, TYPE_LABEL, fmtDuration } from "./types";
import type { CourseFull, ContentType } from "./types";

interface Props {
  courseId: string;
  sections: CourseFull["sections"];
  onChange: () => void;
}

export function SectionsBuilder({ courseId, sections, onChange }: Props) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(sections.map((s) => s.id)));
  const [editing, setEditing] = useState<{ moduleId: string; type: ContentType; existing: any } | null>(null);
  const [editingQuiz, setEditingQuiz] = useState<{ moduleId: string; existing: any } | null>(null);
  const [promptDlg, setPromptDlg] = useState<{ variant: PromptVariant; initial?: string; onSubmit: (v: string) => Promise<void> } | null>(null);

  const createSec = useServerFn(createSection);
  const updateSec = useServerFn(updateSection);
  const deleteSec = useServerFn(deleteSection);
  const reorderSec = useServerFn(reorderSections);
  const createMod = useServerFn(createModule);
  const updateMod = useServerFn(updateModule);
  const deleteMod = useServerFn(deleteModule);
  const reorderMod = useServerFn(reorderModules);
  const deleteCont = useServerFn(deleteContent);
  const reorderCont = useServerFn(reorderContents);

  const toggle = (id: string) => {
    const next = new Set(openSections);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpenSections(next);
  };

  const handleAddSection = () => {
    setPromptDlg({
      variant: "section",
      onSubmit: async (title) => {
        try { await createSec({ data: { courseId, title } }); onChange(); }
        catch (e: any) { toast.error(e.message); }
      },
    });
  };

  const handleRenameSection = (id: string, current: string) => {
    setPromptDlg({
      variant: "rename",
      initial: current,
      onSubmit: async (title) => {
        if (title === current) return;
        try { await updateSec({ data: { sectionId: id, title } }); onChange(); }
        catch (e: any) { toast.error(e.message); }
      },
    });
  };

  const handleDeleteSection = async (id: string) => {
    if (!confirm("Supprimer cette section et tous ses modules ?")) return;
    try { await deleteSec({ data: { sectionId: id } }); onChange(); }
    catch (e: any) { toast.error(e.message); }
  };

  const moveSection = async (idx: number, dir: -1 | 1) => {
    const ids = sections.map((s) => s.id);
    const ni = idx + dir;
    if (ni < 0 || ni >= ids.length) return;
    [ids[idx], ids[ni]] = [ids[ni], ids[idx]];
    try { await reorderSec({ data: { courseId, orderedIds: ids } }); onChange(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleAddModule = (sectionId: string) => {
    setPromptDlg({
      variant: "module",
      onSubmit: async (title) => {
        try { await createMod({ data: { sectionId, title } }); onChange(); }
        catch (e: any) { toast.error(e.message); }
      },
    });
  };

  const handleRenameModule = (id: string, current: string) => {
    setPromptDlg({
      variant: "rename",
      initial: current,
      onSubmit: async (title) => {
        if (title === current) return;
        try { await updateMod({ data: { moduleId: id, title } }); onChange(); }
        catch (e: any) { toast.error(e.message); }
      },
    });
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm("Supprimer ce module et tout son contenu ?")) return;
    try { await deleteMod({ data: { moduleId: id } }); onChange(); }
    catch (e: any) { toast.error(e.message); }
  };

  const moveModule = async (sectionId: string, modules: any[], idx: number, dir: -1 | 1) => {
    const ids = modules.map((m) => m.id);
    const ni = idx + dir;
    if (ni < 0 || ni >= ids.length) return;
    [ids[idx], ids[ni]] = [ids[ni], ids[idx]];
    try { await reorderMod({ data: { sectionId, orderedIds: ids } }); onChange(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteContent = async (id: string) => {
    if (!confirm("Supprimer ce contenu ?")) return;
    try { await deleteCont({ data: { contentId: id } }); onChange(); }
    catch (e: any) { toast.error(e.message); }
  };

  const moveContent = async (moduleId: string, contents: any[], idx: number, dir: -1 | 1) => {
    const ids = contents.map((c) => c.id);
    const ni = idx + dir;
    if (ni < 0 || ni >= ids.length) return;
    [ids[idx], ids[ni]] = [ids[ni], ids[idx]];
    try { await reorderCont({ data: { moduleId, orderedIds: ids } }); onChange(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="flex flex-col gap-3">
      {sections.length === 0 && (
        <div className="rounded-xl p-6 text-center" style={{ backgroundColor: "var(--background)", fontSize: 12, color: "var(--muted-foreground)" }}>
          Aucune section. Crée la première ci-dessous.
        </div>
      )}

      {sections.map((sec, si) => {
        const isOpen = openSections.has(sec.id);
        const totalContents = sec.modules.reduce((acc: number, m: any) => acc + m.contents.length, 0);
        return (
          <div key={sec.id} className="rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button onClick={() => toggle(sec.id)} className="flex items-center gap-2 flex-1 text-left">
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span style={{ fontSize: 13, fontWeight: 500 }}>📌 Section {si + 1} · {sec.title}</span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  {sec.modules.length} module{sec.modules.length !== 1 ? "s" : ""} · {totalContents} contenus
                </span>
              </button>
              <IconBtn onClick={() => moveSection(si, -1)} disabled={si === 0}><ArrowUp size={12} /></IconBtn>
              <IconBtn onClick={() => moveSection(si, 1)} disabled={si === sections.length - 1}><ArrowDown size={12} /></IconBtn>
              <IconBtn onClick={() => handleRenameSection(sec.id, sec.title)}><Pencil size={12} /></IconBtn>
              <IconBtn onClick={() => handleDeleteSection(sec.id)} danger><Trash2 size={12} /></IconBtn>
            </div>

            {isOpen && (
              <div className="px-3 pb-3 flex flex-col gap-2" style={{ borderTop: "0.5px solid var(--border)", paddingTop: 10 }}>
                {sec.modules.map((mod: any, mi: number) => (
                  <div key={mod.id} className="rounded-lg" style={{ backgroundColor: "var(--background)", border: "0.5px solid var(--border)" }}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>{mi + 1}.</span>
                      <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{mod.title}</span>
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                        {mod.contents.length} contenus{mod.quiz ? ` · quiz ${mod.quiz.questions.length}q` : ""}
                      </span>
                      <IconBtn onClick={() => moveModule(sec.id, sec.modules, mi, -1)} disabled={mi === 0}><ArrowUp size={12} /></IconBtn>
                      <IconBtn onClick={() => moveModule(sec.id, sec.modules, mi, 1)} disabled={mi === sec.modules.length - 1}><ArrowDown size={12} /></IconBtn>
                      <IconBtn onClick={() => handleRenameModule(mod.id, mod.title)}><Pencil size={12} /></IconBtn>
                      <IconBtn onClick={() => handleDeleteModule(mod.id)} danger><Trash2 size={12} /></IconBtn>
                    </div>

                    <div className="px-3 pb-3 flex flex-col gap-1.5" style={{ borderTop: "0.5px solid var(--border)", paddingTop: 8 }}>
                      {mod.contents.map((c: any, ci: number) => {
                        const Icon = c.type === "video" ? Video : c.type === "image" ? ImageIcon : FileText;
                        return (
                          <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md" style={{ backgroundColor: "var(--card)" }}>
                            <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TYPE_COLOR[c.type as ContentType] }} />
                            <Icon size={12} style={{ color: "var(--muted-foreground)" }} />
                            <span style={{ fontSize: 12, flex: 1 }}>{c.title}</span>
                            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                              {c.type === "video" && c.duration_seconds ? fmtDuration(c.duration_seconds) : TYPE_LABEL[c.type as ContentType]}
                            </span>
                            <IconBtn onClick={() => moveContent(mod.id, mod.contents, ci, -1)} disabled={ci === 0}><ArrowUp size={11} /></IconBtn>
                            <IconBtn onClick={() => moveContent(mod.id, mod.contents, ci, 1)} disabled={ci === mod.contents.length - 1}><ArrowDown size={11} /></IconBtn>
                            <IconBtn onClick={() => setEditing({ moduleId: mod.id, type: c.type, existing: c })}><Pencil size={11} /></IconBtn>
                            <IconBtn onClick={() => handleDeleteContent(c.id)} danger><Trash2 size={11} /></IconBtn>
                          </div>
                        );
                      })}

                      {mod.quiz && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md" style={{ backgroundColor: "rgba(139, 92, 246, 0.08)" }}>
                          <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#8B5CF6" }} />
                          <HelpCircle size={12} style={{ color: "#8B5CF6" }} />
                          <span style={{ fontSize: 12, flex: 1 }}>Quiz · {mod.quiz.questions.length} question{mod.quiz.questions.length !== 1 ? "s" : ""}</span>
                          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>≥ {mod.quiz.passing_score}%</span>
                          <IconBtn onClick={() => setEditingQuiz({ moduleId: mod.id, existing: mod.quiz })}><Pencil size={11} /></IconBtn>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(["video","pdf","image","text"] as ContentType[]).map((t) => (
                          <button key={t} onClick={() => setEditing({ moduleId: mod.id, type: t, existing: null })}
                            className="rounded-md px-2 py-1 inline-flex items-center gap-1"
                            style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)" }}>
                            <Plus size={11} /> {TYPE_LABEL[t]}
                          </button>
                        ))}
                        <button
                          onClick={() => setEditingQuiz({ moduleId: mod.id, existing: mod.quiz })}
                          disabled={!!mod.quiz}
                          title={mod.quiz ? "Quiz déjà créé" : ""}
                          className="rounded-md px-2 py-1 inline-flex items-center gap-1"
                          style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)", opacity: mod.quiz ? 0.4 : 1 }}>
                          <Plus size={11} /> Quiz
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <button onClick={() => handleAddModule(sec.id)}
                  className="rounded-lg px-3 py-2 flex items-center gap-1.5 self-start"
                  style={{ fontSize: 12, fontWeight: 500, border: "0.5px dashed var(--border)", color: "var(--muted-foreground)" }}>
                  <Plus size={12} /> Nouveau module
                </button>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={handleAddSection}
        className="rounded-xl px-3 py-3 flex items-center justify-center gap-1.5"
        style={{ fontSize: 13, fontWeight: 500, border: "0.5px dashed var(--border)", color: "var(--muted-foreground)" }}>
        <Plus size={14} /> Nouvelle section
      </button>

      {editing && (
        <ContentEditModal
          open
          onOpenChange={(v) => !v && setEditing(null)}
          courseId={courseId}
          moduleId={editing.moduleId}
          type={editing.type}
          existing={editing.existing}
          onSaved={() => { setEditing(null); onChange(); }}
        />
      )}

      {editingQuiz && (
        <QuizEditModal
          open
          onOpenChange={(v) => !v && setEditingQuiz(null)}
          moduleId={editingQuiz.moduleId}
          existing={editingQuiz.existing}
          onSaved={() => { setEditingQuiz(null); onChange(); }}
        />
      )}
    </div>
  );
}

function IconBtn({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="rounded-md p-1"
      style={{ color: danger ? "var(--danger-text)" : "var(--muted-foreground)", opacity: disabled ? 0.3 : 1 }}>
      {children}
    </button>
  );
}
