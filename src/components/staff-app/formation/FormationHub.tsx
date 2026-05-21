import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lock, ChevronRight, GraduationCap, Check, Calendar } from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyAssignedCourses } from "@/lib/formation.functions";
import { CourseDetailView } from "./CourseDetailView";
import type { AssignedCourses, CourseCard, CourseDetail } from "./types";

export function FormationHub({ userId }: { userId: string }) {
  const [data, setData] = useState<AssignedCourses | null>(null);
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ first_name: string; last_name: string } | null>(null);
  const [celebration, setCelebration] = useState<CourseDetail["course"] | null>(null);
  const getCourses = useServerFn(getMyAssignedCourses);

  const load = async () => {
    try { setData(await getCourses({})); }
    catch (e: any) { toast.error(e.message); }
  };

  useEffect(() => {
    load();
    supabase.from("profiles").select("first_name, last_name").eq("id", userId).maybeSingle()
      .then(({ data }) => setProfile(data as any));
  }, [userId]);

  const firstName = profile?.first_name || "toi";
  const initials = `${(profile?.first_name ?? "").charAt(0)}${(profile?.last_name ?? "").charAt(0)}`.toUpperCase() || "—";

  if (celebration) {
    return (
      <div className="flex flex-col items-center text-center p-6 gap-5" style={{ minHeight: 500 }}>
        <div className="rounded-full flex items-center justify-center" style={{ width: 96, height: 96, backgroundColor: "color-mix(in oklch, #16A34A 18%, transparent)" }}>
          <GraduationCap size={48} strokeWidth={1.5} style={{ color: "#16A34A" }} />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500 }}>Parcours {(celebration as any).title} complet !</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>Bravo {firstName}, tu as tout validé 👏</div>
        </div>
        <div className="w-full rounded-xl p-4" style={{ backgroundColor: "#0F172A", color: "white" }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: "rgba(255,255,255,0.15)" }}>
              <Check size={14} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Ton planning est débloqué</div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
            Tu peux déclarer tes disponibilités, accepter des shifts et pointer en arrivant.
          </div>
        </div>
        <div className="w-full rounded-xl p-3" style={{ backgroundColor: "color-mix(in oklch, #F0997B 12%, transparent)", border: "0.5px solid color-mix(in oklch, #F0997B 30%, transparent)" }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>+100 points bonus</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>Valables sur le shop Skult (bientôt)</div>
        </div>
        <button onClick={() => { setCelebration(null); setOpenCourseId(null); load(); }}
          className="rounded-md w-full py-3 flex items-center justify-center gap-2"
          style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          <Calendar size={14} /> Retour
        </button>
      </div>
    );
  }

  if (openCourseId) {
    return (
      <CourseDetailView
        courseId={openCourseId}
        firstName={firstName}
        initials={initials}
        onBack={() => { setOpenCourseId(null); load(); }}
        onCourseCompleted={(c) => {
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
          setCelebration(c);
        }}
      />
    );
  }

  if (!data) return <div className="p-6 text-center" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</div>;

  const { summary, courses } = data;

  return (
    <div className="flex flex-col p-5 gap-4">
      <div>
        <div style={{ fontSize: 18, fontWeight: 500 }}>Salut {firstName} 👋</div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
          {courses.length === 0 ? "Aucun parcours assigné pour l'instant."
            : summary.completedCourses === summary.totalCourses ? "Tous tes parcours sont validés. Bravo 💪"
            : `${summary.completedCourses}/${summary.totalCourses} parcours complétés`}
        </div>
      </div>

      {courses.length > 0 && summary.totalModules > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: "color-mix(in oklch, #F0997B 12%, transparent)", border: "0.5px solid color-mix(in oklch, #F0997B 25%, transparent)" }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", letterSpacing: "0.08em" }}>TA PROGRESSION</div>
          <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>{summary.completedModules} / {summary.totalModules} modules</div>
          <div className="mt-3 rounded-full overflow-hidden" style={{ height: 6, backgroundColor: "rgba(255,255,255,0.5)" }}>
            <div className="h-full" style={{ width: `${summary.progressPct}%`, backgroundColor: "#F0997B", transition: "width 0.3s" }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>
            {summary.progressPct}% complété
            {summary.totalModules - summary.completedModules > 0 && ` · plus que ${summary.totalModules - summary.completedModules} modules`}
          </div>
        </div>
      )}

      {summary.lockedPlanning && (
        <div className="rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: "var(--muted)", border: "0.5px solid var(--border)" }}>
          <Lock size={16} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <div style={{ fontSize: 13, fontWeight: 500 }}>Planning encore verrouillé</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>
              Termine ton parcours pour pouvoir déclarer tes dispos et choisir tes shifts.
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {summary.blockingCourses.map((c: any) => (
                <span key={c.id} className="rounded-full px-2 py-0.5" style={{ fontSize: 11, backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                  {c.icon} {c.title}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginBottom: 8 }}>TES PARCOURS</div>
        <div className="flex flex-col gap-2">
          {courses.length === 0 && (
            <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "var(--muted)", fontSize: 12, color: "var(--muted-foreground)" }}>
              Aucun parcours pour le moment.
            </div>
          )}
          {courses.map((c: CourseCard) => (
            <button key={c.id} onClick={() => setOpenCourseId(c.id)}
              className="rounded-xl p-3 flex items-center gap-3 text-left transition-colors hover:bg-[var(--muted)]"
              style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
              <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, backgroundColor: "color-mix(in oklch, " + (c.color || "#F0997B") + " 15%, transparent)", fontSize: 20 }}>
                {c.icon || "📚"}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 14, fontWeight: 500 }}>{c.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, backgroundColor: "var(--muted)" }}>
                    <div className="h-full" style={{ width: `${c.progressPct}%`, backgroundColor: c.status === "completed" ? "#16A34A" : "#F0997B" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    {c.status === "completed" ? "✓ Validé" : `${c.completedModules}/${c.moduleCount}`}
                  </span>
                </div>
              </div>
              <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
