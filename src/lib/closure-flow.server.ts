import { supabaseAdmin } from "@/integrations/supabase/client.server";

// --- helpers ---------------------------------------------------------------

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function assertOwnerShift(shiftId: string, userId: string) {
  const { data: shift, error } = await supabaseAdmin
    .from("shifts")
    .select("id,user_id,studio_id,shift_date,start_time,end_time,clocked_in_at,clocked_out_at,business_role")
    .eq("id", shiftId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!shift) throw new Error("Shift introuvable");
  // check actor is owner OR admin/manager
  if (shift.user_id !== userId) {
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    const elevated = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "manager");
    if (!elevated) throw new Error("Action non autorisée sur ce shift");
  }
  return shift;
}

// --- 1. validateClockOut ---------------------------------------------------

export type ValidateClockOutInput = {
  shiftId: string;
  actorId: string;
  qrCode: string;
  lat?: number | null;
  lng?: number | null;
};

export async function validateClockOut(input: ValidateClockOutInput) {
  const shift = await assertOwnerShift(input.shiftId, input.actorId);
  if (shift.clocked_out_at) return { ok: true, alreadyDone: true, distance_m: null as number | null };
  if (!shift.clocked_in_at) throw new Error("Tu dois d'abord pointer ton arrivée");

  if (!shift.studio_id) throw new Error("Shift sans studio — impossible de valider");

  const { data: studio, error: stErr } = await supabaseAdmin
    .from("studios")
    .select("id,current_qr_code,geofencing_enabled,geofencing_radius_m,lat,lng")
    .eq("id", shift.studio_id)
    .maybeSingle();
  if (stErr) throw new Error(stErr.message);
  if (!studio) throw new Error("Studio introuvable");

  const expected = (studio.current_qr_code ?? "").trim();
  if (!expected) throw new Error("Aucun QR code actif pour ce studio. Demande à l'admin de le régénérer.");
  if (expected.toLowerCase() !== (input.qrCode ?? "").trim().toLowerCase()) {
    throw new Error("Code invalide. Vérifie le QR affiché sur la tablette.");
  }

  let distance_m: number | null = null;
  if (studio.geofencing_enabled && studio.lat != null && studio.lng != null) {
    if (input.lat == null || input.lng == null) {
      throw new Error("Géolocalisation requise pour clôturer ici. Autorise l'accès à ta position.");
    }
    distance_m = Math.round(haversineMeters(studio.lat, studio.lng, input.lat, input.lng));
    if (distance_m > (studio.geofencing_radius_m ?? 50)) {
      throw new Error(`Tu es trop loin du studio (${distance_m}m). Rapproche-toi pour clôturer.`);
    }
  }

  // compute minutes_late lateness on exit isn't tracked — keep existing minutes_late as-is
  const completedAt = new Date().toISOString();
  const { error: upErr } = await supabaseAdmin
    .from("shifts")
    .update({ clocked_out_at: completedAt })
    .eq("id", input.shiftId)
    .is("clocked_out_at", null);
  if (upErr) throw new Error(upErr.message);

  return { ok: true, alreadyDone: false, distance_m, completedAt };
}

// --- 2. finalizeClosure ----------------------------------------------------

export type ClosureResponseInput = {
  questionId: string;
  stars?: number | null;
  yesno?: boolean | null;
  text?: string | null;
};

export type FinalizeClosureInput = {
  shiftId: string;
  actorId: string;
  submissionId?: string | null;
  responses: ClosureResponseInput[];
};

