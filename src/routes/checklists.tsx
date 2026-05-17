import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardCheck, Plus, Trash2, X, Image as ImageIcon, Camera, Check,
  MessageSquare, Eye, ChevronUp, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useChecklistTemplates, useTemplateWithContent, createTemplate, updateTemplate, deleteTemplate,
  createItem, updateItem, deleteItem, reorderItems,
  createPhoto, updatePhoto, deletePhoto, uploadReferencePhoto, getChecklistPhotoUrl,
  useChecklistSubmissions, loadSubmissionDetail, reviewSubmission,
  type SubmissionWithRelated,
} from "@/hooks/use-checklists";
import type {
  ChecklistTemplateItem, ChecklistTemplatePhoto,
  ChecklistSubmissionItem, ChecklistSubmissionPhoto,
} from "@/types/checklists";
import { useBusinessRoles } from "@/hooks/use-business-roles";
import { useStudios } from "@/hooks/use-studios";

export const Route = createFileRoute("/checklists")({
  component: ChecklistsPage,
  head: () => ({ meta: [{ title: "Checklists — Kadence" }] }),
});

type Tab = "templates" | "submissions";

function ChecklistsPage() {
  const [tab, setTab] = useState<Tab>("templates");

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Checklists de fin de shift</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Modèles par rôle, items à cocher, photos de validation et suivi des soumissions.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: "var(--border)" }}>
        <TabButton active={tab === "templates"} onClick={() => setTab("templates")} label="Modèles" />
        <TabButton active={tab === "submissions"} onClick={() => setTab("submissions")} label="Soumissions" />
      </div>

      {tab === "templates" ? <TemplatesView /> : <SubmissionsView />}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="px-4 py-2.5 transition-colors"
      style={{
        fontSize: 13, fontWeight: 500,
        color: active ? "var(--foreground)" : "var(--muted-foreground)",
        borderBottom: active ? "2px solid var(--coral)" : "2px solid transparent",
        marginBottom: -1,
      }}>
      {label}
    </button>
  );
}

// ============================================================
// TEMPLATES VIEW
// ============================================================

