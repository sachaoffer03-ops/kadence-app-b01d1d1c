import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadScoringSettings } from "./scoring-rules.server";
import { scorePunctuality, scoreChecklist } from "./scoring-shared";
import { loadClockPolicy, computeMinutesLate, computeOutDeviation, clockInNeedsReason, clockOutNeedsReason, cleanReason } from "./clock-policy.server";


async function computeShiftPoints(shiftId: string, submissionId?: string | null): Promise<{
  punctuality: number; checklist: number | null; total: number; outOf: number;
} | null> {
  try {
    const { data: sh } = await supabaseAdmin
      .from("shifts").select("minutes_late").eq("id", shiftId).maybeSingle();
    const rules: any = await loadScoringSettings(supabaseAdmin);
    const ml = sh?.minutes_late == null ? 0 : Number(sh.minutes_late);
    const pPts = scorePunctuality(rules, ml);
    let cPts: number | null = null;
    if (submissionId) {
      const { data: items } = await supabaseAdmin
        .from("checklist_submission_items")
        .select("checked").eq("submission_id", submissionId);
      const arr = items ?? [];
      if (arr.length > 0) {
        const done = arr.filter((i: any) => i.checked).length;
        const missed = arr.length - done;
        cPts = scoreChecklist(rules, done / arr.length, missed);
      }
    }
    const wp = rules.weight_punctuality, wc = rules.weight_checklist;
    const total = cPts !== null
      ? (pPts * wp + cPts * wc) / (wp + wc || 1)
      : pPts;
    return {
      punctuality: Math.round(pPts * 10) / 10,
      checklist: cPts !== null ? Math.round(cPts * 10) / 10 : null,
      total: Math.round(total * 10) / 10,
      outOf: 10,
    };
  } catch {
    return null;
  }
}

type CompleteShiftClockOutInput = {
  shiftId: string;
  actorId: string;
  submissionId?: string | null;
  rating?: number | null;
  feedbackMsg?: string | null;
  reportMsg?: string | null;
  handoffMsg?: string | null;
  outReason?: string | null;
};