export async function finalizeClosure(input: FinalizeClosureInput) {
  const shift = await assertOwnerShift(input.shiftId, input.actorId);
  if (!shift.clocked_out_at) throw new Error("Pointage de sortie requis avant la finalisation");

  // Mark submission completed (if any)
  let submissionStatus: "completed" | "none" = "none";
  let itemsTotal = 0, itemsChecked = 0;
  let photosTotal = 0, photosValidated = 0;
  if (input.submissionId) {
    const { data: sub } = await supabaseAdmin
      .from("checklist_submissions")
      .select("id,shift_id,user_id,template_id,status")
      .eq("id", input.submissionId)
      .maybeSingle();
    if (sub && sub.shift_id === input.shiftId && sub.user_id === shift.user_id) {
      await supabaseAdmin
        .from("checklist_submissions")
        .update({ status: "completed", submitted_at: new Date().toISOString() })
        .eq("id", input.submissionId);
      submissionStatus = "completed";

      // Stats for recap
      const { count: itemsAll } = await supabaseAdmin
        .from("checklist_template_items").select("id", { head: true, count: "exact" })
        .eq("template_id", sub.template_id);
      const { data: itemRows } = await supabaseAdmin
        .from("checklist_submission_items").select("is_checked")
        .eq("submission_id", input.submissionId);
      itemsTotal = itemsAll ?? 0;
      itemsChecked = (itemRows ?? []).filter((r: any) => r.is_checked).length;

      const { count: photosAll } = await supabaseAdmin
        .from("checklist_template_photos").select("id", { head: true, count: "exact" })
        .eq("template_id", sub.template_id);
      const { data: photoRows } = await supabaseAdmin
        .from("checklist_submission_photos").select("ai_validation_status")
        .eq("submission_id", input.submissionId);
      photosTotal = photosAll ?? 0;
      photosValidated = (photoRows ?? []).filter((r: any) =>
        r.ai_validation_status === "validated" || r.ai_validation_status === null
      ).length;
    }
  }

  // Save closure responses (idempotent via unique constraint)
  if (input.responses.length > 0) {
    // delete previous responses for this submission then re-insert
    if (input.submissionId) {
      await supabaseAdmin.from("closure_question_responses").delete().eq("submission_id", input.submissionId);
      const rows = input.responses.map((r) => ({
        submission_id: input.submissionId!,
        question_id: r.questionId,
        stars_value: r.stars ?? null,
        yesno_value: r.yesno ?? null,
        text_value: r.text ?? null,
      }));
      if (rows.length) {
        const { error } = await supabaseAdmin.from("closure_question_responses").insert(rows);
        if (error) console.error("[closure] responses insert error", error);
      }
    }
  }

  // Mark shift completed
  await supabaseAdmin
    .from("shifts")
    .update({ status: "completed" })
    .eq("id", input.shiftId);

  // Notify managers of the studio (best-effort, non-blocking)
  const ownerId = shift.user_id as string;
  if (shift.studio_id && ownerId) {
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("first_name,last_name").eq("id", ownerId).maybeSingle();
    const name = `${(prof as any)?.first_name ?? ""} ${(prof as any)?.last_name ?? ""}`.trim() || "Un employé";
    const { data: mgrs } = await supabaseAdmin
      .from("user_roles").select("user_id,role").in("role", ["admin", "manager"]);
    if (mgrs && mgrs.length) {
      const notifs = mgrs.map((m: any) => ({
        user_id: m.user_id,
        type: "shift_closed",
        title: "Shift clôturé",
        body: `${name} a clôturé son shift (${shift.business_role})`,
        link: `/staff/${ownerId}`,
      }));
      await supabaseAdmin.from("notifications").insert(notifs);
    }
  }

  // ─── Compute recap (server is source of truth) ─────────────────────────────
  const inMs = shift.clocked_in_at ? new Date(shift.clocked_in_at).getTime() : null;
  const outMs = shift.clocked_out_at ? new Date(shift.clocked_out_at).getTime() : Date.now();
  const workedMin = inMs ? Math.max(0, Math.round((outMs - inMs) / 60000)) : 0;
  const workedHours = workedMin / 60;

  // Earnings
  const { data: profRate } = ownerId ? await supabaseAdmin
    .from("profiles").select("hourly_rate,first_name").eq("id", ownerId).maybeSingle()
    : { data: null };
  const hourlyRate = Number((profRate as any)?.hourly_rate ?? 0);
  const earnings = +(workedHours * hourlyRate).toFixed(2);

  // Score breakdown (TODO: rules configurable côté admin dans une future page "Règles de scoring")
  const { data: shiftFresh } = await supabaseAdmin
    .from("shifts").select("minutes_late").eq("id", input.shiftId).maybeSingle();
  const late = (shiftFresh as any)?.minutes_late ?? 0;
  const ponctualite = late <= 0 ? 5 : late <= 5 ? 4 : late <= 15 ? 2 : late <= 30 ? 1 : 0;
  const checklistPct = itemsTotal > 0 ? itemsChecked / itemsTotal : 1;
  const checklistPts = Math.round(checklistPct * 5);
  const photosPct = photosTotal > 0 ? photosValidated / photosTotal : 1;
  const photosPts = Math.round(photosPct * 5);
  const scoreDelta = ponctualite + checklistPts + photosPts;

  // Next scheduled shift
  const today = new Date().toISOString().slice(0, 10);
  const { data: nextShift } = ownerId ? await supabaseAdmin
    .from("shifts")
    .select("id,shift_date,start_time,end_time,business_role,studio_id")
    .eq("user_id", ownerId)
    .eq("status", "scheduled")
    .gt("shift_date", today)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle() : { data: null };

  return {
    workedMin,
    clockedInAt: shift.clocked_in_at,
    clockedOutAt: shift.clocked_out_at,
    submissionStatus,
    itemsTotal, itemsChecked,
    photosTotal, photosValidated,
    earnings, hourlyRate,
    score: { ponctualite, checklist: checklistPts, photos: photosPts, total: scoreDelta },
    firstName: (profRate as any)?.first_name ?? null,
    nextShift: nextShift ?? null,
  };
}
