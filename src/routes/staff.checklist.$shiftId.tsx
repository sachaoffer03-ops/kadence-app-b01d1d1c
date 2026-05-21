import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, Image as ImageIcon, X, Loader2, Star, MessageSquare, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { findApplicableTemplate, getOrCreateSubmission, uploadSubmissionPhoto } from "@/lib/checklists.helpers";
import { getChecklistPhotoUrl } from "@/hooks/use-checklists";
import { completeShiftClockOutFn } from "@/lib/shift-clock.functions";
import type {
  ChecklistTemplate, ChecklistTemplateItem, ChecklistTemplatePhoto,
  ChecklistSubmissionItem, ChecklistSubmissionPhoto,
} from "@/types/checklists";

export const Route = createFileRoute("/staff/checklist/$shiftId")({
  component: StaffChecklistPage,
  head: () => ({ meta: [{ title: "Checklist de fin de shift — Kadence" }] }),
});

interface ShiftRow {
  id: string; shift_date: string; start_time: string; end_time: string;
  business_role: string; studio_id: string | null; user_id: string | null;
  status: string; clocked_out_at: string | null;
}

type Phase = "checklist" | "wrapup" | "done";

function StaffChecklistPage() {
  const { shiftId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [shift, setShift] = useState<ShiftRow | null>(null);
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [items, setItems] = useState<ChecklistTemplateItem[]>([]);
  const [photos, setPhotos] = useState<ChecklistTemplatePhoto[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Map<string, ChecklistSubmissionItem>>(new Map());
  const [photoSubs, setPhotoSubs] = useState<Map<string, ChecklistSubmissionPhoto>>(new Map());
  const [note, setNote] = useState("");
  const [studioName, setStudioName] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("checklist");
  const [photoIdx, setPhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Bootstrap ----
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const { data: s, error: sErr } = await supabase.from("shifts")
          .select("id, shift_date, start_time, end_time, business_role, studio_id, user_id, status, clocked_out_at")
          .eq("id", shiftId).maybeSingle();
        if (sErr) throw sErr;
        if (!s) { setError("Shift introuvable"); setLoading(false); return; }
        if (s.user_id !== user.id) { setError("Ce shift ne t'appartient pas"); setLoading(false); return; }
        if (!alive) return;
        setShift(s as ShiftRow);

        if (s.studio_id) {
          const { data: st } = await supabase.from("studios").select("short_name, name").eq("id", s.studio_id).maybeSingle();
          if (alive && st) setStudioName((st as any).short_name || (st as any).name || "");
        }

        const tpl = await findApplicableTemplate({ studioId: s.studio_id, businessRole: s.business_role });
        if (!alive) return;
        if (!tpl) { setError("Aucune checklist requise pour ce shift"); setLoading(false); return; }
        setTemplate(tpl);

        const [{ data: ti }, { data: tp }] = await Promise.all([
          supabase.from("checklist_template_items" as any).select("*").eq("template_id", tpl.id).order("order_index"),
          supabase.from("checklist_template_photos" as any).select("*").eq("template_id", tpl.id).order("order_index"),
        ]);
        if (!alive) return;
        setItems((ti as any) ?? []);
        setPhotos((tp as any) ?? []);

        const subId = await getOrCreateSubmission(user.id, shiftId, tpl.id);
        if (!alive) return;
        setSubmissionId(subId);

        const [{ data: si }, { data: sp }, { data: sub }] = await Promise.all([
          supabase.from("checklist_submission_items" as any).select("*").eq("submission_id", subId),
          supabase.from("checklist_submission_photos" as any).select("*").eq("submission_id", subId),
          supabase.from("checklist_submissions" as any).select("employee_note").eq("id", subId).maybeSingle(),
        ]);
        if (!alive) return;
        setChecked(new Map(((si as any[]) ?? []).map((i: any) => [i.template_item_id, i])));
        setPhotoSubs(new Map(((sp as any[]) ?? []).map((p: any) => [p.template_photo_id, p])));
        setNote(((sub as any)?.employee_note) ?? "");
      } catch (e: any) {
        setError(e.message || "Erreur de chargement");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user, shiftId]);

  // ---- Toggle item ----
  async function toggleItem(item: ChecklistTemplateItem) {
    if (!submissionId) return;
    const existing = checked.get(item.id);
    const nextChecked = !existing?.is_checked;
    // optimistic
    const next = new Map(checked);
    next.set(item.id, {
      id: existing?.id ?? "tmp",
      submission_id: submissionId,
      template_item_id: item.id,
      is_checked: nextChecked,
      checked_at: nextChecked ? new Date().toISOString() : null,
    });
    setChecked(next);
    try {
      if (existing && existing.id !== "tmp") {
        await supabase.from("checklist_submission_items" as any).update({
          is_checked: nextChecked, checked_at: nextChecked ? new Date().toISOString() : null,
        } as any).eq("id", existing.id);
      } else {
        const { data, error } = await supabase.from("checklist_submission_items" as any).insert({
          submission_id: submissionId, template_item_id: item.id,
          is_checked: nextChecked, checked_at: nextChecked ? new Date().toISOString() : null,
        } as any).select("*").single();
        if (error) throw error;
        const fresh = new Map(checked);
        fresh.set(item.id, data as any);
        setChecked(fresh);
      }
    } catch (e: any) {
      toast.error("Erreur d'enregistrement");
      // revert
      const revert = new Map(checked);
      if (existing) revert.set(item.id, existing); else revert.delete(item.id);
      setChecked(revert);
    }
  }

  // ---- Note autosave (debounced) ----
  useEffect(() => {
    if (!submissionId) return;
    const t = setTimeout(() => {
      supabase.from("checklist_submissions" as any)
        .update({ employee_note: note || null } as any)
        .eq("id", submissionId);
    }, 600);
    return () => clearTimeout(t);
  }, [note, submissionId]);

  // ---- Gating ----
  const requiredItemsDone = useMemo(() =>
    items.filter((i) => i.is_required).every((i) => checked.get(i.id)?.is_checked),
  [items, checked]);
  const requiredPhotosDone = useMemo(() =>
    photos.filter((p) => p.is_required).every((p) => !!photoSubs.get(p.id)?.photo_url),
  [photos, photoSubs]);
  const allDone = requiredItemsDone && requiredPhotosDone;

  const itemsDoneCount = items.filter((i) => checked.get(i.id)?.is_checked).length;
  const photosDoneCount = photos.filter((p) => !!photoSubs.get(p.id)?.photo_url).length;

  if (!user) return <CenterMsg>Chargement…</CenterMsg>;
  if (loading) return <CenterMsg><Loader2 size={20} className="animate-spin" /> Chargement de la checklist…</CenterMsg>;
  if (error) return (
    <CenterMsg>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{error}</div>
      <button onClick={() => navigate({ to: "/staff-app" })} className="rounded-md px-4 py-2"
        style={{ fontSize: 13, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
        Retour à l'accueil
      </button>
    </CenterMsg>
  );
  if (!shift || !template || !submissionId) return null;

  if (phase === "wrapup") {
    return <WrapUp shift={shift} submissionId={submissionId}
      onBack={() => setPhase("checklist")}
      onDone={() => { setPhase("done"); setTimeout(() => navigate({ to: "/staff-app" }), 1500); }} />;
  }
  if (phase === "done") {
    return (
      <CenterMsg>
        <div className="rounded-full flex items-center justify-center mb-4"
          style={{ width: 64, height: 64, backgroundColor: "var(--coral-light)" }}>
          <Check size={28} color="var(--coral-dark)" strokeWidth={1.8} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 4 }}>Shift clôturé</div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Bonne soirée !</div>
      </CenterMsg>
    );
  }

  const dateLabel = new Date(shift.shift_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#FAF8F4", maxWidth: 480, margin: "0 auto", paddingBottom: 100 }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 border-b flex items-center gap-3"
        style={{ backgroundColor: "#FAF8F4", borderColor: "rgba(0,0,0,0.06)" }}>
        <button onClick={() => navigate({ to: "/staff-app" })} className="rounded-full p-2" style={{ backgroundColor: "var(--muted)" }}>
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.2, textTransform: "capitalize" }}>{template.name}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
            {dateLabel} · {shift.business_role}{studioName && ` · ${studioName}`}
          </div>
        </div>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <Section title="À cocher" subtitle={`${itemsDoneCount} / ${items.length}`}>
          <div className="flex flex-col gap-1.5">
            {items.map((item) => {
              const isChecked = !!checked.get(item.id)?.is_checked;
              return (
                <button key={item.id} onClick={() => toggleItem(item)}
                  className="rounded-xl border px-3.5 py-3 flex items-center gap-3 text-left transition-colors"
                  style={{
                    backgroundColor: isChecked ? "var(--coral-light)" : "#fff",
                    borderColor: isChecked ? "var(--coral)" : "rgba(0,0,0,0.08)",
                  }}>
                  <span className="rounded-md flex items-center justify-center shrink-0" style={{
                    width: 22, height: 22,
                    backgroundColor: isChecked ? "var(--coral)" : "transparent",
                    border: isChecked ? "none" : "1.5px solid rgba(0,0,0,0.2)",
                  }}>
                    {isChecked && <Check size={14} color="#fff" strokeWidth={2.5} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13, fontWeight: isChecked ? 500 : 400, opacity: isChecked ? 0.85 : 1, textDecoration: isChecked ? "line-through" : "none" }}>
                      {item.label}
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.4 }}>{item.description}</div>
                    )}
                  </div>
                  {!item.is_required && (
                    <span className="rounded px-1.5 py-0.5" style={{ fontSize: 9, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>opt</span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Photos — one at a time */}
      {photos.length > 0 && (() => {
        const safeIdx = Math.min(photoIdx, photos.length - 1);
        const current = photos[safeIdx];
        const isDone = !!photoSubs.get(current.id)?.photo_url;
        return (
          <Section title="Photos à envoyer" subtitle={`${photosDoneCount} / ${photos.length}`}>
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 mb-3">
              {photos.map((p, i) => {
                const done = !!photoSubs.get(p.id)?.photo_url;
                const active = i === safeIdx;
                return (
                  <button key={p.id} onClick={() => setPhotoIdx(i)}
                    className="rounded-full transition-all"
                    style={{
                      width: active ? 22 : 8, height: 8,
                      backgroundColor: done ? "var(--coral)" : active ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.15)",
                    }}
                    aria-label={`Photo ${i + 1}`} />
                );
              })}
            </div>

            <PhotoCapture key={current.id} photo={current} userId={user.id} submissionId={submissionId}
              current={photoSubs.get(current.id) ?? null}
              onUploaded={(spRow) => {
                const next = new Map(photoSubs);
                next.set(current.id, spRow);
                setPhotoSubs(next);
                // auto-advance to next missing
                const nextMissing = photos.findIndex((pp, i) => i > safeIdx && !next.get(pp.id)?.photo_url);
                if (nextMissing !== -1) setTimeout(() => setPhotoIdx(nextMissing), 400);
              }} />

            <div className="flex items-center justify-between gap-2 mt-3">
              <button onClick={() => setPhotoIdx(Math.max(0, safeIdx - 1))} disabled={safeIdx === 0}
                className="rounded-lg px-3 py-2 flex items-center gap-1.5 disabled:opacity-30"
                style={{ fontSize: 12, fontWeight: 500, border: "1px solid rgba(0,0,0,0.08)", backgroundColor: "#fff" }}>
                <ArrowLeft size={13} /> Précédente
              </button>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                {safeIdx + 1} / {photos.length}{isDone && " ✓"}
              </div>
              <button onClick={() => setPhotoIdx(Math.min(photos.length - 1, safeIdx + 1))} disabled={safeIdx === photos.length - 1}
                className="rounded-lg px-3 py-2 flex items-center gap-1.5 disabled:opacity-30"
                style={{ fontSize: 12, fontWeight: 500, border: "1px solid rgba(0,0,0,0.08)", backgroundColor: "#fff" }}>
                Suivante <ArrowRight size={13} />
              </button>
            </div>
          </Section>
        );
      })()}

      {/* Note */}
      <Section title="Note libre (optionnel)">
        <textarea value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Quelque chose à signaler à l'admin sur la fermeture ?"
          rows={3}
          className="w-full rounded-xl border px-3.5 py-3 outline-none focus:border-[var(--coral)] resize-none"
          style={{ fontSize: 13, borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#fff", lineHeight: 1.5 }} />
      </Section>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 px-4 py-3 border-t"
        style={{ width: "100%", maxWidth: 480, paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))", backgroundColor: "#FAF8F4", borderColor: "rgba(0,0,0,0.06)" }}>
        <button onClick={() => allDone && setPhase("wrapup")} disabled={!allDone}
          className="w-full rounded-xl py-3.5 transition-opacity disabled:opacity-40"
          style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
          {allDone ? "Continuer →" : "Compléter les éléments requis"}
        </button>
        {!allDone && (
          <div className="text-center mt-2" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            {!requiredItemsDone && `${items.filter((i) => i.is_required && !checked.get(i.id)?.is_checked).length} item(s) requis`}
            {!requiredItemsDone && !requiredPhotosDone && " · "}
            {!requiredPhotosDone && `${photos.filter((p) => p.is_required && !photoSubs.get(p.id)?.photo_url).length} photo(s) requise(s)`}
          </div>
        )}
      </div>
    </div>
  );
}

// ============== Wrap-up (rating + report + handoff + finalize) ==============

function WrapUp({ shift, submissionId, onBack, onDone }: {
  shift: ShiftRow; submissionId: string; onBack: () => void; onDone: () => void;
}) {
  const { user } = useAuth();
  const completeClockOut = useServerFn(completeShiftClockOutFn);
  const [rating, setRating] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  const [handoffMsg, setHandoffMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFinalize() {
    if (!user) return;
    setBusy(true);
    try {
      const result = await completeClockOut({
        data: {
          shiftId: shift.id,
          submissionId,
          rating,
          feedbackMsg,
          reportMsg,
          handoffMsg,
        },
      });

      toast.success(result.alreadyCompleted ? "Shift déjà clôturé" : "Shift clôturé");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#FAF8F4", maxWidth: 480, margin: "0 auto", paddingBottom: 100 }}>
      <div className="sticky top-0 z-10 px-4 py-3 border-b flex items-center gap-3"
        style={{ backgroundColor: "#FAF8F4", borderColor: "rgba(0,0,0,0.06)" }}>
        <button onClick={onBack} className="rounded-full p-2" style={{ backgroundColor: "var(--muted)" }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Clôture du shift</div>
      </div>

      <Section title="Comment s'est passé ce shift ?">
        <div className="flex justify-center gap-2 py-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} className="p-1">
              <Star size={32}
                fill={n <= rating ? "var(--coral)" : "transparent"}
                color={n <= rating ? "var(--coral)" : "rgba(0,0,0,0.2)"}
                strokeWidth={1.4} />
            </button>
          ))}
        </div>
        <textarea value={feedbackMsg} onChange={(e) => setFeedbackMsg(e.target.value)}
          placeholder="Un mot sur ton shift (optionnel)"
          rows={3}
          className="w-full mt-3 rounded-xl border px-3.5 py-3 outline-none focus:border-[var(--coral)] resize-none"
          style={{ fontSize: 13, borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#fff" }} />
      </Section>

      <Section title="Message à l'admin (optionnel)" icon={<MessageSquare size={14} />}>
        <textarea value={reportMsg} onChange={(e) => setReportMsg(e.target.value)}
          placeholder="Quelque chose à signaler ?"
          rows={3}
          className="w-full rounded-xl border px-3.5 py-3 outline-none focus:border-[var(--coral)] resize-none"
          style={{ fontSize: 13, borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#fff" }} />
      </Section>

      <Section title="Pour le prochain (optionnel)" icon={<ArrowRight size={14} />}>
        <textarea value={handoffMsg} onChange={(e) => setHandoffMsg(e.target.value)}
          placeholder="Une info à transmettre à l'employé qui prend le poste après toi"
          rows={3}
          className="w-full rounded-xl border px-3.5 py-3 outline-none focus:border-[var(--coral)] resize-none"
          style={{ fontSize: 13, borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#fff" }} />
      </Section>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 px-4 py-3 border-t"
        style={{ width: "100%", maxWidth: 480, backgroundColor: "#FAF8F4", borderColor: "rgba(0,0,0,0.06)" }}>
        <button onClick={handleFinalize} disabled={busy}
          className="w-full rounded-xl py-3.5 transition-opacity disabled:opacity-40"
          style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
          {busy ? "Clôture en cours…" : "Finaliser et pointer ma sortie"}
        </button>
      </div>
    </div>
  );
}

// ============== Sub-components ==============

function Section({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-4 pt-5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {icon}{title}
        </div>
        {subtitle && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function CenterMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center" style={{ backgroundColor: "#FAF8F4" }}>
      {children}
    </div>
  );
}

function PhotoCapture({ photo, userId, submissionId, current, onUploaded }: {
  photo: ChecklistTemplatePhoto; userId: string; submissionId: string;
  current: ChecklistSubmissionPhoto | null;
  onUploaded: (sp: ChecklistSubmissionPhoto) => void;
}) {
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [subUrl, setSubUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    if (photo.reference_photo_url) {
      getChecklistPhotoUrl(photo.reference_photo_url).then((u) => { if (alive) setRefUrl(u); });
    }
    return () => { alive = false; };
  }, [photo.reference_photo_url]);

  useEffect(() => {
    let alive = true;
    if (current?.photo_url) {
      getChecklistPhotoUrl(current.photo_url).then((u) => { if (alive) setSubUrl(u); });
    } else {
      setSubUrl(null);
    }
    return () => { alive = false; };
  }, [current?.photo_url]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadSubmissionPhoto(file, userId, submissionId, photo.id);
      const payload: any = {
        submission_id: submissionId, template_photo_id: photo.id,
        photo_url: path, uploaded_at: new Date().toISOString(),
      };
      if (current?.id) {
        const { data, error } = await supabase.from("checklist_submission_photos" as any)
          .update(payload).eq("id", current.id).select("*").single();
        if (error) throw error;
        onUploaded(data as any);
      } else {
        const { data, error } = await supabase.from("checklist_submission_photos" as any)
          .insert(payload).select("*").single();
        if (error) throw error;
        onUploaded(data as any);
      }
      toast.success("Photo enregistrée");
    } catch (err: any) {
      toast.error(err.message || "Erreur d'upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const done = !!subUrl;

  return (
    <div className="rounded-xl border overflow-hidden" style={{
      backgroundColor: "#fff",
      borderColor: done ? "var(--coral)" : "rgba(0,0,0,0.08)",
    }}>
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="rounded-md flex items-center justify-center shrink-0" style={{
            width: 20, height: 20,
            backgroundColor: done ? "var(--coral)" : "transparent",
            border: done ? "none" : "1.5px solid rgba(0,0,0,0.2)",
          }}>
            {done && <Check size={12} color="#fff" strokeWidth={2.5} />}
          </span>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{photo.label}</div>
          {!photo.is_required && (
            <span className="rounded px-1.5 py-0.5" style={{ fontSize: 9, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>opt</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px" style={{ backgroundColor: "rgba(0,0,0,0.06)" }}>
        <div>
          <div className="px-2 py-1" style={{ fontSize: 10, color: "var(--muted-foreground)", backgroundColor: "#fff" }}>Modèle</div>
          <div style={{ aspectRatio: "4/3" }} className="bg-[var(--muted)] flex items-center justify-center">
            {refUrl ? <img src={refUrl} alt="ref" className="w-full h-full object-cover" /> : <ImageIcon size={20} style={{ color: "var(--muted-foreground)" }} />}
          </div>
        </div>
        <div>
          <div className="px-2 py-1" style={{ fontSize: 10, color: "var(--muted-foreground)", backgroundColor: "#fff" }}>Ta photo</div>
          <div style={{ aspectRatio: "4/3" }} className="bg-[var(--muted)] flex items-center justify-center relative">
            {subUrl ? (
              <img src={subUrl} alt="sub" className="w-full h-full object-cover" />
            ) : uploading ? (
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
            ) : (
              <Camera size={22} style={{ color: "var(--muted-foreground)" }} strokeWidth={1.4} />
            )}
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        className="w-full py-2.5 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
        style={{
          fontSize: 12, fontWeight: 500,
          backgroundColor: done ? "var(--muted)" : "var(--coral-light)",
          color: done ? "var(--muted-foreground)" : "var(--coral-dark)",
          borderTop: "1px solid rgba(0,0,0,0.06)",
        }}>
        <Camera size={13} /> {uploading ? "Envoi…" : done ? "Reprendre la photo" : "Prendre la photo"}
      </button>
    </div>
  );
}