function TemplatesView() {
  const { templates, loading, reload } = useChecklistTemplates();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!selectedId && templates.length > 0) setSelectedId(templates[0].id);
    if (selectedId && !templates.find((t) => t.id === selectedId)) setSelectedId(templates[0]?.id ?? null);
  }, [templates, selectedId]);

  if (loading) {
    return <div style={{ fontSize: 13, color: "var(--muted-foreground)" }} className="py-12 text-center">Chargement…</div>;
  }

  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: "280px 1fr" }}>
      {/* Sidebar */}
      <div>
        <button onClick={() => setShowCreate(true)}
          className="w-full rounded-md py-2.5 mb-3 flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90"
          style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
          <Plus size={14} /> Nouveau modèle
        </button>

        {templates.length === 0 ? (
          <div className="rounded-lg border p-5 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <ClipboardCheck size={22} className="mx-auto mb-2" style={{ color: "var(--muted-foreground)" }} />
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              Aucun modèle. Crée ton premier modèle de checklist par rôle.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {templates.map((tpl) => (
              <button key={tpl.id} onClick={() => setSelectedId(tpl.id)}
                className="text-left rounded-md px-3 py-2.5 transition-colors"
                style={{
                  backgroundColor: selectedId === tpl.id ? "var(--coral-light)" : "transparent",
                  border: selectedId === tpl.id ? "1px solid var(--coral)" : "1px solid transparent",
                }}>
                <div className="flex items-center justify-between gap-2">
                  <div style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tpl.name}</div>
                  {!tpl.is_active && (
                    <span className="rounded px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>off</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main editor */}
      <div>
        {selectedId ? <TemplateEditor templateId={selectedId} onDeleted={() => { setSelectedId(null); reload(); }} /> : (
          <div className="rounded-lg border p-12 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Sélectionne un modèle pour l'éditer.</div>
          </div>
        )}
      </div>

      {showCreate && <CreateTemplateModal onClose={() => setShowCreate(false)} onCreated={(id) => { setSelectedId(id); setShowCreate(false); }} />}
    </div>
  );
}

// ============================================================
// TEMPLATE EDITOR
// ============================================================

function TemplateEditor({ templateId, onDeleted }: { templateId: string; onDeleted?: () => void }) {
  const { data, loading } = useTemplateWithContent(templateId);
  const { roles } = useBusinessRoles({ onlyActive: true });
  const { studios } = useStudios();
  const [section, setSection] = useState<"items" | "photos" | "settings">("items");

  if (loading || !data) {
    return <div style={{ fontSize: 13, color: "var(--muted-foreground)" }} className="py-12 text-center">Chargement…</div>;
  }

  const role = roles.find((r) => r.id === data.business_role_id);
  const studio = studios.find((s) => s.id === data.studio_id);

  return (
    <div className="rounded-lg border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 2 }}>{data.name}</div>
            <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {role && (
                <span className="rounded px-1.5 py-0.5" style={{ backgroundColor: role.color + "20", color: role.color }}>{role.name}</span>
              )}
              {studio && <span>· {studio.short_name || studio.name}</span>}
              {!studio && <span>· Tous studios</span>}
              {data.is_blocking && <span>· Bloquante</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 px-5 border-b" style={{ borderColor: "var(--border)" }}>
        <SubTab active={section === "items"} onClick={() => setSection("items")} label={`Items (${data.items.length})`} />
        <SubTab active={section === "photos"} onClick={() => setSection("photos")} label={`Photos (${data.photos.length})`} />
        <SubTab active={section === "settings"} onClick={() => setSection("settings")} label="Réglages" />
      </div>

      <div className="p-5">
        {section === "items" && <ItemsEditor templateId={templateId} items={data.items} />}
        {section === "photos" && <PhotosEditor templateId={templateId} photos={data.photos} />}
        {section === "settings" && <TemplateSettings template={data} onDeleted={onDeleted} />}
      </div>
    </div>
  );
}

function SubTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="px-3 py-2.5 transition-colors"
      style={{
        fontSize: 12, fontWeight: 500,
        color: active ? "var(--foreground)" : "var(--muted-foreground)",
        borderBottom: active ? "2px solid var(--coral)" : "2px solid transparent",
        marginBottom: -1,
      }}>{label}</button>
  );
}

// =============== Items Editor ===============

function ItemsEditor({ templateId, items }: { templateId: string; items: ChecklistTemplateItem[] }) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [localOrder, setLocalOrder] = useState<ChecklistTemplateItem[]>(items);
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => { setLocalOrder(items); }, [items]);

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setBusy(true);
    try {
      await createItem(templateId, { label: newLabel });
      setNewLabel(""); setAdding(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= localOrder.length) return;
    const next = [...localOrder];
    [next[idx], next[target]] = [next[target], next[idx]];
    setLocalOrder(next);
    setMovingId(next[target].id);
    try {
      await reorderItems(next.map((i) => i.id));
    } catch (e: any) {
      toast.error("Erreur de réorganisation");
      setLocalOrder(items);
    } finally {
      setTimeout(() => setMovingId(null), 250);
    }
  }

  return (
    <div>
      {localOrder.length === 0 && !adding && (
        <div className="rounded-md border-dashed border p-6 text-center mb-3" style={{ borderColor: "var(--border)" }}>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 8 }}>Aucun item à cocher pour ce modèle.</div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 mb-3">
        {localOrder.map((item, idx) => (
          <ItemRow
            key={item.id}
            item={item}
            index={idx}
            total={localOrder.length}
            highlight={movingId === item.id}
            onMoveUp={() => move(idx, -1)}
            onMoveDown={() => move(idx, 1)}
          />
        ))}
      </div>

      {adding ? (
        <div className="rounded-md border p-3" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
          <input autoFocus value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
            placeholder="Ex: Plan de travail nettoyé"
            className="w-full bg-transparent outline-none mb-2"
            style={{ fontSize: 13, fontWeight: 500 }} />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setNewLabel(""); }} className="px-3 py-1.5 rounded-md"
              style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Annuler</button>
            <button onClick={handleAdd} disabled={!newLabel.trim() || busy}
              className="px-3 py-1.5 rounded-md disabled:opacity-40"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>Ajouter</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full rounded-md border-dashed border py-2.5 flex items-center justify-center gap-1.5 transition-colors hover:bg-[var(--muted)]"
          style={{ fontSize: 12, fontWeight: 500, borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          <Plus size={13} /> Ajouter un item
        </button>
      )}
    </div>
  );
}

function ItemRow({ item, index, total, highlight, onMoveUp, onMoveDown }: {
  item: ChecklistTemplateItem;
  index: number;
  total: number;
  highlight: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);

  useEffect(() => { setLabel(item.label); }, [item.label]);

  async function save() {
    if (label.trim() && label !== item.label) {
      await updateItem(item.id, { label: label.trim() });
    } else {
      setLabel(item.label);
    }
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm(`Supprimer "${item.label}" ?`)) return;
    await deleteItem(item.id);
  }

  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div className="flex items-center gap-2 rounded-md border px-2 py-2 group transition-colors"
      style={{
        backgroundColor: highlight ? "var(--muted)" : "#fff",
        borderColor: "var(--border)",
        transition: "background-color 250ms",
      }}>
      <div className="flex flex-col shrink-0" style={{ width: 24 }}>
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Monter"
          className="flex items-center justify-center rounded transition-colors disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[var(--muted)]"
          style={{ height: 18, color: "var(--muted-foreground)" }}>
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Descendre"
          className="flex items-center justify-center rounded transition-colors disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[var(--muted)]"
          style={{ height: 18, color: "var(--muted-foreground)" }}>
          <ChevronDown size={14} />
        </button>
      </div>
      <span className="rounded-sm shrink-0" style={{
        width: 18, height: 18, border: "1.5px solid rgba(0,0,0,0.25)", backgroundColor: "#fff",
      }} aria-hidden />
      {editing ? (
        <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)}
          onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setLabel(item.label); setEditing(false); } }}
          className="flex-1 bg-transparent outline-none" style={{ fontSize: 13 }} />
      ) : (
        <button onClick={() => setEditing(true)} className="flex-1 text-left" style={{ fontSize: 13 }}>{item.label}</button>
      )}
      <button onClick={handleDelete} aria-label="Supprimer"
        className="md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded transition-opacity"
        style={{ color: "var(--muted-foreground)" }}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// =============== Photos Editor ===============

