import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Réservé aux administrateurs");
}

export const listAdmins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return { admins: [] as any[] };
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email, created_at, status")
      .in("id", ids);
    return { admins: (profiles ?? []).sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1)) };
  });

export const createAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6).max(128),
      first_name: z.string().min(1).max(80),
      last_name: z.string().min(1).max(80),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { first_name: data.first_name, last_name: data.last_name },
    });
    if (error || !created.user) throw new Error(error?.message || "Création échouée");

    const newId = created.user.id;

    // Ensure profile exists with correct names
    await supabaseAdmin.from("profiles").upsert({
      id: newId,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      status: "active",
    }, { onConflict: "id" });

    // Force admin role (remove any other role)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: "admin" });
    if (roleErr) throw new Error(roleErr.message);

    return { ok: true, user_id: newId };
  });
