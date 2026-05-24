import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { employeeLink, adminLink } from "@/lib/notif-links";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Action réservée aux admins/managers");
}

// ----- LIRE MES PROPOSITIONS PENDING (bypass RLS via service role) -----
export const getMyPendingProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data, error } = await supabaseAdmin
      .from("shift_proposals")
      .select("id, status, sent_at, replacement_request_id, sent_by, shift:shifts(id, shift_date, start_time, end_time, business_role, studio_id, user_id, notes)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("sent_at", { ascending: false });

    if (error) throw new Error(error.message);

    const filtered = (data || []).filter((p: any) => {
      if (!p.shift) return false;
      if (p.replacement_request_id) return p.shift.user_id !== userId;
      return !p.shift.user_id;
    });

    // Enrichir avec studio (nom, adresse, ville) et expéditeur (prénom)
    const studioIds = Array.from(new Set(filtered.map((p: any) => p.shift.studio_id).filter(Boolean)));
    const senderIds = Array.from(new Set(filtered.map((p: any) => p.sent_by).filter(Boolean)));
    const [{ data: studios }, { data: senders }] = await Promise.all([
      studioIds.length
        ? supabaseAdmin.from("studios").select("id, name, short_name, address, city").in("id", studioIds as string[])
        : Promise.resolve({ data: [] as any[] }),
      senderIds.length
        ? supabaseAdmin.from("profiles").select("id, first_name, last_name").in("id", senderIds as string[])
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const studioMap = Object.fromEntries((studios || []).map((s: any) => [s.id, s]));
    const senderMap = Object.fromEntries((senders || []).map((s: any) => [s.id, s]));

    const enriched = filtered.map((p: any) => ({
      ...p,
      studio: p.shift.studio_id ? studioMap[p.shift.studio_id] || null : null,
      sender: p.sent_by ? senderMap[p.sent_by] || null : null,
    }));

    return { proposals: enriched };
  });

// ----- ENVOYER DES PROPOSITIONS -----
export const sendProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      shiftId: z.string().uuid(),
      userIds: z.array(z.string().uuid()).min(1).max(50),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // Vérifier que le shift existe et est encore libre
    const { data: shift, error: e1 } = await supabase
      .from("shifts")
      .select("id, user_id, shift_date, start_time, end_time, business_role")
      .eq("id", data.shiftId)
      .single();
    if (e1) throw new Error(e1.message);
    if (shift.user_id) throw new Error("Ce shift est déjà attribué");

    // Insère (ou ignore si déjà proposé) — on relance les anciennes refusées en pending
    const rows = data.userIds.map((uid) => ({
      shift_id: data.shiftId,
      user_id: uid,
      sent_by: userId,
      status: "pending",
      sent_at: new Date().toISOString(),
      responded_at: null,
    }));

    const { error: e2 } = await supabaseAdmin
      .from("shift_proposals")
      .upsert(rows, { onConflict: "shift_id,user_id" });
    if (e2) throw new Error(e2.message);

    // Pas de notification : les propositions sont visibles via ProposalsInline sur la home.


    return { ok: true, count: data.userIds.length };
  });

// ----- ACCEPTER UNE PROPOSITION (race-safe) -----
export const acceptProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ proposalId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Récupère la proposition
    const { data: prop, error: e1 } = await supabaseAdmin
      .from("shift_proposals")
      .select("id, shift_id, user_id, status")
      .eq("id", data.proposalId)
      .single();
    if (e1) throw new Error(e1.message);
    if (prop.user_id !== userId) throw new Error("Cette proposition ne vous appartient pas");
    if (prop.status !== "pending") throw new Error("Cette proposition n'est plus disponible");

    // Tentative d'attribution atomique : update shifts ... WHERE user_id IS NULL
    const { data: updated, error: e2 } = await supabaseAdmin
      .from("shifts")
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq("id", prop.shift_id)
      .is("user_id", null)
      .select("id, shift_date, start_time, end_time, business_role")
      .maybeSingle();
    if (e2) throw new Error(e2.message);

    if (!updated) {
      // Quelqu'un d'autre a déjà accepté → on marque cette proposition expirée
      await supabaseAdmin
        .from("shift_proposals")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("id", prop.id);
      return { ok: false, reason: "taken" };
    }

    // Marque cette proposition acceptée et expire les autres pour ce shift
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("shift_proposals")
      .update({ status: "accepted", responded_at: now })
      .eq("id", prop.id);
    await supabaseAdmin
      .from("shift_proposals")
      .update({ status: "expired", responded_at: now })
      .eq("shift_id", prop.shift_id)
      .eq("status", "pending");

    // Notifie l'admin qui a envoyé
    const { data: senderRow } = await supabaseAdmin
      .from("shift_proposals")
      .select("sent_by")
      .eq("id", prop.id)
      .single();
    if (senderRow?.sent_by) {
      const dateLabel = new Date(updated.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
      await supabaseAdmin.from("notifications").insert({
        user_id: senderRow.sent_by,
        type: "proposal_accepted",
        title: "Trou comblé",
        body: `${updated.business_role} · ${dateLabel} · ${String(updated.start_time).slice(0,5)}–${String(updated.end_time).slice(0,5)}`,
        link: adminLink({ kind: "shiftPointage", shiftId: updated.id }),
        priority: "info",
        category: "shift",
      });
    }
    return { ok: true };
  });