const cleanText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function completeShiftClockOut(input: CompleteShiftClockOutInput) {
  const { data: shift, error: shiftError } = await supabaseAdmin
    .from("shifts")
    .select("id,user_id,studio_id,shift_date,start_time,end_time,business_role,clocked_in_at,clocked_out_at")
    .eq("id", input.shiftId)
    .maybeSingle();

  if (shiftError) throw new Error(shiftError.message);
  if (!shift) throw new Error("Shift introuvable");

  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", input.actorId);
  if (rolesError) throw new Error(rolesError.message);

  const isAdminLike = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "manager");
  const isOwner = shift.user_id === input.actorId;
  if (!isOwner && !isAdminLike) throw new Error("Tu ne peux pas clôturer ce shift");
  if (!shift.clocked_in_at) throw new Error("Tu dois d'abord pointer ton arrivée");
  if (shift.clocked_out_at) return { alreadyCompleted: true, completedAt: shift.clocked_out_at as string };

  // Fenêtre de sortie tolérée (réglages studio, appliqués en direct)
  const outNow = new Date();
  const outPolicy = await loadClockPolicy(shift as any);
  const outDeviation = computeOutDeviation(outPolicy, outNow);
  const outReason = cleanReason(input.outReason);
  if (isOwner && clockOutNeedsReason(outPolicy, outNow) && !outReason) {
    throw new Error(
      outDeviation < 0
        ? `Tu pars ${Math.abs(outDeviation)} min avant la fin prévue (tolérance : ${outPolicy.earlyOutWindowMin} min). Un motif est obligatoire pour pointer ta sortie.`
        : `Tu pointes ta sortie ${outDeviation} min après la fin prévue (tolérance : ${outPolicy.graceOutMin} min). Un motif est obligatoire.`
    );
  }


  if (input.submissionId) {
    const { data: submission, error: subReadError } = await supabaseAdmin
      .from("checklist_submissions")
      .select("id,shift_id,user_id")
      .eq("id", input.submissionId)
      .maybeSingle();
    if (subReadError) throw new Error(subReadError.message);
    if (!submission || submission.shift_id !== input.shiftId || submission.user_id !== shift.user_id) {
      throw new Error("Checklist invalide pour ce shift");
    }
    const { error: subUpdateError } = await supabaseAdmin
      .from("checklist_submissions")
      .update({ status: "completed", submitted_at: new Date().toISOString() })
      .eq("id", input.submissionId);
    if (subUpdateError) throw new Error(subUpdateError.message);
  }

  const feedbackMsg = cleanText(input.feedbackMsg);
  const reportMsg = cleanText(input.reportMsg);
  const handoffMsg = cleanText(input.handoffMsg);

  if ((input.rating && input.rating > 0) || feedbackMsg) {
    const { error } = await supabaseAdmin.from("feedbacks").insert({
      shift_id: input.shiftId,
      author_id: input.actorId,
      // Échelle 0..10 (alignée sur la nouvelle UI RatingInput).
      rating: input.rating && input.rating > 0 ? Math.min(Math.max(input.rating, 0), 10) : 7,
      message: feedbackMsg,
    });
    if (error) throw new Error(error.message);
  }
  if (reportMsg) {
    const { error } = await supabaseAdmin.from("shift_reports").insert({
      shift_id: input.shiftId,
      author_id: input.actorId,
      message: reportMsg,
    });
    if (error) throw new Error(error.message);
  }
  if (handoffMsg) {
    const { error } = await supabaseAdmin.from("shift_handoffs").insert({
      shift_id: input.shiftId,
      author_id: input.actorId,
      message: handoffMsg,
    });
    if (error) throw new Error(error.message);
  }

  const completedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("shifts")
    .update({ status: "completed", clocked_out_at: completedAt })
    .eq("id", input.shiftId)
    .is("clocked_out_at", null)
    .select("id")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) return { alreadyCompleted: true, completedAt };

  // ─── Notification handoff → prochain employé du même studio/poste ───
  if (handoffMsg && shift.studio_id && shift.business_role) {
    try {
      const { data: nextShift } = await supabaseAdmin
        .from("shifts")
        .select("id,user_id,shift_date,start_time")
        .eq("studio_id", shift.studio_id)
        .eq("business_role", shift.business_role)
        .not("user_id", "is", null)
        .or(`shift_date.gt.${shift.shift_date},and(shift_date.eq.${shift.shift_date},start_time.gte.${shift.end_time})`)
        .lte("shift_date", new Date(new Date(shift.shift_date).getTime() + 7 * 86_400_000).toISOString().slice(0, 10))
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (nextShift?.user_id && nextShift.user_id !== input.actorId) {
        const { data: author } = await supabaseAdmin
          .from("profiles")
          .select("first_name")
          .eq("id", input.actorId)
          .maybeSingle();
        const fromName = author?.first_name || "Un collègue";
        await supabaseAdmin.from("notifications").insert({
          user_id: nextShift.user_id,
          type: "shift_handoff_received",
          title: "Message du shift précédent",
          body: `${fromName} t'a laissé un mot avant son départ.`,
          link: "/staff-app",
          priority: "normal",
          category: "shift",
        });
      }
    } catch {
      // best-effort
    }
  }


  // Pas de notification "shift à noter" : trop bruyant (une par clôture).
  // Les shifts en attente de note sont regroupés dans l'onglet « À noter » de /feedbacks.



  const points = await computeShiftPoints(input.shiftId, input.submissionId);
  return { alreadyCompleted: false, completedAt, points };
}

// ─────────────────────────── CLOCK IN ───────────────────────────

export type ValidateClockInInput = {
  shiftId: string;
  actorId: string;
  qrCode: string;
  lat?: number | null;
  lng?: number | null;
  lateReason?: string | null;
};

