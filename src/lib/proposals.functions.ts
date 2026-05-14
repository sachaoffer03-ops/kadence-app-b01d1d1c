import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Action réservée aux admins/managers");
}

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

    // Notifications aux employés
    const dateLabel = new Date(shift.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    const notifs = data.userIds.map((uid) => ({
      user_id: uid,
      type: "shift_proposal",
      title: "Nouvelle proposition de shift",
      body: `${shift.business_role} · ${dateLabel} · ${String(shift.start_time).slice(0,5)}–${String(shift.end_time).slice(0,5)}`,
      link: "/staff-app",
    }));
    await supabaseAdmin.from("notifications").insert(notifs);

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
        link: "/trous",
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
