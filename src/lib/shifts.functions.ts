import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { employeeLink } from "@/lib/notif-links";

const TIME = /^\d{2}:\d{2}(:\d{2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Rôles métier : valeur libre (la table business_roles est la source de vérité, validée côté UI).
const businessRoleSchema = z.string().min(1).max(64);

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Action réservée aux admins/managers");
}

// Vérifie qu'un user n'a pas déjà un shift qui chevauche [start,end] le même jour (hors le shift en cours d'édition).
async function assertNoOverlap(
  supabase: any,
  userId: string | null | undefined,
  shiftDate: string,
  startTime: string,
  endTime: string,
  excludeShiftId?: string,
) {
  if (!userId) return;
  const { data, error } = await supabase
    .from("shifts")
    .select("id, start_time, end_time")
    .eq("user_id", userId)
    .eq("shift_date", shiftDate);
  if (error) throw new Error(error.message);
  const s = startTime.slice(0, 8);
  const e = endTime.slice(0, 8);
  for (const row of data ?? []) {
    if (excludeShiftId && row.id === excludeShiftId) continue;
    const rs = String(row.start_time).slice(0, 8);
    const re = String(row.end_time).slice(0, 8);
    // Chevauchement si rs < e ET re > s
    if (rs < e && re > s) {
      throw new Error(`Conflit : cet employé a déjà un shift ${rs.slice(0,5)}–${re.slice(0,5)} ce jour-là`);
    }
  }
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
        businessRole: businessRoleSchema.optional(),
        shiftDate: z.string().regex(DATE).optional(),
        startTime: z.string().regex(TIME).optional(),
        endTime: z.string().regex(TIME).optional(),
        notes: z.string().max(500).nullable().optional(),
        // Si true → on ne reverrouille pas (permet à l'IA de réassigner)
        unlock: z.boolean().optional(),
        // Si false → ne marque pas le shift comme manuel (utile pour le drag & drop pur)
        markManual: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: current, error: eCur } = await supabase
      .from("shifts")
      .select("user_id, shift_date, start_time, end_time, published_at")
      .eq("id", data.shiftId)
      .single();
    if (eCur) throw new Error(eCur.message);

    const nextUserId = data.userId !== undefined ? data.userId : current.user_id;
    const nextDate = data.shiftDate ?? current.shift_date;
    const nextStart = data.startTime ?? current.start_time;
    const nextEnd = data.endTime ?? current.end_time;
    await assertNoOverlap(supabase, nextUserId, nextDate, nextStart, nextEnd, data.shiftId);

    const wasPublished = !!current.published_at;
    const userChanged = data.userId !== undefined && data.userId !== current.user_id;
    const timeChanged =
      (data.shiftDate && data.shiftDate !== current.shift_date) ||
      (data.startTime && data.startTime !== String(current.start_time).slice(0, 8)) ||
      (data.endTime && data.endTime !== String(current.end_time).slice(0, 8));

    const patch: any = { updated_at: new Date().toISOString() };
    if (data.markManual !== false) patch.is_manual = true;
    if (data.unlock) {
      patch.is_locked = false;
    } else if (data.markManual !== false) {
      patch.is_locked = true;
    }
    if (data.userId !== undefined) patch.user_id = data.userId;
    if (data.studioId) patch.studio_id = data.studioId;
    if (data.businessRole) patch.business_role = data.businessRole;
    if (data.shiftDate) patch.shift_date = data.shiftDate;
    if (data.startTime) patch.start_time = data.startTime;
    if (data.endTime) patch.end_time = data.endTime;
    if (data.notes !== undefined) patch.notes = data.notes;

    const { error } = await supabase.from("shifts").update(patch).eq("id", data.shiftId);
    if (error) throw new Error(error.message);

    // Notifications quand on modifie un shift déjà publié
    if (wasPublished) {
      const fmtRange = `${nextDate} ${String(nextStart).slice(0,5)}–${String(nextEnd).slice(0,5)}`;
      const notifs: any[] = [];
      if (userChanged) {
        if (current.user_id) {
          notifs.push({
            user_id: current.user_id,
            type: "shift_removed",
            title: "Shift retiré",
            body: `Le shift du ${current.shift_date} ${String(current.start_time).slice(0,5)} a été réassigné.`,
            link: "/staff-app",
            priority: "info",
            category: "shift",
          });
        }
        if (nextUserId) {
          notifs.push({
            user_id: nextUserId,
            type: "shift_added",
            title: "Nouveau shift",
            body: fmtRange,
            link: "/staff-app",
            priority: "normal",
            category: "shift",
          });
        }
      } else if (timeChanged && nextUserId) {
        notifs.push({
          user_id: nextUserId,
          type: "shift_updated",
          title: "Shift modifié",
          body: fmtRange,
          link: "/staff-app",
          priority: "info",
          category: "shift",
        });
      }
      if (notifs.length > 0) await supabase.from("notifications").insert(notifs);
    }

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
        businessRole: businessRoleSchema,
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
    await assertNoOverlap(supabase, data.userId, data.shiftDate, data.startTime, data.endTime);

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
        link: "/staff-app",
        priority: "normal",
        category: "shift",
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
    const { data: cur } = await supabase
      .from("shifts")
      .select("user_id, shift_date, start_time, published_at")
      .eq("id", data.shiftId)
      .single();
    const { error } = await supabase.from("shifts").delete().eq("id", data.shiftId);
    if (error) throw new Error(error.message);
    if (cur?.published_at && cur.user_id) {
      await supabase.from("notifications").insert({
        user_id: cur.user_id,
        type: "shift_removed",
        title: "Shift annulé",
        body: `${cur.shift_date} ${String(cur.start_time).slice(0,5)}`,
        link: "/staff-app",
        priority: "normal",
        category: "shift",
      });
    }
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
        studioId: z.string().uuid().optional(), // si fourni : ne publie que ce studio
        // Si false (défaut) → bloque si une publication existe déjà sur la période.
        // Le client doit confirmer (true) pour republier.
        confirmRepublish: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // 0. Garde-fou anti-double-publication : signale si une publication existe
    // déjà qui chevauche la période. L'admin doit confirmer pour republier.
    if (!data.confirmRepublish) {
      const { data: prev } = await supabase
        .from("planning_publications")
        .select("id, period_start, period_end, published_at")
        .lte("period_start", data.endDate)
        .gte("period_end", data.startDate)
        .order("published_at", { ascending: false })
        .limit(1);
      if (prev && prev.length > 0) {
        const last = prev[0] as any;
        return {
          ok: false,
          alreadyPublished: true,
          previousPublishedAt: last.published_at,
          previousRange: { start: last.period_start, end: last.period_end },
          published: 0,
          notified: 0,
        };
      }
    }

    // 1. Récupère les drafts à publier
    let q = supabase
      .from("shifts")
      .select("id, user_id, shift_date, start_time, end_time, studio_id")
      .eq("status", "draft")
      .gte("shift_date", data.startDate)
      .lte("shift_date", data.endDate);
    if (data.studioId) q = q.eq("studio_id", data.studioId);
    const { data: drafts, error: e1 } = await q;
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
        link: "/staff-app",
        priority: "info",
        category: "planning",
      }));
      await supabase.from("notifications").insert(notifs);
    }

    return { ok: true, published: list.length, notified: userMap.size };
  });
