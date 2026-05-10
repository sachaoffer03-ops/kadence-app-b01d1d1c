import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, FormField, TextArea, PrimaryButton, SecondaryButton } from "./shared";
import type { ShiftRow } from "./shared";
import { Star, MessageSquare, Send, ArrowRight, Check, Camera } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  shift: ShiftRow | null;
  userId: string;
  onCompleted?: () => void;
}

type Step = "checklist" | "feedback" | "report" | "handoff" | "done";

interface ChecklistItem { id: string; label: string; checked_at: string | null; }

const DEFAULT_CHECKLIST = [
  "Plan de travail propre et désinfecté",
  "Machines éteintes / en mode veille",
  "Stock vérifié pour le shift suivant",
  "Poubelles vidées",
  "Caisse fermée et comptée",
];

export function EndShiftSheet({ open, onClose, shift, userId, onCompleted }: Props) {
  const [step, setStep] = useState<Step>("checklist");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [rating, setRating] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  const [handoffMsg, setHandoffMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !shift) return;
    setStep("checklist");
    setRating(0); setFeedbackMsg(""); setReportMsg(""); setHandoffMsg("");

    (async () => {
      const { data } = await supabase.from("shift_checklist_items")
        .select("id,label,checked_at").eq("shift_id", shift.id).order("position");
      if (data && data.length > 0) {
        setItems(data);
      } else {
        // Seed default checklist
        const rows = DEFAULT_CHECKLIST.map((label, i) => ({ shift_id: shift.id, position: i, label }));
        const { data: inserted } = await supabase.from("shift_checklist_items").insert(rows).select("id,label,checked_at");
        setItems(inserted || []);
      }
    })();
  }, [open, shift]);

  const toggleItem = async (id: string, current: string | null) => {
    const next = current ? null : new Date().toISOString();
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, checked_at: next } : it));
    await supabase.from("shift_checklist_items").update({ checked_at: next }).eq("id", id);
  };

  const allChecked = items.length > 0 && items.every((it) => it.checked_at);
  const checkedCount = items.filter((it) => it.checked_at).length;

  const handleFinish = async () => {
    if (!shift) return;
    setSubmitting(true);
    try {
      // Feedback
      if (rating > 0 || feedbackMsg.trim()) {
        await supabase.from("feedbacks").insert({
          shift_id: shift.id, author_id: userId,
          rating: rating || 3,
          message: feedbackMsg.trim() || null,
        });
      }
      // Report to admin
      if (reportMsg.trim()) {
        await supabase.from("shift_reports").insert({
          shift_id: shift.id, author_id: userId, message: reportMsg.trim(),
        });
      }
      // Handoff to next employee
      if (handoffMsg.trim()) {
        await supabase.from("shift_handoffs").insert({
          shift_id: shift.id, author_id: userId, message: handoffMsg.trim(),
        });
      }
      // Mark shift completed + clock-out
      await supabase.from("shifts").update({
        status: "completed", clocked_out_at: new Date().toISOString(),
      }).eq("id", shift.id);

      setStep("done");
      onCompleted?.();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la clôture du shift");
    } finally {
      setSubmitting(false);
    }
  };

  if (!shift) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Fin de shift">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5 mb-5">
        {(["checklist","feedback","report","handoff"] as Step[]).map((s, i) => {
          const idx = ["checklist","feedback","report","handoff"].indexOf(step);
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

      {step === "checklist" && (
        <>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Checklist de fermeture</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>
            {checkedCount} / {items.length} effectués
          </div>
          <div className="flex flex-col gap-2">
            {items.map((it) => {
              const checked = !!it.checked_at;
              return (
                <button key={it.id} onClick={() => toggleItem(it.id, it.checked_at)}
                  className="rounded-xl border px-3.5 py-3 flex items-center gap-3 text-left"
                  style={{ backgroundColor: checked ? "var(--coral-light)" : "#fff", borderColor: checked ? "var(--coral)" : "rgba(0,0,0,0.08)" }}>
                  <span className="rounded-md flex items-center justify-center shrink-0" style={{
                    width: 22, height: 22,
                    backgroundColor: checked ? "var(--coral)" : "transparent",
                    border: checked ? "none" : "1.5px solid rgba(0,0,0,0.2)",
                  }}>
                    {checked && <Check size={14} color="#fff" strokeWidth={2.5} />}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: checked ? 500 : 400, flex: 1, textDecoration: checked ? "line-through" : "none", opacity: checked ? 0.7 : 1 }}>
                    {it.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex gap-2">
            <SecondaryButton onClick={onClose}>Plus tard</SecondaryButton>
            <PrimaryButton onClick={() => setStep("feedback")} disabled={!allChecked}>
              {allChecked ? "Continuer" : `${items.length - checkedCount} restant${items.length - checkedCount > 1 ? "s" : ""}`}
            </PrimaryButton>
          </div>
        </>
      )}

      {step === "feedback" && (
        <>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Comment s'est passé ce shift ?</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>
            Cette note aide ton admin à comprendre l'ambiance
          </div>
          <div className="flex justify-center gap-2 mb-5 py-3">
            {[1,2,3,4,5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className="p-1">
                <Star size={32}
                  fill={n <= rating ? "var(--coral)" : "transparent"}
                  color={n <= rating ? "var(--coral)" : "rgba(0,0,0,0.2)"}
                  strokeWidth={1.4} />
              </button>
            ))}
          </div>
          <FormField label="Un mot (optionnel)">
            <TextArea value={feedbackMsg} onChange={setFeedbackMsg}
              placeholder="Ce qui a été bien, ce qui a coincé..." rows={3} />
          </FormField>
          <div className="mt-3 flex gap-2">
            <SecondaryButton onClick={() => setStep("checklist")}>Retour</SecondaryButton>
            <PrimaryButton onClick={() => setStep("report")}>Continuer</PrimaryButton>
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
            <TextArea value={reportMsg} onChange={setReportMsg}
              placeholder="Ex: Le client X était mécontent à cause de... / J'ai dû gérer seul un rush, prévoir un renfort..."
              rows={5} />
          </FormField>
          <div className="mt-3 flex gap-2">
            <SecondaryButton onClick={() => setStep("feedback")}>Retour</SecondaryButton>
            <PrimaryButton onClick={() => setStep("handoff")}>Continuer</PrimaryButton>
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
            <TextArea value={handoffMsg} onChange={setHandoffMsg}
              placeholder="Ex: Attention, le moulin chauffe / Stock lait avoine bas / Client réservé à 14h..."
              rows={5} />
          </FormField>
          <div className="mt-3 flex gap-2">
            <SecondaryButton onClick={() => setStep("report")}>Retour</SecondaryButton>
            <PrimaryButton onClick={handleFinish} disabled={submitting}>
              {submitting ? "Envoi..." : "Clôturer le shift"}
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
