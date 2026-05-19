import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, X, Camera, Check, AlertCircle, QrCode, Star, MapPin, Loader2, PartyPopper, Calendar, Clock, Sparkles } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { findApplicableTemplate, getOrCreateSubmission, uploadSubmissionPhoto } from "@/lib/checklists.helpers";
import { validateClockOutFn, finalizeClosureFn, analyzeClosurePhotoFn } from "@/lib/closure-flow.functions";
import type { ChecklistTemplate, ChecklistTemplateItem, ChecklistTemplatePhoto } from "@/types/checklists";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ClosureShiftRow {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  business_role: string;
  studio_id: string | null;
  clocked_in_at?: string | null;
  clocked_out_at?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shift: ClosureShiftRow | null;
  userId: string;
  studios: Record<string, string>;
  onCompleted?: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

interface ClosureQuestion {
  id: string;
  question_text: string;
  response_type: "stars_1_5" | "yes_no" | "free_text" | string;
  is_required: boolean;
  order_index: number;
}

interface PhotoState {
  zoneId: string;
  submissionPhotoId: string | null;
  photoUrl: string | null;
  status: "idle" | "uploading" | "analyzing" | "validated" | "refused";
  message?: string | null;
  failCount: number;
}

interface Recap {
  workedMin: number;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  submissionStatus: string;
  itemsTotal: number; itemsChecked: number;
  photosTotal: number; photosValidated: number;
  earnings: number; hourlyRate: number;
  score: { ponctualite: number; checklist: number; photos: number; total: number };
  firstName: string | null;
  nextShift: { id: string; shift_date: string; start_time: string; end_time: string; business_role: string; studio_id: string | null } | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const fmtTime = (t: string) => t.slice(0, 5).replace(":", "h");
const fmtHHMM = (iso: string) => new Date(iso).toTimeString().slice(0, 5).replace(":", "h");
const fmtDateLong = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fmtEUR = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const minutesTo = (date: Date, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const target = new Date(date);
  target.setHours(h, m ?? 0, 0, 0);
  return Math.round((target.getTime() - Date.now()) / 60000);
};

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export function ClosureFlow({ open, onClose, shift, userId, studios, onCompleted }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [items, setItems] = useState<ChecklistTemplateItem[]>([]);
  const [photos, setPhotos] = useState<ChecklistTemplatePhoto[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [itemStates, setItemStates] = useState<Record<string, boolean>>({});
  const [photoStates, setPhotoStates] = useState<Record<string, PhotoState>>({});
  const [closureQuestions, setClosureQuestions] = useState<ClosureQuestion[]>([]);
  const [questionResponses, setQuestionResponses] = useState<Record<string, { stars?: number; yesno?: boolean; text?: string }>>({});
  const [recap, setRecap] = useState<Recap | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [clockOutLoading, setClockOutLoading] = useState(false);
  const [clockedOutAt, setClockedOutAt] = useState<string | null>(null);

  const validateClockOut = useServerFn(validateClockOutFn);
  const finalizeClosure = useServerFn(finalizeClosureFn);

  // ─── Load template + closure questions when shift opens ──────────────────
  useEffect(() => {
    if (!open || !shift) return;
    setStep(1);
    setRecap(null);
    setClockedOutAt(shift.clocked_out_at ?? null);
    (async () => {
      try {
        const tpl = await findApplicableTemplate({ studioId: shift.studio_id ?? null, businessRole: shift.business_role });
        if (tpl) {
          setTemplate(tpl);
          const subId = await getOrCreateSubmission(userId, shift.id, tpl.id);
          setSubmissionId(subId);
          const [{ data: its }, { data: phs }, { data: subItems }, { data: subPhotos }] = await Promise.all([
            supabase.from("checklist_template_items").select("*").eq("template_id", tpl.id).order("order_index"),
            supabase.from("checklist_template_photos").select("*").eq("template_id", tpl.id).order("order_index"),
            supabase.from("checklist_submission_items").select("template_item_id,is_checked").eq("submission_id", subId),
            supabase.from("checklist_submission_photos").select("id,template_photo_id,photo_url,ai_validation_status").eq("submission_id", subId),
          ]);
          setItems((its ?? []) as any);
          setPhotos((phs ?? []) as any);
          const itMap: Record<string, boolean> = {};
          (subItems ?? []).forEach((r: any) => { itMap[r.template_item_id] = r.is_checked; });
          setItemStates(itMap);
          const phMap: Record<string, PhotoState> = {};
          (phs ?? []).forEach((p: any) => {
            const sub = (subPhotos ?? []).find((s: any) => s.template_photo_id === p.id);
            phMap[p.id] = {
              zoneId: p.id,
              submissionPhotoId: sub?.id ?? null,
              photoUrl: sub?.photo_url ?? null,
              status: sub?.ai_validation_status === "validated" || (sub?.photo_url && !sub?.ai_validation_status) ? "validated" : sub?.photo_url ? "idle" : "idle",
              failCount: 0,
            };
          });
          setPhotoStates(phMap);
        } else {
          setTemplate(null); setItems([]); setPhotos([]); setSubmissionId(null);
        }

        if (shift.studio_id) {
          const { data: qs } = await supabase.from("closure_questions")
            .select("id,question_text,response_type,is_required,order_index")
            .eq("studio_id", shift.studio_id).order("order_index");
          setClosureQuestions((qs ?? []) as any);
          // load existing responses
          if (qs && qs.length) {
            const { data: subId } = await supabase.from("checklist_submissions")
              .select("id").eq("shift_id", shift.id).eq("user_id", userId).maybeSingle();
            if (subId) {
              const { data: rs } = await supabase.from("closure_question_responses")
                .select("question_id,stars_value,yesno_value,text_value")
                .eq("submission_id", (subId as any).id);
              const m: Record<string, { stars?: number; yesno?: boolean; text?: string }> = {};
              (rs ?? []).forEach((r: any) => {
                m[r.question_id] = {
                  stars: r.stars_value ?? undefined,
                  yesno: r.yesno_value ?? undefined,
                  text: r.text_value ?? undefined,
                };
              });
              setQuestionResponses(m);
            }
          }
        } else {
          setClosureQuestions([]);
        }
      } catch (e: any) {
        console.error("[closure] load error", e);
        toast.error("Erreur de chargement", { description: e?.message });
      }
    })();
  }, [open, shift?.id, userId]);

  // ─── Live tick for step 1 ────────────────────────────────────────────────
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!open || !shift) return null;

  const studioName = (shift.studio_id && studios[shift.studio_id]) || "—";

  // ─── Step gating ─────────────────────────────────────────────────────────
  const itemsChecked = Object.values(itemStates).filter(Boolean).length;
  const itemsTotal = items.length;
  const checklistBlocked = template?.is_blocking && items.some((i) => i.is_required && !itemStates[i.id]);
  const photosValidatedCount = Object.values(photoStates).filter((p) => p.status === "validated").length;
  const photosBlocked = (() => {
    if (!template) return false;
    const min = (template as any)?.min_photos_required ?? 0;
    if (photosValidatedCount < min) return true;
    return photos.some((p) => p.is_required && photoStates[p.id]?.status !== "validated");
  })();
  const questionsBlocked = closureQuestions.some((q) => {
    if (!q.is_required) return false;
    const r = questionResponses[q.id];
    if (q.response_type === "stars_1_5") return !r?.stars;
    if (q.response_type === "yes_no") return r?.yesno == null;
    return !r?.text?.trim();
  });

  // ─── Actions ─────────────────────────────────────────────────────────────
  const toggleItem = async (itemId: string) => {
    if (!submissionId) return;
    const newVal = !itemStates[itemId];
    setItemStates((prev) => ({ ...prev, [itemId]: newVal }));
    // upsert
    const { data: existing } = await supabase.from("checklist_submission_items")
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

  const handlePhotoUpload = async (zoneId: string, file: File) => {
    if (!submissionId) return;
    setPhotoStates((prev) => ({ ...prev, [zoneId]: { ...prev[zoneId], status: "uploading" } }));
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const path = await uploadSubmissionPhoto(file, userId, submissionId, zoneId);
        const { data: pub } = supabase.storage.from("checklist-photos").getPublicUrl(path);
        const photoUrl = pub.publicUrl;
        // upsert submission photo
        const { data: existing } = await supabase.from("checklist_submission_photos")
          .select("id").eq("submission_id", submissionId).eq("template_photo_id", zoneId).maybeSingle();
        let submissionPhotoId: string;
        if (existing) {
          submissionPhotoId = (existing as any).id;
          await supabase.from("checklist_submission_photos")
            .update({ photo_url: photoUrl, uploaded_at: new Date().toISOString(), ai_validation_status: null })
            .eq("id", submissionPhotoId);
        } else {
          const { data: inserted, error } = await supabase.from("checklist_submission_photos")
            .insert({ submission_id: submissionId, template_photo_id: zoneId, photo_url: photoUrl, uploaded_at: new Date().toISOString() })
            .select("id").single();
          if (error) throw error;
          submissionPhotoId = (inserted as any).id;
        }

        setPhotoStates((prev) => ({
          ...prev,
          [zoneId]: { ...prev[zoneId], submissionPhotoId, photoUrl, status: (template as any)?.analyze_with_ai ? "analyzing" : "validated" },
        }));

        if ((template as any)?.analyze_with_ai) {
          // TODO: brancher une vraie IA Vision (OpenAI / Claude) qui renverra un score 0-100
          // et comparera à template.ai_validation_threshold pour valider/refuser.
          // Pour l'instant, simulation: 2s + validation auto à 100%
          setTimeout(async () => {
            await supabase.from("checklist_submission_photos")
              .update({ ai_validation_status: "validated", ai_validated_at: new Date().toISOString(), ai_validation_message: "Validé automatiquement (IA placeholder — score 100/100)" })
              .eq("id", submissionPhotoId);
            setPhotoStates((prev) => ({ ...prev, [zoneId]: { ...prev[zoneId], status: "validated" } }));
          }, 2000);
        }
        return;
      } catch (e) {
        lastErr = e;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
    console.error("[closure] upload failed after 3 retries", lastErr);
    toast.error("Échec d'envoi de la photo", { description: "Vérifie ta connexion et réessaie." });
    setPhotoStates((prev) => ({
      ...prev,
      [zoneId]: { ...prev[zoneId], status: "idle", failCount: (prev[zoneId]?.failCount ?? 0) + 1 },
    }));
  };

  const requestCloseWithConfirm = () => {
    if (step === 1 || step === 6) { onClose(); return; }
    if (window.confirm("Tu vas perdre ta progression de cette étape. Continuer ?")) onClose();
  };

  // ─── QR / Geolocation validation (step 4) ────────────────────────────────
  const submitQrCode = async (code: string) => {
    if (!shift || clockOutLoading) return;
    setClockOutLoading(true);
    try {
      let lat: number | null = null, lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error("Géolocalisation indisponible"));
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
        });
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch {
        // non-bloquant si pas de geofencing requis — serveur tranchera
      }
      const r = await validateClockOut({ data: { shiftId: shift.id, qrCode: code, lat, lng } });
      setClockedOutAt(r.completedAt ?? new Date().toISOString());
      toast.success("Pointage de sortie validé");
      setStep(5);
    } catch (e: any) {
      toast.error("Validation refusée", { description: e?.message ?? "Code invalide" });
    } finally {
      setClockOutLoading(false);
    }
  };

  // ─── Finalize (entry of step 6) ──────────────────────────────────────────
  const runFinalize = async () => {
    if (finalizing || !shift) return;
    setFinalizing(true);
    try {
      const responses = closureQuestions.map((q) => {
        const r = questionResponses[q.id] ?? {};
        return {
          questionId: q.id,
          stars: r.stars ?? null,
          yesno: r.yesno ?? null,
          text: r.text?.trim() ? r.text.trim() : null,
        };
      }).filter((r) => r.stars != null || r.yesno != null || r.text != null);
      const result = await finalizeClosure({ data: { shiftId: shift.id, submissionId, responses } });
      setRecap(result as Recap);
      onCompleted?.();
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de finalisation", { description: e?.message });
    } finally {
      setFinalizing(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#FAF8F4" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "rgba(0,0,0,0.06)", paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <button
          onClick={() => step > 1 && step < 6 ? setStep((s) => (s - 1) as Step) : requestCloseWithConfirm()}
          className="rounded-full p-2"
          style={{ backgroundColor: "var(--muted)" }}
          aria-label="Retour"
        >
          {step > 1 && step < 6 ? <ArrowLeft size={16} /> : <X size={16} />}
        </button>
        <Stepper step={step} />
        <div style={{ width: 32 }} />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {step === 1 && <Step1 shift={shift} studioName={studioName} now={now} />}
        {step === 2 && <Step2 role={shift.business_role} items={items} photos={photos} itemStates={itemStates} onToggle={toggleItem} onJumpPhoto={() => setStep(3)} hasTemplate={!!template} />}
        {step === 3 && <Step3 role={shift.business_role} photos={photos} states={photoStates} onUpload={handlePhotoUpload} template={template} hasTemplate={!!template} />}
        {step === 4 && <Step4 onSubmitCode={submitQrCode} loading={clockOutLoading} />}
        {step === 5 && <Step5 questions={closureQuestions} responses={questionResponses} setResponses={setQuestionResponses} submissionId={submissionId} />}
        {step === 6 && <Step6 recap={recap} studios={studios} onClose={() => { onClose(); window.location.reload(); }} onRetry={runFinalize} finalizing={finalizing} />}
      </div>

      {/* Footer (steps 1-5) */}
      {step < 6 && (
        <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: "rgba(0,0,0,0.06)", backgroundColor: "#fff", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              className="w-full rounded-md py-3 transition-opacity"
              style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
            >
              Terminer mon shift
            </button>
          )}
          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              disabled={!!checklistBlocked}
              className="w-full rounded-md py-3 transition-opacity disabled:opacity-50"
              style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
            >
              {checklistBlocked ? `Encore ${items.filter((i) => i.is_required && !itemStates[i.id]).length} à cocher` : "Suivant"}
            </button>
          )}
          {step === 3 && (
            <button
              onClick={() => setStep(4)}
              disabled={photosBlocked}
              className="w-full rounded-md py-3 transition-opacity disabled:opacity-50"
              style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
            >
              {photosBlocked ? "Photos requises manquantes" : "Suivant"}
            </button>
          )}
          {step === 4 && (
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>
              Scanne ou tape le code affiché à l'accueil
            </div>
          )}
          {step === 5 && (
            <button
              onClick={async () => { setStep(6); await runFinalize(); }}
              disabled={questionsBlocked || finalizing}
              className="w-full rounded-md py-3 transition-opacity disabled:opacity-50"
              style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
            >
              {questionsBlocked ? "Réponds aux questions requises" : "Terminer"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Stepper
// ────────────────────────────────────────────────────────────────────────────
function Stepper({ step }: { step: Step }) {
  const total = 5;
  const active = Math.min(step, 5);
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const idx = i + 1;
        const done = idx < active;
        const cur = idx === active;
        return (
          <span key={i} className="rounded-full transition-all" style={{
            width: cur ? 20 : 6, height: 6,
            backgroundColor: cur || done ? "var(--coral)" : "rgba(0,0,0,0.18)",
          }} />
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 1 — Récap shift
// ────────────────────────────────────────────────────────────────────────────
function Step1({ shift, studioName, now }: { shift: ClosureShiftRow; studioName: string; now: number }) {
  const today = new Date();
  const endMinutes = minutesTo(today, shift.end_time);
  const nowLabel = new Date(now).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="px-5 py-6">
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #1A1614 0%, #2A2520 100%)", color: "#FAF8F4" }}>
        <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Shift en cours</div>
        <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>{shift.business_role}</div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>{studioName.replace("Skult ", "")}</div>
        <div style={{ fontSize: 14, marginTop: 14 }}>{fmtTime(shift.start_time)} → {fmtTime(shift.end_time)}</div>
        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>Il est {nowLabel}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
          {endMinutes > 0 ? `Fin du shift dans ${endMinutes} min` : `Shift dépassé de ${-endMinutes} min`}
        </div>
      </div>

      <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: "#EAF4FB", border: "0.5px solid #BCD8EC" }}>
        <div style={{ fontSize: 13, color: "#1F4E6E", lineHeight: 1.5 }}>
          Tu peux commencer la clôture dès maintenant. Le QR code final sera disponible à l'accueil du studio.
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 2 — Checklist
// ────────────────────────────────────────────────────────────────────────────
function Step2({ role, items, photos, itemStates, onToggle, onJumpPhoto, hasTemplate }: {
  role: string;
  items: ChecklistTemplateItem[];
  photos: ChecklistTemplatePhoto[];
  itemStates: Record<string, boolean>;
  onToggle: (id: string) => void;
  onJumpPhoto: () => void;
  hasTemplate: boolean;
}) {
  const total = items.length;
  const done = items.filter((i) => itemStates[i.id]).length;
  return (
    <div className="px-5 py-5">
      <span className="inline-block rounded-full px-2.5 py-1 mb-3" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Clôture {role}
      </span>
      <div style={{ fontSize: 20, fontWeight: 500 }}>Checklist de fin de shift</div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
        {hasTemplate ? `${done} / ${total} validés` : "Aucune checklist configurée pour ton rôle"}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {items.map((it) => {
          const checked = !!itemStates[it.id];
          const hasPhoto = photos.some((p) => p.id === (it as any).photo_zone_id);
          return (
            <div key={it.id} className="rounded-xl border px-3 py-3 flex items-center gap-3" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
              <button onClick={() => onToggle(it.id)}
                className="rounded-md flex items-center justify-center shrink-0"
                style={{ width: 28, height: 28, backgroundColor: checked ? "var(--coral)" : "transparent", border: checked ? "none" : "1.5px solid rgba(0,0,0,0.2)" }}
                aria-label={checked ? "Décocher" : "Cocher"}
              >
                {checked && <Check size={16} color="#fff" strokeWidth={2.5} />}
              </button>
              <div className="flex-1" style={{ fontSize: 13, fontWeight: 500, opacity: checked ? 0.55 : 1, textDecoration: checked ? "line-through" : "none" }}>
                {it.label}
                {it.is_required && <span style={{ color: "var(--coral-dark)", marginLeft: 4 }}>*</span>}
              </div>
              {hasPhoto && (
                <button onClick={onJumpPhoto} className="rounded-md p-2" style={{ backgroundColor: "var(--muted)" }} aria-label="Voir la photo">
                  <Camera size={14} style={{ color: "var(--muted-foreground)" }} />
                </button>
              )}
            </div>
          );
        })}
        {!hasTemplate && (
          <div className="rounded-xl px-4 py-6 text-center" style={{ backgroundColor: "#fff", border: "0.5px dashed rgba(0,0,0,0.15)", fontSize: 12, color: "var(--muted-foreground)" }}>
            Tu peux passer à l'étape suivante.
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 3 — Photos
// ────────────────────────────────────────────────────────────────────────────
function Step3({ photos, states, onUpload, template, hasTemplate }: {
  role: string;
  photos: ChecklistTemplatePhoto[];
  states: Record<string, PhotoState>;
  onUpload: (zoneId: string, file: File) => Promise<void>;
  template: ChecklistTemplate | null;
  hasTemplate: boolean;
}) {
  return (
    <div className="px-5 py-5">
      <span className="inline-block rounded-full px-2.5 py-1 mb-3" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {(template as any)?.analyze_with_ai ? "Validation IA" : "Photos"}
      </span>
      <div style={{ fontSize: 20, fontWeight: 500 }}>Photos de clôture</div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
        {hasTemplate
          ? ((template as any)?.analyze_with_ai ? "Tes photos sont analysées automatiquement" : "Prends une photo de chaque zone")
          : "Aucune photo demandée"}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {photos.map((zone) => {
          const st = states[zone.id];
          return <PhotoCard key={zone.id} zone={zone} state={st} onUpload={(f) => onUpload(zone.id, f)} />;
        })}
        {!hasTemplate && (
          <div className="rounded-xl px-4 py-6 text-center" style={{ backgroundColor: "#fff", border: "0.5px dashed rgba(0,0,0,0.15)", fontSize: 12, color: "var(--muted-foreground)" }}>
            Tu peux passer à l'étape suivante.
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoCard({ zone, state, onUpload }: { zone: ChecklistTemplatePhoto; state?: PhotoState; onUpload: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const status = state?.status ?? "idle";
  const badge = status === "validated" ? { label: "Validée", bg: "var(--success-bg)", fg: "var(--success-text)" }
              : status === "refused" ? { label: "Refusée — reprendre", bg: "#FEE4E2", fg: "#B42318" }
              : status === "analyzing" ? { label: "Analyse IA…", bg: "var(--coral-light)", fg: "var(--coral-dark)" }
              : status === "uploading" ? { label: "Envoi…", bg: "var(--muted)", fg: "var(--muted-foreground)" }
              : { label: "À photographier", bg: "var(--muted)", fg: "var(--muted-foreground)" };

  return (
    <div className="rounded-xl border p-3" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="rounded-md p-1.5" style={{ backgroundColor: "var(--muted)" }}><Camera size={14} /></div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{zone.label}{zone.is_required && <span style={{ color: "var(--coral-dark)", marginLeft: 4 }}>*</span>}</div>
            {zone.description && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{zone.description}</div>}
          </div>
        </div>
        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: badge.bg, color: badge.fg }}>{badge.label}</span>
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading" || status === "analyzing"}
        className="w-full rounded-lg flex items-center justify-center overflow-hidden relative disabled:opacity-60"
        style={{ aspectRatio: "4/3", backgroundColor: state?.photoUrl ? "transparent" : "var(--muted)" }}
      >
        {state?.photoUrl ? (
          <img src={state.photoUrl} alt={zone.label} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
            <Camera size={28} />
            <span style={{ fontSize: 12 }}>Prendre la photo</span>
          </div>
        )}
        {(status === "uploading" || status === "analyzing") && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)", color: "#fff" }}>
            <Loader2 size={24} className="animate-spin" />
          </div>
        )}
      </button>
      {state?.message && status === "refused" && (
        <div className="mt-2" style={{ fontSize: 11, color: "#B42318" }}>{state.message}</div>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 4 — QR scanner
// ────────────────────────────────────────────────────────────────────────────
function Step4({ onSubmitCode, loading }: { onSubmitCode: (c: string) => void; loading: boolean }) {
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState(["", "", "", "", ""]);
  const handleManualSubmit = () => {
    const full = code.join("").trim();
    if (full.length < 3) { toast.error("Code trop court"); return; }
    onSubmitCode(full);
  };
  return (
    <div className="px-5 py-5">
      <span className="inline-block rounded-full px-2.5 py-1 mb-3" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Clôture officielle
      </span>
      <div style={{ fontSize: 20, fontWeight: 500 }}>Scanne le QR au studio</div>
      <div className="mt-2 rounded-xl p-3" style={{ backgroundColor: "#EAF4FB", border: "0.5px solid #BCD8EC", fontSize: 12, color: "#1F4E6E", lineHeight: 1.5 }}>
        Le QR code est affiché sur la tablette à l'accueil. Il change régulièrement.
      </div>

      {!manual ? (
        <>
          <div className="mt-4 rounded-xl overflow-hidden relative" style={{ backgroundColor: "#000", aspectRatio: "1/1" }}>
            <Scanner
              onScan={(results) => {
                const code = results?.[0]?.rawValue;
                if (code && !loading) onSubmitCode(code);
              }}
              onError={(e) => console.error("[scanner]", e)}
              constraints={{ facingMode: "environment" }}
              styles={{ container: { width: "100%", height: "100%" } }}
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "#fff" }}>
                <Loader2 size={28} className="animate-spin" />
              </div>
            )}
          </div>
          <button onClick={() => setManual(true)} className="mt-3 w-full rounded-md py-2.5 border"
            style={{ fontSize: 13, fontWeight: 500, borderColor: "rgba(0,0,0,0.12)", backgroundColor: "#fff" }}>
            <QrCode size={14} className="inline-block mr-1.5" />
            Entrer le code manuellement
          </button>
        </>
      ) : (
        <div className="mt-4">
          <div className="flex justify-center gap-2 mb-4">
            {code.map((c, i) => (
              <input key={i} value={c} maxLength={1}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  const next = [...code]; next[i] = v; setCode(next);
                  if (v && i < 4) (document.getElementById(`otp-${i + 1}`) as HTMLInputElement)?.focus();
                }}
                id={`otp-${i}`}
                inputMode="text" autoCapitalize="characters"
                className="rounded-lg text-center" style={{ width: 44, height: 56, fontSize: 22, fontWeight: 500, border: "1.5px solid rgba(0,0,0,0.15)", backgroundColor: "#fff" }} />
            ))}
          </div>
          <button onClick={handleManualSubmit} disabled={loading}
            className="w-full rounded-md py-3 disabled:opacity-50"
            style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
            {loading ? "Validation…" : "Valider mon pointage de sortie"}
          </button>
          <button onClick={() => setManual(false)} className="mt-2 w-full rounded-md py-2.5"
            style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Revenir au scanner
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 5 — Questions
// ────────────────────────────────────────────────────────────────────────────
function Step5({ questions, responses, setResponses, submissionId }: {
  questions: ClosureQuestion[];
  responses: Record<string, { stars?: number; yesno?: boolean; text?: string }>;
  setResponses: React.Dispatch<React.SetStateAction<Record<string, { stars?: number; yesno?: boolean; text?: string }>>>;
  submissionId: string | null;
}) {
  const update = (qid: string, patch: { stars?: number; yesno?: boolean; text?: string }) => {
    setResponses((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  };
  return (
    <div className="px-5 py-5">
      <span className="inline-block rounded-full px-2.5 py-1 mb-3" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Dernière étape
      </span>
      <div style={{ fontSize: 20, fontWeight: 500 }}>Comment s'est passé ton shift ?</div>

      <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: "#EAF4FB", border: "0.5px solid #BCD8EC", fontSize: 12, color: "#1F4E6E", lineHeight: 1.5 }}>
        100% confidentiel. Tes réponses ne sont visibles que par les managers. Elles ne sont jamais partagées avec le reste de l'équipe.
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {questions.length === 0 ? (
          <div className="rounded-xl px-4 py-6 text-center" style={{ backgroundColor: "#fff", border: "0.5px dashed rgba(0,0,0,0.15)", fontSize: 12, color: "var(--muted-foreground)" }}>
            Aucune question pour ce studio.
          </div>
        ) : questions.map((q) => {
          const r = responses[q.id] ?? {};
          return (
            <div key={q.id} className="rounded-xl border p-4" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
                {q.question_text}
                {q.is_required && <span style={{ color: "var(--coral-dark)", marginLeft: 4 }}>*</span>}
              </div>
              {q.response_type === "stars_1_5" && (
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => update(q.id, { stars: n })} className="p-1">
                      <Star size={28} fill={n <= (r.stars ?? 0) ? "var(--coral)" : "transparent"} color={n <= (r.stars ?? 0) ? "var(--coral)" : "rgba(0,0,0,0.25)"} strokeWidth={1.4} />
                    </button>
                  ))}
                </div>
              )}
              {q.response_type === "yes_no" && (
                <div className="flex gap-2">
                  <button onClick={() => update(q.id, { yesno: true })} className="flex-1 rounded-md py-2.5"
                    style={{ fontSize: 13, fontWeight: 500, backgroundColor: r.yesno === true ? "var(--coral)" : "var(--muted)", color: r.yesno === true ? "var(--coral-text)" : "var(--foreground)" }}>Oui</button>
                  <button onClick={() => update(q.id, { yesno: false })} className="flex-1 rounded-md py-2.5"
                    style={{ fontSize: 13, fontWeight: 500, backgroundColor: r.yesno === false ? "var(--coral)" : "var(--muted)", color: r.yesno === false ? "var(--coral-text)" : "var(--foreground)" }}>Non</button>
                </div>
              )}
              {q.response_type === "free_text" && (
                <textarea value={r.text ?? ""} onChange={(e) => update(q.id, { text: e.target.value })}
                  rows={3} placeholder="Tape ta réponse…"
                  className="w-full rounded-md border px-3 py-2 outline-none resize-none"
                  style={{ fontSize: 13, borderColor: "rgba(0,0,0,0.12)", backgroundColor: "#fff" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 6 — Bien joué !
// ────────────────────────────────────────────────────────────────────────────
function Step6({ recap, studios, onClose, onRetry, finalizing }: {
  recap: Recap | null; studios: Record<string, string>;
  onClose: () => void; onRetry: () => void; finalizing: boolean;
}) {
  if (!recap) {
    return (
      <div className="px-5 py-12 flex flex-col items-center text-center gap-4">
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--coral)" }} />
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{finalizing ? "Finalisation…" : "Préparation du récap…"}</div>
        {!finalizing && (
          <button onClick={onRetry} className="rounded-md px-4 py-2 border" style={{ fontSize: 13, borderColor: "rgba(0,0,0,0.12)" }}>Réessayer</button>
        )}
      </div>
    );
  }
  const workedH = Math.floor(recap.workedMin / 60);
  const workedM = recap.workedMin % 60;
  const checklistOk = recap.itemsTotal === 0 || recap.itemsChecked === recap.itemsTotal;
  return (
    <div className="px-5 py-6">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="rounded-full flex items-center justify-center mb-4" style={{ width: 80, height: 80, backgroundColor: "var(--success-bg)" }}>
          <Check size={40} color="var(--success-text)" strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 500 }}>Bien joué ! Shift clôturé</div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
          Bonne soirée{recap.firstName ? `, ${recap.firstName}` : ""}. À très vite.
        </div>
      </div>

      {/* Récap */}
      <Card title="Récap de ton shift">
        <Row label="Heures prestées" value={`${workedH}h${String(workedM).padStart(2, "0")}`} />
        <Row label="Pointage entrée" value={recap.clockedInAt ? fmtHHMM(recap.clockedInAt) : "—"} />
        <Row label="Pointage sortie" value={recap.clockedOutAt ? fmtHHMM(recap.clockedOutAt) : "—"} />
        <Row label="Checklist" value={
          recap.itemsTotal === 0 ? <span style={{ color: "var(--muted-foreground)" }}>—</span> :
          checklistOk
            ? <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>Complète</span>
            : <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>Partielle</span>
        } />
        <Row label="Photos IA" value={`${recap.photosValidated} / ${recap.photosTotal}`} last />
      </Card>

      {/* Gains */}
      <Card title="Tes gains de ce shift">
        <Row label="Rémunération" value={<span style={{ fontSize: 18, fontWeight: 500 }}>{fmtEUR(recap.earnings)}</span>} last />
      </Card>

      {/* Score */}
      <Card title="Impact sur ton score">
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Total</span>
          <span style={{ fontSize: 22, fontWeight: 500, color: "var(--coral-dark)" }}>+{recap.score.total} pts</span>
        </div>
        <Row label="Ponctualité" value={`+${recap.score.ponctualite}`} />
        <Row label="Checklist" value={`+${recap.score.checklist}`} />
        <Row label="Photos" value={`+${recap.score.photos}`} last />
      </Card>

      {/* Next shift */}
      <Card title="Ton prochain shift">
        {recap.nextShift ? (
          <div className="flex items-start gap-3">
            <div className="rounded-md p-2" style={{ backgroundColor: "var(--coral-light)" }}>
              <Calendar size={16} style={{ color: "var(--coral-dark)" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>{fmtDateLong(recap.nextShift.shift_date)}</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                {fmtTime(recap.nextShift.start_time)} → {fmtTime(recap.nextShift.end_time)} · {recap.nextShift.business_role}
                {recap.nextShift.studio_id && studios[recap.nextShift.studio_id] && ` · ${studios[recap.nextShift.studio_id].replace("Skult ", "")}`}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun shift planifié pour le moment.</div>
        )}
      </Card>

      <button onClick={onClose} className="w-full rounded-md py-3 mt-6"
        style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
        Retour à l'accueil
      </button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4 mb-3" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: last ? "none" : "0.5px solid rgba(0,0,0,0.05)" }}>
      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
