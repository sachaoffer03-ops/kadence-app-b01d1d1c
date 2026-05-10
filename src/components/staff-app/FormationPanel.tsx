import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Play, GraduationCap, ChevronLeft, Clock } from "lucide-react";
import { PrimaryButton } from "./shared";

interface PathRow { id: string; title: string; description: string | null; }
interface FormationRow {
  id: string; title: string; description: string | null;
  duration_min: number | null; video_url: string | null;
  required_role: string | null; path_id: string | null;
}

export function FormationPanel({ userId }: { userId: string }) {
  const [paths, setPaths] = useState<PathRow[]>([]);
  const [formations, setFormations] = useState<FormationRow[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<FormationRow | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: f }, { data: c }] = await Promise.all([
        supabase.from("training_paths").select("id,title,description").order("position"),
        supabase.from("formations").select("id,title,description,duration_min,video_url,required_role,path_id").order("position"),
        supabase.from("formation_completions").select("formation_id").eq("user_id", userId),
      ]);
      setPaths((p as PathRow[]) || []);
      setFormations((f as FormationRow[]) || []);
      setCompleted(new Set((c || []).map((r) => r.formation_id as string)));
    })();
  }, [userId]);

  const markDone = async (id: string) => {
    const { error } = await supabase.from("formation_completions").insert({ user_id: userId, formation_id: id });
    if (error) { toast.error("Erreur"); return; }
    setCompleted(prev => new Set(prev).add(id));
    toast.success("Formation validée");
    setActive(null);
  };

  // Vue détail (module ouvert)
  if (active) {
    return (
      <div className="px-5 pt-12">
        <button onClick={() => setActive(null)} className="flex items-center gap-1 mb-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          <ChevronLeft size={14} /> Toutes les formations
        </button>
        <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 4, lineHeight: 1.2 }}>{active.title}</div>
        <div className="flex items-center gap-1.5 mb-5" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          <Clock size={12} />
          {active.duration_min ? `${active.duration_min} min` : "Durée libre"}
          {active.required_role && <> · {active.required_role}</>}
        </div>
        {active.video_url ? (
          <video src={active.video_url} controls className="w-full rounded-xl mb-4" style={{ maxHeight: 280, backgroundColor: "#000" }} />
        ) : (
          <div className="rounded-xl flex items-center justify-center mb-4" style={{ height: 160, backgroundColor: "var(--muted)", fontSize: 12, color: "var(--muted-foreground)" }}>
            Pas de vidéo associée
          </div>
        )}
        {active.description && (
          <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16, whiteSpace: "pre-wrap", color: "var(--foreground)" }}>{active.description}</div>
        )}
        {completed.has(active.id) ? (
          <div className="rounded-md py-3 text-center" style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
            <Check size={14} className="inline mr-1.5" /> Formation déjà validée
          </div>
        ) : (
          <PrimaryButton onClick={() => markDone(active.id)}>Marquer comme terminée</PrimaryButton>
        )}
      </div>
    );
  }

  const orphans = formations.filter(f => !f.path_id);
  const hasContent = paths.some(p => formations.some(f => f.path_id === p.id)) || orphans.length > 0;
  const totalDone = completed.size;
  const totalCount = formations.length;
  const totalPct = totalCount > 0 ? Math.round((totalDone / totalCount) * 100) : 0;

  return (
    <div className="px-5 pt-12">
      <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Formations</div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Tes modules à suivre.</div>

      {/* Hero progression globale */}
      {totalCount > 0 && (
        <div className="rounded-xl mb-5 p-4" style={{ background: "linear-gradient(135deg, #1A1A1A, #2A2A28)" }}>
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--coral)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Progression</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{totalDone}/{totalCount}</div>
          </div>
          <div style={{ width: "100%", height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)" }}>
            <div style={{ width: `${totalPct}%`, height: "100%", borderRadius: 2, backgroundColor: "var(--coral)" }} />
          </div>
        </div>
      )}

      {!hasContent ? (
        <div className="rounded-xl px-4 py-10 text-center" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <GraduationCap size={28} style={{ color: "var(--muted-foreground)", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Aucune formation pour l'instant</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Ton admin t'en assignera bientôt.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {paths.map(path => {
            const items = formations.filter(f => f.path_id === path.id);
            if (items.length === 0) return null;
            const doneCount = items.filter(f => completed.has(f.id)).length;
            return (
              <section key={path.id}>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{path.title}</div>
                    {path.description && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{path.description}</div>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: doneCount === items.length ? "var(--success-text)" : "var(--muted-foreground)" }}>
                    {doneCount}/{items.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {items.map(f => <ModuleCard key={f.id} f={f} done={completed.has(f.id)} onClick={() => setActive(f)} />)}
                </div>
              </section>
            );
          })}
          {orphans.length > 0 && (
            <section>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Autres modules</div>
              <div className="grid grid-cols-2 gap-3">
                {orphans.map(f => <ModuleCard key={f.id} f={f} done={completed.has(f.id)} onClick={() => setActive(f)} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ModuleCard({ f, done, onClick }: { f: FormationRow; done: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl p-3.5 text-left flex flex-col justify-between transition-transform active:scale-[0.98]"
      style={{
        minHeight: 130,
        backgroundColor: done ? "var(--success-bg)" : "#fff",
        border: `0.5px solid ${done ? "var(--success-text)" : "rgba(0,0,0,0.08)"}`,
        boxShadow: done ? "none" : "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div
          className="rounded-lg flex items-center justify-center"
          style={{
            width: 36, height: 36,
            backgroundColor: done ? "var(--success-text)" : "var(--coral-light)",
            color: done ? "#fff" : "var(--coral-dark)",
          }}
        >
          {done ? <Check size={16} /> : <Play size={14} />}
        </div>
        {done && (
          <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--success-text)", color: "#fff" }}>
            Validé
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginBottom: 4 }} className="line-clamp-2">{f.title}</div>
        <div className="flex items-center gap-1" style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
          <Clock size={10} />
          {f.duration_min ? `${f.duration_min} min` : "Libre"}
        </div>
      </div>
    </button>
  );
}
