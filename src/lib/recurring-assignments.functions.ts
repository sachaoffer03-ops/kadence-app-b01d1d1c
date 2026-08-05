import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RecurringAssignment = {
  id: string;
  user_id: string;
  studio_id: string;
  business_role: string;
  weekday: number;
  start_time: string;
  end_time: string;
  date_from: string;
  date_to: string;
  is_active: boolean;
  studio_name?: string | null;
};

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Toutes les dates du créneau récurrent (weekday 0=dimanche) à partir de `from`. */
function occurrences(rule: {
  weekday: number;
  date_from: string;
  date_to: string;
}, notBefore: string): string[] {
  const start = new Date(`${rule.date_from}T00:00:00`);
  const end = new Date(`${rule.date_to}T00:00:00`);
  const floor = new Date(`${notBefore}T00:00:00`);
  const out: string[] = [];
  const d = new Date(start);
  while (d.getDay() !== rule.weekday) d.setDate(d.getDate() + 1);
  while (d <= end) {
    if (d >= floor) out.push(toDateStr(d));
    d.setDate(d.getDate() + 7);
    if (out.length > 400) break;
  }
  return out;
}

export const listRecurringAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<RecurringAssignment[]> => {
    const { data: rows, error } = await context.supabase
      .from("recurring_assignments")
      .select("id, user_id, studio_id, business_role, weekday, start_time, end_time, date_from, date_to, is_active, studios:studio_id(name)")
      .eq("user_id", data.userId)
      .order("weekday", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const { studios, ...rest } = r as typeof r & { studios: { name: string } | null };
      return { ...rest, studio_name: studios?.name ?? null } as RecurringAssignment;
    });
  });

const createInput = z.object({
  userId: z.string().uuid(),
  studioId: z.string().uuid(),
  businessRole: z.string().min(1),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export const createRecurringAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId: authorId } = context;

    const { data: rule, error } = await supabase
      .from("recurring_assignments")
      .insert({
        user_id: data.userId,
        studio_id: data.studioId,
        business_role: data.businessRole,
        weekday: data.weekday,
        start_time: data.startTime,
        end_time: data.endTime,
        date_from: data.dateFrom,
        date_to: data.dateTo,
        created_by: authorId,
      })
      .select("id, weekday, date_from, date_to")
      .single();
    if (error) throw new Error(error.message);

    const result = await materialize(supabase, {
      id: rule.id,
      user_id: data.userId,
      studio_id: data.studioId,
      business_role: data.businessRole,
      weekday: data.weekday,
      start_time: data.startTime,
      end_time: data.endTime,
      date_from: data.dateFrom,
      date_to: data.dateTo,
    });
    return { id: rule.id, ...result };
  });

export const applyRecurringAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rule, error } = await context.supabase
      .from("recurring_assignments")
      .select("id, user_id, studio_id, business_role, weekday, start_time, end_time, date_from, date_to")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return materialize(context.supabase, rule as never);
  });

export const deleteRecurringAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), removeFutureShifts: z.boolean().default(true) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rule } = await supabase
      .from("recurring_assignments")
      .select("user_id, studio_id, business_role, weekday, start_time, end_time, date_from, date_to")
      .eq("id", data.id)
      .single();

    let removed = 0;
    if (rule && data.removeFutureShifts) {
      const today = toDateStr(new Date());
      const dates = occurrences(rule as never, today);
      if (dates.length > 0) {
        const { data: del } = await supabase
          .from("shifts")
          .delete()
          .eq("user_id", rule.user_id)
          .eq("studio_id", rule.studio_id)
          .eq("start_time", rule.start_time)
          .in("shift_date", dates)
          .is("clocked_in_at", null)
          .select("id");
        removed = del?.length ?? 0;
      }
    }

    const { error } = await supabase.from("recurring_assignments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { removed };
  });

async function materialize(
  supabase: { from: (t: string) => any },
  rule: {
    id?: string;
    user_id: string;
    studio_id: string;
    business_role: string;
    weekday: number;
    start_time: string;
    end_time: string;
    date_from: string;
    date_to: string;
  },
): Promise<{ created: number; skipped: number; availabilities: number }> {
  const today = toDateStr(new Date());
  const dates = occurrences(rule, today);
  if (dates.length === 0) return { created: 0, skipped: 0, availabilities: 0 };

  // Shifts déjà présents ce jour-là pour cet employé → on ne double pas
  const { data: existing } = await supabase
    .from("shifts")
    .select("shift_date")
    .eq("user_id", rule.user_id)
    .in("shift_date", dates);
  const taken = new Set<string>((existing ?? []).map((s: { shift_date: string }) => s.shift_date));

  const nowIso = new Date().toISOString();
  const toCreate = dates.filter((d) => !taken.has(d));
  if (toCreate.length > 0) {
    const { error } = await supabase.from("shifts").insert(
      toCreate.map((d) => ({
        user_id: rule.user_id,
        studio_id: rule.studio_id,
        business_role: rule.business_role,
        shift_date: d,
        start_time: rule.start_time,
        end_time: rule.end_time,
        status: "scheduled",
        is_manual: true,
        is_locked: true,
        published_at: nowIso,
      })),
    );
    if (error) throw new Error(error.message);
  }

  // Dispos cohérentes
  const { data: existingAvail } = await supabase
    .from("availabilities")
    .select("avail_date")
    .eq("user_id", rule.user_id)
    .eq("studio_id", rule.studio_id)
    .in("avail_date", dates);
  const availTaken = new Set<string>(
    (existingAvail ?? []).map((a: { avail_date: string }) => a.avail_date),
  );
  const availToCreate = dates.filter((d) => !availTaken.has(d));
  if (availToCreate.length > 0) {
    await supabase.from("availabilities").insert(
      availToCreate.map((d) => ({
        user_id: rule.user_id,
        studio_id: rule.studio_id,
        avail_date: d,
        start_time: rule.start_time,
        end_time: rule.end_time,
      })),
    );
  }

  return {
    created: toCreate.length,
    skipped: dates.length - toCreate.length,
    availabilities: availToCreate.length,
  };
}
