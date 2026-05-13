import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TIME = /^\d{2}:\d{2}(:\d{2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROLES = ["Barista", "Accueil", "Host", "Cuisine"] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Action réservée aux admins/managers");
}

// ---------- UPDATE ----------
export const updateShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        shiftId: z.string().uuid(),
        userId: z.string().uuid().nullable().optional(),
        studioId: z.string().uuid().optional(),
        businessRole: z.enum(ROLES).optional(),
        shiftDate: z.string().regex(DATE).optional(),
        startTime: z.string().regex(TIME).optional(),
        endTime: z.string().regex(TIME).optional(),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const patch: any = { is_manual: true, is_locked: true, updated_at: new Date().toISOString() };
    if (data.userId !== undefined) patch.user_id = data.userId;
    if (data.studioId) patch.studio_id = data.studioId;
    if (data.businessRole) patch.business_role = data.businessRole;
    if (data.shiftDate) patch.shift_date = data.shiftDate;
    if (data.startTime) patch.start_time = data.startTime;
    if (data.endTime) patch.end_time = data.endTime;
    if (data.notes !== undefined) patch.notes = data.notes;

    const { error } = await supabase.from("shifts").update(patch).eq("id", data.shiftId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- CREATE ----------
export const createShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid().nullable(),
        studioId: z.string().uuid(),
        businessRole: z.enum(ROLES),
        shiftDate: z.string().regex(DATE),
        startTime: z.string().regex(TIME),
        endTime: z.string().regex(TIME),
        notes: z.string().max(500).optional(),
        publishImmediately: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const status = data.publishImmediately ? "scheduled" : "draft";
    const published_at = data.publishImmediately ? new Date().toISOString() : null;

    const { data: row, error } = await supabase
      .from("shifts")
      .insert({
        user_id: data.userId,
        studio_id: data.studioId,
        business_role: data.businessRole,
        shift_date: data.shiftDate,
        start_time: data.startTime,
        end_time: data.endTime,
        notes: data.notes ?? null,
        status,
        published_at,
        is_manual: true,
        is_locked: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.publishImmediately && data.userId) {
      await supabase.from("notifications").insert({
        user_id: data.userId,
        type: "shift_added",
        title: "Nouveau shift ajouté",
        body: `${data.shiftDate} ${data.startTime.slice(0, 5)}-${data.endTime.slice(0, 5)}`,
        link: "/mon-planning",
      });
    }
    return { ok: true, id: row?.id };
  });

// ---------- DELETE ----------
export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("shifts").delete().eq("id", data.shiftId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PUBLISH ----------
export const publishPlanning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        startDate: z.string().regex(DATE),
        endDate: z.string().regex(DATE),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // 1. Récupère les drafts à publier
    const { data: drafts, error: e1 } = await supabase
      .from("shifts")
      .select("id, user_id, shift_date, start_time, end_time")
      .eq("status", "draft")
      .gte("shift_date", data.startDate)
      .lte("shift_date", data.endDate);
    if (e1) throw new Error(e1.message);

    const list = drafts ?? [];
    if (list.length === 0) {
      return { ok: true, published: 0, notified: 0 };
    }

    const now = new Date().toISOString();
    const ids = list.map((s: any) => s.id);
    const { error: e2 } = await supabase
      .from("shifts")
      .update({ status: "scheduled", published_at: now })
      .in("id", ids);
    if (e2) throw new Error(e2.message);

    // 2. Audit
    await supabase.from("planning_publications").insert({
      published_by: userId,
      period_start: data.startDate,
      period_end: data.endDate,
      shifts_count: list.length,
    });

    // 3. Notifs (1 par employé concerné)
    const userMap = new Map<string, number>();
    for (const s of list as any[]) {
      if (!s.user_id) continue;
      userMap.set(s.user_id, (userMap.get(s.user_id) ?? 0) + 1);
    }
    if (userMap.size > 0) {
      const notifs = Array.from(userMap.entries()).map(([uid, count]) => ({
        user_id: uid,
        type: "planning_published",
        title: "Nouveau planning publié",
        body: `${count} shift${count > 1 ? "s" : ""} entre le ${data.startDate} et le ${data.endDate}`,
        link: "/mon-planning",
      }));
      await supabase.from("notifications").insert(notifs);
    }

    return { ok: true, published: list.length, notified: userMap.size };
  });
