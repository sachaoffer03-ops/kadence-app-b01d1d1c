// Server-only helpers for formation
export async function assertAdminOrManager(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Réservé aux admins et managers");
}

// Studios d'un utilisateur (multi-studios + studio principal du profil)
export async function getUserStudioIds(supabase: any, uid: string): Promise<Set<string>> {
  const [{ data: us }, { data: prof }] = await Promise.all([
    supabase.from("user_studios").select("studio_id").eq("user_id", uid),
    supabase.from("profiles").select("studio_id").eq("id", uid).maybeSingle(),
  ]);
  const set = new Set<string>(((us ?? []) as any[]).map((r: any) => r.studio_id));
  if ((prof as any)?.studio_id) set.add((prof as any).studio_id);
  return set;
}

// Map course_id -> studios ciblés (absent/vide = tous les studios)
export async function getCourseStudiosMap(supabase: any): Promise<Map<string, Set<string>>> {
  const { data } = await supabase.from("training_course_studios").select("course_id, studio_id");
  const map = new Map<string, Set<string>>();
  for (const row of ((data ?? []) as any[])) {
    if (!map.has(row.course_id)) map.set(row.course_id, new Set());
    map.get(row.course_id)!.add(row.studio_id);
  }
  return map;
}

export function courseMatchesStudios(courseStudios: Set<string> | undefined, userStudios: Set<string>) {
  if (!courseStudios || courseStudios.size === 0) return true;
  for (const s of userStudios) if (courseStudios.has(s)) return true;
  return false;
}

