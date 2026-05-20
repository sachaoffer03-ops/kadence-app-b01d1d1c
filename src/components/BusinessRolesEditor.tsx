// CRUD admin des rôles métier (table public.business_roles).
// Permet d'ajouter/renommer/supprimer/réordonner les rôles + couleurs.
// Les changements se propagent partout via le hook useBusinessRoles + Realtime.
import { useEffect, useState } from "react";
import { Plus, Trash2, Save, GripVertical, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { reloadBusinessRoles, useBusinessRoles, type BusinessRoleRow } from "@/hooks/use-business-roles";

interface Draft extends BusinessRoleRow {
  _dirty?: boolean;
  _new?: boolean;
}

export function BusinessRolesEditor() {
  const { roles, isLoading } = useBusinessRoles();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDrafts(roles.map((r) => ({ ...r })));
  }, [roles.map((r) => r.id).join(",")]);

  const update = (id: string, patch: Partial<Draft>) => {
    setDrafts((p) => p.map((d) => (d.id === id ? { ...d, ...patch, _dirty: true } : d)));
  };

  const addRow = () => {
    const nextPos = drafts.length ? Math.max(...drafts.map((d) => d.position)) + 1 : 0;
    setDrafts((p) => [
      ...p,
      {
        id: `new-${Date.now()}`,
        name: "",
        color: "#888888",
        position: nextPos,
        is_active: true,
        _dirty: true,
        _new: true,
      },
    ]);
  };

  const removeRow = async (d: Draft) => {
    if (d._new) {
      setDrafts((p) => p.filter((x) => x.id !== d.id));
      return;
    }
    // Vérifier si utilisé en historique
    const { count } = await supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .eq("business_role", d.name);
    if ((count ?? 0) > 0) {
      const ok = confirm(
        `Le rôle "${d.name}" est utilisé dans ${count} shift(s) historiques. Le supprimer va casser ces données. Préfère le désactiver. Continuer ?`
      );
      if (!ok) return;
    }
    const { error } = await supabase.from("business_roles").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    setDrafts((p) => p.filter((x) => x.id !== d.id));
    toast.success("Rôle supprimé");
    reloadBusinessRoles();
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = drafts.findIndex((d) => d.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= drafts.length) return;
    const copy = [...drafts];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    setDrafts(copy.map((d, i) => ({ ...d, position: i, _dirty: true })));
  };

  const saveAll = async () => {
    const dirty = drafts.filter((d) => d._dirty);
    if (!dirty.length) return toast.info("Aucun changement");
    // Validation
    for (const d of dirty) {
      if (!d.name.trim()) return toast.error("Le nom ne peut pas être vide");
      if (!/^#[0-9a-fA-F]{6}$/.test(d.color)) return toast.error(`Couleur invalide pour "${d.name}"`);
    }
    const names = drafts.map((d) => d.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return toast.error("Deux rôles ne peuvent pas avoir le même nom");

    setSaving(true);
    // Détection renommages : comparer aux rôles d'origine
    const renames: Array<{ old: string; nw: string }> = [];
    for (const d of dirty) {
      if (d._new) continue;
      const orig = roles.find((r) => r.id === d.id);
      if (orig && orig.name !== d.name.trim()) {
        renames.push({ old: orig.name, nw: d.name.trim() });
      }
    }

    // Inserts
    const inserts = dirty.filter((d) => d._new).map((d) => ({
      name: d.name.trim(),
      color: d.color,
      position: d.position,
      is_active: d.is_active,
    }));
    if (inserts.length) {
      const { error } = await supabase.from("business_roles").insert(inserts);
      if (error) { setSaving(false); return toast.error(error.message); }
    }

    // Updates
    const updates = dirty.filter((d) => !d._new);
    for (const d of updates) {
      const { error } = await supabase
        .from("business_roles")
        .update({ name: d.name.trim(), color: d.color, position: d.position, is_active: d.is_active })
        .eq("id", d.id);
      if (error) { setSaving(false); return toast.error(error.message); }
    }

    // Cascade renommages dans toutes les tables qui stockent le nom
    for (const r of renames) {
      await supabase.from("shifts").update({ business_role: r.nw }).eq("business_role", r.old);
      await supabase.from("staffing_templates").update({ business_role: r.nw }).eq("business_role", r.old);
      await supabase.from("user_business_roles").update({ role: r.nw }).eq("role", r.old);
      // checklist_templates: désormais lié par business_role_id (FK uuid), renommage géré automatiquement
      // formations/training_paths supprimés — refonte du système de formation
    }

    setSaving(false);
    toast.success(`${dirty.length} rôle(s) enregistré(s)${renames.length ? ` · ${renames.length} renommage(s) propagé(s)` : ""}`);
    reloadBusinessRoles();
  };

  if (isLoading) return <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>;

  const dirtyCount = drafts.filter((d) => d._dirty).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: "var(--info-bg)" }}>
        <Info size={14} style={{ color: "var(--info-text)", marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 11, color: "var(--info-text)", lineHeight: 1.5 }}>
          Ces rôles apparaissent partout dans l'app : planning, besoins par studio, invitations, formations, checklists.
          Renommer un rôle propage automatiquement le changement à tout l'historique. Pour retirer un rôle de l'usage sans casser l'historique, désactive-le.
        </div>
      </div>

      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Rôles métier</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{drafts.length} rôle{drafts.length > 1 ? "s" : ""} configuré{drafts.length > 1 ? "s" : ""}</div>
          </div>
          {dirtyCount > 0 && (
            <button onClick={saveAll} disabled={saving}
              className="rounded-md px-3 py-2 flex items-center gap-2"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              <Save size={13} /> {saving ? "Enregistrement…" : `Enregistrer (${dirtyCount})`}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {drafts.map((d, i) => (
            <div key={d.id} className="flex items-center gap-2 rounded-lg p-2"
              style={{ backgroundColor: d._dirty ? "var(--muted)" : "transparent", border: "0.5px solid var(--border)" }}>
              <div className="flex flex-col">
                <button onClick={() => move(d.id, -1)} disabled={i === 0} style={{ opacity: i === 0 ? 0.3 : 1, fontSize: 10, lineHeight: 1 }}>▲</button>
                <button onClick={() => move(d.id, 1)} disabled={i === drafts.length - 1} style={{ opacity: i === drafts.length - 1 ? 0.3 : 1, fontSize: 10, lineHeight: 1 }}>▼</button>
              </div>
              <GripVertical size={14} style={{ color: "var(--muted-foreground)" }} />
              <input
                type="color"
                value={d.color}
                onChange={(e) => update(d.id, { color: e.target.value })}
                style={{ width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer" }}
              />
              <input
                type="text"
                value={d.name}
                placeholder="Nom du rôle"
                onChange={(e) => update(d.id, { name: e.target.value })}
                className="flex-1 rounded-md px-2 py-1.5 outline-none"
                style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}
              />
              <label className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                <input type="checkbox" checked={d.is_active} onChange={(e) => update(d.id, { is_active: e.target.checked })} />
                Actif
              </label>
              <button onClick={() => removeRow(d)} className="rounded-md p-1.5"
                style={{ color: "var(--danger-text)" }} title="Supprimer">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <button onClick={addRow}
          className="mt-3 rounded-md px-3 py-2 flex items-center gap-2"
          style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>
          <Plus size={13} /> Ajouter un rôle
        </button>
      </div>
    </div>
  );
}
