import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Play, GraduationCap, ChevronLeft } from "lucide-react";
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

  if (active) {
    return (
      <div className="px-5 pt-6">
        <button onClick={() => setActive(null)} className="flex items-center gap-1 mb-3" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          <ChevronLeft size={14} /> Toutes les formations
        </button>
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{active.title}</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 14 }}>
          {active.duration_min ? `${active.duration_min} min` : "Durée libre"}
        </div>
        {active.video_url ? (
          <video src={active.video_url} controls className="w-full rounded-lg mb-4" style={{ maxHeight: 280, backgroundColor: "#000" }} />
        ) : (
          <div className="rounded-lg flex items-center justify-center mb-4" style={{ height: 160, backgroundColor: "var(--muted)", fontSize: 12, color: "var(--muted-foreground)" }}>
            Pas de vidéo associée
          </div>
        )}
        {active.description && (
          <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16, whiteSpace: "pre-wrap" }}>{active.description}</div>
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

  return (
    <div className="px-5 pt-6">
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Formations</div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Tes parcours et modules à suivre.</div>

      {!hasContent ? (
        <div className="rounded-xl px-4 py-8 text-center" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <GraduationCap size={28} style={{ color: "var(--muted-foreground)", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Aucune formation pour l'instant</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Ton admin t'en assignera bientôt.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {paths.map(path => {
            const items = formations.filter(f => f.path_id === path.id);
            if (items.length === 0) return null;
            const doneCount = items.filter(f => completed.has(f.id)).length;
            const pct = Math.round((doneCount / items.length) * 100);
            return (
              <div key={path.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{path.title}</div>
                    {path.description && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{path.description}</div>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: pct === 100 ? "var(--success-text)" : "var(--muted-foreground)" }}>
                    {doneCount}/{items.length}
                  </span>
                </div>
                <div style={{ width: "100%", height: 4, borderRadius: 2, backgroundColor: "var(--muted)", marginBottom: 8 }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, backgroundColor: pct === 100 ? "var(--success-text)" : "var(--coral)" }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  {items.map(f => <Item key={f.id} f={f} done={completed.has(f.id)} onClick={() => setActive(f)} />)}
                </div>
              </div>
            );
          })}
          {orphans.length > 0 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Autres modules</div>
              <div className="flex flex-col gap-1.5">
                {orphans.map(f => <Item key={f.id} f={f} done={completed.has(f.id)} onClick={() => setActive(f)} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Item({ f, done, onClick }: { f: FormationRow; done: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-lg px-3 py-2.5 flex items-center gap-3 text-left transition-colors"
      style={{ backgroundColor: done ? "var(--success-bg)" : "#fff", border: `0.5px solid ${done ? "var(--success-text)" : "rgba(0,0,0,0.08)"}` }}>
      <div className="rounded-full flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: done ? "var(--success-text)" : "var(--muted)", color: done ? "#fff" : "var(--muted-foreground)" }}>
        {done ? <Check size={14} /> : <Play size={12} />}
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 13, fontWeight: 500 }} className="truncate">{f.title}</div>
        <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{f.duration_min ? `${f.duration_min} min` : "Durée libre"}{f.required_role ? ` · ${f.required_role}` : ""}</div>
      </div>
    </button>
  );
}