// ----- REFUSER UNE PROPOSITION -----
export const declineProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ proposalId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("shift_proposals")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", data.proposalId)
      .eq("user_id", userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- ENVOYER PROPOSITIONS DE REMPLACEMENT (liées à une demande de modif) -----
// Pour cancel/time_change : shiftId optionnel (on prend req.shift_id).
// Pour unavailable : shiftId obligatoire (un envoi par shift de la période).
export const sendReplacementProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      requestId: z.string().uuid(),
      userIds: z.array(z.string().uuid()).min(1).max(50),
      shiftId: z.string().uuid().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: req, error: e0 } = await supabaseAdmin
      .from("modification_requests")
      .select("id, shift_id, user_id, status, type, proposed_start_date, proposed_end_date")
      .eq("id", data.requestId)
      .single();
    if (e0) throw new Error(e0.message);
    if (req.status !== "pending") throw new Error("Cette demande n'est plus en attente");

    // Résolution du shift cible
    let targetShiftId = data.shiftId ?? req.shift_id;
    if (req.type === "unavailable" && !data.shiftId) {
      throw new Error("shiftId requis pour une demande d'indisponibilité");
    }
    if (!targetShiftId) throw new Error("Aucun shift cible");

    // Pour unavailable : vérifier que le shift appartient bien à l'employé et dans la période
    if (req.type === "unavailable") {
      const { data: sh } = await supabaseAdmin
        .from("shifts")
        .select("id, user_id, shift_date")
        .eq("id", targetShiftId)
        .single();
      if (!sh) throw new Error("Shift introuvable");
      if (sh.user_id !== req.user_id) throw new Error("Ce shift n'appartient pas à l'employé");
      if (req.proposed_start_date && req.proposed_end_date) {
        if (sh.shift_date < req.proposed_start_date || sh.shift_date > req.proposed_end_date) {
          throw new Error("Shift hors période d'indisponibilité");
        }
      }
    }

    const { data: shift, error: e1 } = await supabaseAdmin
      .from("shifts")
      .select("id, shift_date, start_time, end_time, business_role")
      .eq("id", targetShiftId)
      .single();
    if (e1) throw new Error(e1.message);

    const filtered = data.userIds.filter((uid) => uid !== req.user_id);
    if (filtered.length === 0) throw new Error("Sélectionnez au moins un autre employé");

    const rows = filtered.map((uid) => ({
      shift_id: targetShiftId!,
      user_id: uid,
      sent_by: userId,
      status: "pending",
      sent_at: new Date().toISOString(),
      responded_at: null,
      replacement_request_id: req.id,
    }));

    const { error: e2 } = await supabaseAdmin
      .from("shift_proposals")
      .upsert(rows, { onConflict: "shift_id,user_id" });
    if (e2) throw new Error(e2.message);

    const dateLabel = new Date(shift.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    const notifs = filtered.map((uid) => ({
      user_id: uid,
      type: "shift_proposal",
      title: "Proposition de remplacement",
      body: `${shift.business_role} · ${dateLabel} · ${String(shift.start_time).slice(0,5)}–${String(shift.end_time).slice(0,5)}`,
      link: `/staff-app/propositions`,
      priority: "normal",
      category: "shift",
    }));
    await supabaseAdmin.from("notifications").insert(notifs);

    return { ok: true, count: filtered.length };
  });

