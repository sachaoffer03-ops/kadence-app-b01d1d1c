import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Réservé aux administrateurs");
}

export const listChatConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: msgs, error } = await supabaseAdmin
      .from("ai_chat_messages")
      .select("id, user_id, role, content, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const byUser = new Map<string, { user_id: string; last_message: string; last_role: string; last_at: string; count: number }>();
    for (const m of msgs ?? []) {
      const cur = byUser.get(m.user_id);
      if (!cur) {
        byUser.set(m.user_id, {
          user_id: m.user_id,
          last_message: m.content,
          last_role: m.role,
          last_at: m.created_at,
          count: 1,
        });
      } else {
        cur.count++;
      }
    }

    const userIds = Array.from(byUser.keys());
    if (userIds.length === 0) return { conversations: [] };

    const [{ data: profiles }, { data: feedbackRows }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", userIds),
      supabaseAdmin
        .from("ai_message_feedback")
        .select("message_id, rating, ai_chat_messages!inner(user_id)")
        .in("ai_chat_messages.user_id", userIds),
    ]);

    const feedbackByUser = new Map<string, { up: number; down: number; correction: number }>();
    for (const f of (feedbackRows as any[]) ?? []) {
      const uid = f.ai_chat_messages?.user_id;
      if (!uid) continue;
      const c = feedbackByUser.get(uid) ?? { up: 0, down: 0, correction: 0 };
      c[f.rating as "up" | "down" | "correction"]++;
      feedbackByUser.set(uid, c);
    }

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const conversations = Array.from(byUser.values())
      .map((c) => {
        const p: any = profileMap.get(c.user_id);
        return {
          ...c,
          first_name: p?.first_name ?? null,
          last_name: p?.last_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          feedback: feedbackByUser.get(c.user_id) ?? { up: 0, down: 0, correction: 0 },
        };
      })
      .sort((a, b) => (a.last_at < b.last_at ? 1 : -1));

    return { conversations };
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: messages, error }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("ai_chat_messages")
        .select("id, role, content, created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: true })
        .limit(500),
      supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, email")
        .eq("id", data.userId)
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);

    const ids = (messages ?? []).map((m: any) => m.id);
    let feedbacks: any[] = [];
    if (ids.length > 0) {
      const { data: fbs } = await supabaseAdmin
        .from("ai_message_feedback")
        .select("id, message_id, rating, comment, corrected_answer, admin_id, updated_at")
        .in("message_id", ids);
      feedbacks = fbs ?? [];
    }
    const fbMap = new Map(feedbacks.map((f) => [f.message_id, f]));

    return {
      profile,
      messages: (messages ?? []).map((m: any) => ({
        ...m,
        feedback: fbMap.get(m.id) ?? null,
      })),
    };
  });

const RateSchema = z.object({
  message_id: z.string().uuid(),
  rating: z.enum(["up", "down", "correction"]),
  comment: z.string().max(2000).optional().nullable(),
  corrected_answer: z.string().max(8000).optional().nullable(),
});

export const rateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("ai_message_feedback")
      .upsert(
        {
          message_id: data.message_id,
          rating: data.rating,
          comment: data.comment ?? null,
          corrected_answer: data.corrected_answer ?? null,
          admin_id: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "message_id" }
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { feedback: row };
  });

export const deleteMessageFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ message_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_message_feedback")
      .delete()
      .eq("message_id", data.message_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBotStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(); since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();

    const [allMsgsRes, recentMsgsRes, fbRes, kbRes, usersRes] = await Promise.all([
      supabaseAdmin.from("ai_chat_messages").select("id, role", { count: "exact", head: true }),
      supabaseAdmin
        .from("ai_chat_messages")
        .select("id, role, user_id, created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true })
        .limit(5000),
      supabaseAdmin
        .from("ai_message_feedback")
        .select("rating, created_at, comment, corrected_answer"),
      supabaseAdmin
        .from("ai_knowledge_entries")
        .select("id, is_active, entry_type, category"),
      supabaseAdmin
        .from("ai_chat_messages")
        .select("user_id"),
    ]);

    const recent = recentMsgsRes.data ?? [];
    const fb = fbRes.data ?? [];
    const kb = kbRes.data ?? [];

    // Timeline last 30 days
    const days = new Map<string, { date: string; total: number; up: number; down: number; correction: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.set(key, { date: key, total: 0, up: 0, down: 0, correction: 0 });
    }
    for (const m of recent) {
      if (m.role !== "assistant") continue;
      const key = String(m.created_at).slice(0, 10);
      const d = days.get(key);
      if (d) d.total++;
    }
    for (const f of fb) {
      const key = String(f.created_at).slice(0, 10);
      const d = days.get(key);
      if (d) (d as any)[f.rating]++;
    }

    const totalUp = fb.filter((f) => f.rating === "up").length;
    const totalDown = fb.filter((f) => f.rating === "down").length;
    const totalCorr = fb.filter((f) => f.rating === "correction").length;
    const totalRated = totalUp + totalDown + totalCorr;
    const assistantMsgs = recent.filter((m) => m.role === "assistant").length;
    const uniqUsers = new Set((usersRes.data ?? []).map((r: any) => r.user_id)).size;
    const satisfaction = totalRated === 0 ? null : Math.round((totalUp / totalRated) * 100);
    const coverage = assistantMsgs === 0 ? 0 : Math.round((totalRated / assistantMsgs) * 100);

    return {
      totals: {
        total_messages: allMsgsRes.count ?? 0,
        assistant_messages_30d: assistantMsgs,
        unique_users: uniqUsers,
        knowledge_active: kb.filter((k: any) => k.is_active).length,
        knowledge_total: kb.length,
      },
      feedback: {
        up: totalUp, down: totalDown, correction: totalCorr,
        rated: totalRated,
        satisfaction_pct: satisfaction,
        coverage_pct: coverage,
      },
      timeline: Array.from(days.values()),
      knowledge_by_type: Object.fromEntries(
        ["text", "faq", "link", "file", "table"].map((t) => [
          t,
          kb.filter((k: any) => k.entry_type === t).length,
        ])
      ),
    };
  });
