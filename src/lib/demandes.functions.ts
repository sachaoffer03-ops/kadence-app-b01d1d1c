import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Action réservée aux admins/managers");
}

const ReqType = z.enum(["cancel", "time_change", "unavailable"]);
const Urgency = z.enum(["normal", "urgent", "critique"]);

// ───────────────────────── EMPLOYÉ ─────────────────────────

export const createModificationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      type: ReqType,
      shiftId: z.string().uuid().nullable().optional(),
      reason: z.string().trim().min(1).max(500),
      urgency: Urgency,
      proposedStartTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
      proposedEndTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
      proposedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      proposedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    if (data.type === "time_change") {
      if (!data.shiftId) throw new Error("Shift requis pour un changement d'horaire");
      if (!data.proposedStartTime || !data.proposedEndTime) {
        throw new Error("Créneau proposé requis");
      }
    }
    if (data.type === "unavailable") {
      if (!data.proposedStartDate || !data.proposedEndDate) {
        throw new Error("Période d'indisponibilité requise");
      }
      if (data.proposedStartDate > data.proposedEndDate) {
        throw new Error("La date de fin doit être après la date de début");
      }
    }
    if (data.type === "cancel" && !data.shiftId) {
      throw new Error("Shift requis pour une annulation");
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("modification_requests")
      .insert({
        user_id: userId,
        shift_id: data.shiftId ?? null,
        type: data.type,
        urgency: data.urgency,
        reason: data.reason,
        proposed_start_time: data.proposedStartTime ?? null,
        proposed_end_time: data.proposedEndTime ?? null,
        proposed_start_date: data.proposedStartDate ?? null,
        proposed_end_date: data.proposedEndDate ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted.id };
  });

export const cancelMyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("modification_requests")
      .delete()
      .eq("id", data.requestId)
      .eq("user_id", userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ───────────────────────── ADMIN ─────────────────────────

async function notifyEmployee(userId: string, reqType: string, status: "accepted" | "refused", note?: string) {
  const typeLabel: Record<string, string> = {
    cancel: "annulation",
    time_change: "changement d'horaire",
    unavailable: "indisponibilité",
    swap: "échange",
  };
  const label = typeLabel[reqType] ?? reqType;
  const body = status === "accepted"
    ? `Ta demande de ${label} a été acceptée.${note ? " " + note : ""}`
    : `Ta demande de ${label} a été refusée.${note ? " Motif : " + note : ""}`;
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type: "modification_request_resolved",
    title: status === "accepted" ? "Demande acceptée" : "Demande refusée",
    body,
    link: "/staff-app",
    priority: "info",
    category: "request",
  });
}

export const acceptCancelRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      requestId: z.string().uuid(),
      findReplacement: z.boolean().default(false),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: req, error } = await supabaseAdmin
      .from("modification_requests")
      .select("id, user_id, shift_id, type, status")
      .eq("id", data.requestId)
      .single();
    if (error) throw new Error(error.message);
    if (req.status !== "pending") throw new Error("Demande déjà traitée");
    if (!req.shift_id) throw new Error("Demande sans shift");

    const now = new Date().toISOString();
    // Libérer le shift
    await supabaseAdmin
      .from("shifts")
      .update({ user_id: null, updated_at: now })
      .eq("id", req.shift_id);

    await supabaseAdmin
      .from("modification_requests")
      .update({ status: "accepted", resolved_at: now, admin_actor_id: userId })
      .eq("id", req.id);

    await notifyEmployee(req.user_id, req.type, "accepted");
    return { ok: true, shiftId: req.shift_id, findReplacement: data.findReplacement };
  });

export const acceptTimeChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      requestId: z.string().uuid(),
      finalStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      finalEnd: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: req, error } = await supabaseAdmin
      .from("modification_requests")
      .select("id, user_id, shift_id, type, status")
      .eq("id", data.requestId)
      .single();
    if (error) throw new Error(error.message);
    if (req.status !== "pending") throw new Error("Demande déjà traitée");
    if (!req.shift_id) throw new Error("Demande sans shift");

    const now = new Date().toISOString();
    const { error: e2 } = await supabaseAdmin
      .from("shifts")
      .update({ start_time: data.finalStart, end_time: data.finalEnd, updated_at: now })
      .eq("id", req.shift_id);
    if (e2) throw new Error(e2.message);

    await supabaseAdmin
      .from("modification_requests")
      .update({ status: "accepted", resolved_at: now, admin_actor_id: userId })
      .eq("id", req.id);

    await notifyEmployee(req.user_id, req.type, "accepted", `Nouveau créneau : ${data.finalStart.slice(0, 5)}–${data.finalEnd.slice(0, 5)}`);
    return { ok: true };
  });

