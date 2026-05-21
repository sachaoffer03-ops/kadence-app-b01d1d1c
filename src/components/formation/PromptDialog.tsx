import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FolderPlus, FilePlus, Pencil } from "lucide-react";

export type PromptVariant = "section" | "module" | "rename";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  variant: PromptVariant;
  initialValue?: string;
  onSubmit: (value: string) => Promise<void> | void;
}

const VARIANTS = {
  section: {
    icon: FolderPlus,
    title: "Nouvelle section",
    subtitle: "Regroupe les modules d'une même thématique",
    placeholder: "Ex. Les fondamentaux",
    cta: "Créer la section",
  },
  module: {
    icon: FilePlus,
    title: "Nouveau module",
    subtitle: "Une étape concrète du parcours",
    placeholder: "Ex. Préparer la machine à café",
    cta: "Créer le module",
  },
  rename: {
    icon: Pencil,
    title: "Renommer",
    subtitle: "Mets à jour le titre",
    placeholder: "Nouveau titre",
    cta: "Enregistrer",
  },
} as const;

export function PromptDialog({ open, onOpenChange, variant, initialValue, onSubmit }: Props) {
  const cfg = VARIANTS[variant];
  const Icon = cfg.icon;
  const [value, setValue] = useState(initialValue ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setValue(initialValue ?? ""); setBusy(false); } }, [open, initialValue]);

  const submit = async () => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    try { await onSubmit(v); onOpenChange(false); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
        <DialogHeader className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, backgroundColor: "var(--muted)" }}>
              <Icon size={16} strokeWidth={1.5} style={{ color: "var(--foreground)" }} />
            </div>
            <div className="flex flex-col">
              <DialogTitle style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em" }}>{cfg.title}</DialogTitle>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{cfg.subtitle}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6">
          <label style={{ fontSize: 11, fontWeight: 500, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Titre</label>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={cfg.placeholder}
            className="w-full bg-transparent outline-none transition-colors"
            style={{ fontSize: 13, padding: "10px 12px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--foreground)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: "0.5px solid var(--border)", backgroundColor: "var(--muted)" }}>
          <button onClick={() => onOpenChange(false)} disabled={busy}
            className="rounded-md transition-colors hover:bg-[var(--card)]"
            style={{ fontSize: 12, fontWeight: 500, padding: "8px 14px", color: "var(--muted-foreground)" }}>
            Annuler
          </button>
          <button onClick={submit} disabled={busy || !value.trim()}
            className="rounded-md transition-opacity disabled:opacity-40"
            style={{ fontSize: 12, fontWeight: 500, padding: "8px 16px", backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            {busy ? "..." : cfg.cta}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
