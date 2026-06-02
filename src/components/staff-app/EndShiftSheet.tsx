import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sheet, FormField, TextArea, PrimaryButton, SecondaryButton } from "./shared";
import type { ShiftRow } from "./shared";
import { Star, MessageSquare, ArrowRight, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { completeShiftClockOutFn } from "@/lib/shift-clock.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  shift: ShiftRow | null;
  userId: string;
  onCompleted?: () => void;
}

// Flow simplifié — pas de fausse checklist (la vraie checklist vit dans /staff/checklist/$shiftId)
type Step = "feedback" | "report" | "handoff" | "done";

interface Draft {
  step?: Step;
  rating?: number;
  feedbackMsg?: string;
  reportMsg?: string;
  handoffMsg?: string;
}

const DRAFT_PREFIX = "kadence:end-shift:";

function readDraft(shiftId: string): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${DRAFT_PREFIX}${shiftId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft(shiftId: string) {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(`${DRAFT_PREFIX}${shiftId}`); } catch {}
}

const STEPS: Step[] = ["feedback", "report", "handoff"];

export function EndShiftSheet({ open, onClose, shift, onCompleted }: Props) {
  const completeClockOut = useServerFn(completeShiftClockOutFn);
  const openedShiftRef = useRef<string | null>(null);
  const [step, setStep] = useState<Step>("feedback");
  const [rating, setRating] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  const [handoffMsg, setHandoffMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const saveDraft = (patch: Draft) => {
    if (!shift || typeof window === "undefined") return;
    const next: Draft = { step, rating, feedbackMsg, reportMsg, handoffMsg, ...patch };
    try { window.sessionStorage.setItem(`${DRAFT_PREFIX}${shift.id}`, JSON.stringify(next)); } catch {}
  };

  const goToStep = (next: Step) => {
    setStep(next);
    saveDraft({ step: next });
  };

  useEffect(() => {
    if (!open || !shift) {
      openedShiftRef.current = null;
      return;
    }
    if (openedShiftRef.current === shift.id) return;
    openedShiftRef.current = shift.id;
    if (shift.clocked_out_at) {
      toast.info("Ce shift est déjà clôturé");
      onClose();
      return;
    }
    if (!shift.clocked_in_at) {
      toast.error("Tu dois d'abord pointer ton arrivée");
      onClose();
      return;
    }
    const draft = readDraft(shift.id);
    const draftStep = draft?.step;
    setStep(draftStep && STEPS.includes(draftStep) ? draftStep : "feedback");
    setRating(typeof draft?.rating === "number" ? draft.rating : 0);
    setFeedbackMsg(typeof draft?.feedbackMsg === "string" ? draft.feedbackMsg : "");
    setReportMsg(typeof draft?.reportMsg === "string" ? draft.reportMsg : "");
    setHandoffMsg(typeof draft?.handoffMsg === "string" ? draft.handoffMsg : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shift?.id]);

  const handleFinish = async () => {
    if (!shift) return;
    setSubmitting(true);
    try {
      const result = await completeClockOut({
        data: {
          shiftId: shift.id,
          rating,
          feedbackMsg,
          reportMsg,
          handoffMsg,
        },
      });
      if (result.alreadyCompleted) {
        toast.info("Shift déjà clôturé");
      } else {
        toast.success("Shift terminé");
      }

      clearDraft(shift.id);
      setStep("done");
      onCompleted?.();
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur lors de la clôture", { description: e?.message ?? String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  if (!shift) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Fin de shift">
      {/* Step indicator */}
      {step !== "done" && (
        <div className="flex items-center gap-1.5 mb-5">
          {STEPS.map((s, i) => {
            const idx = STEPS.indexOf(step);
            const active = i === idx;
            const done = i < idx;
            return (
              <div key={s} className="flex-1 rounded-full" style={{
                height: 3,
                backgroundColor: active || done ? "var(--coral)" : "var(--muted)",
              }} />
            );
          })}
        </div>
      )}

      {step === "feedback" && (
        <>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Comment s'est passé ce shift ?</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>
            Cette note aide ton admin à comprendre l'ambiance
          </div>
          <div className="flex justify-center gap-2 mb-5 py-3">
            {[1,2,3,4,5].map((n) => (
              <button key={n} type="button" onClick={() => { setRating(n); saveDraft({ rating: n }); }} className="p-1">
                <Star size={32}
                  fill={n <= rating ? "var(--coral)" : "transparent"}
                  color={n <= rating ? "var(--coral)" : "rgba(0,0,0,0.2)"}
                  strokeWidth={1.4} />
              </button>
            ))}
          </div>
          <FormField label="Un mot (optionnel)">
            <TextArea value={feedbackMsg} onChange={(value) => { setFeedbackMsg(value); saveDraft({ feedbackMsg: value }); }}
              placeholder="Ce qui a été bien, ce qui a coincé..." rows={3} />
          </FormField>
          <div className="mt-3 flex gap-2">
            <SecondaryButton onClick={onClose}>Plus tard</SecondaryButton>
            <PrimaryButton onClick={() => goToStep("report")}>Continuer</PrimaryButton>
          </div>
        </>
      )}

      {step === "report" && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={18} style={{ color: "var(--coral)" }} />
            <div style={{ fontSize: 18, fontWeight: 500 }}>Message à l'admin</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>
            Quelque chose à signaler à Sacha ou à l'équipe encadrante ?
          </div>
          <FormField label="Ton message (optionnel)">
            <TextArea value={reportMsg} onChange={(value) => { setReportMsg(value); saveDraft({ reportMsg: value }); }}
              placeholder="Ex: Le client X était mécontent à cause de... / J'ai dû gérer seul un rush, prévoir un renfort..."
              rows={5} />
          </FormField>
          <div className="mt-3 flex gap-2">
            <SecondaryButton onClick={() => goToStep("feedback")}>Retour</SecondaryButton>
            <PrimaryButton onClick={() => goToStep("handoff")}>Continuer</PrimaryButton>
          </div>
        </>
      )}

      {step === "handoff" && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <ArrowRight size={18} style={{ color: "var(--coral)" }} />
            <div style={{ fontSize: 18, fontWeight: 500 }}>Message au prochain</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>
            Une info à transmettre à l'employé qui prend ton poste après toi (même studio, même rôle)
          </div>
          <FormField label="Pour le prochain (optionnel)">
            <TextArea value={handoffMsg} onChange={(value) => { setHandoffMsg(value); saveDraft({ handoffMsg: value }); }}
              placeholder="Ex: Attention, le moulin chauffe / Stock lait avoine bas / Client réservé à 14h..."
              rows={5} />
          </FormField>
          <div className="mt-3 flex gap-2">
            <SecondaryButton onClick={() => goToStep("report")}>Retour</SecondaryButton>
            <PrimaryButton onClick={handleFinish} disabled={submitting}>
              {submitting ? "Envoi..." : "Finaliser et pointer ma sortie"}
            </PrimaryButton>
          </div>
        </>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center text-center py-8">
          <div className="rounded-full flex items-center justify-center mb-5"
            style={{ width: 72, height: 72, backgroundColor: "var(--coral-light)" }}>
            <Check size={36} color="var(--coral-dark)" strokeWidth={1.8} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 6 }}>Shift terminé</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 24, lineHeight: 1.5 }}>
            Bonne soirée. Tes infos ont été transmises.
          </div>
          <PrimaryButton onClick={onClose}>Fermer</PrimaryButton>
        </div>
      )}
    </Sheet>
  );
}
