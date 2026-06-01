import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminOrManager(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "manager"]);
  if (!data || data.length === 0) throw new Error("Réservé aux administrateurs/managers");
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Réservé aux administrateurs");
}

/** Employé : vérifie s'il peut contribuer */
export const getMyContributorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("ai_contributor")
      .eq("id", userId)
      .maybeSingle();
    return { canContribute: Boolean(data?.ai_contributor) };
  });

const SubmitSchema = z.object({
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(10).max(8000),
  category: z.string().min(1).max(60).default("general"),
  entry_type: z.enum(["text", "faq"]).default("text"),
});

/** Employé contributeur : soumet une suggestion */
export const submitSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SubmitSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("ai_contributor")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.ai_contributor) throw new Error("Vous n'êtes pas autorisé à contribuer");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Anti-spam : max 10 en attente par employé
    const { count } = await supabaseAdmin
      .from("ai_knowledge_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId)
      .eq("status", "pending");
    if ((count ?? 0) >= 10) {
      throw new Error("Vous avez déjà 10 suggestions en attente, patientez avant d'en envoyer d'autres.");
    }

    const { error } = await supabaseAdmin.from("ai_knowledge_suggestions").insert({
      author_id: userId,
      title: data.title,
      content: data.content,
      category: data.category,
      entry_type: data.entry_type,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin : liste les suggestions */
export const listSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("ai_knowledge_suggestions")
      .select("id, author_id, title, content, category, entry_type, status, admin_notes, reviewer_id, reviewed_at, approved_entry_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set([...(rows ?? []).map((r: any) => r.author_id), ...(rows ?? []).map((r: any) => r.reviewer_id).filter(Boolean)]));
    let profileMap = new Map<string, any>();
    if (ids.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", ids);
      profileMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    }

    return {
      suggestions: (rows ?? []).map((r: any) => ({
        ...r,
        author: profileMap.get(r.author_id) ?? null,
        reviewer: r.reviewer_id ? profileMap.get(r.reviewer_id) ?? null : null,
      })),
    };
  });

const ReviewSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  // Permet à l'admin de modifier avant approbation
  title: z.string().trim().min(3).max(200).optional(),
  content: z.string().trim().min(10).max(8000).optional(),
  category: z.string().min(1).max(60).optional(),
  entry_type: z.enum(["text", "faq"]).optional(),
  admin_notes: z.string().max(2000).optional(),
});

/** Admin : approuve (avec édition optionnelle) ou refuse */
export const reviewSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ReviewSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: s, error: getErr } = await supabaseAdmin
      .from("ai_knowledge_suggestions")
      .select("id, title, content, category, entry_type, status")
      .eq("id", data.id)
      .maybeSingle();
    if (getErr || !s) throw new Error("Suggestion introuvable");
    if (s.status !== "pending") throw new Error("Suggestion déjà traitée");

    if (data.action === "reject") {
      const { error } = await supabaseAdmin
        .from("ai_knowledge_suggestions")
        .update({
          status: "rejected",
          reviewer_id: userId,
          reviewed_at: new Date().toISOString(),
          admin_notes: data.admin_notes ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // Approve : crée l'entrée dans ai_knowledge_entries
    const title = data.title ?? s.title;
    const content = data.content ?? s.content;
    const category = data.category ?? s.category;
    const entry_type = data.entry_type ?? s.entry_type;

    const { data: entry, error: insErr } = await supabaseAdmin
      .from("ai_knowledge_entries")
      .insert({
        title,
        content,
        category,
        entry_type,
        tags: [],
        priority: 0,
        is_active: true,
        data: {},
        author_id: userId,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("ai_knowledge_suggestions")
      .update({
        status: "approved",
        reviewer_id: userId,
        reviewed_at: new Date().toISOString(),
        approved_entry_id: entry.id,
        admin_notes: data.admin_notes ?? null,
        // On stocke aussi la version finale validée
        title,
        content,
        category,
        entry_type,
      })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, entry_id: entry.id };
  });

/** Admin/Manager : active/désactive le statut contributeur d'un employé */
export const setContributorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ userId: z.string().uuid(), is_contributor: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update({ ai_contributor: data.is_contributor })
      .eq("id", data.userId)
      .select("id, ai_contributor")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Profil introuvable");
    return { ok: true, ai_contributor: updated.ai_contributor };
  });

/** Admin : liste des contributeurs actifs */
export const listContributors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, avatar_url, ai_contributor")
      .eq("status", "active")
      .order("first_name", { ascending: true });
    if (error) throw new Error(error.message);
    return { employees: data ?? [] };
  });
