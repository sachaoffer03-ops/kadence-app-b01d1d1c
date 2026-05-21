import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminOrManager, computeShiftStatus, todayIso, type PointageStatus } from "./pointage.server";

// ---------- Types ----------

export type PointageShift = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  business_role: string;
  user_id: string | null;
  studio_id: string | null;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  status: string;
  minutes_late: number | null;
  clock_admin_note: string | null;
  user_name: string | null;
  user_avatar: string | null;
  studio_name: string | null;
  studio_short: string | null;
  computed_status: PointageStatus;
};

export type PointageTodayResult = {
  shifts: PointageShift[];
  kpis: {
    present_count: number;
    expected_count: number;
    late_count: number;
    no_show_count: number;
    worked_minutes: number;
    planned_minutes: number;
  };
};

// ---------- getPointageToday ----------

export const getPointageTodayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studioIds?: string[] } | undefined) =>
    z.object({ studioIds: z.array(z.string().uuid()).optional() }).parse(input ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdminOrManager(supabase, userId);
    const today = todayIso();

    let q = supabase
      .from("shifts")
      .select("id,shift_date,start_time,end_time,business_role,user_id,studio_id,clocked_in_at,clocked_out_at,status,minutes_late,clock_admin_note")
      .eq("shift_date", today)
      .order("start_time", { ascending: true });
    if (data.studioIds && data.studioIds.length > 0) q = q.in("studio_id", data.studioIds);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows || []).map((r: any) => r.user_id).filter(Boolean)));
    const studioIds = Array.from(new Set((rows || []).map((r: any) => r.studio_id).filter(Boolean)));

    const [{ data: profiles }, { data: studios }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id,first_name,last_name,avatar_url").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      studioIds.length
        ? supabase.from("studios").select("id,name,short_name,clock_in_grace_period_min").in("id", studioIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const smap = new Map((studios ?? []).map((s: any) => [s.id, s]));

    let present = 0,
      expected = 0,
      late = 0,
      noShow = 0,
      worked = 0,
      planned = 0;

    const out: PointageShift[] = (rows || []).map((r: any) => {
      const s = r.studio_id ? smap.get(r.studio_id) as any : null;
      const grace = s?.clock_in_grace_period_min ?? 15;
      const p = r.user_id ? pmap.get(r.user_id) as any : null;
      const computed = computeShiftStatus({
        shiftDate: r.shift_date,
        startTime: r.start_time,
        endTime: r.end_time,
        clockedInAt: r.clocked_in_at,
        clockedOutAt: r.clocked_out_at,
        status: r.status,
        graceMinIn: grace,
        minutesLate: r.minutes_late,
      });

      // KPIs
      if (r.user_id) expected += 1;
      if (r.clocked_in_at) present += 1;
      if (computed === "late_no_in" || computed === "late_in") late += 1;
      if (computed === "no_show") noShow += 1;

      const startMs = new Date(`${r.shift_date}T${r.start_time}`).getTime();
      const endMs = new Date(`${r.shift_date}T${r.end_time}`).getTime();
      planned += Math.max(0, Math.round((endMs - startMs) / 60_000));
      if (r.clocked_in_at && r.clocked_out_at) {
        worked += Math.max(
          0,
          Math.round((new Date(r.clocked_out_at).getTime() - new Date(r.clocked_in_at).getTime()) / 60_000)
        );
      }

      return {
        id: r.id,
        shift_date: r.shift_date,
        start_time: r.start_time,
        end_time: r.end_time,
        business_role: r.business_role,
        user_id: r.user_id,
        studio_id: r.studio_id,
        clocked_in_at: r.clocked_in_at,
        clocked_out_at: r.clocked_out_at,
        status: r.status,
        minutes_late: r.minutes_late,
        clock_admin_note: r.clock_admin_note,
        user_name: p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || null : null,
        user_avatar: p?.avatar_url ?? null,
        studio_name: s?.name ?? null,
        studio_short: s?.short_name ?? null,
        computed_status: computed,
      };
    });

    return {
      shifts: out,
      kpis: {
        present_count: present,
        expected_count: expected,
        late_count: late,
        no_show_count: noShow,
        worked_minutes: worked,
        planned_minutes: planned,
      },
    } as PointageTodayResult;
  });

// ---------- Manual actions ----------

