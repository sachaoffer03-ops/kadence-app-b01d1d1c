import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FilterEnum = z.enum(["all", "unread", "urgent"]);
const CategoryEnum = z.enum(["planning", "shift", "training", "request", "document", "pointage", "general"]);

export const listMyNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      filter: FilterEnum.optional().default("all"),
      category: CategoryEnum.optional(),
      limit: z.number().int().min(1).max(200).optional().default(50),
      offset: z.number().int().min(0).optional().default(0),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at, priority, category", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (data.filter === "unread") q = q.is("read_at", null);
    if (data.filter === "urgent") q = q.eq("priority", "urgent");
    if (data.category) q = q.eq("category", data.category);

    const { data: items, error, count } = await q.range(data.offset, data.offset + data.limit - 1);
    if (error) throw new Error(error.message);

    // counts
    const { data: countsRows } = await supabase
      .from("notifications")
      .select("priority")
      .eq("user_id", userId)
      .is("read_at", null);
    const counts = { urgent: 0, normal: 0, info: 0, total: 0 };
    for (const r of (countsRows ?? []) as any[]) {
      counts.total += 1;
      const p = (r.priority || "normal") as keyof typeof counts;
      if (p in counts) (counts as any)[p] += 1;
    }

    return { items: (items ?? []) as any[], total: count ?? 0, counts };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ notificationId: z.string().uuid(), unread: z.boolean().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = data.unread ? { read_at: null } : { read_at: new Date().toISOString() };
    const { error } = await supabase
      .from("notifications")
      .update(patch)
      .eq("id", data.notificationId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ category: CategoryEnum.optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (data.category) q = q.eq("category", data.category);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const countUnread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("priority")
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    const counts = { urgent: 0, normal: 0, info: 0, total: 0 };
    for (const r of (data ?? []) as any[]) {
      counts.total += 1;
      const p = (r.priority || "normal") as keyof typeof counts;
      if (p in counts) (counts as any)[p] += 1;
    }
    return counts;
  });

export const getRecentImportantNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ limit: z.number().int().min(1).max(10).optional().default(3) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: items, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at, priority, category")
      .eq("user_id", userId)
      .is("read_at", null)
      .in("priority", ["urgent", "normal"])
      .order("priority", { ascending: true }) // urgent < normal lexicographically -> use a separate ordering
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    // Sort: urgent first, then normal, then by date desc
    const sorted = [...(items ?? [])].sort((a: any, b: any) => {
      const order: Record<string, number> = { urgent: 0, normal: 1, info: 2 };
      const pa = order[a.priority] ?? 1;
      const pb = order[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return { items: sorted.slice(0, data.limit) as any[] };
  });
