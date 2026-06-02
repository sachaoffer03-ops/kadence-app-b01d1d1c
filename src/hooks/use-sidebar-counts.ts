import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface SidebarCounts {
  trous: number;
  notifications: number;
  demandes: number;
  signalements: number;
  feedbacks: number;
}

const ZERO: SidebarCounts = { trous: 0, notifications: 0, demandes: 0, signalements: 0, feedbacks: 0 };

export function useSidebarCounts(): SidebarCounts {
  const { user } = useAuth();
  const [counts, setCounts] = useState<SidebarCounts>(ZERO);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [trous, notifs, demandes, signalements, feedbacks] = await Promise.all([
        supabase.from("shifts").select("id", { count: "exact", head: true })
          .is("user_id", null).gte("shift_date", today),
        user?.id
          ? supabase.from("notifications").select("id", { count: "exact", head: true })
              .eq("user_id", user.id).is("read_at", null)
          : Promise.resolve({ count: 0 } as any),
        supabase.from("modification_requests").select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("signalements").select("id", { count: "exact", head: true })
          .eq("resolved", false),
        supabase.from("feedbacks").select("id", { count: "exact", head: true })
          .is("read_at", null),
      ]);
      setCounts({
        trous: trous.count ?? 0,
        notifications: notifs.count ?? 0,
        demandes: demandes.count ?? 0,
        signalements: signalements.count ?? 0,
        feedbacks: feedbacks.count ?? 0,
      });
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const debouncedLoad = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { load(); }, 300);
  }, [load]);

  useEffect(() => {
    load();
    let ch = supabase.channel("sidebar-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "modification_requests" }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "signalements" }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "feedbacks" }, debouncedLoad);
    if (user?.id) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, debouncedLoad);
    }
    ch.subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [load, debouncedLoad, user?.id]);

  return counts;
}
