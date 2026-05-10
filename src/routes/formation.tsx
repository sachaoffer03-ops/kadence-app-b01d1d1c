import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Play, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getRoleStyle, type BusinessRole } from "@/lib/staff-helpers";

export const Route = createFileRoute("/formation")({
  component: FormationPage,
  head: () => ({ meta: [{ title: "Formation — Kadence" }] }),
});

interface Path { id: string; title: string; description: string | null; type: string; required_role: BusinessRole | null; position: number }
interface Formation {
  id: string; path_id: string | null; title: string; description: string | null;
  video_url: string | null; duration_min: number | null; required_role: BusinessRole | null; position: number;
}

const allRoles: BusinessRole[] = ["Barista", "Accueil", "Host", "Cuisine"];

function FormationPage() {
  const [paths, setPaths] = useState<Path[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState({ title: "", type: "role" as "commun" | "role", role: "Barista" as BusinessRole });
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newFormation, setNewFormation] = useState({ title: "", description: "" });

  const load = async () => {
    const [{ data: p }, { data: f }] = await Promise.all([
      supabase.from("training_paths").select("*").order("position"),
      supabase.from("formations").select("*").order("position"),
    ]);
    setPaths((p || []) as Path[]);
    setFormations((f || []) as Formation[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("formation-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "training_paths" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "formations" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const createPath = async () => {
    if (!newPath.title.trim()) { toast.error("Titre requis"); return; }
    const { error } = await supabase.from("training_paths").insert({
      title: newPath.title.trim(),
      type: newPath.type,
      required_role: newPath.type === "role" ? newPath.role : null,
      position: paths.length,
    });
    if (error) toast.error(error.message);
    else { toast.success("Parcours créé"); setNewPath({ title: "", type: "role", role: "Barista" }); setCreating(false); }
  };

  const deletePath = async (id: string) => {
    if (!confirm("Supprimer ce parcours et toutes ses formations ?")) return;
    await supabase.from("formations").delete().eq("path_id", id);
    const { error } = await supabase.from("training_paths").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Parcours supprimé");
  };

  const addFormation = async (pathId: string) => {
    if (!newFormation.title.trim()) { toast.error("Titre requis"); return; }
    const path = paths.find((p) => p.id === pathId);
    const count = formations.filter((f) => f.path_id === pathId).length;
    const { error } = await supabase.from("formations").insert({
      path_id: pathId,
      title: newFormation.title.trim(),
      description: newFormation.description.trim() || null,
      required_role: path?.required_role ?? null,
      position: count,
    });
    if (error) toast.error(error.message);
    else { toast.success("Formation ajoutée"); setNewFormation({ title: "", description: "" }); setAddingTo(null); }
  };

  const deleteFormation = async (id: string) => {
    const { error } = await supabase.from("formations").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Formation supprimée");
  };

  if (loading) return <div className="p-6" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Formation</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Parcours et modules de formation pour les employés.</p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-md px-3 py-2 flex items-center gap-1.5"
          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          <Plus size={13} /> Nouveau parcours
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
        <Kpi label="Parcours" value={paths.length} />
        <Kpi label="Modules" value={formations.length} />
        <Kpi label="Communs" value={paths.filter((p) => p.type === "commun").length} />
      </div>

      {creating && (
        <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--coral)" }}>
          <div className="flex flex-col gap-3">
            <input autoFocus value={newPath.title} onChange={(e) => setNewPath({ ...newPath, title: e.target.value })}
              placeholder="Titre du parcours"
              style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)" }} />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setNewPath({ ...newPath, type: "commun" })}
                className="rounded-full px-2.5 py-1"
                style={{ fontSize: 11, fontWeight: newPath.type === "commun" ? 500 : 400, backgroundColor: newPath.type === "commun" ? "var(--foreground)" : "transparent", color: newPath.type === "commun" ? "var(--card)" : "var(--muted-foreground)", border: newPath.type === "commun" ? "none" : "0.5px solid var(--border)" }}>
                Commun à tous
              </button>
              {allRoles.map((r) => {
                const a = newPath.type === "role" && newPath.role === r;
                return (
                  <button key={r} onClick={() => setNewPath({ ...newPath, type: "role", role: r })}
                    className="rounded-full px-2.5 py-1"
                    style={{ fontSize: 11, fontWeight: a ? 500 : 400, backgroundColor: a ? "var(--foreground)" : "transparent", color: a ? "var(--card)" : "var(--muted-foreground)", border: a ? "none" : "0.5px solid var(--border)" }}>
                    {r}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setCreating(false); setNewPath({ title: "", type: "role", role: "Barista" }); }}
                className="rounded-md px-3 py-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Annuler</button>
              <button onClick={createPath} className="rounded-md px-3 py-2"
                style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>Créer</button>
            </div>
          </div>
        </div>
      )}

      {paths.length === 0 ? (
        <div className="rounded-xl border px-6 py-10 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <GraduationCap size={28} style={{ margin: "0 auto 8px", color: "var(--muted-foreground)" }} />
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Aucun parcours de formation</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Créez un premier parcours pour structurer la formation.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {paths.map((path) => {
            const modules = formations.filter((f) => f.path_id === path.id);
            const rc = path.required_role ? getRoleStyle(path.required_role) : { bg: "var(--muted)", text: "var(--foreground)", dot: "var(--foreground)" };
            return (
              <div key={path.id} className="rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-3 p-4" style={{ borderBottom: modules.length || addingTo === path.id ? "0.5px solid var(--border)" : "none" }}>
                  <span className="rounded-full" style={{ width: 10, height: 10, backgroundColor: rc.dot }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{path.title}</span>
                      <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: rc.bg, color: rc.text }}>
                        {path.type === "commun" ? "Commun" : path.required_role}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                      {modules.length} module{modules.length > 1 ? "s" : ""}
                    </div>
                  </div>
                  <button onClick={() => setAddingTo(addingTo === path.id ? null : path.id)} className="rounded-md p-1.5" style={{ border: "0.5px solid var(--border)" }}><Plus size={13} /></button>
                  <button onClick={() => deletePath(path.id)} className="rounded-md p-1.5" style={{ border: "0.5px solid var(--border)", color: "var(--danger-text)" }}><Trash2 size={13} /></button>
                </div>

                {addingTo === path.id && (
                  <div className="p-4 flex flex-col gap-2" style={{ backgroundColor: "var(--coral-light)" }}>
                    <input autoFocus value={newFormation.title} onChange={(e) => setNewFormation({ ...newFormation, title: e.target.value })}
                      placeholder="Titre de la formation"
                      style={{ fontSize: 13, padding: "6px 10px", border: "0.5px solid var(--border)", borderRadius: 4, backgroundColor: "var(--card)" }} />
                    <input value={newFormation.description} onChange={(e) => setNewFormation({ ...newFormation, description: e.target.value })}
                      placeholder="Description (optionnel)"
                      style={{ fontSize: 12, padding: "6px 10px", border: "0.5px solid var(--border)", borderRadius: 4, backgroundColor: "var(--card)" }} />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setAddingTo(null); setNewFormation({ title: "", description: "" }); }}
                        className="rounded-md px-3 py-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Annuler</button>
                      <button onClick={() => addFormation(path.id)} className="rounded-md px-3 py-1.5"
                        style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>Ajouter</button>
                    </div>
                  </div>
                )}

                {modules.length > 0 && (
                  <div className="flex flex-col">
                    {modules.map((m, i) => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: i < modules.length - 1 ? "0.5px solid var(--border)" : "none" }}>
                        <Play size={14} style={{ color: "var(--muted-foreground)" }} />
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{m.title}</div>
                          {m.description && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{m.description}</div>}
                        </div>
                        {m.duration_min && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{m.duration_min} min</span>}
                        <button onClick={() => deleteFormation(m.id)} className="rounded-md p-1" style={{ color: "var(--muted-foreground)" }}><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <span style={{ fontSize: 22, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