export const acceptUnavailabilityRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: req, error } = await supabaseAdmin
      .from("modification_requests")
      .select("id, user_id, type, status, reason, proposed_start_date, proposed_end_date")
      .eq("id", data.requestId)
      .single();
    if (error) throw new Error(error.message);
    if (req.status !== "pending") throw new Error("Demande déjà traitée");
    if (!req.proposed_start_date || !req.proposed_end_date) {
      throw new Error("Période manquante");
    }

    const now = new Date().toISOString();

    await supabaseAdmin.from("unavailability_periods").insert({
      user_id: req.user_id,
      start_date: req.proposed_start_date,
      end_date: req.proposed_end_date,
      reason: req.reason,
      source_request_id: req.id,
    });

    // Libère les shifts assignés sur la période
    await supabaseAdmin
      .from("shifts")
      .update({ user_id: null, updated_at: now })
      .eq("user_id", req.user_id)
      .gte("shift_date", req.proposed_start_date)
      .lte("shift_date", req.proposed_end_date);

    await supabaseAdmin
      .from("modification_requests")
      .update({ status: "accepted", resolved_at: now, admin_actor_id: userId })
      .eq("id", req.id);

    await notifyEmployee(req.user_id, req.type, "accepted",
      `Période : ${req.proposed_start_date} → ${req.proposed_end_date}`);
    return { ok: true };
  });

export const refuseRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      requestId: z.string().uuid(),
      response: z.string().trim().min(1).max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: req, error } = await supabaseAdmin
      .from("modification_requests")
      .select("id, user_id, type, status")
      .eq("id", data.requestId)
      .single();
    if (error) throw new Error(error.message);
    if (req.status !== "pending") throw new Error("Demande déjà traitée");

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("modification_requests")
      .update({
        status: "refused",
        resolved_at: now,
        admin_actor_id: userId,
        admin_response: data.response,
      })
      .eq("id", req.id);

    await notifyEmployee(req.user_id, req.type, "refused", data.response);
    return { ok: true };
  });

export const getDemandesData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({}).parse(input ?? {}))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const [{ data: requests }, { data: profiles }, { data: shifts }, { data: proposals }] = await Promise.all([
      supabaseAdmin.from("modification_requests")
        .select("id, user_id, shift_id, type, urgency, status, reason, admin_response, created_at, resolved_at, proposed_start_time, proposed_end_time, proposed_start_date, proposed_end_date, admin_actor_id")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin.from("profiles").select("id, first_name, last_name, avatar_url, status"),
      supabaseAdmin.from("shifts").select("id, shift_date, start_time, end_time, business_role, studio_id, user_id"),
      supabaseAdmin.from("shift_proposals")
        .select("id, user_id, status, sent_at, responded_at, replacement_request_id")
        .not("replacement_request_id", "is", null),
    ]);

    const reqs = requests ?? [];
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const pendings = reqs.filter((r: any) => r.status === "pending");
    const urgent = pendings.filter((r: any) => r.urgency === "urgent" || r.urgency === "critique");
    const treatedToday = reqs.filter((r: any) =>
      r.status !== "pending" && r.resolved_at && new Date(r.resolved_at) >= todayStart,
    );
    const thirtyDaysAgo = Date.now() - 30 * 86400 * 1000;
    const recent = reqs.filter((r: any) =>
      r.status !== "pending" && r.resolved_at && new Date(r.resolved_at).getTime() >= thirtyDaysAgo,
    );
    let avgMs = 0;
    if (recent.length > 0) {
      const total = recent.reduce((s: number, r: any) =>
        s + (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()), 0);
      avgMs = total / recent.length;
    }

    return {
      kpis: {
        pending: pendings.length,
        urgent: urgent.length,
        treatedToday: treatedToday.length,
        avgResolutionMs: avgMs,
      },
      requests: reqs,
      profiles: profiles ?? [],
      shifts: shifts ?? [],
      proposals: proposals ?? [],
    };
  });
