// Helper serveur — vérifie qu'un manager possède la permission requise.
// Admin → toujours OK. Employee → toujours rejeté.
// À utiliser dans tous les server functions admin sensibles.

export async function assertManagerPermission(
  supabase: any,
  userId: string,
  permissionKey: string,
): Promise<void> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const rs = (roles ?? []).map((r: any) => r.role as string);
  if (rs.includes("admin")) return;
  if (!rs.includes("manager")) {
    throw new Error("Accès refusé : compte non autorisé");
  }
  const { data: mp } = await supabase
    .from("manager_permissions")
    .select("permissions")
    .eq("user_id", userId)
    .maybeSingle();
  const perms: string[] = (mp?.permissions as string[] | null) ?? [];
  if (!perms.includes(permissionKey)) {
    throw new Error(`Permission manquante : ${permissionKey}`);
  }
}
