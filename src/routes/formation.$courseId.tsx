import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Settings, Eye, Send, SendHorizonal, Copy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getCourseFullStructure, publishCourse, unpublishCourse, duplicateCourse } from "@/lib/formation.functions";
import { CourseSidebar } from "@/components/formation/CourseSidebar";
import { SectionsBuilder } from "@/components/formation/SectionsBuilder";
import { CourseSettingsSheet } from "@/components/formation/CourseSettingsSheet";
import { StudentPreviewSheet } from "@/components/formation/StudentPreviewSheet";
import { fmtTotalMinutes } from "@/components/formation/types";
import type { CourseFull } from "@/components/formation/types";

export const Route = createFileRoute("/formation/$courseId")({
  component: CourseBuilderPage,
  head: () => ({ meta: [{ title: "Parcours — Kadence" }] }),
});

function CourseBuilderPage() {
  const { courseId } = Route.useParams();
  const [data, setData] = useState<CourseFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sidebarKey, setSidebarKey] = useState(0);

  const fetchStructure = useServerFn(getCourseFullStructure);
  const pub = useServerFn(publishCourse);
  const unpub = useServerFn(unpublishCourse);
  const dup = useServerFn(duplicateCourse);

  const load = useCallback(async () => {
    try {
      const d = await fetchStructure({ data: { courseId } });
      setData(d);
    } catch (e: any) {
      toast.error(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { setLoading(true); load(); }, [courseId, load]);

  const refreshAll = () => { load(); setSidebarKey((k) => k + 1); };

  const handlePublishToggle = async () => {
    if (!data) return;
    setBusy(true);
    try {
      if (data.course.is_published) {
        await unpub({ data: { courseId } });
        toast.success("Parcours dépublié");
      } else {
        const res = await pub({ data: { courseId } });
        toast.success(`Publié · ${res.notified} employé(s) notifié(s)`);
      }
      refreshAll();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setBusy(false); }
  };

  const totals = data ? {
    sections: data.sections.length,
    modules: data.sections.reduce((a, s) => a + s.modules.length, 0),
    contents: data.sections.reduce((a, s) => a + s.modules.reduce((b: number, m: any) => b + m.contents.length, 0), 0),
    minutes: data.sections.reduce((a, s) => a + s.modules.reduce((b: number, m: any) => b + (m.duration_estimate_min ?? 0), 0), 0),
  } : null;

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <Link to="/formation" className="flex items-center gap-1 mb-4" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={14} /> Tous les parcours
      </Link>

      <div className="grid gap-5" style={{ gridTemplateColumns: "260px 1fr" }}>
        <div>
          <CourseSidebar activeCourseId={courseId} refreshKey={sidebarKey} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: "rgba(37, 99, 235, 0.06)", border: "0.5px solid rgba(37, 99, 235, 0.2)", fontSize: 12, color: "var(--foreground)" }}>
            💡 Organise chaque parcours en <strong>Sections → Modules → Sous-contenus</strong>. Ajoute un quiz final par module pour valider les acquis.
          </div>

          {loading || !data ? (
            <>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </>
          ) : (
            <>
              <div className="rounded-xl border p-4 flex items-start gap-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <div style={{ fontSize: 28 }}>{data.course.icon ?? "📚"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 style={{ fontSize: 18, fontWeight: 500 }}>{data.course.title}</h1>
                    {!data.course.is_published && (
                      <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
                        Brouillon
                      </span>
                    )}
                    {data.course.is_published && (
                      <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
                        Publié
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                    {totals!.sections} sections · {totals!.modules} modules · {totals!.contents} sous-contenus
                    {totals!.minutes > 0 && ` · ${fmtTotalMinutes(totals!.minutes)} cumulé`}
                    {" · "}note de réussite quiz : {data.course.passing_quiz_score}%
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  <ActionBtn icon={Copy} label="Dupliquer" onClick={() => setShowDuplicate(true)} />
                  <ActionBtn icon={Settings} label="Réglages" onClick={() => setShowSettings(true)} />
                  <ActionBtn icon={Eye} label="Aperçu" onClick={() => setShowPreview(true)} />
                  <ActionBtn
                    icon={data.course.is_published ? SendHorizonal : Send}
                    label={busy ? "..." : data.course.is_published ? "Dépublier" : "Publier"}
                    onClick={handlePublishToggle}
                    primary
                  />
                </div>
              </div>

              <SectionsBuilder courseId={courseId} sections={data.sections} onChange={refreshAll} />

              <CourseSettingsSheet
                open={showSettings} onOpenChange={setShowSettings}
                course={data.course} studios={data.studios} courseStudioIds={data.courseStudioIds}
                onSaved={refreshAll}
              />

              <StudentPreviewSheet open={showPreview} onOpenChange={setShowPreview} data={data} />

              {data && (
                <DuplicateCourseDialog
                  open={showDuplicate}
                  onOpenChange={setShowDuplicate}
                  course={data.course}
                  studios={data.studios}
                  courseStudioIds={data.courseStudioIds}
                  onDuplicate={async (payload) => {
                    setBusy(true);
                    try {
                      const res = await dup({ data: { courseId, ...payload } });
                      toast.success("Parcours dupliqué");
                      setShowDuplicate(false);
                      refreshAll();
                      // navigate to the copy after a short delay so the sidebar refreshes
                      setTimeout(() => {
                        window.location.href = `/formation/${res.id}`;
                      }, 150);
                    } catch (e: any) {
                      toast.error(e.message || "Erreur");
                    } finally { setBusy(false); }
                  }}
                  busy={busy}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, primary }: { icon: any; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick}
      className="rounded-md px-3 py-2 inline-flex items-center gap-1.5"
      style={{
        fontSize: 12, fontWeight: 500,
        backgroundColor: primary ? "var(--foreground)" : "transparent",
        color: primary ? "var(--card)" : "var(--foreground)",
        border: primary ? "none" : "0.5px solid var(--border)",
      }}>
      <Icon size={13} /> {label}
    </button>
  );
}

function DuplicateCourseDialog({
  open,
  onOpenChange,
  course,
  studios,
  courseStudioIds,
  onDuplicate,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  course: CourseFull["course"];
  studios: { id: string; name: string }[];
  courseStudioIds: string[];
  onDuplicate: (payload: { title: string; studioIds: string[] }) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(`${course.title} (copie)`);
  const [studioIds, setStudioIds] = useState<string[]>(courseStudioIds);

  useEffect(() => {
    if (open) {
      setTitle(`${course.title} (copie)`);
      setStudioIds(courseStudioIds);
    }
  }, [open, course.title, courseStudioIds]);

  const toggleStudio = (id: string) => {
    setStudioIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const save = () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    onDuplicate({ title: title.trim(), studioIds });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontSize: 16, fontWeight: 500 }}>Dupliquer le parcours</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Titre du nouveau parcours</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1.5 rounded-md" style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
          </div>
          {studios.length > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Studios cibles</label>
              <div className="flex flex-col gap-1.5 mt-2">
                {studios.map((s) => {
                  const on = studioIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleStudio(s.id)} className="rounded-lg px-3 py-2 text-left flex items-center justify-between"
                      style={{ fontSize: 12, border: `0.5px solid ${on ? "#F0997B" : "var(--border)"}`, backgroundColor: on ? "rgba(240,153,123,0.08)" : "transparent" }}>
                      <span>{s.name}</span>
                      {on && <span style={{ fontSize: 11, color: "#F0997B" }}>Sélectionné</span>}
                    </button>
                  );
                })}
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  {studioIds.length === 0
                    ? "Aucun studio sélectionné : le parcours s'applique à tous les studios."
                    : "Seuls les employés de ces studios verront le parcours."}
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} disabled={busy} className="rounded-md px-3 py-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Annuler</button>
          <button onClick={save} disabled={busy} className="rounded-md px-3 py-2" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            {busy ? "..." : "Dupliquer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
