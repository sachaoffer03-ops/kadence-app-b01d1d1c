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
        link: `/cloture?shift=${shift.id}`,
        priority: "info",
        category: "shift",
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

  // Score breakdown — règles configurables via /regles-scoring (table scoring_settings)
  const { loadScoringSettings } = await import("./scoring-rules.server");
  const { scorePunctuality, scoreChecklist, scorePhotos } = await import("./scoring-shared");
  const rules = await loadScoringSettings(supabaseAdmin);

  const { data: shiftFresh } = await supabaseAdmin
    .from("shifts").select("minutes_late").eq("id", input.shiftId).maybeSingle();
  const late = (shiftFresh as any)?.minutes_late ?? 0;

  // Affichage step6 reste sur une échelle /5 → on convertit (rules sont /10)
  const ponctualite = Math.round(scorePunctuality(rules, late) / 2);
  const checklistPct = itemsTotal > 0 ? itemsChecked / itemsTotal : 1;
  const checklistMissed = Math.max(0, itemsTotal - itemsChecked);
  const checklistPts = Math.round(scoreChecklist(rules, checklistPct, checklistMissed) / 2);
  const photosPct = photosTotal > 0 ? photosValidated / photosTotal : 1;
  const photosRefused = Math.max(0, photosTotal - photosValidated);
  const photosPts = Math.round(scorePhotos(rules, photosPct, photosRefused) / 2);
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

// --- 3. analyzeClosurePhoto (Lovable AI Vision) ---------------------------

export type AnalyzeClosurePhotoInput = {
  submissionPhotoId: string;
  actorId: string;
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function toSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  // Already an absolute URL? use as-is
  if (/^https?:\/\//.test(path)) return path;
  const { data, error } = await supabaseAdmin.storage
    .from("checklist-photos")
    .createSignedUrl(path, 600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function analyzeClosurePhoto(input: AnalyzeClosurePhotoInput) {
  // Load submission photo + template config
  const { data: subPhoto, error: spErr } = await supabaseAdmin
    .from("checklist_submission_photos")
    .select("id, photo_url, template_photo_id, submission_id")
    .eq("id", input.submissionPhotoId)
    .maybeSingle();
  if (spErr) throw new Error(spErr.message);
  if (!subPhoto) throw new Error("Photo introuvable");

  const { data: zone } = await supabaseAdmin
    .from("checklist_template_photos")
    .select("id, label, description, reference_photo_url, template_id")
    .eq("id", (subPhoto as any).template_photo_id)
    .maybeSingle();
  const { data: tpl } = zone
    ? await supabaseAdmin
        .from("checklist_templates")
        .select("ai_detection_hint, ai_validation_threshold, analyze_with_ai")
        .eq("id", (zone as any).template_id)
        .maybeSingle()
    : { data: null };

  const threshold = Number((tpl as any)?.ai_validation_threshold ?? 75);
  const hint = (tpl as any)?.ai_detection_hint
    ?? "présence de saleté visible, ustensiles non rangés, déchets au sol, écrans non éteints";
  const zoneLabel = (zone as any)?.label ?? "Zone";
  const zoneDesc = (zone as any)?.description ?? "";

  const photoUrl = await toSignedUrl((subPhoto as any).photo_url);
  const refUrl = await toSignedUrl((zone as any)?.reference_photo_url ?? null);
  if (!photoUrl) throw new Error("Photo employé inaccessible");

  // Build the prompt
  const systemPrompt = `Tu es un inspecteur qualité pour un coffee shop. Tu compares la photo prise par un employé en fin de shift à une photo de référence (si disponible) et tu vérifies qu'aucun problème n'est visible.

Points à vérifier (priorité): ${hint}

Tu réponds STRICTEMENT en JSON sur une seule ligne, sans texte autour, au format:
{"confidence": <entier 0-100>, "verdict": "pass" | "fail", "reason": "<une phrase courte en français, max 140 caractères>"}

confidence = à quel point la zone est propre/conforme (0=très sale, 100=parfait).
verdict = "pass" si confidence >= ${threshold}, sinon "fail".`;

  const userContent: any[] = [
    { type: "text", text: `Zone: ${zoneLabel}${zoneDesc ? ` — ${zoneDesc}` : ""}.` },
  ];
  if (refUrl) {
    userContent.push({ type: "text", text: "Photo de référence (état attendu) :" });
    userContent.push({ type: "image_url", image_url: { url: refUrl } });
  }
  userContent.push({ type: "text", text: "Photo prise par l'employé maintenant :" });
  userContent.push({ type: "image_url", image_url: { url: photoUrl } });

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY manquant");

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Save soft failure on the photo so admin can see it
    await supabaseAdmin
      .from("checklist_submission_photos")
      .update({
        ai_validation_status: "validated", // fail-open: don't block clôture if AI down
        ai_validation_message: `Analyse IA indisponible (${res.status}). Photo acceptée par défaut.`,
        ai_validated_at: new Date().toISOString(),
      })
      .eq("id", input.submissionPhotoId);
    return { status: "validated", confidence: null, message: "Analyse IA indisponible", soft: true, upstreamStatus: res.status, upstreamBody: text.slice(0, 200) };
  }

  const json = await res.json();
  const raw: string = json?.choices?.[0]?.message?.content ?? "{}";
  // Extract first {...} block defensively
  const m = raw.match(/\{[\s\S]*?\}/);
  let parsed: { confidence?: number; verdict?: string; reason?: string } = {};
  try {
    parsed = m ? JSON.parse(m[0]) : {};
  } catch {
    parsed = {};
  }
  const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence ?? 0))));
  const verdict = parsed.verdict === "fail" ? "fail" : (confidence >= threshold ? "pass" : "fail");
  const reason = String(parsed.reason ?? "").slice(0, 280) || (verdict === "pass" ? "Conforme" : "Photo refusée");

  const status = verdict === "pass" ? "validated" : "rejected";
  const levelLabel = confidence >= 80 ? "Élevé" : confidence >= 50 ? "Moyen" : "Faible";
  const message = `${levelLabel} (${confidence}/100) — ${reason}`;

  await supabaseAdmin
    .from("checklist_submission_photos")
    .update({
      ai_validation_status: status,
      ai_validation_message: message,
      ai_validated_at: new Date().toISOString(),
    })
    .eq("id", input.submissionPhotoId);

  return { status, confidence, message, level: levelLabel.toLowerCase(), threshold };
}

