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
  onSaved: () => void;
}

function getContextLabels(contracts: string[]) {
  const hasStudent = contracts.includes("Étudiant");
  const hasFlexi = contracts.includes("Flexi");
  const hasCdi = contracts.includes("CDI");

  const standardCap = hasCdi ? 48 : hasFlexi ? 20 : hasStudent ? 15 : 40;
  const standardLabel = `${standardCap}h`;

  let helper: string;
  if (hasStudent && !hasCdi) {
    helper = "Autoriser cet étudiant à dépasser son plafond hebdomadaire de 15h.";
  } else if (hasFlexi && !hasCdi) {
    helper = "Autoriser ce Flexi à dépasser son plafond hebdomadaire de 20h.";
  } else if (hasCdi) {
    helper = "Autoriser ce CDI à dépasser son plafond hebdomadaire standard.";
  } else {
    helper = "Autoriser cet employé à dépasser son plafond hebdomadaire.";
  }

  let warning: string;
  if (hasStudent && !hasCdi) {
    warning =
      "Cet étudiant pourra dépasser le plafond légal de 15h/semaine. Assure-toi qu'il a un statut compatible (équivalent temps plein, étudiant sans plafond hebdo, convention spécifique). Le quota annuel 650h jobiste reste appliqué.";
  } else {
    warning =
      "Cet employé ne sera plus contraint par le plafond hebdomadaire de son contrat. Les autres règles (repos légal, ONSS, indisponibilités) restent appliquées.";
  }

  return { standardCap, standardLabel, helper, warning };
}

export function ExtendedHoursCard({ userId, firstName, contracts, allowed, onSaved }: Props) {
  const labels = getContextLabels(contracts);
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const update = useServerFn(updateExtendedHours);

  const handleToggle = (next: boolean) => setPendingToggle(next);

  const confirmToggle = async () => {
    if (pendingToggle === null) return;
    setSaving(true);
    try {
      await update({ data: { userId, allowed: pendingToggle } });
      toast.success(
        pendingToggle
          ? "Dépassement du plafond activé"
          : "Dépassement du plafond désactivé",
      );
      setPendingToggle(null);
      onSaved();
    } catch (e: any) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

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
          <div
            className="rounded-lg"
            style={{
              backgroundColor: "var(--warning-bg)",
              border: "0.5px solid var(--warning-border, var(--border))",
              color: "var(--warning-text)",
              padding: 12,
              fontSize: 12,
              lineHeight: 1.5,
              marginTop: 12,
            }}
          >
            {labels.warning}
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
                ? "Activer le dépassement du plafond hebdomadaire ?"
                : "Désactiver le dépassement du plafond ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggle ? (
                <>
                  Activer le dépassement du plafond hebdomadaire pour{" "}
                  <strong>{firstName}</strong> ? Le moteur de planning ne sera plus limité
                  par son plafond contractuel. Cette action est tracée.
                </>
              ) : (
                <>
                  Le plafond redeviendra <strong>{labels.standardLabel}</strong>. Cette
                  action est tracée.
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
