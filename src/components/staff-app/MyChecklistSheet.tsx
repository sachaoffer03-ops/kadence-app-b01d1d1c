import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Camera, Check, Loader2, CloudUpload, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  findApplicableTemplate,
  getOrCreateSubmission,
  uploadSubmissionPhoto,
  detectChecklistMoment,
  type ChecklistPhase,
} from "@/lib/checklists.helpers";
import type { ChecklistTemplate, ChecklistTemplateItem, ChecklistTemplatePhoto } from "@/types/checklists";

export interface ChecklistShiftRow {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  business_role: string;
  studio_id: string | null;
  clocked_in_at?: string | null;
  clocked_out_at?: string | null;
}

interface PhotoState {
  submissionPhotoId: string | null;
  photoUrl: string | null;
  status: "idle" | "uploading" | "done";
}

const PHASE_LABEL: Record<ChecklistPhase, string> = {
  opening: "Ouverture",
  transition_in: "Prise de poste",
  transition_out: "Passage de relais",
  closing: "Clôture",
};

/**
 * Charge l'avancement checklist d'un shift (pour l'afficher sur l'accueil employé).
 * Retourne null si aucune checklist n'est configurée pour ce poste/studio.
 */
export async function loadChecklistProgress(shift: ChecklistShiftRow, userId: string): Promise<{
  phase: ChecklistPhase;
  total: number;
  done: number;
} | null> {
  const detected = (await detectChecklistMoment({ shiftId: shift.id, side: "clock_out" })) ?? "closing";
  const tpl = await findApplicableTemplate({
    studioId: shift.studio_id ?? null,
    businessRole: shift.business_role,
    phase: detected,
  });
  if (!tpl) return null;
  const [{ data: its }, { data: phs }] = await Promise.all([
    supabase.from("checklist_template_items").select("id").eq("template_id", tpl.id),
    supabase.from("checklist_template_photos").select("id").eq("template_id", tpl.id),
  ]);
  const total = (its?.length ?? 0) + (phs?.length ?? 0);
  const { data: sub } = await supabase
    .from("checklist_submissions")
    .select("id")
    .eq("user_id", userId)
    .eq("shift_id", shift.id)
    .eq("template_id", tpl.id)
    .maybeSingle();
  let done = 0;
  if (sub) {
    const [{ data: si }, { data: sp }] = await Promise.all([
      supabase.from("checklist_submission_items").select("is_checked").eq("submission_id", (sub as any).id),
      supabase.from("checklist_submission_photos").select("photo_url").eq("submission_id", (sub as any).id),
    ]);
    done = ((si ?? []) as any[]).filter((r) => r.is_checked).length
      + ((sp ?? []) as any[]).filter((r) => !!r.photo_url).length;
  }
  return { phase: detected, total, done };
}

