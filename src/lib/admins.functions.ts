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

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6).max(128),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list, error: listErr } = await supabaseAdmin
      .from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (listErr) throw new Error(listErr.message);
    if (!list) throw new Error("Utilisateur introuvable");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(list.id, {
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
});

export const setUserAppRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["employee", "manager", "admin"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.user_id === userId && data.role !== "admin") {
      throw new Error("Tu ne peux pas retirer ton propre statut admin");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Remplace TOUS les rôles existants par le nouveau (un seul role app par user)
    const { error: delErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    if (delErr) throw new Error(delErr.message);
    const { error: insErr } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    if (insErr) throw new Error(insErr.message);

    // Notification à l'employé
    const label = data.role === "admin" ? "Administrateur" : data.role === "manager" ? "Manager" : "Employé";
    await supabaseAdmin.from("notifications").insert({
      user_id: data.user_id,
      type: "role_changed",
      title: `Ton rôle a été mis à jour`,
      body: `Tu es désormais ${label}. ${data.role !== "employee" ? "Tu as maintenant accès à la console admin." : ""}`,
      priority: "normal",
      category: "account",
    });

    return { ok: true };
  });
