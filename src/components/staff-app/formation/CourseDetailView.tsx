import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Lock, Circle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getCourseForEmployee } from "@/lib/formation.functions";
import { ModulePlayer } from "./ModulePlayer";
import type { CourseDetail, DetailModule } from "./types";

interface Props {
  courseId: string;
  firstName: string;
  initials: string;
  onBack: () => void;
  onCourseCompleted: (course: CourseDetail["course"]) => void;
}

export function CourseDetailView({ courseId, firstName, initials, onBack, onCourseCompleted }: Props) {
  const [data, setData] = useState<CourseDetail | null>(null);
  const [openModule, setOpenModule] = useState<{ module: DetailModule; review: boolean } | null>(null);
  const getCourse = useServerFn(getCourseForEmployee);

  const load = async () => {
    try { setData(await getCourse({ data: { courseId } })); }
    catch (e: any) { toast.error(e.message); onBack(); }
  };
  useEffect(() => { load(); }, [courseId]);

  if (!data) return <div className="p-6 text-center" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</div>;

  if (openModule) {
    return (
      <ModulePlayer
        module={openModule.module}
        firstName={firstName}
        initials={initials}
        reviewMode={openModule.review}
        onBack={async () => { setOpenModule(null); await load(); }}
        onModuleComplete={async () => {
          setOpenModule(null);
          const fresh = await getCourse({ data: { courseId } });
          setData(fresh);
          if (fresh.completedAt && !data.completedAt) onCourseCompleted(fresh.course);
        }}
      />
    );
  }

  const flatModules: DetailModule[] = [];
  data.sections.forEach((s) => s.modules.forEach((m) => flatModules.push(m as any)));

  const openModuleHandler = (m: DetailModule) => {
    if ((m as any).locked) {
      toast("Termine d'abord le module précédent");
      return;
    }
    setOpenModule({ module: m, review: m.status === "completed" });
  };

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: "0.5px solid var(--border)" }}>
        <button onClick={onBack} className="flex items-center gap-1 mb-3" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          <ArrowLeft size={14} /> Mes parcours
        </button>
        <div className="flex items-center gap-3">
          <div style={{ fontSize: 28 }}>{(data.course as any).icon ?? "📚"}</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 500 }}>{data.course.title}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
              {data.completedModules}/{data.totalModules} modules validés
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-full overflow-hidden" style={{ height: 6, backgroundColor: "var(--muted)" }}>
          <div className="h-full" style={{ width: `${data.progressPct}%`, backgroundColor: "#F0997B", transition: "width 0.3s" }} />
        </div>
      </div>

      <div className="px-5 py-5 flex flex-col">
        {flatModules.map((m: any, i) => {
          const isDone = m.status === "completed";
          const isLocked = m.locked;
          const isInProgress = m.status === "in_progress";
          return (
            <div key={m.id} className="flex gap-3 relative">
              <div className="flex flex-col items-center" style={{ width: 28 }}>
                <div className="rounded-full flex items-center justify-center" style={{
                  width: 28, height: 28,
                  backgroundColor: isDone ? "#16A34A" : isInProgress ? "#F0997B" : isLocked ? "var(--muted)" : "var(--card)",
                  border: isLocked || !isInProgress && !isDone ? "1px solid var(--border)" : "none",
                  color: isDone || isInProgress ? "white" : "var(--muted-foreground)",
                }}>
                  {isDone ? <Check size={14} strokeWidth={2.5} /> : isLocked ? <Lock size={12} /> : <Circle size={10} fill={isInProgress ? "white" : "transparent"} />}
                </div>
                {i < flatModules.length - 1 && <div className="flex-1 w-px my-1" style={{ backgroundColor: "var(--border)", minHeight: 28 }} />}
              </div>
              <button onClick={() => openModuleHandler(m)} className="flex-1 text-left rounded-lg p-3 mb-3 transition-colors disabled:opacity-60"
                disabled={isLocked}
                style={{
                  border: "0.5px solid var(--border)",
                  backgroundColor: isInProgress ? "color-mix(in oklch, #F0997B 6%, transparent)" : "var(--card)",
                }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", letterSpacing: "0.06em" }}>MODULE {m.position_global}</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{m.title}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
                  {m.contents.length} contenu{m.contents.length !== 1 ? "s" : ""}
                  {m.quiz ? ` · quiz ${m.quiz.questions.length}q` : ""}
                  {isDone && " · ✓ Validé"}
                  {isInProgress && " · en cours"}
                </div>
              </button>
            </div>
          );
        })}
        {flatModules.length === 0 && (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "var(--muted)", fontSize: 12, color: "var(--muted-foreground)" }}>
            Ce parcours est vide pour l'instant.
          </div>
        )}
      </div>
    </div>
  );
}