export function MyChecklistSheet({ open, onClose, shift, userId, onProgress }: {
  open: boolean;
  onClose: () => void;
  shift: ChecklistShiftRow | null;
  userId: string;
  onProgress?: (p: { done: number; total: number }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<ChecklistPhase>("closing");
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [items, setItems] = useState<ChecklistTemplateItem[]>([]);
  const [photos, setPhotos] = useState<ChecklistTemplatePhoto[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [itemStates, setItemStates] = useState<Record<string, boolean>>({});
  const [photoStates, setPhotoStates] = useState<Record<string, PhotoState>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !shift) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const detected = (await detectChecklistMoment({ shiftId: shift.id, side: "clock_out" })) ?? "closing";
        const tpl = await findApplicableTemplate({
          studioId: shift.studio_id ?? null,
          businessRole: shift.business_role,
          phase: detected,
        });
        if (!alive) return;
        setPhase(detected);
        if (!tpl) {
          setTemplate(null); setItems([]); setPhotos([]); setSubmissionId(null);
          setLoading(false);
          return;
        }
        setTemplate(tpl);
        const subId = await getOrCreateSubmission(userId, shift.id, tpl.id, detected);
        if (!alive) return;
        setSubmissionId(subId);
        const [{ data: its }, { data: phs }, { data: si }, { data: sp }] = await Promise.all([
          supabase.from("checklist_template_items").select("*").eq("template_id", tpl.id).order("order_index"),
          supabase.from("checklist_template_photos").select("*").eq("template_id", tpl.id).order("order_index"),
          supabase.from("checklist_submission_items").select("template_item_id,is_checked").eq("submission_id", subId),
          supabase.from("checklist_submission_photos").select("id,template_photo_id,photo_url").eq("submission_id", subId),
        ]);
        if (!alive) return;
        setItems((its ?? []) as any);
        setPhotos((phs ?? []) as any);
        const im: Record<string, boolean> = {};
        ((si ?? []) as any[]).forEach((r) => { im[r.template_item_id] = r.is_checked; });
        setItemStates(im);
        const pm: Record<string, PhotoState> = {};
        ((phs ?? []) as any[]).forEach((p) => {
          const found = ((sp ?? []) as any[]).find((s) => s.template_photo_id === p.id);
          pm[p.id] = {
            submissionPhotoId: found?.id ?? null,
            photoUrl: found?.photo_url ?? null,
            status: found?.photo_url ? "done" : "idle",
          };
        });
        setPhotoStates(pm);
      } catch (e: any) {
        console.error("[my-checklist] load", e);
        toast.error("Erreur de chargement", { description: e?.message });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, shift?.id, userId]);

  const itemsDone = items.filter((i) => itemStates[i.id]).length;
  const photosDone = photos.filter((p) => photoStates[p.id]?.status === "done").length;
  const total = items.length + photos.length;
  const done = itemsDone + photosDone;

  useEffect(() => {
    if (open && !loading) onProgress?.({ done, total });
  }, [done, total, loading, open]);

  const flashSaved = () => { setSavedAt(Date.now()); setTimeout(() => setSavedAt(null), 1800); };

  const toggleItem = async (itemId: string) => {
    if (!submissionId) return;
    const newVal = !itemStates[itemId];
    setItemStates((prev) => ({ ...prev, [itemId]: newVal }));
    setSaving(true);
    try {
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
      flashSaved();
    } catch (e: any) {
      setItemStates((prev) => ({ ...prev, [itemId]: !newVal }));
      toast.error("Non enregistré", { description: "Vérifie ta connexion et réessaie." });
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (zoneId: string, file: File) => {
    if (!submissionId) return;
    setPhotoStates((prev) => ({ ...prev, [zoneId]: { ...prev[zoneId], status: "uploading" } }));
    try {
      const path = await uploadSubmissionPhoto(file, userId, submissionId, zoneId);
      const { data: existing } = await supabase.from("checklist_submission_photos")
        .select("id").eq("submission_id", submissionId).eq("template_photo_id", zoneId).maybeSingle();
      let spId: string;
      if (existing) {
        spId = (existing as any).id;
        await supabase.from("checklist_submission_photos")
          .update({ photo_url: path, uploaded_at: new Date().toISOString(), ai_validation_status: null, ai_validation_message: null })
          .eq("id", spId);
      } else {
        const { data: ins, error } = await supabase.from("checklist_submission_photos")
          .insert({ submission_id: submissionId, template_photo_id: zoneId, photo_url: path, uploaded_at: new Date().toISOString() })
          .select("id").single();
        if (error) throw error;
        spId = (ins as any).id;
      }
      const signed = await signChecklistPhoto(path);
      const analyze = !!(template as any)?.analyze_with_ai;
      setPhotoStates((prev) => ({
        ...prev,
        [zoneId]: { submissionPhotoId: spId, photoUrl: signed, status: analyze ? "analyzing" : "done", message: null },
      }));
      flashSaved();

      if (analyze) {
        try {
          const result: any = await analyzeClosurePhotoFn({ data: { submissionPhotoId: spId } });
          setPhotoStates((prev) => ({
            ...prev,
            [zoneId]: {
              ...prev[zoneId],
              status: "done",
              message: result?.status === "rejected" ? (result?.message ?? "Photo non conforme") : null,
              rejected: result?.status === "rejected",
            },
          }));
          if (result?.status === "rejected") {
            toast.warning("Photo à revoir", { description: result?.message ?? "L'IA a détecté un souci sur cette zone." });
          }
        } catch (err) {
          console.error("[my-checklist] AI", err);
          setPhotoStates((prev) => ({ ...prev, [zoneId]: { ...prev[zoneId], status: "done" } }));
        }
      }
    } catch (e: any) {
      console.error("[my-checklist] upload", e);
      toast.error("Photo non envoyée", { description: "Vérifie ta connexion et réessaie." });
      setPhotoStates((prev) => ({ ...prev, [zoneId]: { ...prev[zoneId], status: "idle" } }));
    }
  };

  if (!open || !shift) return null;

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#FAF8F4" }}>
      {/* Header */}
      <div className="shrink-0 border-b" style={{ borderColor: "rgba(0,0,0,0.06)", backgroundColor: "#fff", paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <div className="flex items-center justify-between px-4 pb-3">
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Ma check-list · {PHASE_LABEL[phase]}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {shift.business_role} · {done}/{total} fait{done > 1 ? "s" : ""}
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2" style={{ backgroundColor: "var(--muted)" }} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <div style={{ height: 4, backgroundColor: "rgba(0,0,0,0.06)" }}>
          <div style={{ height: 4, width: `${pct}%`, backgroundColor: pct === 100 ? "var(--success-text)" : "var(--coral)", transition: "width .25s" }} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-16" style={{ color: "var(--muted-foreground)" }}>
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : !template ? (
          <div className="rounded-xl px-4 py-8 text-center" style={{ backgroundColor: "#fff", border: "0.5px dashed rgba(0,0,0,0.15)", fontSize: 13, color: "var(--muted-foreground)" }}>
            Aucune check-list configurée pour ton poste sur ce studio.
          </div>
        ) : (
          <>
            <div className="rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: "#EAF4FB", border: "0.5px solid #BCD8EC" }}>
              <div style={{ fontSize: 12, color: "#1F4E6E", lineHeight: 1.5 }}>
                Tu peux cocher au fur et à mesure pendant tout ton shift. Chaque case est enregistrée immédiatement —
                tu peux fermer l'app et revenir plus tard. Elle doit être à 100 % pour clôturer ton shift.
              </div>
            </div>

            {items.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  À cocher · {itemsDone}/{items.length}
                </div>
                <div className="flex flex-col gap-2 mb-6">
                  {items.map((it) => {
                    const checked = !!itemStates[it.id];
                    return (
                      <button
                        key={it.id}
                        onClick={() => toggleItem(it.id)}
                        className="rounded-xl border px-3 py-3 flex items-center gap-3 text-left"
                        style={{ backgroundColor: "#fff", borderColor: checked ? "var(--success-text)" : "rgba(0,0,0,0.08)" }}
                      >
                        <span
                          className="rounded-md flex items-center justify-center shrink-0"
                          style={{ width: 28, height: 28, backgroundColor: checked ? "var(--coral)" : "transparent", border: checked ? "none" : "1.5px solid rgba(0,0,0,0.2)" }}
                        >
                          {checked && <Check size={16} color="#fff" strokeWidth={2.5} />}
                        </span>
                        <span className="flex-1">
                          <span style={{ fontSize: 13, fontWeight: 500, opacity: checked ? 0.55 : 1, textDecoration: checked ? "line-through" : "none" }}>
                            {it.label}
                          </span>
                          {it.description && (
                            <span className="block" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{it.description}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {photos.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Photos · {photosDone}/{photos.length}
                </div>
                <div className="flex flex-col gap-3">
                  {photos.map((z) => (
                    <PhotoRow key={z.id} zone={z} state={photoStates[z.id]} onUpload={(f) => uploadPhoto(z.id, f)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t px-4 py-3" style={{ borderColor: "rgba(0,0,0,0.06)", backgroundColor: "#fff", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center justify-between mb-2" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          <span className="inline-flex items-center gap-1.5">
            {saving ? <><Loader2 size={12} className="animate-spin" /> Enregistrement…</>
              : savedAt ? <><CloudUpload size={12} style={{ color: "var(--success-text)" }} /> Enregistré</>
              : <><CloudUpload size={12} /> Progression sauvegardée automatiquement</>}
          </span>
          <span>{pct}%</span>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-md py-3"
          style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
        >
          {pct === 100 ? "Terminé — revenir à l'accueil" : "Continuer plus tard"}
        </button>
      </div>
    </div>
  );
}

function PhotoRow({ zone, state, onUpload }: { zone: ChecklistTemplatePhoto; state?: PhotoState; onUpload: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const status = state?.status ?? "idle";
  return (
    <div className="rounded-xl border p-3" style={{ backgroundColor: "#fff", borderColor: status === "done" ? "var(--success-text)" : "rgba(0,0,0,0.08)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="rounded-md p-1.5" style={{ backgroundColor: "var(--muted)" }}><Camera size={14} /></div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{zone.label}</div>
            {zone.description && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{zone.description}</div>}
          </div>
        </div>
        <span className="rounded-full px-2 py-0.5" style={{
          fontSize: 10, fontWeight: 500,
          backgroundColor: status === "done" ? "var(--success-bg)" : "var(--muted)",
          color: status === "done" ? "var(--success-text)" : "var(--muted-foreground)",
        }}>
          {status === "uploading" ? "Envoi…" : status === "done" ? "Envoyée" : "À photographier"}
        </span>
      </div>
      {state?.photoUrl && (
        <img src={state.photoUrl} alt={zone.label} className="w-full rounded-lg mb-2" style={{ maxHeight: 180, objectFit: "cover" }} />
      )}
      <input
        ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="w-full rounded-md py-2.5 disabled:opacity-50"
        style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--muted)" }}
      >
        {status === "uploading" ? "Envoi…" : state?.photoUrl ? "Reprendre la photo" : "Prendre la photo"}
      </button>
    </div>
  );
}

/** Carte d'accès rapide affichée sur l'accueil employé pendant tout le shift. */
export function ChecklistAccessCard({ done, total, phase, onOpen }: {
  done: number; total: number; phase: ChecklistPhase; onOpen: () => void;
}) {
  const complete = total > 0 && done >= total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <button
      onClick={onOpen}
      className="w-full rounded-xl px-4 py-4 mb-3 flex items-center gap-3 text-left"
      style={{
        backgroundColor: complete ? "var(--success-bg)" : "#fff",
        border: `0.5px solid ${complete ? "var(--success-text)" : "var(--coral)"}`,
      }}
    >
      <div className="rounded-lg flex items-center justify-center shrink-0" style={{
        width: 36, height: 36,
        backgroundColor: complete ? "var(--success-text)" : "var(--coral-light)",
        color: complete ? "#fff" : "var(--coral-dark)",
      }}>
        {complete ? <Check size={16} /> : <ListChecks size={16} />}
      </div>
      <div className="flex-1">
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          {complete ? "Check-list terminée" : "Faire ma check-list"}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {PHASE_LABEL[phase]} · {done}/{total} fait{done > 1 ? "s" : ""} — {complete ? "prêt à clôturer" : "à remplir avant de clôturer"}
        </div>
        <div className="mt-2 rounded-full" style={{ height: 4, backgroundColor: "rgba(0,0,0,0.08)" }}>
          <div className="rounded-full" style={{ height: 4, width: `${pct}%`, backgroundColor: complete ? "var(--success-text)" : "var(--coral)" }} />
        </div>
      </div>
    </button>
  );
}
