import { useEffect, useState, useCallback, useRef } from "react";
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
  internal_notes?: string | null;
  has_kitchen: boolean;
  opening_hours: DayHours[];
  role_hours: Record<string, RoleSchedule>;
  created_at: string;
  // Pointage / QR
  geofencing_enabled?: boolean;
  geofencing_radius_m?: number;
  lat?: number | null;
  lng?: number | null;
  clock_in_grace_period_min?: number;
  clock_out_grace_period_min?: number;
  clock_out_button_appears_before_min?: number;
  qr_renewal_seconds?: number;
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
  const channelId = useRef(`studios-list-${Math.random().toString(36).slice(2)}`);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("studios")
      .select("id, name, created_at, address, city, postal_code, phone, opening_hours, capacity, color, description, short_name, has_kitchen, manager_id, deleted_at, email, surface_m2, opened_at, role_hours, manager_name, clock_out_button_appears_before_min, clock_out_grace_period_min, clock_out_overdue_action, qr_renewal_seconds, qr_display_support, geofencing_enabled, geofencing_radius_m, clock_in_grace_period_min")
      .order("created_at", { ascending: true });
    if (!error && data) setStudios(data.map(normalize));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const ch = supabase
      .channel(channelId.current)
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
    .select("id, name, created_at, address, city, postal_code, phone, opening_hours, capacity, color, description, short_name, has_kitchen, manager_id, deleted_at, email, surface_m2, opened_at, role_hours, manager_name, clock_out_button_appears_before_min, clock_out_grace_period_min, clock_out_overdue_action, qr_renewal_seconds, qr_display_support, geofencing_enabled, geofencing_radius_m, clock_in_grace_period_min")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function updateStudio(id: string, patch: Partial<StudioRow>): Promise<void> {
  const { error } = await supabase.from("studios").update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function softDeleteStudio(id: string): Promise<{ ok: boolean; blockers?: any; report?: any }> {
  // Suppression complète (hard delete) : efface toutes les données liées partout
  const { data, error } = await supabase.rpc("force_delete_studio" as any, { _studio_id: id });
  if (error) throw error;
  return { ok: true, report: data };
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
