import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, MapPin, Users, ChefHat, X } from "lucide-react";
import { toast } from "sonner";
import {
  listStudiosAdmin,
  listAdminCandidates,
  createStudio,
  updateStudio,
  deleteStudio,
} from "@/lib/studios.functions";

export const Route = createFileRoute("/studios")({
  component: StudiosPage,
  head: () => ({ meta: [{ title: "Studios — Kadence" }] }),
});

type StudioRow = Awaited<ReturnType<typeof listStudiosAdmin>>[number];
type AdminLite = { id: string; first_name: string; last_name: string; email: string };

function StudiosPage() {
  const list = useServerFn(listStudiosAdmin);
  const listAdmins = useServerFn(listAdminCandidates);

  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [admins, setAdmins] = useState<AdminLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StudioRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<StudioRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([list({}), listAdmins({})]);
      setStudios(s);
      setAdmins(a as AdminLite[]);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Studios</h1>
          <p className="text-sm text-muted-foreground">
            Gérez vos établissements, leurs managers et leurs équipements.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
        >
          <Plus size={14} /> Ajouter un studio
        </button>
      </header>

      {loading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : studios.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Aucun studio. Cliquez sur « Ajouter un studio » pour commencer.
        </div>
      ) : (
        <div className="grid gap-3">
          {studios.map((s) => (
            <article
              key={s.id}
              className="rounded-lg border p-4 flex items-start gap-4"
              style={{ backgroundColor: "#fff" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-medium">{s.name}</h2>
                  {s.short_name && (
                    <span className="text-xs rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
                      {s.short_name}
                    </span>
                  )}
                  {s.has_kitchen && (
                    <span className="inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 bg-amber-100 text-amber-800">
                      <ChefHat size={11} /> Cuisine
                    </span>
                  )}
                </div>
                <div className="mt-2 grid sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} />
                    <span className="truncate">{s.address || "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users size={13} />
                    <span>{s.employee_count} employé{s.employee_count > 1 ? "s" : ""}</span>
                  </div>
                  <div className="truncate">
                    Manager :{" "}
                    {s.manager
                      ? `${s.manager.first_name} ${s.manager.last_name}`.trim() || "—"
                      : "—"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditing(s)}
                  className="rounded-md border px-2 py-1.5 text-xs inline-flex items-center gap-1 hover:bg-muted"
                  title="Modifier"
                >
                  <Pencil size={12} /> Modifier
                </button>
                <button
                  onClick={() => setDeleting(s)}
                  className="rounded-md border px-2 py-1.5 text-xs inline-flex items-center gap-1 hover:bg-destructive/10 text-destructive"
                  title="Supprimer"
                >
                  <Trash2 size={12} /> Supprimer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <StudioFormModal
          initial={editing}
          admins={admins}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await load();
          }}
        />
      )}

      {deleting && (
        <DeleteConfirmModal
          studio={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            setDeleting(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

/* -------- Form modal -------- */

function deriveShortName(name: string): string {
  // suggestion non-bloquante : on retire un éventuel préfixe d'enseigne (1er mot)
  // si le nom contient au moins 2 mots, sinon on renvoie tel quel.
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return parts.slice(1).join(" ");
  return trimmed;
}

function StudioFormModal({
  initial,
  admins,
  onClose,
  onSaved,
}: {
  initial: StudioRow | null;
  admins: AdminLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const create = useServerFn(createStudio);
  const update = useServerFn(updateStudio);

  const [name, setName] = useState(initial?.name ?? "");
  const [shortName, setShortName] = useState(initial?.short_name ?? "");
  const [shortTouched, setShortTouched] = useState(!!initial);
  const [address, setAddress] = useState(initial?.address ?? "");
  const [managerId, setManagerId] = useState<string | "">(initial?.manager_id ?? "");
  const [hasKitchen, setHasKitchen] = useState(!!initial?.has_kitchen);
  const [saving, setSaving] = useState(false);

  // auto-suggest short_name à partir du nom tant que le champ n'est pas touché
  useEffect(() => {
    if (!shortTouched) setShortName(deriveShortName(name));
  }, [name, shortTouched]);

  const valid = name.trim().length > 0 && shortName.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        short_name: shortName.trim(),
        address: address.trim() || null,
        manager_id: managerId || null,
        has_kitchen: hasKitchen,
      };
      if (initial) {
        await update({ data: { id: initial.id, patch: payload } });
        toast.success("Studio mis à jour");
      } else {
        await create({ data: payload });
        toast.success("Studio créé");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border bg-card p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">
            {initial ? "Modifier le studio" : "Ajouter un studio"}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        <Field label="Nom complet" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Skult Sablon, Bar du Coin…"
            className="w-full rounded-md border px-3 py-2 text-sm"
            required
            maxLength={120}
          />
        </Field>

        <Field
          label="Nom court"
          required
          hint="Affiché dans les listes compactes (onglets, badges)."
        >
          <input
            value={shortName}
            onChange={(e) => {
              setShortName(e.target.value);
              setShortTouched(true);
            }}
            placeholder="Ex: Sablon"
            className="w-full rounded-md border px-3 py-2 text-sm"
            required
            maxLength={60}
          />
        </Field>

        <Field label="Adresse">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Optionnel"
            className="w-full rounded-md border px-3 py-2 text-sm"
            maxLength={255}
          />
        </Field>

        <Field label="Manager">
          <select
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          >
            <option value="">— Aucun —</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {`${a.first_name} ${a.last_name}`.trim() || a.email}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasKitchen}
            onChange={(e) => setHasKitchen(e.target.checked)}
          />
          <span>Ce studio dispose d'une cuisine</span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!valid || saving}
            className="rounded-md px-3 py-2 text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
          >
            {saving ? "Enregistrement…" : initial ? "Sauvegarder" : "Créer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* -------- Delete confirm -------- */

function DeleteConfirmModal({
  studio,
  onClose,
  onDeleted,
}: {
  studio: StudioRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const del = useServerFn(deleteStudio);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await del({ data: { id: studio.id } });
      toast.success("Studio supprimé");
      onDeleted();
    } catch (e: any) {
      toast.error(e.message ?? "Suppression impossible");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border bg-card p-5 space-y-4"
      >
        <h2 className="text-lg font-medium">Supprimer « {studio.name} » ?</h2>
        <p className="text-sm text-muted-foreground">
          Le studio sera archivé (soft delete) pour préserver l'historique des shifts.
          La suppression est refusée si des shifts, templates ou employés y sont
          encore rattachés.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            Annuler
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="rounded-md px-3 py-2 text-sm bg-destructive text-destructive-foreground disabled:opacity-50"
          >
            {busy ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}