function PhotosEditor({ templateId, photos }: { templateId: string; photos: ChecklistTemplatePhoto[] }) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  async function handleAdd() {
    if (!newLabel.trim()) return;
    try {
      await createPhoto(templateId, { label: newLabel });
      setNewLabel(""); setAdding(false);
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {photos.map((p) => (
          <PhotoCard key={p.id} photo={p} templateId={templateId} />
        ))}
      </div>

      {adding ? (
        <div className="rounded-md border p-3" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
          <input autoFocus value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
            placeholder="Ex: Comptoir café rangé"
            className="w-full bg-transparent outline-none mb-2"
            style={{ fontSize: 13, fontWeight: 500 }} />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setNewLabel(""); }} className="px-3 py-1.5 rounded-md"
              style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Annuler</button>
            <button onClick={handleAdd} disabled={!newLabel.trim()}
              className="px-3 py-1.5 rounded-md disabled:opacity-40"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>Ajouter</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full rounded-md border-dashed border py-2.5 flex items-center justify-center gap-1.5 transition-colors hover:bg-[var(--muted)]"
          style={{ fontSize: 12, fontWeight: 500, borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          <Plus size={13} /> Ajouter une photo de validation
        </button>
      )}
    </div>
  );
}

function PhotoCard({ photo, templateId }: { photo: ChecklistTemplatePhoto; templateId: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    if (photo.reference_photo_url) {
      getChecklistPhotoUrl(photo.reference_photo_url).then((u) => { if (alive) setSignedUrl(u); });
    } else {
      setSignedUrl(null);
    }
    return () => { alive = false; };
  }, [photo.reference_photo_url]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadReferencePhoto(file, templateId, photo.id);
      toast.success("Photo de référence enregistrée");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!confirm(`Supprimer "${photo.label}" ?`)) return;
    await deletePhoto(photo.id);
  }

  return (
    <div className="rounded-md border overflow-hidden flex flex-col" style={{ backgroundColor: "#fff", borderColor: "var(--border)" }}>
      <div className="relative bg-[var(--muted)]" style={{ aspectRatio: "4/3" }}>
        {signedUrl ? (
          <img src={signedUrl} alt={photo.label} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2" style={{ color: "var(--muted-foreground)" }}>
            <ImageIcon size={26} strokeWidth={1.4} />
            <div style={{ fontSize: 11 }}>Aucune référence</div>
          </div>
        )}
      </div>
      <div className="p-2.5 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.label}</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="p-1.5 rounded transition-colors hover:bg-[var(--muted)]"
          title={signedUrl ? "Remplacer" : "Téléverser"} style={{ color: "var(--coral)" }}>
          <Camera size={13} />
        </button>
        <button onClick={handleDelete} className="p-1.5 rounded transition-colors hover:bg-[var(--muted)]"
          style={{ color: "var(--muted-foreground)" }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// =============== Template Settings ===============

function TemplateSettings({ template, onDeleted }: { template: { id: string; name: string; description: string | null; business_role_id: string | null; studio_id: string | null; is_blocking: boolean; is_active: boolean }; onDeleted?: () => void }) {
  const { roles } = useBusinessRoles({ onlyActive: true });
  const { studios } = useStudios();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [roleId, setRoleId] = useState<string | null>(template.business_role_id);
  const [studioId, setStudioId] = useState<string | null>(template.studio_id);
  const [isBlocking, setIsBlocking] = useState(template.is_blocking);
  const [isActive, setIsActive] = useState(template.is_active);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(template.name);
    setDescription(template.description ?? "");
    setRoleId(template.business_role_id);
    setStudioId(template.studio_id);
    setIsBlocking(template.is_blocking);
    setIsActive(template.is_active);
  }, [template]);

  async function handleSave() {
    setBusy(true);
    try {
      await updateTemplate(template.id, {
        name, description: description || null, business_role_id: roleId,
        studio_id: studioId, is_blocking: isBlocking, is_active: isActive,
      });
      toast.success("Modèle enregistré");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!confirm(`Supprimer définitivement "${template.name}" ? Toutes les soumissions liées seront aussi supprimées.`)) return;
    try {
      await deleteTemplate(template.id);
      toast.success("Modèle supprimé");
      onDeleted?.();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="max-w-xl">
      <Field label="Nom du modèle">
        <Input value={name} onChange={setName} />
      </Field>
      <Field label="Description">
        <Input value={description} onChange={setDescription} placeholder="Ex: Checklist fermeture barista" />
      </Field>
      <Field label="Rôle métier">
        <select value={roleId ?? ""} onChange={(e) => setRoleId(e.target.value || null)}
          className="w-full rounded-md border px-3 py-2 outline-none" style={{ fontSize: 13, borderColor: "var(--border)", backgroundColor: "#fff" }}>
          <option value="">— Aucun (tous rôles) —</option>
          {roles.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
        </select>
      </Field>
      <Field label="Studio">
        <select value={studioId ?? ""} onChange={(e) => setStudioId(e.target.value || null)}
          className="w-full rounded-md border px-3 py-2 outline-none" style={{ fontSize: 13, borderColor: "var(--border)", backgroundColor: "#fff" }}>
          <option value="">— Tous les studios —</option>
          {studios.map((s) => (<option key={s.id} value={s.id}>{s.short_name || s.name}</option>))}
        </select>
      </Field>

      <div className="flex flex-col gap-3 mb-5 mt-4">
        <Toggle label="Bloquante au pointage de sortie" hint="L'employé ne peut pas clôturer son shift sans compléter cette checklist" value={isBlocking} onChange={setIsBlocking} />
        <Toggle label="Modèle actif" hint="Désactivé : invisible aux employés mais conservé pour l'historique" value={isActive} onChange={setIsActive} />
      </div>

      <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <button onClick={handleDelete} className="px-3 py-2 rounded-md flex items-center gap-1.5 transition-colors hover:bg-red-50"
          style={{ fontSize: 12, color: "#c44" }}>
          <Trash2 size={12} /> Supprimer le modèle
        </button>
        <button onClick={handleSave} disabled={busy || !name.trim()}
          className="px-4 py-2 rounded-md disabled:opacity-40"
          style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-md border px-3 py-2 outline-none focus:border-[var(--foreground)]"
      style={{ fontSize: 13, borderColor: "var(--border)", backgroundColor: "#fff" }} />
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex items-start justify-between gap-3 text-left rounded-md border px-3 py-2.5"
      style={{ backgroundColor: "#fff", borderColor: "var(--border)" }}>
      <div className="flex-1">
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div className="rounded-full transition-colors shrink-0 mt-0.5" style={{
        width: 32, height: 18,
        backgroundColor: value ? "var(--coral)" : "rgba(0,0,0,0.15)",
        position: "relative",
      }}>
        <div className="rounded-full transition-transform" style={{
          width: 14, height: 14, backgroundColor: "#fff",
          position: "absolute", top: 2, left: 2,
          transform: value ? "translateX(14px)" : "translateX(0)",
        }} />
      </div>
    </button>
  );
}

// =============== Create Template Modal ===============

function CreateTemplateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { roles } = useBusinessRoles({ onlyActive: true });
  const { studios } = useStudios();
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const tpl = await createTemplate({ name, business_role_id: roleId, studio_id: studioId });
      toast.success("Modèle créé");
      onCreated(tpl.id);
    } catch (e: any) { toast.error(e.message); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full rounded-lg border shadow-xl"
        style={{ maxWidth: 460, backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Nouveau modèle de checklist</div>
          <button onClick={onClose} className="rounded-full p-1.5" style={{ backgroundColor: "var(--muted)" }}>
            <X size={13} />
          </button>
        </div>
        <div className="p-5">
          <Field label="Nom"><Input value={name} onChange={setName} placeholder="Ex: Fermeture barista" /></Field>
          <Field label="Rôle métier (optionnel)">
            <select value={roleId ?? ""} onChange={(e) => setRoleId(e.target.value || null)}
              className="w-full rounded-md border px-3 py-2 outline-none" style={{ fontSize: 13, borderColor: "var(--border)", backgroundColor: "#fff" }}>
              <option value="">— Tous les rôles —</option>
              {roles.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
            </select>
          </Field>
          <Field label="Studio (optionnel)">
            <select value={studioId ?? ""} onChange={(e) => setStudioId(e.target.value || null)}
              className="w-full rounded-md border px-3 py-2 outline-none" style={{ fontSize: 13, borderColor: "var(--border)", backgroundColor: "#fff" }}>
              <option value="">— Tous les studios —</option>
              {studios.map((s) => (<option key={s.id} value={s.id}>{s.short_name || s.name}</option>))}
            </select>
          </Field>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-md" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Annuler</button>
          <button onClick={handleSubmit} disabled={!name.trim() || busy}
            className="px-4 py-2 rounded-md disabled:opacity-40"
            style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
            {busy ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUBMISSIONS VIEW
// ============================================================

function SubmissionsView() {
  const { submissions, loading } = useChecklistSubmissions();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "to_review" | "reviewed" | "in_progress">("all");

  const filtered = useMemo(() => {
    if (filter === "all") return submissions;
    if (filter === "to_review") {
      return submissions.filter((s) =>
        (s.status === "completed" || s.status === "incomplete_submitted") && !s.reviewed_by_admin_at
      );
    }
    if (filter === "reviewed") return submissions.filter((s) => !!s.reviewed_by_admin_at);
    if (filter === "in_progress") return submissions.filter((s) => s.status === "in_progress");
    return submissions;
  }, [submissions, filter]);

  if (loading) {
    return <div style={{ fontSize: 13, color: "var(--muted-foreground)" }} className="py-12 text-center">Chargement…</div>;
  }

  return (
    <div>
      <div className="flex gap-1.5 mb-4">
        {([
          { v: "all", l: "Toutes" },
          { v: "to_review", l: "À réviser" },
          { v: "in_progress", l: "En cours" },
          { v: "reviewed", l: "Révisées" },
        ] as const).map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className="px-3 py-1.5 rounded-md transition-colors"
            style={{
              fontSize: 12, fontWeight: 500,
              backgroundColor: filter === f.v ? "var(--coral-light)" : "var(--card)",
              border: `1px solid ${filter === f.v ? "var(--coral)" : "var(--border)"}`,
              color: filter === f.v ? "var(--coral-dark, var(--coral))" : "var(--muted-foreground)",
            }}>
            {f.l}{filter === f.v && submissions.length > 0 && ` · ${filtered.length}`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border p-12 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <ClipboardCheck size={26} className="mx-auto mb-3" style={{ color: "var(--muted-foreground)" }} strokeWidth={1.4} />
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Aucune soumission {filter !== "all" && "dans ce filtre"}.
          </div>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {filtered.map((s, i) => (
            <SubmissionRow key={s.id} sub={s} onClick={() => setOpenId(s.id)} isLast={i === filtered.length - 1} />
          ))}
        </div>
      )}

      {openId && <SubmissionDrawer submissionId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function SubmissionRow({ sub, onClick, isLast }: { sub: SubmissionWithRelated; onClick: () => void; isLast: boolean }) {
  const statusColors: Record<string, { bg: string; fg: string; label: string }> = {
    pending: { bg: "rgba(0,0,0,0.06)", fg: "var(--muted-foreground)", label: "En attente" },
    in_progress: { bg: "#fef3c7", fg: "#92400e", label: "En cours" },
    completed: { bg: "var(--coral-light)", fg: "var(--coral-dark, var(--coral))", label: "À réviser" },
    incomplete_submitted: { bg: "#fee2e2", fg: "#991b1b", label: "Incomplète" },
  };
  const sc = sub.reviewed_by_admin_at
    ? { bg: "#dcfce7", fg: "#166534", label: "Révisée" }
    : (statusColors[sub.status] ?? statusColors.pending);

  return (
    <button onClick={onClick}
      className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[var(--muted)]"
      style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          {sub.user_first_name} {sub.user_last_name}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
          {sub.template_name} · {sub.shift_date ? new Date(sub.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "—"}
        </div>
      </div>
      <span className="rounded px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: sc.bg, color: sc.fg }}>
        {sc.label}
      </span>
      <Eye size={14} style={{ color: "var(--muted-foreground)" }} />
    </button>
  );
}

function SubmissionDrawer({ submissionId, onClose }: { submissionId: string; onClose: () => void }) {
  const { submissions } = useChecklistSubmissions();
  const sub = submissions.find((s) => s.id === submissionId);
  const [items, setItems] = useState<ChecklistSubmissionItem[]>([]);
  const [photos, setPhotos] = useState<ChecklistSubmissionPhoto[]>([]);
  const [tplItems, setTplItems] = useState<Map<string, string>>(new Map());
  const [tplPhotos, setTplPhotos] = useState<Map<string, ChecklistTemplatePhoto>>(new Map());
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const detail = await loadSubmissionDetail(submissionId);
      if (!alive) return;
      setItems(detail.items);
      setPhotos(detail.photos);

      // Load template items + photos labels
      if (sub?.template_id) {
        const { data: ti } = await supabase
          .from("checklist_template_items").select("id, label").eq("template_id", sub.template_id);
        const { data: tp } = await supabase
          .from("checklist_template_photos").select("*").eq("template_id", sub.template_id);
        if (alive) {
          setTplItems(new Map((ti ?? []).map((i: any) => [i.id, i.label])));
          setTplPhotos(new Map(((tp as any[]) ?? []).map((p: any) => [p.id, p])));
        }
      }
      if (alive) setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [submissionId, sub?.template_id]);

  useEffect(() => { setFeedback(sub?.admin_feedback ?? ""); }, [sub?.admin_feedback]);

  async function handleReview() {
    setBusy(true);
    try {
      await reviewSubmission(submissionId, feedback.trim() || null);
      toast.success("Marquée comme révisée");
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  if (!sub) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full h-full overflow-y-auto"
        style={{ maxWidth: 560, backgroundColor: "var(--background)", animation: "slideInRight 200ms ease-out" }}>
        <div className="sticky top-0 z-10 px-5 py-4 border-b flex items-center justify-between"
          style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>
              {sub.user_first_name} {sub.user_last_name}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
              {sub.template_name} · {sub.shift_date && new Date(sub.shift_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5" style={{ backgroundColor: "var(--muted)" }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div style={{ fontSize: 13, color: "var(--muted-foreground)" }} className="py-12 text-center">Chargement…</div>
          ) : (
            <>
              {items.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Items ({items.filter((i) => i.is_checked).length}/{items.length})
                  </div>
                  <div className="rounded-md border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                    {items.map((it, idx) => (
                      <div key={it.id} className="flex items-center gap-2.5 px-3 py-2.5"
                        style={{ borderBottom: idx === items.length - 1 ? "none" : "1px solid var(--border)" }}>
                        <span className="rounded flex items-center justify-center shrink-0"
                          style={{
                            width: 18, height: 18,
                            backgroundColor: it.is_checked ? "var(--coral)" : "transparent",
                            border: it.is_checked ? "none" : "1.5px solid rgba(0,0,0,0.2)",
                          }}>
                          {it.is_checked && <Check size={12} color="#fff" strokeWidth={2.5} />}
                        </span>
                        <span style={{ fontSize: 13, opacity: it.is_checked ? 1 : 0.6 }}>
                          {tplItems.get(it.template_item_id) ?? "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {photos.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Photos ({photos.filter((p) => p.photo_url).length}/{photos.length})
                  </div>
                  <div className="flex flex-col gap-3">
                    {photos.map((p) => (
                      <PhotoComparisonRow key={p.id} sp={p} reference={tplPhotos.get(p.template_photo_id)} />
                    ))}
                  </div>
                </div>
              )}

              {sub.employee_note && (
                <div className="mb-5">
                  <div className="mb-2 flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <MessageSquare size={11} /> Note de l'employé
                  </div>
                  <div className="rounded-md border p-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {sub.employee_note}
                  </div>
                </div>
              )}

              <div className="mb-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="mb-2" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Ton retour à l'employé
                </div>
                <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Ex: Bien rangé, merci ! / Penser à essuyer le moulin la prochaine fois…"
                  rows={3}
                  className="w-full rounded-md border px-3 py-2 outline-none focus:border-[var(--foreground)] resize-none"
                  style={{ fontSize: 13, borderColor: "var(--border)", backgroundColor: "#fff", lineHeight: 1.5 }} />
                <div className="flex justify-end mt-3">
                  <button onClick={handleReview} disabled={busy}
                    className="px-4 py-2 rounded-md disabled:opacity-40 flex items-center gap-1.5"
                    style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
                    <Check size={13} /> {sub.reviewed_by_admin_at ? "Mettre à jour le retour" : "Marquer comme révisée"}
                  </button>
                </div>
                {sub.reviewed_by_admin_at && (
                  <div className="mt-2" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    Révisée le {new Date(sub.reviewed_by_admin_at).toLocaleString("fr-FR")}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
      </div>
    </div>
  );
}

function PhotoComparisonRow({ sp, reference }: { sp: ChecklistSubmissionPhoto; reference: ChecklistTemplatePhoto | undefined }) {
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [subUrl, setSubUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (reference?.reference_photo_url) {
      getChecklistPhotoUrl(reference.reference_photo_url).then((u) => { if (alive) setRefUrl(u); });
    }
    if (sp.photo_url) {
      getChecklistPhotoUrl(sp.photo_url).then((u) => { if (alive) setSubUrl(u); });
    }
    return () => { alive = false; };
  }, [reference?.reference_photo_url, sp.photo_url]);

  return (
    <div className="rounded-md border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border)", fontSize: 12, fontWeight: 500 }}>
        {reference?.label ?? "Photo"}
      </div>
      <div className="grid grid-cols-2 gap-px" style={{ backgroundColor: "var(--border)" }}>
        <div className="bg-[var(--muted)]">
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", padding: "4px 8px", backgroundColor: "var(--card)" }}>Référence</div>
          <div style={{ aspectRatio: "4/3" }} className="bg-[var(--muted)] flex items-center justify-center">
            {refUrl ? <img src={refUrl} alt="ref" className="w-full h-full object-cover" /> : <ImageIcon size={20} style={{ color: "var(--muted-foreground)" }} />}
          </div>
        </div>
        <div className="bg-[var(--muted)]">
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", padding: "4px 8px", backgroundColor: "var(--card)" }}>Soumission</div>
          <div style={{ aspectRatio: "4/3" }} className="bg-[var(--muted)] flex items-center justify-center">
            {subUrl ? <img src={subUrl} alt="sub" className="w-full h-full object-cover" /> : <ImageIcon size={20} style={{ color: "var(--muted-foreground)" }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
