// Server-only helpers for formation
export async function assertAdminOrManager(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Réservé aux admins et managers");
}
