import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Camera, PartyPopper, Loader2, MessageSquareQuote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { findApplicableTemplate, getOrCreateSubmission, uploadSubmissionPhoto, detectChecklistMoment, type ChecklistPhase } from "@/lib/checklists.helpers";
import type { ChecklistTemplate, ChecklistTemplateItem, ChecklistTemplatePhoto } from "@/types/checklists";

export interface OpeningShiftRow {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  business_role: string;
  studio_id: string | null;
  clocked_in_at?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shift: OpeningShiftRow | null;
  userId: string;
  studios: Record<string, string>;
  firstName?: string | null;
  clockedInAt?: string | null;
  minutesLate?: number;
}

type Step = 1 | 2 | 3 | 4;

export function OpeningFlow({ open, onClose, shift, userId, studios, firstName, clockedInAt, minutesLate = 0 }: Props) {
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<ChecklistPhase | null>(null);
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [items, setItems] = useState<ChecklistTemplateItem[]>([]);
  const [photos, setPhotos] = useState<ChecklistTemplatePhoto[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [itemStates, setItemStates] = useState<Record<string, boolean>>({});
  const [photoStates, setPhotoStates] = useState<Record<string, { url: string | null; status: "idle" | "uploading" | "done" }>>({});
  const [previousHandoff, setPreviousHandoff] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (!open || !shift) return;
    setStep(1);
    setLoading(true);
    (async () => {
      try {
        // Detect phase (opening | transition | null) for this clock-in
        const detected = await detectChecklistMoment({ shiftId: shift.id, side: "clock_in" });
        setPhase(detected);
        if (detected) {
          const tpl = await findApplicableTemplate({
            studioId: shift.studio_id ?? null,
            businessRole: shift.business_role,
            phase: detected,
          });
          if (tpl) {
            setTemplate(tpl);
            const subId = await getOrCreateSubmission(userId, shift.id, tpl.id, detected);
            setSubmissionId(subId);
            const [{ data: its }, { data: phs }, { data: subItems }, { data: subPhotos }] = await Promise.all([
              supabase.from("checklist_template_items").select("*").eq("template_id", tpl.id).order("order_index"),
              supabase.from("checklist_template_photos").select("*").eq("template_id", tpl.id).order("order_index"),
              supabase.from("checklist_submission_items").select("template_item_id,is_checked").eq("submission_id", subId),
              supabase.from("checklist_submission_photos").select("template_photo_id,photo_url").eq("submission_id", subId),
            ]);
            setItems((its ?? []) as any);
            setPhotos((phs ?? []) as any);
            const im: Record<string, boolean> = {};
            (subItems ?? []).forEach((r: any) => { im[r.template_item_id] = r.is_checked; });
            setItemStates(im);
            const pm: Record<string, { url: string | null; status: "idle" | "uploading" | "done" }> = {};
            (phs ?? []).forEach((p: any) => {
              const sp = (subPhotos ?? []).find((s: any) => s.template_photo_id === p.id);
              pm[p.id] = { url: sp?.photo_url ?? null, status: sp?.photo_url ? "done" : "idle" };
            });
            setPhotoStates(pm);
          } else {
            setTemplate(null); setItems([]); setPhotos([]); setSubmissionId(null);
          }
        } else {
          setTemplate(null); setItems([]); setPhotos([]); setSubmissionId(null);
        }

        // Previous shift handoff (same studio + role, before this shift)
        if (shift.studio_id) {
          const { data: prev } = await supabase
            .from("shifts")
            .select("id")
            .eq("studio_id", shift.studio_id)
            .eq("business_role", shift.business_role)
            .lt("shift_date", shift.shift_date)
            .not("clocked_out_at", "is", null)
            .order("shift_date", { ascending: false })
            .order("end_time", { ascending: false })
            .limit(1);
          const prevId = (prev ?? [])[0]?.id;
          if (prevId) {
            const { data: ho } = await supabase
              .from("shift_handoffs")
              .select("message")
              .eq("shift_id", prevId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if ((ho as any)?.message) setPreviousHandoff((ho as any).message as string);
          }
        }
      } catch (e: any) {
        console.error("[opening] load", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, shift?.id, userId]);

  if (!open || !shift) return null;

  const studioName = (shift.studio_id && studios[shift.studio_id]) || "—";
  const hasChecklist = !!template && items.length > 0;
  const hasPhotos = !!template && photos.length > 0;
  const totalSteps: Step = (hasPhotos ? 3 : hasChecklist ? 2 : 1) as Step;
  const checklistTitle = phase === "transition"
    ? `Transition ${shift.business_role}`
    : `Ouverture ${shift.business_role}`;
  const ctaStart = phase === "transition" ? "Commencer la transition →" : "Commencer ma checklist d'ouverture →";

  const itemsBlocked = items.some((i) => i.is_required && !itemStates[i.id]);
  const photosBlocked = photos.some((p) => p.is_required && photoStates[p.id]?.status !== "done");

  const toggleItem = async (itemId: string) => {
    if (!submissionId) return;
    const newVal = !itemStates[itemId];
    setItemStates((prev) => ({ ...prev, [itemId]: newVal }));
    const { data: existing } = await supabase
      .from("checklist_submission_items")
      .select("id").eq("submission_id", submissionId).eq("template_item_id", itemId).maybeSingle();
    if (existing) {
      await supabase.from("checklist_submission_items")
        .update({ is_checked: newVal, checked_at: newVal ? new Date().toISOString() : null })
        .eq("id", (existing as any).id);
    } else {
      await supabase.from("checklist_submission_items").insert({
        submission_id: submissionId, template_item_id: itemId, is_checked: newVal,
        checked_at: newVal ? new Date().toISOString() : null,
      });
    }
  };

  const handleUpload = async (zoneId: string, file: File) => {
    if (!submissionId) return;
    setPhotoStates((prev) => ({ ...prev, [zoneId]: { ...(prev[zoneId] ?? { url: null, status: "idle" }), status: "uploading" } }));
    try {
      const path = await uploadSubmissionPhoto(file, userId, submissionId, zoneId);
      const { data: pub } = supabase.storage.from("checklist-photos").getPublicUrl(path);
      const url = pub.publicUrl;
      const { data: existing } = await supabase.from("checklist_submission_photos")
        .select("id").eq("submission_id", submissionId).eq("template_photo_id", zoneId).maybeSingle();
      if (existing) {
        await supabase.from("checklist_submission_photos")
          .update({ photo_url: url, uploaded_at: new Date().toISOString() })
          .eq("id", (existing as any).id);
      } else {
        await supabase.from("checklist_submission_photos").insert({
          submission_id: submissionId, template_photo_id: zoneId, photo_url: url, uploaded_at: new Date().toISOString(),
        });
      }
      setPhotoStates((prev) => ({ ...prev, [zoneId]: { url, status: "done" } }));
    } catch (e: any) {
      console.error("[opening] upload", e);
      toast.error("Échec de l'envoi", { description: e?.message });
      setPhotoStates((prev) => ({ ...prev, [zoneId]: { ...(prev[zoneId] ?? { url: null, status: "idle" }), status: "idle" } }));
    }
  };

  const finalize = async () => {
    if (finalizing) return;
    setFinalizing(true);
    try {
      if (submissionId) {
        await supabase.from("checklist_submissions")
          .update({ status: "completed", submitted_at: new Date().toISOString() })
          .eq("id", submissionId);
      }
      toast.success("Bon shift ! 🚀");
      onClose();
    } catch (e: any) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setFinalizing(false);
    }
  };

  const clockedTime = clockedInAt
    ? new Date(clockedInAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#FAF8F4" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "rgba(0,0,0,0.06)", paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => step > 1 ? setStep((s) => (s - 1) as Step) : onClose()}
          className="rounded-full p-2 -ml-2"
          aria-label="Retour"
        >
          <ArrowLeft size={18} />
        </button>
        <Stepper step={step} total={totalSteps} />
        <div style={{ width: 36 }} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin" /></div>
        ) : step === 1 ? (
          <>
            <div
              className="rounded-full flex items-center justify-center mb-5"
              style={{ width: 64, height: 64, backgroundColor: "var(--coral-light)" }}
            >
              <PartyPopper size={30} color="var(--coral-dark)" strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
              Bienvenue{firstName ? ` ${firstName}` : ""}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 8, lineHeight: 1.5 }}>
              {shift.business_role} · {studioName.replace("Skult ", "")} · {shift.start_time.slice(0, 5).replace(":", "h")}–{shift.end_time.slice(0, 5).replace(":", "h")}
            </div>
            {clockedTime && (
              <div
                className="mt-4 rounded-lg px-3 py-2 inline-flex items-center gap-2"
                style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", fontSize: 12 }}
              >
                <Check size={13} color="var(--coral-dark)" />
                <span>
                  Pointage à {clockedTime}
                  {minutesLate > 0 ? ` · ${minutesLate} min de retard` : ""}
                </span>
              </div>
            )}

            {previousHandoff && (
              <div
                className="mt-5 rounded-xl p-4"
                style={{ backgroundColor: "#FFF7ED", border: "0.5px solid #FED7AA" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquareQuote size={14} style={{ color: "#9A3412" }} />
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#9A3412", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Notes de l'équipe précédente
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#7C2D12", lineHeight: 1.5, fontStyle: "italic" }}>
                  « {previousHandoff} »
                </div>
              </div>
            )}

            <div className="mt-8">
              <button
                onClick={() => {
                  if (hasChecklist) setStep(2);
                  else finalize();
                }}
                disabled={finalizing}
                className="w-full rounded-md py-3 disabled:opacity-50"
                style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
              >
                {hasChecklist ? "Commencer ma checklist d'ouverture →" : "Commencer mon service →"}
              </button>
            </div>
          </>
        ) : step === 2 ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Étape 2 sur {totalSteps}
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4, letterSpacing: "-0.01em" }}>
              Checklist d'ouverture
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>
              Coche chaque tâche réalisée avant d'ouvrir.
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {items.map((it) => {
                const checked = !!itemStates[it.id];
                return (
                  <button
                    key={it.id}
                    onClick={() => toggleItem(it.id)}
                    className="flex items-start gap-3 rounded-xl p-3 text-left transition-colors"
                    style={{
                      backgroundColor: checked ? "var(--coral-light)" : "#fff",
                      border: `0.5px solid ${checked ? "transparent" : "rgba(0,0,0,0.08)"}`,
                    }}
                  >
                    <div
                      className="rounded-md flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        width: 22, height: 22,
                        backgroundColor: checked ? "var(--coral)" : "transparent",
                        border: checked ? "none" : "1.5px solid rgba(0,0,0,0.2)",
                      }}
                    >
                      {checked && <Check size={14} color="var(--coral-text)" strokeWidth={2.5} />}
                    </div>
                    <div className="flex-1">
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>
                        {it.label}
                        {it.is_required && <span style={{ color: "var(--coral-dark)", marginLeft: 4 }}>*</span>}
                      </div>
                      {it.description && (
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{it.description}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              <button
                onClick={() => {
                  if (hasPhotos) setStep(3);
                  else finalize();
                }}
                disabled={itemsBlocked || finalizing}
                className="w-full rounded-md py-3 disabled:opacity-50"
                style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
              >
                {hasPhotos ? "Suivant →" : "Commencer mon service →"}
              </button>
              {itemsBlocked && (
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 8, textAlign: "center" }}>
                  Coche d'abord toutes les tâches obligatoires (*)
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Étape 3 sur {totalSteps}
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4, letterSpacing: "-0.01em" }}>
              Photos d'ouverture
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>
              Prends une photo de chaque zone pour valider le démarrage.
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3">
              {photos.map((p) => {
                const s = photoStates[p.id] ?? { url: null, status: "idle" };
                return (
                  <label
                    key={p.id}
                    className="rounded-xl p-3 cursor-pointer block"
                    style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]; if (f) handleUpload(p.id, f);
                      }}
                    />
                    <div className="flex items-center gap-3">
                      <div
                        className="rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                        style={{ width: 56, height: 56, backgroundColor: "var(--muted)" }}
                      >
                        {s.url ? (
                          <img src={s.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : s.status === "uploading" ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Camera size={18} style={{ color: "var(--muted-foreground)" }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {p.label}
                          {p.is_required && <span style={{ color: "var(--coral-dark)", marginLeft: 4 }}>*</span>}
                        </div>
                        {p.description && (
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{p.description}</div>
                        )}
                        {s.status === "done" && (
                          <div style={{ fontSize: 10, color: "var(--coral-dark)", marginTop: 4 }}>
                            <Check size={10} className="inline mr-0.5" /> Envoyée — appuie pour remplacer
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-6">
              <button
                onClick={finalize}
                disabled={photosBlocked || finalizing}
                className="w-full rounded-md py-3 disabled:opacity-50"
                style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
              >
                {finalizing ? "Validation…" : "Commencer mon service →"}
              </button>
              {photosBlocked && (
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 8, textAlign: "center" }}>
                  Ajoute d'abord les photos obligatoires (*)
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stepper({ step, total }: { step: number; total: number }) {
  if (total <= 1) return <div />;
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all"
          style={{
            width: i + 1 === step ? 18 : 6,
            height: 6,
            backgroundColor: i + 1 <= step ? "var(--coral)" : "rgba(0,0,0,0.12)",
          }}
        />
      ))}
    </div>
  );
}
