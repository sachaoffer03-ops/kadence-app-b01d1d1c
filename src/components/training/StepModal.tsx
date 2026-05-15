import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createStep, updateStep } from "@/hooks/use-training";
import type { TrainingStep } from "@/types/training";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderId: string;
  step?: TrainingStep | null;
  onSaved?: () => void;
}

export function StepModal({ open, onOpenChange, folderId, step, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(step?.title ?? "");
    setDescription(step?.description ?? "");
  }, [open, step]);

  const save = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    setSaving(true);
    try {
      if (step) await updateStep(step.id, { title: title.trim(), description: description.trim() || null });
      else await createStep(folderId, { title: title.trim(), description: description.trim() || null });
      toast.success(step ? "Étape mise à jour" : "Étape créée");
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontSize: 16, fontWeight: 500 }}>
            {step ? "Modifier l'étape" : "Nouvelle étape"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de l'étape"
            style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)" }} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optionnel)"
            rows={3}
            style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)", resize: "vertical" }} />
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} disabled={saving}
            className="rounded-md px-3 py-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Annuler
          </button>
          <button onClick={save} disabled={saving}
            className="rounded-md px-3 py-2"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            {saving ? "..." : step ? "Sauvegarder" : "Créer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
