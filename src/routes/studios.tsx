import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/studios")({
  component: StudiosPage,
  head: () => ({ meta: [{ title: "Studios — Kadence" }] }),
});

interface Studio { id: string; name: string; created_at: string }

function StudiosPage() {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = async () => {
    const { data } = await supabase.from("studios").select("*").order("name");
    setStudios((data || []) as Studio[]);
    const { data: profiles } = await supabase.from("profiles").select("studio_id").not("studio_id", "is", null);
    const c: Record<string, number> = {};
    (profiles || []).forEach((p) => { if (p.studio_id) c[p.studio_id] = (c[p.studio_id] || 0) + 1; });
    setCounts(c);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("studios-rt").on("postgres_changes", { event: "*", schema: "public", table: "studios" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const startEdit = (s: Studio) => { setEditingId(s.id); setEditName(s.name); };
  const saveEdit = async (id: string) => {
    if (!editName.trim()) { toast.error("Nom requis"); return; }
    const { error } = await supabase.from("studios").update({ name: editName.trim() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Studio mis à jour"); setEditingId(null); load(); }
  };
  const remove = async (id: string) => {
    if (!confirm("Supprimer ce studio ?")) return;
    const { error } = await supabase.from("studios").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Studio supprimé"); load(); }
  };
  const createStudio = async () => {
    if (!newName.trim()) { toast.error("Nom requis"); return; }
    const { error } = await supabase.from("studios").insert({ name: newName.trim() });
    if (error) toast.error(error.message); else { toast.success("Studio créé"); setNewName(""); setCreating(false); load(); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Studios</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Gérez vos centres et leurs informations.</p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-md px-3 py-2 flex items-center gap-1.5"
          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          <Plus size={13} /> Nouveau studio
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--coral)" }}>
          <div className="flex items-center gap-2">
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createStudio(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
              placeholder="Nom du studio"
              style={{ flex: 1, fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)" }} />
            <button onClick={createStudio} className="rounded-md px-3 py-2" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>Créer</button>
            <button onClick={() => { setCreating(false); setNewName(""); }} className="rounded-md px-2 py-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}><X size={14} /></button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : studios.length === 0 ? (
        <div className="rounded-xl border px-6 py-10 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Aucun studio</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Créez votre premier studio pour commencer.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {studios.map((s) => (
            <div key={s.id} className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: editingId === s.id ? "var(--coral)" : "var(--border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 40, height: 40, backgroundColor: "var(--coral-light)" }}>
                    <MapPin size={18} style={{ color: "var(--coral-dark)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingId === s.id ? (
                      <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(s.id); if (e.key === "Escape") setEditingId(null); }}
                        style={{ width: "100%", fontSize: 15, fontWeight: 500, padding: "4px 8px", border: "0.5px solid var(--border)", borderRadius: 4, backgroundColor: "var(--background)" }} />
                    ) : (
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{s.name}</div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                      {counts[s.id] || 0} employé{(counts[s.id] || 0) > 1 ? "s" : ""} rattaché{(counts[s.id] || 0) > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {editingId === s.id ? (
                    <>
                      <button onClick={() => saveEdit(s.id)} className="rounded-md p-1.5" style={{ backgroundColor: "var(--foreground)", color: "var(--card)" }}><Check size={14} /></button>
                      <button onClick={() => setEditingId(null)} className="rounded-md p-1.5" style={{ border: "0.5px solid var(--border)" }}><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(s)} className="rounded-md p-1.5" style={{ border: "0.5px solid var(--border)" }}><Pencil size={13} /></button>
                      <button onClick={() => remove(s.id)} className="rounded-md p-1.5" style={{ border: "0.5px solid var(--border)", color: "var(--danger-text)" }}><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