async function loadShift(supabase: any, shiftId: string) {
  const { data, error } = await supabase
    .from("shifts")
    .select("id,shift_date,start_time,end_time,user_id,studio_id,clocked_in_at,clocked_out_at,status,minutes_late,clock_admin_note")
    .eq("id", shiftId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Shift introuvable");
  return data;
}

async function writeAudit(
  supabase: any,
  actorId: string,
  shiftId: string,
  action: string,
  before: any,
  after: any,
  note?: string | null
) {
  await supabase.from("shift_clock_audit").insert({
    shift_id: shiftId,
    actor_id: actorId,
    action,
    before_value: before,
    after_value: after,
    note: note ?? null,
  } as any);
}

function combineDateTime(dateIso: string, time: string): string {
  // time HH:MM
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${dateIso}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function diffMinutes(planned: Date, real: Date): number {
  return Math.max(0, Math.floor((real.getTime() - planned.getTime()) / 60_000));
}

export const manualClockInFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ shiftId: z.string().uuid(), time: z.string().regex(/^\d{2}:\d{2}$/), reason: z.string().min(1).max(500) })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdminOrManager(supabase, userId);
    const shift = await loadShift(supabase, data.shiftId);
    if (shift.clocked_in_at) throw new Error("Déjà pointé à l'arrivée");
    const iso = combineDateTime(shift.shift_date, data.time);
    const minutesLate = diffMinutes(new Date(`${shift.shift_date}T${shift.start_time}`), new Date(iso));
    const { error } = await supabase
      .from("shifts")
      .update({ clocked_in_at: iso, minutes_late: minutesLate, status: "scheduled" })
      .eq("id", shift.id);
    if (error) throw new Error(error.message);
    await writeAudit(supabase, userId, shift.id, "manual_clock_in", null, { clocked_in_at: iso, minutes_late: minutesLate }, data.reason);
    return { ok: true };
  });

export const manualClockOutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ shiftId: z.string().uuid(), time: z.string().regex(/^\d{2}:\d{2}$/), reason: z.string().min(1).max(500) })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdminOrManager(supabase, userId);
    const shift = await loadShift(supabase, data.shiftId);
    if (!shift.clocked_in_at) throw new Error("Pointage d'arrivée manquant");
    if (shift.clocked_out_at) throw new Error("Déjà pointé à la sortie");
    const iso = combineDateTime(shift.shift_date, data.time);
    const { error } = await supabase
      .from("shifts")
      .update({ clocked_out_at: iso, status: "completed" })
      .eq("id", shift.id);
    if (error) throw new Error(error.message);
    await writeAudit(supabase, userId, shift.id, "manual_clock_out", null, { clocked_out_at: iso }, data.reason);
    return { ok: true };
  });

export const editMinutesLateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ shiftId: z.string().uuid(), newValue: z.number().int().min(0).max(600), reason: z.string().min(1).max(500) })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdminOrManager(supabase, userId);
    const shift = await loadShift(supabase, data.shiftId);
    const before = { minutes_late: shift.minutes_late };
    const { error } = await supabase.from("shifts").update({ minutes_late: data.newValue }).eq("id", shift.id);
    if (error) throw new Error(error.message);
    await writeAudit(supabase, userId, shift.id, "edit_minutes_late", before, { minutes_late: data.newValue }, data.reason);
    return { ok: true };
  });

export const markNoShowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ shiftId: z.string().uuid(), reason: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdminOrManager(supabase, userId);
    const shift = await loadShift(supabase, data.shiftId);
    const before = { status: shift.status };
    const { error } = await supabase.from("shifts").update({ status: "cancelled" }).eq("id", shift.id);
    if (error) throw new Error(error.message);
    await writeAudit(supabase, userId, shift.id, "mark_no_show", before, { status: "cancelled" }, data.reason);
    return { ok: true };
  });

export const undoNoShowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdminOrManager(supabase, userId);
    const shift = await loadShift(supabase, data.shiftId);
    const before = { status: shift.status };
    const nextStatus = shift.clocked_out_at ? "completed" : "scheduled";
    const { error } = await supabase.from("shifts").update({ status: nextStatus }).eq("id", shift.id);
    if (error) throw new Error(error.message);
    await writeAudit(supabase, userId, shift.id, "undo_no_show", before, { status: nextStatus }, null);
    return { ok: true };
  });

export const setAdminNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ shiftId: z.string().uuid(), note: z.string().max(2000) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdminOrManager(supabase, userId);
    const shift = await loadShift(supabase, data.shiftId);
    const before = { clock_admin_note: shift.clock_admin_note };
    const cleaned = data.note.trim() ? data.note.trim() : null;
    const action = shift.clock_admin_note ? "edit_note" : "add_note";
    const { error } = await supabase.from("shifts").update({ clock_admin_note: cleaned }).eq("id", shift.id);
    if (error) throw new Error(error.message);
    await writeAudit(supabase, userId, shift.id, action, before, { clock_admin_note: cleaned }, null);
    return { ok: true };
  });

export type AuditEntry = {
  id: string;
  action: string;
  before_value: any;
  after_value: any;
  note: string | null;
  created_at: string;
  actor_name: string | null;
};

