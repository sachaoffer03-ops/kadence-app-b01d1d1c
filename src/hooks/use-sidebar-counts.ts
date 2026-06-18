import { useEffect, useState, useCallback, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
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

  // Rafraîchit à chaque navigation (changement d'URL)
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    load();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    if (user?.id) {
      ch = supabase.channel("sidebar-counts-" + Math.random().toString(36).slice(2, 10))
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, debouncedLoad);
      ch.subscribe();
    }
    // Polling raccourci à 20s + rafraîchit quand l'onglet redevient visible
    const interval = setInterval(() => { load(); }, 20_000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (ch) supabase.removeChannel(ch);
    };
  }, [load, debouncedLoad, user?.id, pathname]);

  return counts;
}
