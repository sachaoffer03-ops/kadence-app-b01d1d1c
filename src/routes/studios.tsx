import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, MapPin, Phone, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/studios")({
  component: StudiosPage,
  head: () => ({ meta: [{ title: "Studios — Kadence" }] }),
});

interface Studio {
  id: string; name: string;
  address: string | null; city: string | null; postal_code: string | null;
  phone: string | null; opening_hours: string | null;
  capacity: number | null; color: string | null; description: string | null;
}

type RoleCount = Record<string, Record<string, number>>;

const allRoles = ["Barista", "Accueil", "Host", "Cuisine"] as const;

function StudiosPage() {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Studio>>({});
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<Partial<Studio>>({ color: "#F0997B" });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [byRole, setByRole] = useState<RoleCount>({});

  const load = async () => {
    const { data } = await supabase.from("studios").select("*").order("name");
    setStudios((data || []) as Studio[]);
    const [{ data: profiles }, { data: ubr }] = await Promise.all([
      supabase.from("profiles").select("id, studio_id").not("studio_id", "is", null),
      supabase.from("user_business_roles").select("user_id, role"),
    ]);
    const c: Record<string, number> = {};
    const r: RoleCount = {};
    const studioByUser: Record<string, string> = {};
    (profiles || []).forEach((p) => {
      if (!p.studio_id) return;
      studioByUser[p.id] = p.studio_id;
      c[p.studio_id] = (c[p.studio_id] || 0) + 1;
    });
    (ubr || []).forEach((x) => {
      const sid = studioByUser[x.user_id];
      if (!sid) return;
      r[sid] = r[sid] || {};
      r[sid][x.role] = (r[sid][x.role] || 0) + 1;
    });
    setCounts(c); setByRole(r);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("studios-rt").on("postgres_changes", { event: "*", schema: "public", table: "studios" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const startEdit = (s: Studio) => { setEditingId(s.id); setDraft({ ...s }); };
  const saveEdit = async () => {
    if (!draft.name?.trim()) { toast.error("Nom requis"); return; }
    const { id, ...rest } = draft;
    const { error } = await supabase.from("studios").update({
      name: rest.name?.trim(),
      address: rest.address || null,
      city: rest.city || null,
      postal_code: rest.postal_code || null,
      phone: rest.phone || null,
      opening_hours: rest.opening_hours || null,
      capacity: rest.capacity ? Number(rest.capacity) : null,
      color: rest.color || null,
      description: rest.description || null,
    }).eq("id", id!);
    if (error) toast.error(error.message);
    else { toast.success("Studio mis à jour"); setEditingId(null); load(); }
  };
  const remove = async (id: string) => {
    if (!confirm("Supprimer ce studio ?")) return;
    const { error } = await supabase.from("studios").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Studio supprimé"); load(); }
  };
  const createStudio = async () => {
    if (!newDraft.name?.trim()) { toast.error("Nom requis"); return; }
    const { error } = await supabase.from("studios").insert({
      name: newDraft.name.trim(),
      address: newDraft.address || null,
      city: newDraft.city || null,
      postal_code: newDraft.postal_code || null,
      phone: newDraft.phone || null,
      opening_hours: newDraft.opening_hours || null,
      capacity: newDraft.capacity ? Number(newDraft.capacity) : null,
      color: newDraft.color || "#F0997B",
      description: newDraft.description || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Studio créé"); setNewDraft({ color: "#F0997B" }); setCreating(false); load(); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Studios & postes</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Gérez vos centres, leur fiche et la répartition par poste.</p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-md px-3 py-2 flex items-center gap-1.5"
          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          <Plus size={13} /> Nouveau studio
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--coral)" }}>
          <StudioForm draft={newDraft} setDraft={setNewDraft} />
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => { setCreating(false); setNewDraft({ color: "#F0997B" }); }}
              className="rounded-md px-3 py-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Annuler</button>
            <button onClick={createStudio} className="rounded-md px-3 py-2" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>Créer</button>
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
          {studios.map((s) => {
            const isEditing = editingId === s.id;
            const total = counts[s.id] || 0;
            const roles = byRole[s.id] || {};
            return (
              <div key={s.id} className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: isEditing ? "var(--coral)" : "var(--border)" }}>
                <div className="p-5" style={{ borderBottom: "0.5px solid var(--border)" }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="rounded-lg flex items-center justify-center shrink-0"
                        style={{ width: 44, height: 44, backgroundColor: (s.color || "#F0997B") + "22" }}>
                        <MapPin size={20} style={{ color: s.color || "var(--coral-dark)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                            style={{ width: "100%", fontSize: 15, fontWeight: 500, padding: "4px 8px", border: "0.5px solid var(--border)", borderRadius: 4, backgroundColor: "var(--background)" }} />
                        ) : (
                          <div style={{ fontSize: 15, fontWeight: 500 }}>{s.name}</div>
                        )}
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                          {total} employé{total > 1 ? "s" : ""} · {s.capacity || "–"} places
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} className="rounded-md p-1.5" style={{ backgroundColor: "var(--foreground)", color: "var(--card)" }}><Check size={14} /></button>
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

                  {isEditing ? (
                    <StudioForm draft={draft} setDraft={setDraft} />
                  ) : (
                    <>
                      {s.description && (
                        <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, marginBottom: 10 }}>{s.description}</p>
                      )}
                      <div className="flex flex-col gap-1.5" style={{ fontSize: 12 }}>
                        {(s.address || s.city) && (
                          <Line icon={<MapPin size={12} />}>{[s.address, s.postal_code, s.city].filter(Boolean).join(" · ")}</Line>
                        )}
                        {s.phone && <Line icon={<Phone size={12} />}>{s.phone}</Line>}
                        {s.opening_hours && <Line icon={<Clock size={12} />}>{s.opening_hours}</Line>}
                      </div>
                    </>
                  )}
                </div>

                {!isEditing && (
                  <div className="p-4" style={{ backgroundColor: "var(--background)" }}>
                    <div className="flex items-center gap-1.5 mb-2" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      <Users size={11} /> Postes
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {allRoles.map((role) => {
                        const n = roles[role] || 0;
                        return (
                          <span key={role} className="rounded-full px-2 py-1"
                            style={{ fontSize: 11, fontWeight: 500,
                              backgroundColor: n ? "var(--card)" : "transparent",
                              border: "0.5px solid var(--border)",
                              color: n ? "var(--foreground)" : "var(--muted-foreground)" }}>
                            {role} <span style={{ opacity: 0.55 }}>· {n}</span>
                          </span>
                        );
                      })}
                    </div>
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

function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
      <span style={{ color: "var(--muted-foreground)" }}>{icon}</span>
      <span style={{ color: "var(--foreground)" }}>{children}</span>
    </div>
  );
}

function StudioForm({ draft, setDraft }: { draft: Partial<Studio>; setDraft: (d: Partial<Studio>) => void }) {
  const inp = { fontSize: 12, padding: "6px 9px", border: "0.5px solid var(--border)", borderRadius: 5, backgroundColor: "var(--background)", outline: "none", width: "100%" } as const;
  return (
    <div className="grid grid-cols-2 gap-2">
      {!draft.id && (
        <input placeholder="Nom du studio" value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ ...inp, gridColumn: "span 2" }} />
      )}
      <input placeholder="Adresse" value={draft.address || ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} style={{ ...inp, gridColumn: "span 2" }} />
      <input placeholder="Code postal" value={draft.postal_code || ""} onChange={(e) => setDraft({ ...draft, postal_code: e.target.value })} style={inp} />
      <input placeholder="Ville" value={draft.city || ""} onChange={(e) => setDraft({ ...draft, city: e.target.value })} style={inp} />
      <input placeholder="Téléphone" value={draft.phone || ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} style={inp} />
      <input type="number" placeholder="Capacité" value={draft.capacity ?? ""} onChange={(e) => setDraft({ ...draft, capacity: e.target.value ? Number(e.target.value) : null })} style={inp} />
      <input placeholder="Horaires" value={draft.opening_hours || ""} onChange={(e) => setDraft({ ...draft, opening_hours: e.target.value })} style={{ ...inp, gridColumn: "span 2" }} />
      <textarea placeholder="Description" value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{ ...inp, gridColumn: "span 2", minHeight: 50, resize: "vertical", fontFamily: "inherit" }} />
      <div className="flex items-center gap-2" style={{ gridColumn: "span 2", fontSize: 11, color: "var(--muted-foreground)" }}>
        Couleur
        <input type="color" value={draft.color || "#F0997B"} onChange={(e) => setDraft({ ...draft, color: e.target.value })} style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer" }} />
        <span style={{ fontSize: 11 }}>{draft.color || "#F0997B"}</span>
      </div>
    </div>
  );
}
