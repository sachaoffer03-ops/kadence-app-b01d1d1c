import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the live permission list for the current manager.
 * - admin → returns null (means "all access").
 * - manager → array of permission keys (route prefixes). [] = no access.
 * - employee/unauth → returns [].
 * Updates in real time via Supabase Realtime.
 */
export function useMyManagerPermissions(
  userId: string | undefined,
  appRole: "admin" | "manager" | "employee" | null,
): { permissions: string[] | null; loading: boolean } {
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!userId || !appRole) {
      setPermissions(appRole === "admin" ? null : []);
      setLoading(false);
      return;
    }
    if (appRole === "admin") {
      setPermissions(null);
      setLoading(false);
      return;
    }
    if (appRole !== "manager") {
      setPermissions([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from("manager_permissions")
        .select("permissions")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      setPermissions((data?.permissions as string[] | null) ?? []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`manager_perms_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "manager_permissions", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId, appRole]);

  return { permissions, loading };
}
