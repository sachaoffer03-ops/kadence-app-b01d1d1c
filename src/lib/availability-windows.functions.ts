// =============================================================================
// AVAILABILITY WINDOWS — server functions exposées à l'UI.
// Admin/Manager : CRUD + open/close/reopen + list participants.
// Employé : list open windows (filtré côté DB par RLS).
// =============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const ok = !!data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Réservé aux admins/managers");
}

// --------------------------------------------------------------------------
// listWindows (admin) — toutes les windows, plus récentes d'abord
// --------------------------------------------------------------------------
export const listWindows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("availability_windows")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { windows: data ?? [] };
  });

// --------------------------------------------------------------------------
// listMyOpenWindows (employé) — fenêtres ouvertes qui me concernent
// --------------------------------------------------------------------------
export const listMyOpenWindows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // RLS filtre déjà sur status=open + target
    const { data, error } = await supabase
      .from("availability_windows")
      .select("id, title, period_start, period_end, deadline_at")
      .order("deadline_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { windows: data ?? [] };
  });

// --------------------------------------------------------------------------
// createWindow (admin) — crée en statut 'draft'
// --------------------------------------------------------------------------
const CreateInput = z.object({
  title: z.string().min(1).max(120),
  period_start: z.string().regex(DATE_RE),
  period_end: z.string().regex(DATE_RE),
  deadline_at: z.string().min(10), // ISO
  target_user_ids: z.array(z.string().uuid()).nullable().optional(),
});

export const createWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    if (data.period_start > data.period_end) {
      throw new Error("La période est invalide");
    }
    if (new Date(data.deadline_at).getTime() <= Date.now()) {
      throw new Error("La deadline doit être dans le futur");
    }
    const target = data.target_user_ids && data.target_user_ids.length > 0
      ? data.target_user_ids
      : null;
    const { data: row, error } = await supabase
      .from("availability_windows")
      .insert({
        title: data.title,
        period_start: data.period_start,
        period_end: data.period_end,
        deadline_at: data.deadline_at,
        target_user_ids: target,
        status: "draft",
        notifications_sent: {},
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { window: row };
  });

// --------------------------------------------------------------------------
// updateWindow (admin) — sur draft ou open : titre, période, deadline, cibles
// --------------------------------------------------------------------------
const UpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(120).optional(),
  period_start: z.string().regex(DATE_RE).optional(),
  period_end: z.string().regex(DATE_RE).optional(),
  deadline_at: z.string().min(10).optional(),
  target_user_ids: z.array(z.string().uuid()).nullable().optional(),
});

export const updateWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpdateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const patch: any = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.period_start !== undefined) patch.period_start = data.period_start;
    if (data.period_end !== undefined) patch.period_end = data.period_end;
    if (data.deadline_at !== undefined) patch.deadline_at = data.deadline_at;
    if (data.target_user_ids !== undefined) {
      patch.target_user_ids = data.target_user_ids && data.target_user_ids.length > 0
        ? data.target_user_ids
        : null;
    }
    const { error } = await supabase
      .from("availability_windows")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --------------------------------------------------------------------------
// openWindow (admin) — passe draft → open + déclenche notifs ouverture
// --------------------------------------------------------------------------
export const openWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { data: w, error: e0 } = await supabase
      .from("availability_windows")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!w) throw new Error("Fenêtre introuvable");
    if (w.status === "open") return { ok: true, already: true };
    if (new Date(w.deadline_at).getTime() <= Date.now()) {
      throw new Error("La deadline est déjà passée — modifie-la avant d'ouvrir");
    }

    const { error } = await supabase
      .from("availability_windows")
      .update({ status: "open", closed_at: null, closed_by: null })
      .eq("id", data.id)
      .eq("status", "draft");
    if (error) throw new Error(error.message);

    // Notifs d'ouverture (admin client)
    const { notifyWindowOpened } = await import("@/lib/availability-windows.server");
    await notifyWindowOpened(w as any);
    return { ok: true };
  });

// --------------------------------------------------------------------------
// closeWindow (admin) — clôture manuelle
// --------------------------------------------------------------------------
export const closeWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data: w } = await supabase
      .from("availability_windows")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!w) throw new Error("Fenêtre introuvable");
    if (w.status === "closed") return { ok: true, already: true };
    const { closeWindowInternal } = await import("@/lib/availability-windows.server");
    await closeWindowInternal(w as any, userId);
    return { ok: true };
  });

// --------------------------------------------------------------------------
// reopenWindow (admin) — rouvre une fenêtre fermée (nouvelle deadline requise)
// --------------------------------------------------------------------------
export const reopenWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      deadline_at: z.string().min(10),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    if (new Date(data.deadline_at).getTime() <= Date.now()) {
      throw new Error("La nouvelle deadline doit être dans le futur");
    }
    const { data: w } = await supabase
      .from("availability_windows")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!w) throw new Error("Fenêtre introuvable");

    const { error } = await supabase
      .from("availability_windows")
      .update({
        status: "open",
        deadline_at: data.deadline_at,
        closed_at: null,
        closed_by: null,
        // On garde notifications_sent : pas de re-spam des rappels déjà envoyés.
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Notif d'ouverture (re-prévenir uniquement les non-remplis ? ici on prévient tout le monde)
    const { notifyWindowOpened } = await import("@/lib/availability-windows.server");
    await notifyWindowOpened({ ...(w as any), status: "open", deadline_at: data.deadline_at });
    return { ok: true };
  });

// --------------------------------------------------------------------------
// deleteWindow (admin) — supprime une fenêtre draft (sécurité)
// --------------------------------------------------------------------------
export const deleteWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data: w } = await supabase
      .from("availability_windows")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (!w) return { ok: true };
    if (w.status !== "draft") throw new Error("Seules les fenêtres en brouillon peuvent être supprimées");
    const { error } = await supabase.from("availability_windows").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --------------------------------------------------------------------------
// getWindowParticipants (admin) — détails de remplissage
// --------------------------------------------------------------------------
export const getWindowParticipants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data: w } = await supabase
      .from("availability_windows")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!w) throw new Error("Fenêtre introuvable");
    const { listParticipants } = await import("@/lib/availability-windows.server");
    const participants = await listParticipants(w as any);
    return { participants };
  });
