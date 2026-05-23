import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin uniquement");
}

export const linkAllEmployeesToAllStudios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    await assertAdmin(supabase, userId);

    // All active (non-deleted) studios, including those with 0 current links
    const { data: studios } = await supabaseAdmin
      .from("studios")
      .select("id, name")
      .is("deleted_at", null);

    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((adminRoles ?? []).map((r: any) => r.user_id));

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("status", "active");
    const employees = (profiles ?? []).filter((p: any) => !adminIds.has(p.id));

    let added = 0;
    for (const emp of employees) {
      const { data: existing } = await supabaseAdmin
        .from("user_studios")
        .select("studio_id")
        .eq("user_id", emp.id);
      const existingSet = new Set((existing ?? []).map((r: any) => r.studio_id));
      const missing = (studios ?? []).filter((s: any) => !existingSet.has(s.id));
      if (missing.length > 0) {
        await supabaseAdmin
          .from("user_studios")
          .insert(missing.map((s: any) => ({ user_id: emp.id, studio_id: s.id })));
        added += missing.length;
      }
    }
    return { employees: employees.length, links_added: added, studios: (studios ?? []).length };
  });

export const giveAllRolesToAllEmployees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    await assertAdmin(supabase, userId);

    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((adminRoles ?? []).map((r: any) => r.user_id));

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("status", "active");
    const employees = (profiles ?? []).filter((p: any) => !adminIds.has(p.id));

    const { data: rolesRows } = await supabaseAdmin
      .from("business_roles")
      .select("name")
      .eq("is_active", true);
    const allRoles = (rolesRows ?? []).map((r: any) => r.name);

    let added = 0;
    for (const emp of employees) {
      const { data: existing } = await supabaseAdmin
        .from("user_business_roles")
        .select("role")
        .eq("user_id", emp.id);
      const existingSet = new Set((existing ?? []).map((r: any) => r.role));
      const missing = allRoles.filter((r) => !existingSet.has(r));
      if (missing.length > 0) {
        await supabaseAdmin
          .from("user_business_roles")
          .insert(missing.map((role) => ({ user_id: emp.id, role })));
        added += missing.length;
      }
    }
    return { employees: employees.length, roles_added: added, roles_total: allRoles.length };
  });
