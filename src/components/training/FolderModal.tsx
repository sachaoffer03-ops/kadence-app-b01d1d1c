import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FOLDER_COLORS, FOLDER_ICONS, DEFAULT_FOLDER_COLOR, DEFAULT_FOLDER_ICON } from "@/lib/training-presets";
import { useBusinessRoles } from "@/hooks/use-business-roles";
import { toast } from "sonner";
import { createFolder, updateFolder } from "@/hooks/use-training";
import type { TrainingFolder } from "@/types/training";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folder?: TrainingFolder | null; // null/undefined = create
  onSaved?: () => void;
}

export function FolderModal({ open, onOpenChange, folder, onSaved }: Props) {
  const { names: allRoles } = useBusinessRoles({ onlyActive: true });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(DEFAULT_FOLDER_ICON);
  const [color, setColor] = useState(DEFAULT_FOLDER_COLOR);
  const [requiredRoles, setRequiredRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(folder?.name ?? "");
    setDescription(folder?.description ?? "");
    setIcon(folder?.icon ?? DEFAULT_FOLDER_ICON);
    setColor(folder?.color ?? DEFAULT_FOLDER_COLOR);
    setRequiredRoles(folder?.required_for_roles ?? []);
  }, [open, folder]);

  const toggleRole = (r: string) =>
    setRequiredRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const save = async () => {
    if (!name.trim()) { toast.error("Nom requis"); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        icon, color,
        required_for_roles: requiredRoles,
      };
      if (folder) await updateFolder(folder.id, payload);
      else await createFolder(payload);
      toast.success(folder ? "Dossier mis à jour" : "Dossier créé");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontSize: 16, fontWeight: 500 }}>
            {folder ? "Modifier le dossier" : "Nouveau dossier"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Nom</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Onboarding"
              className="w-full mt-1.5"
              style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)" }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionnel"
              rows={2}
              className="w-full mt-1.5"
              style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)", resize: "vertical" }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Couleur</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {FOLDER_COLORS.map((c) => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)}
                  className="rounded-full transition-transform"
                  style={{
                    width: 28, height: 28, backgroundColor: c.value,
                    border: color === c.value ? "2px solid var(--foreground)" : "0.5px solid var(--border)",
                    transform: color === c.value ? "scale(1.1)" : "scale(1)",
                  }}
                  title={c.name} />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Icône</label>
            <div className="grid grid-cols-10 gap-1.5 mt-2">
              {FOLDER_ICONS.map(({ name: n, icon: Ic }) => {
                const active = icon === n;
                return (
                  <button key={n} type="button" onClick={() => setIcon(n)}
                    className="rounded-md flex items-center justify-center transition-colors"
                    style={{
                      aspectRatio: "1", padding: 6,
                      backgroundColor: active ? color : "transparent",
                      color: active ? "#fff" : "var(--foreground)",
                      border: `0.5px solid ${active ? color : "var(--border)"}`,
                    }}>
                    <Ic size={16} />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Rôles concernés</label>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, marginBottom: 8 }}>
              Vide = optionnel pour tous. Sélectionnés = obligatoire pour ces rôles.
            </div>
            <div className="flex flex-wrap gap-2">
              {allRoles.map((r) => {
                const a = requiredRoles.includes(r);
                return (
                  <button key={r} type="button" onClick={() => toggleRole(r)}
                    className="rounded-full px-2.5 py-1"
                    style={{
                      fontSize: 11, fontWeight: a ? 500 : 400,
                      backgroundColor: a ? "var(--foreground)" : "transparent",
                      color: a ? "var(--card)" : "var(--muted-foreground)",
                      border: a ? "none" : "0.5px solid var(--border)",
                    }}>
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <button onClick={() => onOpenChange(false)} disabled={saving}
            className="rounded-md px-3 py-2"
            style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Annuler
          </button>
          <button onClick={save} disabled={saving}
            className="rounded-md px-3 py-2"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            {saving ? "..." : folder ? "Sauvegarder" : "Créer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
