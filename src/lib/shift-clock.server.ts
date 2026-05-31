import { supabaseAdmin } from "@/integrations/supabase/client.server";

type CompleteShiftClockOutInput = {
  shiftId: string;
  actorId: string;
  submissionId?: string | null;
  rating?: number | null;
  feedbackMsg?: string | null;
  reportMsg?: string | null;
  handoffMsg?: string | null;
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
    .select("id,user_id,studio_id,shift_date,end_time,business_role,clocked_in_at,clocked_out_at")
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


  // ─── Notification "shift_to_rate" pour les admins/managers du studio ───
  // Déclenché à chaque clôture pour rappeler à l'équipe d'attribuer une note manager.
  // On évite de notifier si l'employé s'auto-note (cas rare) — on cible seulement les admins/managers.
  try {
    if (!shift.user_id) throw new Error("no user");
    const { data: employee } = await supabaseAdmin
      .from("profiles")
      .select("first_name,last_name")
      .eq("id", shift.user_id)
      .maybeSingle();
    const empName = [employee?.first_name, employee?.last_name].filter(Boolean).join(" ") || "Un employé";

    // Récupère les admins/managers (limités au studio si possible)
    const { data: managerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "manager"]);
    const managerIds = Array.from(new Set((managerRoles ?? []).map((r: any) => r.user_id))) as string[];

    let recipients = managerIds;
    if (shift.studio_id && managerIds.length > 0) {
      const { data: studioLinks } = await supabaseAdmin
        .from("user_studios")
        .select("user_id")
        .eq("studio_id", shift.studio_id)
        .in("user_id", managerIds);
      const studioManagerIds = (studioLinks ?? []).map((s: any) => s.user_id);
      // Admins globaux : toujours notifiés ; managers : uniquement ceux liés au studio.
      const adminIds = (managerRoles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id);
      recipients = Array.from(new Set([...adminIds, ...studioManagerIds]));
    }
    // Exclut l'acteur lui-même (s'il vient de noter via la clôture)
    recipients = recipients.filter((uid) => uid && uid !== input.actorId);

    if (recipients.length > 0) {
      const dateLabel = new Date(shift.shift_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      const rows = recipients.map((uid) => ({
        user_id: uid,
        type: "shift_to_rate",
        title: "Shift à noter",
        body: `${empName} a terminé son shift du ${dateLabel} — pense à attribuer une note.`,
        link: `/planning?shift=${input.shiftId}`,
        priority: "normal",
        category: "planning",
      }));
      await supabaseAdmin.from("notifications").insert(rows);
    }
  } catch {
    // Best-effort : ne casse pas la clôture si la notif échoue
  }

  return { alreadyCompleted: false, completedAt };
}

// ─────────────────────────── CLOCK IN ───────────────────────────

export type ValidateClockInInput = {
  shiftId: string;
  actorId: string;
  qrCode: string;
  lat?: number | null;
  lng?: number | null;
};

export async function validateClockIn(input: ValidateClockInInput) {
  const { data: shift, error } = await supabaseAdmin
    .from("shifts")
    .select("id,user_id,studio_id,shift_date,start_time,clocked_in_at,clocked_out_at")
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
      throw new Error("Géolocalisation requise pour pointer ici. Autorise l'accès à ta position.");
    }
    distance_m = Math.round(haversineMeters(studio.lat, studio.lng, input.lat, input.lng));
    if (distance_m > (studio.geofencing_radius_m ?? 50)) {
      throw new Error(`Tu es trop loin du studio (${distance_m}m). Rapproche-toi pour pointer.`);
    }
  }

  const startDt = new Date(`${shift.shift_date}T${shift.start_time}`);
  const now = new Date();
  const minutesLate = Math.max(0, Math.floor((now.getTime() - startDt.getTime()) / 60_000));
  const clockedInAt = now.toISOString();

  const { error: upErr } = await supabaseAdmin
    .from("shifts")
    .update({ clocked_in_at: clockedInAt, minutes_late: minutesLate, status: "scheduled" })
    .eq("id", input.shiftId)
    .is("clocked_in_at", null);
  if (upErr) throw new Error(upErr.message);

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

