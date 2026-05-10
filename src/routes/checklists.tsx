import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, Trash2, Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { roleColors, type Role } from "@/lib/mock-data";

export const Route = createFileRoute("/checklists")({
  component: ChecklistsPage,
  head: () => ({ meta: [{ title: "Checklists — Kadence" }] }),
});

const allRoles: Role[] = ["Barista", "Accueil", "Host", "Cuisine"];

interface Item { id: string; label: string; photoRequired?: boolean; }
interface Template {
  id: string; studio_id: string | null; business_role: Role; items: Item[];
}
interface StudioRow { id: string; name: string; }

function ChecklistsPage() {
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeStudio, setActiveStudio] = useState<string>("");
  const [selected, setSelected] = useState<string>("");
  const [newItem, setNewItem] = useState("");
  const [creatingTpl, setCreatingTpl] = useState(false);
  const [tplRole, setTplRole] = useState<Role>("Barista");

  useEffect(() => {
    const load = async () => {
      const [{ data: sts }, { data: tps }] = await Promise.all([
        supabase.from("studios").select("id,name").order("name"),
        supabase.from("checklist_templates").select("*").order("created_at"),
      ]);
      setStudios(sts || []);
      const tpls = (tps || []).map(t => ({ ...t, items: (t.items as unknown as Item[]) || [] })) as Template[];
      setTemplates(tpls);
      if (sts && sts.length) {
        setActiveStudio(prev => prev || sts[0].id);
      }
    };
    load();
    const channel = supabase.channel("checklists-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_templates" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Templates filtrés sur le studio actif
  const studioTemplates = useMemo(
    () => templates.filter(t => t.studio_id === activeStudio),
    [templates, activeStudio]
  );

  // Auto-sélection du premier template du studio actif
  useEffect(() => {
    if (studioTemplates.length === 0) { setSelected(""); return; }
    if (!studioTemplates.some(t => t.id === selected)) {
      setSelected(studioTemplates[0].id);
    }
  }, [studioTemplates, selected]);

  const studioName = (id: string | null) => studios.find(s => s.id === id)?.name || "Tous studios";
  const template = templates.find(t => t.id === selected) || null;

  const persistItems = async (id: string, items: Item[]) => {
    const { error } = await supabase.from("checklist_templates").update({ items: items as unknown as never }).eq("id", id);
    if (error) toast.error("Erreur sauvegarde");
  };

  const addItem = async () => {
    const v = newItem.trim();
    if (!v || !template) return;
    const items = [...template.items, { id: `ci-${Date.now()}`, label: v, photoRequired: false }];
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, items } : t));
    setNewItem("");
    await persistItems(template.id, items);
  };

  const deleteItem = async (id: string) => {
    if (!template) return;
    const items = template.items.filter(i => i.id !== id);
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, items } : t));
    await persistItems(template.id, items);
  };

  const togglePhoto = async (id: string) => {
    if (!template) return;
    const items = template.items.map(i => i.id === id ? { ...i, photoRequired: !i.photoRequired } : i);
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, items } : t));
    await persistItems(template.id, items);
  };

  const createTemplate = async () => {
    if (templates.some(t => t.studio_id === activeStudio && t.business_role === tplRole)) {
      toast.error("Ce template existe déjà");
      return;
    }
    const { data, error } = await supabase.from("checklist_templates")
      .insert({ studio_id: activeStudio, business_role: tplRole, items: [] })
      .select().single();
    if (error || !data) { toast.error("Erreur"); return; }
    setSelected(data.id); setCreatingTpl(false);
    toast.success("Template créé");
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("checklist_templates").delete().eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    if (selected === id) setSelected(templates.find(t => t.id !== id)?.id || "");
    toast.success("Template supprimé");
  };

  const activeStudioName = studios.find(s => s.id === activeStudio)?.name || "";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Checklists de fin de shift</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Items vérifiés par les employés en fin de shift.</p>
        </div>
        <button onClick={() => setCreatingTpl(true)} disabled={!activeStudio} className="rounded-md px-3 py-1.5 flex items-center gap-1.5"
          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)", opacity: activeStudio ? 1 : 0.4 }}>
          <Plus size={13} /> Nouveau template
        </button>
      </div>

      {/* Filtres studio */}
      <div className="flex items-center gap-2 mb-5">
        {studios.map(s => {
          const active = s.id === activeStudio;
          const short = s.name.replace(/^Skult\s+/i, "");
          return (
            <button key={s.id} onClick={() => setActiveStudio(s.id)}
              className="rounded-full px-4 py-1.5"
              style={{
                fontSize: 12,
                fontWeight: active ? 500 : 400,
                backgroundColor: active ? "var(--foreground)" : "var(--card)",
                color: active ? "var(--card)" : "var(--foreground)",
                border: `0.5px solid ${active ? "var(--foreground)" : "var(--border)"}`,
              }}>
              {short}
            </button>
          );
        })}
      </div>

      {creatingTpl && (
        <div className="rounded-xl border p-4 mb-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--coral)" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <span style={{ fontSize: 12, fontWeight: 500 }}>Studio</span>
            <span className="rounded-md px-2.5 py-1" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--muted)" }}>
              {activeStudioName}
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 8 }}>Rôle</span>
            <div className="flex items-center gap-1">
              {allRoles.map(r => {
                const a = tplRole === r;
                return (
                  <button key={r} onClick={() => setTplRole(r)} className="rounded-full px-2.5 py-1"
                    style={{ fontSize: 11, fontWeight: a ? 500 : 400,
                      backgroundColor: a ? "var(--foreground)" : "transparent",
                      color: a ? "var(--card)" : "var(--muted-foreground)",
                      border: a ? "none" : "0.5px solid var(--border)" }}>{r}</button>
                );
              })}
            </div>
            <button onClick={createTemplate} className="rounded-md px-3 py-1.5 ml-auto" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>Créer</button>
            <button onClick={() => setCreatingTpl(false)} className="rounded-md px-2 py-1.5" style={{ fontSize: 12 }}>Annuler</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        <div className="flex flex-col gap-2">
          {studioTemplates.length === 0 && (
            <div className="rounded-lg border px-4 py-6 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", fontSize: 12, color: "var(--muted-foreground)" }}>
              Aucun template pour ce studio. Crée le premier.
            </div>
          )}
          {templates.map(cl => {
            const rc = roleColors[cl.business_role];
            const isSelected = cl.id === selected;
            return (
              <button key={cl.id} onClick={() => setSelected(cl.id)} className="rounded-lg border px-4 py-3 text-left"
                style={{ backgroundColor: isSelected ? "var(--foreground)" : "var(--card)", borderColor: isSelected ? "var(--foreground)" : "var(--border)", color: isSelected ? "var(--card)" : "var(--foreground)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: isSelected ? "var(--coral)" : rc.dot }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{cl.business_role}</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {studioName(cl.studio_id).replace("Skult ", "")} · {cl.items.length} items
                </div>
              </button>
            );
          })}
        </div>

        {template && (
          <div className="col-span-2">
            <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: roleColors[template.business_role].dot }} />
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{template.business_role} — {studioName(template.studio_id)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{template.items.length} items</div>
                </div>
                <button onClick={() => deleteTemplate(template.id)} className="rounded-md p-2" style={{ border: "0.5px solid var(--border)", color: "var(--danger-text)" }}>
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="flex flex-col gap-1 mb-4">
                {template.items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--background)" }}>
                    <GripVertical size={14} style={{ color: "var(--muted-foreground)" }} />
                    <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>
                    <button onClick={() => togglePhoto(item.id)} className="rounded-full px-1.5 py-0.5 flex items-center gap-1"
                      style={{ fontSize: 10, fontWeight: 500,
                        backgroundColor: item.photoRequired ? "var(--info-bg)" : "transparent",
                        color: item.photoRequired ? "var(--info-text)" : "var(--muted-foreground)",
                        border: item.photoRequired ? "none" : "0.5px solid var(--border)" }}>
                      <Camera size={9} /> Photo
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="rounded p-1" style={{ color: "var(--muted-foreground)" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {template.items.length === 0 && (
                  <div className="text-center py-6" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    Aucun item. Ajoute le premier ci-dessous.
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3" style={{ borderTop: "0.5px solid var(--border)" }}>
                <input value={newItem} onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addItem(); }}
                  placeholder="Ajouter un item de checklist…"
                  style={{ flex: 1, fontSize: 13, padding: "6px 10px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)", outline: "none" }} />
                <button onClick={addItem} className="rounded-md px-3 py-1.5 flex items-center gap-1" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                  <Plus size={12} /> Ajouter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
