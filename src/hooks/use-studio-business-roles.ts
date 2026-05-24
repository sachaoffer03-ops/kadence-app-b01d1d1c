// Hook : rôles métier ACTIFS configurés pour UN studio précis.
// Source : intersection entre `studio_business_roles` (liens) et
// `business_roles` (catalogue global). Re-fetch quand studioId change.
// Réagit aussi aux changements globaux du catalogue via useBusinessRoles.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessRoles, type BusinessRoleRow } from "@/hooks/use-business-roles";

export function useStudioBusinessRoles(studioId: string | null) {
  const { roles: allRoles } = useBusinessRoles({ onlyActive: true });
  const [linkedNames, setLinkedNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!studioId) { setLinkedNames([]); return; }
    setLoading(true);
    supabase
      .from("studio_business_roles")
      .select("role")
      .eq("studio_id", studioId)
      .then(({ data }) => {
        if (cancelled) return;
        setLinkedNames((data ?? []).map((r: any) => r.role));
        setLoading(false);
      });

    const channel = supabase
      .channel(`studio_business_roles_${studioId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "studio_business_roles", filter: `studio_id=eq.${studioId}` },
        () => {
          supabase
            .from("studio_business_roles")
            .select("role")
            .eq("studio_id", studioId)
            .then(({ data }) => {
              if (!cancelled) setLinkedNames((data ?? []).map((r: any) => r.role));
            });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [studioId]);

  const set = new Set(linkedNames);
  const roles: BusinessRoleRow[] = allRoles
    .filter((r) => set.has(r.name))
    .sort((a, b) => a.position - b.position);

  return {
    roles,
    names: roles.map((r) => r.name),
    isLoading: loading,
  };
}
