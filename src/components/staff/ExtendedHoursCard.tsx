import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { updateExtendedHours } from "@/lib/extended-hours.functions";

interface Props {
  userId: string;
  firstName: string;
  contracts: string[];
  allowed: boolean;
  cap: number | null;
  onSaved: () => void;
}

function getContextLabels(contracts: string[]) {
  const hasStudent = contracts.includes("Étudiant");
  const hasFlexi = contracts.includes("Flexi");
  const hasCdi = contracts.includes("CDI");

  const standardCap = hasCdi ? 48 : hasFlexi ? 20 : hasStudent ? 15 : 40;

  let helper: string;
  if (hasStudent && !hasCdi) {
    helper = "Autoriser cet étudiant à dépasser le plafond légal de 15h/semaine.";
  } else if (hasFlexi && !hasCdi) {
    helper = "Autoriser ce Flexi à dépasser le plafond standard de 20h/semaine.";
  } else if (hasCdi) {
    helper = "Définir un plafond hebdomadaire personnalisé (par défaut 48h CDI).";
  } else {
    helper = "Définir un plafond hebdomadaire personnalisé pour cet employé.";
  }

  let warning: string;
  if (hasStudent && !hasCdi) {
    warning =
      "Cet étudiant pourra dépasser le plafond légal de 15h/semaine. Assure-toi qu'il a un statut compatible (équivalent temps plein, étudiant sans plafond hebdo, convention spécifique). Le quota annuel 650h jobiste reste appliqué.";
  } else if (hasFlexi && !hasCdi) {
    warning =
      "Ce Flexi pourra dépasser son plafond standard. Vérifie que son contrat le permet et que les contraintes ONSS sont respectées.";
  } else {
    warning =
      "Le plafond hebdomadaire personnalisé remplace le plafond standard de ce contrat dans le moteur de planning. Maximum légal 48h/semaine.";
  }

  const standardLabel = `${standardCap}h/semaine (standard ${hasCdi ? "CDI" : hasFlexi ? "Flexi" : hasStudent ? "étudiant" : "contrat"})`;
  return { standardCap, helper, warning, standardLabel };
}

export function ExtendedHoursCard({ userId, firstName, contracts, allowed, cap, onSaved }: Props) {
  const labels = getContextLabels(contracts);
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);
  const [draftCap, setDraftCap] = useState<string>(cap !== null && cap !== undefined ? String(cap) : "");
  const [saving, setSaving] = useState(false);
  const update = useServerFn(updateExtendedHours);

  const handleToggle = (next: boolean) => setPendingToggle(next);

  const confirmToggle = async () => {
    if (pendingToggle === null) return;
    setSaving(true);
    try {
      if (pendingToggle) {
        // Activation : on sauve avec cap null (utilise 48 par défaut) — l'admin pourra ensuite saisir un cap
        await update({ data: { userId, allowed: true, cap: null } });
        toast.success("Plafond personnalisé activé");
      } else {
        await update({ data: { userId, allowed: false, cap: null } });
        toast.success("Plafond personnalisé désactivé");
        setDraftCap("");
      }
      setPendingToggle(null);
      onSaved();
    } catch (e: any) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCap = async () => {
    const parsed = draftCap.trim() === "" ? null : Number(draftCap);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 1 || parsed > 48)) {
      toast.error("Plafond invalide", { description: "Entre 1 et 48h/semaine." });
      return;
    }
    setSaving(true);
    try {
      await update({ data: { userId, allowed: true, cap: parsed } });
      toast.success("Plafond enregistré");
      onSaved();
    } catch (e: any) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraftCap(cap !== null && cap !== undefined ? String(cap) : "");
  };

  const currentCap = cap ?? 48;

  return (
    <>
      <div
        className="rounded-xl border"
        style={{
          backgroundColor: "var(--card)",
          borderColor: "var(--border)",
          borderWidth: "0.5px",
          padding: "16px 20px",
          marginTop: 16,
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div style={{ fontSize: 14, fontWeight: 500 }}>Plafond hebdomadaire</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
              {labels.helper}
            </div>
          </div>
          <Switch checked={allowed} onCheckedChange={handleToggle} disabled={saving} />
        </div>

        {allowed ? (
          <div className="mt-4 flex flex-col gap-3">
            <div
              className="rounded-lg"
              style={{
                backgroundColor: "var(--warning-bg)",
                border: "0.5px solid var(--warning-border, var(--border))",
                color: "var(--warning-text)",
                padding: 12,
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {labels.warning}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, display: "block", marginBottom: 6 }}>
                Plafond hebdomadaire personnalisé
              </label>
              <input
                type="number"
                min={1}
                max={48}
                value={draftCap}
                onChange={(e) => setDraftCap(e.target.value)}
                placeholder={`Ex: ${labels.standardCap === 15 ? 30 : 35}h`}
                className="w-full rounded-md px-3 py-2"
                style={{
                  border: "0.5px solid var(--border)",
                  backgroundColor: "var(--background)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
                Laisser vide pour utiliser le plafond CDI (48h).
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveCap}
                disabled={saving}
                className="rounded-md px-3 py-1.5"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: "var(--coral)",
                  color: "var(--coral-text, #fff)",
                  border: "none",
                  cursor: saving ? "wait" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                Enregistrer
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="rounded-md px-3 py-1.5"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: "transparent",
                  color: "var(--muted-foreground)",
                  border: "0.5px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted-foreground)" }}>
            Plafond actuel : {labels.standardLabel}.
          </div>
        )}
      </div>

      <AlertDialog open={pendingToggle !== null} onOpenChange={(o) => !o && setPendingToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingToggle
                ? "Activer un plafond hebdomadaire personnalisé ?"
                : "Désactiver le plafond personnalisé ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggle ? (
                <>
                  Le moteur de planning pourra donner à <strong>{firstName}</strong> jusqu'à{" "}
                  <strong>{currentCap}h/semaine</strong> au lieu de{" "}
                  <strong>{labels.standardCap}h</strong>. Cette action est tracée.
                </>
              ) : (
                <>
                  Le plafond redeviendra <strong>{labels.standardLabel}</strong>. Cette action est tracée.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle} disabled={saving}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
