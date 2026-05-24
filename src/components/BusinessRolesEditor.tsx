// CRUD admin des rôles métier — désormais SCOPÉ PAR STUDIO.
//
// Modèle :
// - `business_roles` reste le catalogue global (id + nom + couleur + position + actif).
// - `studio_business_roles` lie un rôle (par nom) à un studio.
// - Cet éditeur travaille studio par studio : on choisit un studio, on voit/édite
//   uniquement les rôles activés pour CE studio. Renommer/changer la couleur
//   met à jour la ligne globale (donc partagée si un autre studio utilise le même nom).
// - Supprimer = retire seulement le lien studio. Si le nom n'est plus utilisé par
//   aucun studio, la ligne globale est aussi nettoyée pour rester cohérent.
// - S'il n'y a pas de studios, on affiche un état vide invitant à en créer un.
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, GripVertical, Info, Building2, X, Shuffle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { reloadBusinessRoles, useBusinessRoles, type BusinessRoleRow } from "@/hooks/use-business-roles";
import { useStudios } from "@/hooks/use-studios";
import { Link } from "@tanstack/react-router";

interface Draft extends BusinessRoleRow {
  _dirty?: boolean;
  _new?: boolean;
  _origName?: string;
}

const PRESET_PALETTE = ["#3B82F6", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];
const randomPresetColor = () => PRESET_PALETTE[Math.floor(Math.random() * PRESET_PALETTE.length)];
const isHexColor = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);

