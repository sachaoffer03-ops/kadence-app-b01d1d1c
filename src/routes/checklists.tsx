import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, Sparkles, GripVertical, Plus, Trash2, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { checklistTemplates as initial, roleColors, type ChecklistTemplate, type Role, type Studio } from "@/lib/mock-data";

export const Route = createFileRoute("/checklists")({
  component: ChecklistsPage,
  head: () => ({ meta: [{ title: "Checklists — Kadence" }] }),
});

const allRoles: Role[] = ["Barista", "Accueil", "Host", "Cuisine"];
const allStudios: Studio[] = ["Skult Rhodes", "Skult Châtelain"];

function ChecklistsPage() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>(initial);
  const [selected, setSelected] = useState(initial[0]?.id || "");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [newItem, setNewItem] = useState("");
  const [creatingTpl, setCreatingTpl] = useState(false);
  const [tplStudio, setTplStudio] = useState<Studio>("Skult Rhodes");
  const [tplRole, setTplRole] = useState<Role>("Barista");

  const template = templates.find((c) => c.id === selected);

  const addItem = () => {
    const v = newItem.trim();
    if (!v || !template) return;
    const id = `ci-${Date.now()}`;
    setTemplates((prev) => prev.map((t) => t.id === template.id ? { ...t, items: [...t.items, { id, label: v, photoRequired: false, aiValidation: false }] } : t));
    setNewItem("");
    toast.success("Item ajouté");
  };
  const deleteItem = (id: string) => {
    if (!template) return;
    setTemplates((prev) => prev.map((t) => t.id === template.id ? { ...t, items: t.items.filter((i) => i.id !== id) } : t));
    toast.success("Item supprimé");
  };
  const toggleFlag = (id: string, key: "photoRequired" | "aiValidation") => {
    if (!template) return;
    setTemplates((prev) => prev.map((t) => t.id === template.id ? { ...t, items: t.items.map((i) => i.id === id ? { ...i, [key]: !i[key] } : i) } : t));
  };
  const startEditItem = (id: string, label: string) => { setEditingItemId(id); setEditLabel(label); };
  const submitEditItem = (id: string) => {
    if (!template || !editLabel.trim()) { setEditingItemId(null); return; }
    setTemplates((prev) => prev.map((t) => t.id === template.id ? { ...t, items: t.items.map((i) => i.id === id ? { ...i, label: editLabel.trim() } : i) } : t));
    setEditingItemId(null);
    toast.success("Item modifié");
  };

  const createTemplate = () => {
    if (templates.some((t) => t.studio === tplStudio && t.role === tplRole)) {
      toast.error("Ce template existe déjà");
      return;
    }
    const id = `cl-${Date.now()}`;
    const t: ChecklistTemplate = { id, studio: tplStudio, role: tplRole, completionRate: 0, frequentlySkipped: [], items: [] };
    setTemplates((p) => [...p, t]);
    setSelected(id);
    setCreatingTpl(false);
    toast.success("Template créé");
  };
  const deleteTemplate = (id: string) => {
    setTemplates((p) => p.filter((t) => t.id !== id));
    if (selected === id) setSelected(templates[0]?.id || "");
    toast.success("Template supprimé");
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Checklists de fin de shift</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Configurez les items de vérification par studio et par rôle.</p>
        </div>
        <button onClick={() => setCreatingTpl(true)} className="rounded-md px-3 py-1.5 flex items-center gap-1.5"
          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          <Plus size={13} /> Nouveau template
        </button>
      </div>

      {creatingTpl && (
        <div className="rounded-xl border p-4 mb-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--coral)" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <span style={{ fontSize: 12, fontWeight: 500 }}>Studio</span>
            <Chips value={tplStudio} onChange={(v) => setTplStudio(v as Studio)} options={allStudios.map((s) => ({ value: s, label: s.replace("Skult ", "") }))} />
            <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 8 }}>Rôle</span>
            <Chips value={tplRole} onChange={(v) => setTplRole(v as Role)} options={allRoles.map((r) => ({ value: r, label: r }))} />
            <button onClick={createTemplate} className="rounded-md px-3 py-1.5 ml-auto" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>Créer</button>
            <button onClick={() => setCreatingTpl(false)} className="rounded-md px-2 py-1.5" style={{ fontSize: 12 }}>Annuler</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <MiniKpi label="Complétion globale" value={`${templates.length ? Math.round(templates.reduce((s, c) => s + c.completionRate, 0) / templates.length) : 0}%`} />
        <MiniKpi label="Templates actifs" value={templates.length.toString()} />
        <MiniKpi label="Items souvent oubliés" value={templates.reduce((s, c) => s + c.frequentlySkipped.length, 0).toString()} color="var(--warning-text)" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="flex flex-col gap-2">
          {templates.map((cl) => {
            const roleColor = roleColors[cl.role];
            const isSelected = cl.id === selected;
            return (
              <button key={cl.id} onClick={() => setSelected(cl.id)} className="rounded-lg border px-4 py-3 text-left"
                style={{ backgroundColor: isSelected ? "var(--foreground)" : "var(--card)", borderColor: isSelected ? "var(--foreground)" : "var(--border)", color: isSelected ? "var(--card)" : "var(--foreground)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: isSelected ? "var(--coral)" : roleColor.dot }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{cl.role}</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {cl.studio.replace("Skult ", "")} · {cl.items.length} items · {cl.completionRate}%
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
                    <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: roleColors[template.role].dot }} />
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{template.role} — {template.studio}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {template.items.length} items · Complétion : {template.completionRate}%
                  </div>
                </div>
                <button onClick={() => deleteTemplate(template.id)} title="Supprimer le template" className="rounded-md p-2" style={{ border: "0.5px solid var(--border)", color: "var(--danger-text)" }}>
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="flex flex-col gap-1 mb-4">
                {template.items.map((item) => {
                  const editing = editingItemId === item.id;
                  return (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                      <GripVertical size={14} style={{ color: "var(--muted-foreground)", cursor: "grab" }} />
                      {editing ? (
                        <input autoFocus value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") submitEditItem(item.id); if (e.key === "Escape") setEditingItemId(null); }}
                          onBlur={() => submitEditItem(item.id)}
                          style={{ fontSize: 13, flex: 1, padding: "4px 8px", border: "0.5px solid var(--border)", borderRadius: 4, backgroundColor: "var(--background)" }} />
                      ) : (
                        <span style={{ fontSize: 13, flex: 1, cursor: "pointer" }} onClick={() => startEditItem(item.id, item.label)}>{item.label}</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <ToggleTag icon={Camera} label="Photo" active={item.photoRequired} onClick={() => toggleFlag(item.id, "photoRequired")} />
                        <ToggleTag icon={Sparkles} label="IA" active={item.aiValidation} onClick={() => toggleFlag(item.id, "aiValidation")} coral />
                        <button onClick={() => deleteItem(item.id)} className="rounded p-1" style={{ color: "var(--muted-foreground)" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {template.items.length === 0 && (
                  <div className="text-center py-6" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    Aucun item. Ajoutez le premier ci-dessous.
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3" style={{ borderTop: "0.5px solid var(--border)" }}>
                <input value={newItem} onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
                  placeholder="Ajouter un item de checklist…"
                  style={{ flex: 1, fontSize: 13, padding: "6px 10px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)", outline: "none" }} />
                <button onClick={addItem} className="rounded-md px-3 py-1.5 flex items-center gap-1" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                  <Plus size={12} /> Ajouter
                </button>
              </div>

              {template.frequentlySkipped.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "0.5px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={13} style={{ color: "var(--warning-text)" }} />
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--warning-text)" }}>Items souvent oubliés</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {template.frequentlySkipped.map((item) => (
                      <span key={item} className="rounded-full px-2.5 py-1" style={{ fontSize: 11, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>{item}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleTag({ icon: Icon, label, active, onClick, coral }: { icon: any; label: string; active: boolean; onClick: () => void; coral?: boolean }) {
  return (
    <button onClick={onClick} className="rounded-full px-1.5 py-0.5 flex items-center gap-1"
      style={{ fontSize: 9, fontWeight: 500,
        backgroundColor: active ? (coral ? "var(--coral-light)" : "var(--info-bg)") : "transparent",
        color: active ? (coral ? "var(--coral-dark)" : "var(--info-text)") : "var(--muted-foreground)",
        border: active ? "none" : "0.5px solid var(--border)" }}>
      <Icon size={9} /> {label}
    </button>
  );
}

function Chips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} className="rounded-full px-2.5 py-1"
            style={{ fontSize: 11, fontWeight: active ? 500 : 400,
              backgroundColor: active ? "var(--foreground)" : "transparent",
              color: active ? "var(--card)" : "var(--muted-foreground)",
              border: active ? "none" : "0.5px solid var(--border)" }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <span style={{ fontSize: 22, fontWeight: 500, color: color || "var(--foreground)" }}>{value}</span>
    </div>
  );
}
