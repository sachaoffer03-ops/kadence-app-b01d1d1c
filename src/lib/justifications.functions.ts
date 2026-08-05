import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminOrManager } from "./pointage.server";

export type JustificationKind = "late" | "clock_out";

export type JustificationRow = {
  shift_id: string;
  kind: JustificationKind;
  shift_date: string;
  start_time: string;
  end_time: string;
  business_role: string;
  studio_name: string | null;
  user_name: string;
  reason: string;
  minutes: number | null; // retard en min, ou écart de sortie (négatif = plus tôt)
  status: "pending" | "accepted" | "refused";
  reviewed_at: string | null;
  review_note: string | null;
};

const listSchema = z.object({
  status: z.enum(["pending", "accepted", "refused", "all"]).default("pending"),
  studioIds: z.array(z.string().uuid()).optional(),
});

export const listJustificationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => listSchema.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdminOrManager(supabase, userId);

    let q = supabase
      .from("shifts")
      .select(
        "id,shift_date,start_time,end_time,business_role,user_id,studio_id,minutes_late,late_reason,late_reason_status,clock_out_reason,clock_out_reason_status,clock_out_deviation_min,reason_reviewed_at,reason_review_note",
      )
      .or("late_reason.not.is.null,clock_out_reason.not.is.null")
      .order("shift_date", { ascending: false })
      .limit(500);
    if (data.studioIds?.length) q = q.in("studio_id", data.studioIds);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean)));
    const studioIds = Array.from(new Set((rows ?? []).map((r: any) => r.studio_id).filter(Boolean)));
    const [{ data: profiles }, { data: studios }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id,first_name,last_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      studioIds.length
        ? supabase.from("studios").select("id,name").in("id", studioIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map<string, string>((profiles ?? []).map((p: any) => [p.id as string, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));
    const smap = new Map<string, string>((studios ?? []).map((s: any) => [s.id as string, s.name as string]));

    const out: JustificationRow[] = [];
    for (const r of rows ?? []) {
      const base = {
        shift_id: r.id,
        shift_date: r.shift_date,
        start_time: r.start_time,
        end_time: r.end_time,
        business_role: r.business_role,
        studio_name: smap.get(r.studio_id) ?? null,
        user_name: pmap.get(r.user_id) || "—",
        reviewed_at: r.reason_reviewed_at,
        review_note: r.reason_review_note,
      };
      if (r.late_reason) {
        out.push({ ...base, kind: "late", reason: r.late_reason, minutes: r.minutes_late, status: r.late_reason_status ?? "pending" });
      }
      if (r.clock_out_reason) {
        out.push({ ...base, kind: "clock_out", reason: r.clock_out_reason, minutes: r.clock_out_deviation_min, status: r.clock_out_reason_status ?? "pending" });
      }
    }
    const filtered = data.status === "all" ? out : out.filter((r) => r.status === data.status);
    return {
      rows: filtered,
      counts: {
        pending: out.filter((r) => r.status === "pending").length,
        accepted: out.filter((r) => r.status === "accepted").length,
        refused: out.filter((r) => r.status === "refused").length,
      },
    };
  });

const reviewSchema = z.object({
  items: z
    .array(z.object({ shiftId: z.string().uuid(), kind: z.enum(["late", "clock_out"]) }))
    .min(1)
    .max(200),
  decision: z.enum(["accepted", "refused"]),
  note: z.string().max(280).nullable().optional(),
});

export const reviewJustificationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => reviewSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdminOrManager(supabase, userId);

    const now = new Date().toISOString();
    let updated = 0;
    for (const item of data.items) {
      const patch: Record<string, unknown> = {
        reason_reviewed_by: userId,
        reason_reviewed_at: now,
        reason_review_note: data.note ?? null,
      };
      if (item.kind === "late") patch.late_reason_status = data.decision;
      else patch.clock_out_reason_status = data.decision;
      const { error } = await supabase.from("shifts").update(patch).eq("id", item.shiftId);
      if (error) throw new Error(error.message);
      updated++;
    }
    return { ok: true, updated };
  });