// ----- ACCEPTER UN REMPLACEMENT (race-safe) -----
export const acceptReplacementProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ proposalId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: prop, error: e1 } = await supabaseAdmin
      .from("shift_proposals")
      .select("id, shift_id, user_id, status, sent_by, replacement_request_id")
      .eq("id", data.proposalId)
      .single();
    if (e1) throw new Error(e1.message);
    if (prop.user_id !== userId) throw new Error("Cette proposition ne vous appartient pas");
    if (prop.status !== "pending") throw new Error("Cette proposition n'est plus disponible");
    if (!prop.replacement_request_id) throw new Error("Proposition invalide");

    const { data: req, error: e2 } = await supabaseAdmin
      .from("modification_requests")
      .select("id, shift_id, user_id, status, type, proposed_start_date, proposed_end_date, reason")
      .eq("id", prop.replacement_request_id)
      .single();
    if (e2) throw new Error(e2.message);
    if (req.status !== "pending") {
      await supabaseAdmin.from("shift_proposals")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("id", prop.id);
      return { ok: false, reason: "taken" };
    }

    // Réassignation atomique : on transfère le shift de l'employé d'origine au remplaçant
    const { data: updated, error: e3 } = await supabaseAdmin
      .from("shifts")
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq("id", prop.shift_id)
      .eq("user_id", req.user_id)
      .select("id, shift_date, start_time, end_time, business_role")
      .maybeSingle();
    if (e3) throw new Error(e3.message);

    if (!updated) {
      await supabaseAdmin.from("shift_proposals")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("id", prop.id);
      return { ok: false, reason: "taken" };
    }

    const now = new Date().toISOString();
    await supabaseAdmin.from("shift_proposals")
      .update({ status: "accepted", responded_at: now })
      .eq("id", prop.id);
    // Expire les autres propositions pour CE SHIFT uniquement (pas la requête entière)
    await supabaseAdmin.from("shift_proposals")
      .update({ status: "expired", responded_at: now })
      .eq("shift_id", prop.shift_id)
      .eq("status", "pending");

    const dateLabel = new Date(updated.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    const body = `${updated.business_role} · ${dateLabel} · ${String(updated.start_time).slice(0,5)}–${String(updated.end_time).slice(0,5)}`;

    // Pour une demande UNAVAILABLE : ne marquer accepted que si TOUS les shifts ont été couverts
    let requestNowAccepted = false;
    if (req.type === "unavailable" && req.proposed_start_date && req.proposed_end_date) {
      const { count } = await supabaseAdmin
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", req.user_id)
        .neq("status", "cancelled")
        .gte("shift_date", req.proposed_start_date)
        .lte("shift_date", req.proposed_end_date);
      if ((count ?? 0) === 0) {
        await supabaseAdmin.from("modification_requests")
          .update({ status: "accepted", resolved_at: now, admin_response: "Tous les shifts ont trouvé un remplaçant" })
          .eq("id", req.id);
        await supabaseAdmin.from("unavailability_periods").insert({
          user_id: req.user_id,
          start_date: req.proposed_start_date,
          end_date: req.proposed_end_date,
          reason: req.reason,
          source_request_id: req.id,
        });
        requestNowAccepted = true;
      }
    } else {
      // cancel/time_change : un seul shift → demande acceptée
      await supabaseAdmin.from("modification_requests")
        .update({ status: "accepted", resolved_at: now, admin_response: "Remplaçant trouvé automatiquement" })
        .eq("id", req.id);
      requestNowAccepted = true;
    }

    // Notifie l'admin qui a envoyé
    if (prop.sent_by) {
      await supabaseAdmin.from("notifications").insert({
        user_id: prop.sent_by,
        type: "replacement_accepted",
        title: "Remplaçant trouvé",
        body,
        link: adminLink({ kind: "request", requestId: req.id }),
        category: "request",
      });
    }
    // Notifie l'employé d'origine
    await supabaseAdmin.from("notifications").insert({
      user_id: req.user_id,
      type: requestNowAccepted ? "request_accepted" : "shift_replaced",
      title: requestNowAccepted ? "Demande acceptée" : "Un shift a trouvé un remplaçant",
      body: requestNowAccepted ? `Un remplaçant a été trouvé. ${body}` : body,
      link: employeeLink({ kind: "request", requestId: req.id }),
      category: "request",
    });

    return { ok: true, requestAccepted: requestNowAccepted };
  });

// ----- ANNULER (admin) -----
export const cancelProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ proposalIds: z.array(z.string().uuid()).min(1).max(50) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabaseAdmin
      .from("shift_proposals")
      .update({ status: "cancelled", responded_at: new Date().toISOString() })
      .in("id", data.proposalIds)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
