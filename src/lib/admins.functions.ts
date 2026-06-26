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
    // Backward-compat single-role wrapper → délègue à setUserAppRoles
    return applyUserAppRoles({ userId: context.userId, targetUserId: data.user_id, roles: [data.role] });
  });

export const setUserAppRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      user_id: z.string().uuid(),
      roles: z.array(z.enum(["employee", "manager", "admin"])).min(1).max(3),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    return applyUserAppRoles({ userId: context.userId, targetUserId: data.user_id, roles: data.roles });
  });

async function applyUserAppRoles(args: { userId: string; targetUserId: string; roles: Array<"employee" | "manager" | "admin"> }) {
  const { userId, targetUserId } = args;
  const roles = Array.from(new Set(args.roles));
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Assert caller is admin
  const { data: callerRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const callerIsAdmin = (callerRoles ?? []).some((r: any) => r.role === "admin");
  if (!callerIsAdmin) throw new Error("Réservé aux administrateurs");

  // Empêche un admin de retirer son propre statut admin
  if (targetUserId === userId && !roles.includes("admin")) {
    throw new Error("Tu ne peux pas retirer ton propre statut admin");
  }

  // Rôles précédents
  const { data: prevRows } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", targetUserId);
  const prevRoles = (prevRows ?? []).map((r: any) => r.role as string);

  // Remplace l'ensemble
  const { error: delErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUserId);
  if (delErr) throw new Error(delErr.message);
  const insRows = roles.map((role) => ({ user_id: targetUserId, role }));
  const { error: insErr } = await supabaseAdmin.from("user_roles").insert(insRows);
  if (insErr) throw new Error(insErr.message);

  // Permissions manager : grant par défaut si nouveau manager, retire si plus manager
  const becameManager = roles.includes("manager") && !prevRoles.includes("manager");
  const lostManager = !roles.includes("manager") && prevRoles.includes("manager");

  if (becameManager) {
    const { ALL_PERMISSION_KEYS } = await import("@/lib/permissions");
    const { data: existing } = await supabaseAdmin
      .from("manager_permissions")
      .select("user_id")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("manager_permissions").insert({
        user_id: targetUserId,
        permissions: ALL_PERMISSION_KEYS,
        updated_by: userId,
      });
    }
  }
  if (lostManager && !roles.includes("admin")) {
    await supabaseAdmin.from("manager_permissions").delete().eq("user_id", targetUserId);
  }

  // Notification à l'utilisateur
  const labels = roles
    .map((r) => (r === "admin" ? "Administrateur" : r === "manager" ? "Manager" : "Employé"))
    .join(" + ");
  const hasMulti = roles.length > 1;
  await supabaseAdmin.from("notifications").insert({
    user_id: targetUserId,
    type: "role_changed",
    title: `Ton accès a été mis à jour`,
    body: hasMulti
      ? `Tu as désormais plusieurs accès : ${labels}. L'espace affiché dépend du lien sur lequel tu te connectes (employé ou admin).`
      : `Tu es désormais ${labels}.${roles.includes("employee") ? "" : " Tu as maintenant accès à la console admin."}`,
    priority: "normal",
    category: "account",
  });

  return { ok: true, roles };
}


export const getManagerPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("manager_permissions")
      .select("permissions")
      .eq("user_id", data.user_id)
      .maybeSingle();
    return { permissions: (row?.permissions as string[] | null) ?? [] };
  });

export const setManagerPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      user_id: z.string().uuid(),
      permissions: z.array(z.string()).max(128),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.includes("manager")) {
      throw new Error("Permissions modifiables uniquement pour un Manager");
    }

    const { ALL_PERMISSION_KEYS } = await import("@/lib/permissions");
    const sanitized = Array.from(new Set(data.permissions.filter((k) => ALL_PERMISSION_KEYS.includes(k))));

    const { error } = await supabaseAdmin
      .from("manager_permissions")
      .upsert(
        { user_id: data.user_id, permissions: sanitized, updated_by: userId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("notifications").insert({
      user_id: data.user_id,
      type: "permissions_changed",
      title: "Tes accès Manager ont été mis à jour",
      body: `${sanitized.length} section${sanitized.length > 1 ? "s" : ""} accessible${sanitized.length > 1 ? "s" : ""}.`,
      priority: "normal",
      category: "account",
    });

    return { ok: true, permissions: sanitized };
  });