export function BusinessRolesEditor() {
  const { studios, loading: studiosLoading } = useStudios();
  const { roles: allRoles, isLoading } = useBusinessRoles();
  const [studioId, setStudioId] = useState<string | null>(null);
  const [studioRoleNames, setStudioRoleNames] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingScope, setLoadingScope] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(() => randomPresetColor());
  const [creating, setCreating] = useState(false);

  // Sélectionne le 1er studio par défaut
  useEffect(() => {
    if (!studioId && studios.length > 0) setStudioId(studios[0].id);
  }, [studios, studioId]);

  // Charge les rôles liés au studio sélectionné
  const reloadStudioScope = async (sid: string | null) => {
    if (!sid) { setStudioRoleNames([]); return; }
    setLoadingScope(true);
    const { data } = await supabase
      .from("studio_business_roles")
      .select("role")
      .eq("studio_id", sid);
    setStudioRoleNames((data ?? []).map((r: any) => r.role));
    setLoadingScope(false);
  };
  useEffect(() => { reloadStudioScope(studioId); }, [studioId]);

  // Drafts = intersection (rôles globaux) ∩ (rôles du studio)
  useEffect(() => {
    const linked = allRoles
      .filter((r) => studioRoleNames.includes(r.name))
      .sort((a, b) => a.position - b.position)
      .map((r) => ({ ...r, _origName: r.name }));
    setDrafts(linked);
  }, [allRoles.map((r) => `${r.id}:${r.name}:${r.color}:${r.position}:${r.is_active}`).join("|"), studioRoleNames.join("|")]);

  const studioName = useMemo(
    () => studios.find((s) => s.id === studioId)?.name ?? "—",
    [studios, studioId]
  );

  const update = (id: string, patch: Partial<Draft>) => {
    setDrafts((p) => p.map((d) => (d.id === id ? { ...d, ...patch, _dirty: true } : d)));
  };

  const openCreate = () => {
    setNewName("");
    setNewColor(randomPresetColor());
    setCreateOpen(true);
  };

  const createRole = async () => {
    if (!studioId) return;
    const trimmed = newName.trim();
    if (!trimmed) return toast.error("Le nom du rôle est requis");
    if (!isHexColor(newColor)) return toast.error("Couleur invalide (format #RRGGBB attendu)");

    // Doublon dans CE studio ?
    if (studioRoleNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      return toast.error(`"${trimmed}" existe déjà dans ${studioName}`);
    }

    setCreating(true);
    try {
      const existing = allRoles.find((r) => r.name.toLowerCase() === trimmed.toLowerCase());
      if (!existing) {
        const nextPos = allRoles.length ? Math.max(...allRoles.map((r) => r.position)) + 1 : 0;
        const { error } = await supabase.from("business_roles").insert({
          name: trimmed,
          color: newColor,
          position: nextPos,
          is_active: true,
        });
        if (error) { setCreating(false); return toast.error(error.message); }
      }
      const { error: eLink } = await supabase
        .from("studio_business_roles")
        .insert({ studio_id: studioId, role: trimmed });
      if (eLink && !String(eLink.message).includes("duplicate")) {
        setCreating(false); return toast.error(eLink.message);
      }
      toast.success(`Rôle "${trimmed}" ajouté à ${studioName}`);
      setCreateOpen(false);
      await reloadStudioScope(studioId);
      reloadBusinessRoles();
    } finally {
      setCreating(false);
    }
  };

  const removeRow = async (d: Draft) => {
    if (!studioId) return;
    if (d._new) {
      setDrafts((p) => p.filter((x) => x.id !== d.id));
      return;
    }
    // Combien de shifts historiques utilisent ce rôle dans CE studio ?
    const { count: studioShiftCount } = await supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .eq("business_role", d.name)
      .eq("studio_id", studioId);
    if ((studioShiftCount ?? 0) > 0) {
      const ok = confirm(
        `Le rôle "${d.name}" est utilisé dans ${studioShiftCount} shift(s) historiques de ${studioName}. Le retirer de ce studio peut casser ces données. Continuer ?`
      );
      if (!ok) return;
    }
    // 1) supprimer le lien studio↔rôle
    const { error: e1 } = await supabase
      .from("studio_business_roles")
      .delete()
      .eq("studio_id", studioId)
      .eq("role", d.name);
    if (e1) return toast.error(e1.message);

    // 2) si le rôle n'est plus utilisé par AUCUN studio, supprimer aussi la ligne globale
    const { count: otherStudios } = await supabase
      .from("studio_business_roles")
      .select("studio_id", { count: "exact", head: true })
      .eq("role", d.name);
    if ((otherStudios ?? 0) === 0) {
      await supabase.from("business_roles").delete().eq("id", d.id);
    }

    toast.success(`Rôle "${d.name}" retiré de ${studioName}`);
    await reloadStudioScope(studioId);
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
    if (!studioId) return;
    const dirty = drafts.filter((d) => d._dirty);
    if (!dirty.length) return toast.info("Aucun changement");

    // Validation
    for (const d of dirty) {
      if (!d.name.trim()) return toast.error("Le nom ne peut pas être vide");
      if (!/^#[0-9a-fA-F]{6}$/.test(d.color)) return toast.error(`Couleur invalide pour "${d.name}"`);
    }
    const names = drafts.map((d) => d.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return toast.error("Deux rôles ne peuvent pas avoir le même nom dans ce studio");

    setSaving(true);

    // Renommages (rôles existants dont le nom a changé)
    const renames: Array<{ old: string; nw: string }> = [];
    for (const d of dirty) {
      if (d._new) continue;
      if (d._origName && d._origName !== d.name.trim()) {
        renames.push({ old: d._origName, nw: d.name.trim() });
      }
    }

    // Inserts (nouveaux rôles) : crée la ligne globale si nécessaire + lien studio
    const newRows = dirty.filter((d) => d._new);
    for (const d of newRows) {
      const trimmed = d.name.trim();
      // Existe déjà dans le catalogue ? (un autre studio peut déjà l'avoir)
      const existing = allRoles.find((r) => r.name.toLowerCase() === trimmed.toLowerCase());
      if (!existing) {
        const { error } = await supabase.from("business_roles").insert({
          name: trimmed,
          color: d.color,
          position: d.position,
          is_active: d.is_active,
        });
        if (error) { setSaving(false); return toast.error(error.message); }
      }
      // Lier au studio
      const { error: eLink } = await supabase
        .from("studio_business_roles")
        .insert({ studio_id: studioId, role: trimmed });
      if (eLink && !String(eLink.message).includes("duplicate")) {
        setSaving(false); return toast.error(eLink.message);
      }
    }

    // Updates (catalogue global)
    const updates = dirty.filter((d) => !d._new);
    for (const d of updates) {
      const { error } = await supabase
        .from("business_roles")
        .update({ name: d.name.trim(), color: d.color, position: d.position, is_active: d.is_active })
        .eq("id", d.id);
      if (error) { setSaving(false); return toast.error(error.message); }
    }

    // Cascade renommages
    for (const r of renames) {
      await supabase.from("shifts").update({ business_role: r.nw }).eq("business_role", r.old);
      await supabase.from("staffing_templates").update({ business_role: r.nw }).eq("business_role", r.old);
      await supabase.from("user_business_roles").update({ role: r.nw }).eq("role", r.old);
      await supabase.from("studio_business_roles").update({ role: r.nw }).eq("role", r.old);
    }

    setSaving(false);
    toast.success(`${dirty.length} changement(s) enregistré(s) pour ${studioName}`);
    await reloadStudioScope(studioId);
    reloadBusinessRoles();
  };

  // ─── États vides ────────────────────────────────────────────────────────────
  if (studiosLoading || isLoading) {
    return <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>;
  }

  if (studios.length === 0) {
    return (
      <div className="rounded-xl border p-6 flex flex-col items-center text-center gap-3"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <Building2 size={28} style={{ color: "var(--muted-foreground)" }} />
        <div style={{ fontSize: 14, fontWeight: 500 }}>Aucun studio configuré</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", maxWidth: 420, lineHeight: 1.5 }}>
          Les rôles métier sont liés aux studios. Crée d'abord au moins un studio,
          puis tu pourras ajouter les postes (Barista, Accueil, etc.) qui existent dans ce studio.
        </div>
        <Link to="/studios"
          className="rounded-md px-3 py-2 mt-1"
          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          Créer un studio
        </Link>
      </div>
    );
  }

  const dirtyCount = drafts.filter((d) => d._dirty).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: "var(--info-bg)" }}>
        <Info size={14} style={{ color: "var(--info-text)", marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 11, color: "var(--info-text)", lineHeight: 1.5 }}>
          Les rôles sont définis <strong>par studio</strong>. Ils apparaissent comme filtres sur le planning,
          dans les besoins en staff et lors des invitations. Renommer un rôle propage le changement
          partout (shifts, templates, employés).
        </div>
      </div>

      {/* Sélecteur de studio */}
      <div className="rounded-xl border p-3 flex items-center gap-3 flex-wrap"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <Building2 size={16} style={{ color: "var(--muted-foreground)" }} />
        <div style={{ fontSize: 12, fontWeight: 500 }}>Studio</div>
        <select
          value={studioId ?? ""}
          onChange={(e) => setStudioId(e.target.value || null)}
          className="rounded-md px-2 py-1.5"
          style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}
        >
          {studios.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Rôles de {studioName}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {drafts.length} rôle{drafts.length > 1 ? "s" : ""} configuré{drafts.length > 1 ? "s" : ""} pour ce studio
            </div>
          </div>
          {dirtyCount > 0 && (
            <button onClick={saveAll} disabled={saving}
              className="rounded-md px-3 py-2 flex items-center gap-2"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              <Save size={13} /> {saving ? "Enregistrement…" : `Enregistrer (${dirtyCount})`}
            </button>
          )}
        </div>

        {loadingScope ? (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement des rôles…</div>
        ) : drafts.length === 0 ? (
          <div className="rounded-lg p-4 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)", border: "0.5px dashed var(--border)" }}>
            Aucun rôle pour ce studio. Ajoute-en un ci-dessous (ex : Barista, Accueil, Cuisine).
          </div>
        ) : (
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
                  style={{ color: "var(--danger-text)" }} title="Retirer de ce studio">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button onClick={openCreate}
          className="mt-3 rounded-md px-3 py-2 flex items-center gap-2"
          style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>
          <Plus size={13} /> Ajouter un rôle à {studioName}
        </button>
      </div>

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={() => !creating && setCreateOpen(false)}
        >
          <div
            className="rounded-xl w-full max-w-md p-5 flex flex-col gap-4"
            style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div style={{ fontSize: 14, fontWeight: 500 }}>Nouveau rôle métier</div>
              <button onClick={() => !creating && setCreateOpen(false)} className="rounded-md p-1" title="Fermer">
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Nom du rôle *</label>
              <input
                type="text"
                value={newName}
                autoFocus
                placeholder="ex : Barista, Accueil, Cuisine"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newName.trim() && isHexColor(newColor)) createRole(); }}
                className="rounded-md px-2 py-1.5 outline-none"
                style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Couleur *</label>
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    backgroundColor: isHexColor(newColor) ? newColor : "transparent",
                    border: "1px solid var(--border)",
                  }}
                />
                <input
                  type="color"
                  value={isHexColor(newColor) ? newColor : "#3B82F6"}
                  onChange={(e) => setNewColor(e.target.value)}
                  style={{ width: 36, height: 36, border: "none", background: "transparent", cursor: "pointer" }}
                />
                <input
                  type="text"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  placeholder="#RRGGBB"
                  className="rounded-md px-2 py-1.5 outline-none"
                  style={{ fontSize: 12, width: 100, border: "0.5px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: "monospace" }}
                />
                <button
                  type="button"
                  onClick={() => setNewColor(randomPresetColor())}
                  className="rounded-md px-2 py-1.5 flex items-center gap-1"
                  style={{ fontSize: 11, border: "0.5px solid var(--border)" }}
                  title="Couleur aléatoire de la palette"
                >
                  <Shuffle size={12} /> Aléatoire
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {PRESET_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    title={c}
                    style={{
                      width: 22, height: 22, borderRadius: "50%",
                      backgroundColor: c,
                      border: newColor.toLowerCase() === c.toLowerCase() ? "2px solid var(--foreground)" : "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                className="rounded-md px-3 py-2"
                style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}
              >
                Annuler
              </button>
              <button
                onClick={createRole}
                disabled={creating || !newName.trim() || !isHexColor(newColor)}
                className="rounded-md px-3 py-2"
                style={{
                  fontSize: 12, fontWeight: 500,
                  backgroundColor: "var(--foreground)", color: "var(--card)",
                  opacity: (creating || !newName.trim() || !isHexColor(newColor)) ? 0.5 : 1,
                }}
              >
                {creating ? "Création…" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