export async function validateClockIn(input: ValidateClockInInput) {
  const { data: shift, error } = await supabaseAdmin
    .from("shifts")
    .select("id,user_id,studio_id,shift_date,start_time,end_time,clocked_in_at,clocked_out_at")
    .eq("id", input.shiftId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!shift) throw new Error("Shift introuvable");
  if (shift.user_id !== input.actorId) throw new Error("Ce shift ne t'appartient pas");
  if (shift.clocked_in_at) return { ok: true, alreadyDone: true as const, clockedInAt: shift.clocked_in_at, minutesLate: 0 };
  if (shift.clocked_out_at) throw new Error("Ce shift est déjà clôturé");
  if (!shift.studio_id) throw new Error("Shift sans studio — impossible de pointer");

  const { data: studio, error: stErr } = await supabaseAdmin
    .from("studios")
    .select("id,current_qr_code,previous_qr_code,previous_qr_rotated_at,geofencing_enabled,geofencing_radius_m,lat,lng")
    .eq("id", shift.studio_id)
    .maybeSingle();
  if (stErr) throw new Error(stErr.message);
  if (!studio) throw new Error("Studio introuvable");

  const expected = (studio.current_qr_code ?? "").trim();
  if (!expected) throw new Error("Aucun QR code actif pour ce studio. Demande à l'admin de le régénérer.");
  const submitted = (input.qrCode ?? "").trim().toLowerCase();
  const prev = (((studio as any).previous_qr_code as string) ?? "").trim().toLowerCase();
  const prevAt = (studio as any).previous_qr_rotated_at ? new Date((studio as any).previous_qr_rotated_at).getTime() : 0;
  const prevValid = !!prev && submitted === prev && (Date.now() - prevAt) <= 45_000;
  if (expected.toLowerCase() !== submitted && !prevValid) {
    throw new Error("Code invalide. Vérifie le QR affiché sur la tablette.");
  }

  let distance_m: number | null = null;
  if (studio.geofencing_enabled && studio.lat != null && studio.lng != null) {
    if (input.lat == null || input.lng == null) {
      throw new Error("Géolocalisation requise pour pointer ici. Autorise l'accès à ta position.");
    }
    distance_m = Math.round(haversineMeters(studio.lat, studio.lng, input.lat, input.lng));
    if (distance_m > (studio.geofencing_radius_m ?? 50)) {
      throw new Error(`Tu es trop loin du studio (${distance_m}m). Rapproche-toi pour pointer.`);
    }
  }

  // Tolérance de retard : lue en direct sur le studio (réglages /cloture)
  const now = new Date();
  const policy = await loadClockPolicy(shift as any);
  const minutesLate = computeMinutesLate(policy, now);
  const reason = cleanReason(input.lateReason);
  if (clockInNeedsReason(policy, now) && !reason) {
    throw new Error(
      `Tu as ${minutesLate} min de retard (tolérance : ${policy.graceInMin} min). Un motif est obligatoire pour pointer ton arrivée.`
    );
  }
  const clockedInAt = now.toISOString();

  const { error: upErr } = await supabaseAdmin
    .from("shifts")
    .update({ clocked_in_at: clockedInAt, minutes_late: minutesLate, status: "scheduled", late_reason: reason } as any)
    .eq("id", input.shiftId)
    .is("clocked_in_at", null);
  if (upErr) throw new Error(upErr.message);

  await supabaseAdmin.from("shift_clock_audit").insert({
    shift_id: input.shiftId,
    actor_id: input.actorId,
    action: "self_clock_in",
    before_value: null,
    after_value: { clocked_in_at: clockedInAt, minutes_late: minutesLate, distance_m },
    note: reason,
  } as any);



  const { data: shiftFull } = await supabaseAdmin
    .from("shifts")
    .select("business_role")
    .eq("id", input.shiftId)
    .maybeSingle();

  // ─── Rappel handoff au pointage : s'il y a un mot du shift précédent, notifier l'employé ───
  try {
    if (shiftFull?.business_role && shift.studio_id) {
      const { data: prevShift } = await supabaseAdmin
        .from("shifts")
        .select("id,shift_date,end_time,user_id")
        .eq("studio_id", shift.studio_id)
        .eq("business_role", shiftFull.business_role)
        .neq("id", input.shiftId)
        .not("clocked_out_at", "is", null)
        .or(`shift_date.lt.${shift.shift_date},and(shift_date.eq.${shift.shift_date},end_time.lte.${shift.start_time})`)
        .gte("shift_date", new Date(new Date(shift.shift_date).getTime() - 7 * 86_400_000).toISOString().slice(0, 10))
        .order("shift_date", { ascending: false })
        .order("end_time", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prevShift?.id) {
        const { data: handoff } = await supabaseAdmin
          .from("shift_handoffs")
          .select("id,author_id")
          .eq("shift_id", prevShift.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (handoff?.id) {
          const { data: author } = await supabaseAdmin
            .from("profiles")
            .select("first_name")
            .eq("id", handoff.author_id)
            .maybeSingle();
          const fromName = author?.first_name || "Le collègue précédent";
          await supabaseAdmin.from("notifications").insert({
            user_id: input.actorId,
            type: "shift_handoff_reminder",
            title: "Mot du shift précédent",
            body: `${fromName} t'a laissé un message — pense à le lire avant de commencer.`,
            link: "/staff-app",
            priority: "normal",
            category: "shift",
          });
        }
      }
    }
  } catch {
    // best-effort
  }

  return { ok: true, alreadyDone: false as const, clockedInAt, minutesLate, distance_m };
}