export const getShiftAuditHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdminOrManager(supabase, userId);
    const { data: rows, error } = await supabase
      .from("shift_clock_audit")
      .select("id,action,before_value,after_value,note,created_at,actor_id")
      .eq("shift_id", data.shiftId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const actorIds = Array.from(new Set((rows || []).map((r: any) => r.actor_id)));
    const { data: profs } = actorIds.length
      ? await supabase.from("profiles").select("id,first_name,last_name").in("id", actorIds)
      : { data: [] as any[] };
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim()]));
    return (rows || []).map((r: any) => ({
      id: r.id,
      action: r.action,
      before_value: r.before_value,
      after_value: r.after_value,
      note: r.note,
      created_at: r.created_at,
      actor_name: pmap.get(r.actor_id) || null,
    })) as AuditEntry[];
  });

// ---------- Alerts ----------

export const checkPointageAlertsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdminOrManager(supabase, userId);
    const today = todayIso();
    const now = new Date();

    const [{ data: shifts }, { data: studios }, { data: admins }] = await Promise.all([
      supabase
        .from("shifts")
        .select("id,shift_date,start_time,end_time,user_id,studio_id,clocked_in_at,clocked_out_at,status")
        .eq("shift_date", today),
      supabase.from("studios").select("id,name,short_name,clock_in_grace_period_min"),
      supabase.from("user_roles").select("user_id,role").in("role", ["admin", "manager"]),
    ]);

    const smap = new Map((studios ?? []).map((s: any) => [s.id, s]));
    const adminIds = Array.from(new Set((admins ?? []).map((a: any) => a.user_id)));
    if (adminIds.length === 0) return { created: 0 };

    const profilesNeeded = Array.from(new Set((shifts ?? []).map((s: any) => s.user_id).filter(Boolean)));
    const { data: profiles } = profilesNeeded.length
      ? await supabase.from("profiles").select("id,first_name").in("id", profilesNeeded)
      : { data: [] as any[] };
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p.first_name || "Employé"]));

    const alerts: Array<{ type: string; shiftId: string; title: string; body: string }> = [];

    for (const sh of (shifts ?? []) as any[]) {
      if (!sh.user_id || sh.status === "cancelled") continue;
      const studio = sh.studio_id ? (smap.get(sh.studio_id) as any) : null;
      const grace = studio?.clock_in_grace_period_min ?? 15;
      const start = new Date(`${sh.shift_date}T${sh.start_time}`);
      const end = new Date(`${sh.shift_date}T${sh.end_time}`);
      const firstName = pmap.get(sh.user_id) || "Employé";
      const studioName = (studio?.short_name || studio?.name || "—").replace(/^Skult\s+/i, "");

      // A. Late arrival
      if (!sh.clocked_in_at && now > new Date(start.getTime() + grace * 60_000)) {
        alerts.push({
          type: "shift_late_arrival",
          shiftId: sh.id,
          title: `${firstName} en retard`,
          body: `Shift ${sh.start_time.slice(0, 5)} au ${studioName} non pointé`,
        });
      }
      // B. No-show suspected (30 min)
      if (!sh.clocked_in_at && now > new Date(start.getTime() + 30 * 60_000)) {
        alerts.push({
          type: "shift_no_show_suspected",
          shiftId: sh.id,
          title: `${firstName} : no-show probable`,
          body: `Plus de 30 min après l'heure de début, toujours pas pointé`,
        });
      }
      // C. Clock-out missing (1h after end)
      if (sh.clocked_in_at && !sh.clocked_out_at && now > new Date(end.getTime() + 60 * 60_000)) {
        alerts.push({
          type: "shift_clock_out_missing",
          shiftId: sh.id,
          title: `Sortie non pointée`,
          body: `Rappel : ${firstName} n'a pas pointé sa sortie`,
        });
      }
    }

    if (alerts.length === 0) return { created: 0 };

    // Idempotency: link contains shift id + alert type, check existing notifs for last 24h
    const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
    const { data: existing } = await supabase
      .from("notifications")
      .select("link,user_id")
      .gte("created_at", since)
      .like("link", "/pointage?%");
    const existingKeys = new Set(
      (existing ?? []).map((n: any) => `${n.user_id}::${n.link}`)
    );

    const rowsToInsert: any[] = [];
    for (const a of alerts) {
      const link = `/pointage?shift=${a.shiftId}&alert=${a.type}`;
      const priority =
        a.type === "shift_late_arrival" || a.type === "shift_no_show_suspected" ? "urgent" : "normal";
      for (const adminId of adminIds) {
        const key = `${adminId}::${link}`;
        if (existingKeys.has(key)) continue;
        rowsToInsert.push({
          user_id: adminId,
          type: a.type,
          title: a.title,
          body: a.body,
          link,
          priority,
          category: "pointage",
        });
      }
    }

    if (rowsToInsert.length === 0) return { created: 0 };
    const { error } = await supabase.from("notifications").insert(rowsToInsert);
    if (error) throw new Error(error.message);
    return { created: rowsToInsert.length };
  });
