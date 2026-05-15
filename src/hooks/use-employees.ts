import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmployeeLite {
  id: string;
  firstName: string;
  lastName: string;
  contract: string | null;
  studioId: string | null;
  roles: string[];
  score: number;
  quotaUsed: number | null;
  quotaMax: number | null;
  punctuality: number;
  roleScores?: Record<string, number>;
}

/**
 * Hook DB-backed pour la liste des employés. Remplace l'import `employees` de mock-data.
 * Charge `profiles` + `user_business_roles` et expose une forme stable.
 */
export function useEmployees() {
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: ps }, { data: br }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,first_name,last_name,contract,studio_id,score,quota_used,quota_max")
          .neq("status", "archived"),
        supabase.from("user_business_roles").select("user_id,role"),
      ]);
      if (cancelled) return;
      const rolesByUser: Record<string, string[]> = {};
      (br ?? []).forEach((r: any) => {
        (rolesByUser[r.user_id] ||= []).push(r.role);
      });
      const list: EmployeeLite[] = (ps ?? []).map((p: any) => ({
        id: p.id,
        firstName: p.first_name ?? "",
        lastName: p.last_name ?? "",
        contract: p.contract,
        studioId: p.studio_id,
        roles: rolesByUser[p.id] ?? [],
        score: typeof p.score === "number" ? Number(p.score) : 7,
        quotaUsed: p.quota_used !== null ? Number(p.quota_used) : null,
        quotaMax: p.quota_max !== null ? Number(p.quota_max) : null,
        punctuality: typeof p.score === "number" ? Number(p.score) : 7,
      }));
      setEmployees(list);
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel("use-employees")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_business_roles" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { employees, loading };
}