// --- 4. notifyOverdueClockOuts -------------------------------------------
// Notifies managers/admins for shifts that exceeded `end_time + grace`
// without clocking out. Idempotent: only emits one notification per shift.

export async function notifyOverdueClockOuts() {
  // Find candidate shifts that started today (or yesterday late night),
  // have clocked_in_at, no clocked_out_at, and a studio set.
  const nowIso = new Date().toISOString();
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const { data: shifts } = await supabaseAdmin
    .from("shifts")
    .select("id,user_id,studio_id,shift_date,end_time,business_role,clocked_in_at,clocked_out_at")
    .in("shift_date", [todayStr, yesterdayStr])
    .is("clocked_out_at", null)
    .not("clocked_in_at", "is", null);

  if (!shifts || shifts.length === 0) return { processed: 0, notified: 0 };

  // Load studios in one shot
  const studioIds = Array.from(new Set(shifts.map((s: any) => s.studio_id).filter(Boolean)));
  const { data: studios } = studioIds.length
    ? await supabaseAdmin
        .from("studios")
        .select("id,name,clock_out_grace_period_min,clock_out_overdue_action")
        .in("id", studioIds)
    : { data: [] as any[] };
  const studioMap = new Map<string, any>((studios ?? []).map((s: any) => [s.id, s]));

  let notified = 0;
  for (const sh of shifts as any[]) {
    if (!sh.studio_id) continue;
    const studio = studioMap.get(sh.studio_id);
    if (!studio) continue;
    if (studio.clock_out_overdue_action !== "notify_manager") continue;

    const grace = Number(studio.clock_out_grace_period_min ?? 20);
    const endIso = new Date(`${sh.shift_date}T${sh.end_time}`).getTime();
    const dueIso = endIso + grace * 60_000;
    if (Date.now() < dueIso) continue;

    // Idempotency: have we already notified for this shift ?
    const linkSig = `/pointage?shift=${sh.id}`;
    const { data: existing } = await supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("type", "shift_overdue_clockout")
      .eq("link", linkSig)
      .limit(1);
    if (existing && existing.length) continue;

    // Profile name for body
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("first_name,last_name").eq("id", sh.user_id).maybeSingle();
    const name = `${(prof as any)?.first_name ?? ""} ${(prof as any)?.last_name ?? ""}`.trim() || "Un employé";

    const { data: mgrs } = await supabaseAdmin
      .from("user_roles").select("user_id,role").in("role", ["admin", "manager"]);

    if (!mgrs || mgrs.length === 0) continue;
    const overdueMin = Math.round((Date.now() - dueIso) / 60_000);
    const rows = mgrs.map((m: any) => ({
      user_id: m.user_id,
      type: "shift_overdue_clockout",
      title: `Pointage de sortie en retard — ${studio.name}`,
      body: `${name} n'a pas pointé sa sortie (${sh.business_role}). En retard de ${overdueMin} min.`,
      link: linkSig,
      priority: "normal",
      category: "pointage",
    }));
    await supabaseAdmin.from("notifications").insert(rows);
    notified += 1;
  }
  return { processed: shifts.length, notified, at: nowIso };
}

// --- overrideRejectedPhoto -------------------------------------------------

export type OverrideRejectedPhotoInput = {
  submissionPhotoId: string;
  actorId: string;
  reason?: string | null;
};

export async function overrideRejectedPhoto(input: OverrideRejectedPhotoInput) {
  // Only admin/manager
  const { data: roles } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", input.actorId);
  const elevated = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "manager");
  if (!elevated) throw new Error("Réservé aux admins / managers");

  const { data: photo, error } = await supabaseAdmin
    .from("checklist_submission_photos")
    .select("id, ai_validation_status, submission_id")
    .eq("id", input.submissionPhotoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!photo) throw new Error("Photo introuvable");

  const reason = (input.reason ?? "").trim().slice(0, 280) || null;
  const nowIso = new Date().toISOString();
  const message = reason
    ? `Validée manuellement par l'admin : ${reason}`
    : "Validée manuellement par l'admin.";

  const { error: upErr } = await supabaseAdmin
    .from("checklist_submission_photos")
    .update({
      ai_validation_status: "validated",
      ai_validation_message: message,
      ai_validated_at: nowIso,
      admin_override_by: input.actorId,
      admin_override_at: nowIso,
      admin_override_reason: reason,
    } as any)
    .eq("id", input.submissionPhotoId);
  if (upErr) throw new Error(upErr.message);

  return { ok: true, photoId: input.submissionPhotoId, validatedAt: nowIso };
}
