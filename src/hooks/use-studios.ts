import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DayHours {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

export interface RoleSchedule {
  open: string;
  close: string;
}

export interface StudioRow {
  id: string;
  name: string;
  short_name: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  manager_id: string | null;
  manager_name: string | null;
  capacity: number | null;
  surface_m2: number | null;
  opened_at: string | null;
  internal_notes: string | null;
  has_kitchen: boolean;
  opening_hours: DayHours[];
  role_hours: Record<string, RoleSchedule>;
  created_at: string;
}

const DEFAULT_WEEK: DayHours[] = [
  { day: "Lundi", open: "08h00", close: "18h00", closed: false },
  { day: "Mardi", open: "08h00", close: "18h00", closed: false },
  { day: "Mercredi", open: "08h00", close: "18h00", closed: false },
  { day: "Jeudi", open: "08h00", close: "18h00", closed: false },
  { day: "Vendredi", open: "08h00", close: "18h00", closed: false },
  { day: "Samedi", open: "08h00", close: "18h00", closed: false },
  { day: "Dimanche", open: "08h00", close: "18h00", closed: false },
];

function normalize(row: any): StudioRow {
  const oh = Array.isArray(row.opening_hours) && row.opening_hours.length === 7
    ? row.opening_hours
    : DEFAULT_WEEK;
  return {
    ...row,
    opening_hours: oh,
    role_hours: row.role_hours ?? {},
  };
}

export function useStudios() {
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("studios")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) setStudios(data.map(normalize));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const ch = supabase
      .channel("studios-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "studios" }, () => reload())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [reload]);

  return { studios, loading, reload };
}

export async function createStudio(name: string, hasKitchen: boolean = false): Promise<StudioRow | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const short = trimmed.replace(/^Skult\s+/i, "");
  const { data, error } = await supabase
    .from("studios")
    .insert({
      name: trimmed,
      short_name: short || trimmed,
      has_kitchen: hasKitchen,
      opened_at: new Date().toISOString().slice(0, 10),
      opening_hours: DEFAULT_WEEK as any,
      role_hours: {} as any,
    })
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function updateStudio(id: string, patch: Partial<StudioRow>): Promise<void> {
  const { error } = await supabase.from("studios").update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function softDeleteStudio(id: string): Promise<{ ok: boolean; blockers?: any }> {
  // Vérifier les blockers via RPC existante
  const { data: blockers } = await supabase.rpc("studio_blockers", { _studio_id: id });
  const b: any = blockers ?? {};
  const totalBlock =
    (b.shifts ?? 0) +
    (b.staffing_templates ?? 0) +
    (b.profiles ?? 0) +
    (b.user_studios ?? 0) +
    (b.checklist_templates ?? 0) +
    (b.signalements ?? 0);
  if (totalBlock > 0) {
    return { ok: false, blockers: b };
  }
  const { error } = await supabase
    .from("studios")
    .update({ deleted_at: new Date().toISOString() } as any)
    .eq("id", id);
  if (error) throw error;
  return { ok: true };
}

// ----- studio_business_roles -----

export function useStudioBusinessRoles(studioId: string | null) {
  const [roles, setRoles] = useState<string[]>([]);

  const reload = useCallback(async () => {
    if (!studioId) {
      setRoles([]);
      return;
    }
    const { data } = await supabase
      .from("studio_business_roles" as any)
      .select("role")
      .eq("studio_id", studioId);
    setRoles((data ?? []).map((r: any) => r.role));
  }, [studioId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { roles, reload };
}

export async function addRoleToStudio(studioId: string, role: string) {
  const { error } = await supabase
    .from("studio_business_roles" as any)
    .insert({ studio_id: studioId, role });
  if (error && !String(error.message).includes("duplicate")) throw error;
}

export async function removeRoleFromStudio(studioId: string, role: string) {
  const { error } = await supabase
    .from("studio_business_roles" as any)
    .delete()
    .eq("studio_id", studioId)
    .eq("role", role);
  if (error) throw error;
}
