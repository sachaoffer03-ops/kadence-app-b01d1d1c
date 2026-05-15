import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StaffAdjustment {
  role: string;
  delta: number;
}

export type ExceptionType = "fermeture" | "evenement" | "ajustement";

export interface StudioException {
  id: string;
  studio_id: string;
  exception_date: string; // YYYY-MM-DD
  exception_type: ExceptionType;
  title: string;
  description: string | null;
  staff_adjustments: StaffAdjustment[];
  created_at: string;
}

function normalize(row: any): StudioException {
  return {
    ...row,
    staff_adjustments: Array.isArray(row.staff_adjustments) ? row.staff_adjustments : [],
  };
}

export function useStudioExceptions(studioId: string | null) {
  const [exceptions, setExceptions] = useState<StudioException[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!studioId) {
      setExceptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("studio_exceptions" as any)
      .select("*")
      .eq("studio_id", studioId)
      .order("exception_date", { ascending: true });
    setExceptions((data ?? []).map(normalize));
    setLoading(false);
  }, [studioId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { exceptions, loading, reload };
}

export async function createException(input: Omit<StudioException, "id" | "created_at">) {
  const { error } = await supabase.from("studio_exceptions" as any).insert(input as any);
  if (error) throw error;
}

export async function updateException(id: string, patch: Partial<StudioException>) {
  const { error } = await supabase
    .from("studio_exceptions" as any)
    .update(patch as any)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteException(id: string) {
  const { error } = await supabase.from("studio_exceptions" as any).delete().eq("id", id);
  if (error) throw error;
}
