import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StaffNotifKind = "shift" | "request" | "message";

export interface StaffNotif {
  id: string;
  kind: StaffNotifKind;
  title: string;
  body: string;
  date: string; // ISO
  read: boolean;
}

const lastSeenKey = (uid: string) => `staff-notif-lastseen:${uid}`;

function fmtShiftDate(iso: string, start?: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return start ? `${date} · ${start.slice(0, 5)}` : date;
}

export function useStaffNotifications(userId: string | undefined) {
  const [items, setItems] = useState<StaffNotif[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    if (!userId) return 0;
    return Number(localStorage.getItem(lastSeenKey(userId)) || 0);
  });

  const load = useCallback(async () => {
    if (!userId) return;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: shifts }, { data: reqs }, { data: msgs }] = await Promise.all([
      supabase.from("shifts")
        .select("id,shift_date,start_time,business_role,created_at,updated_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("modification_requests")
        .select("id,type,status,admin_response,resolved_at,shift_id")
        .eq("user_id", userId)
        .not("resolved_at", "is", null)
        .order("resolved_at", { ascending: false })
        .limit(20),
      supabase.from("messages")
        .select("id,sender_id,content,created_at,read_at")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const seenAt = Number(localStorage.getItem(lastSeenKey(userId)) || 0);
    const list: StaffNotif[] = [];

    (shifts || []).forEach((s) => {
      const ts = new Date(s.created_at).getTime();
      list.push({
        id: `shift-${s.id}`,
        kind: "shift",
        title: "Planning généré",
        body: `Nouveau shift ${fmtShiftDate(s.shift_date, s.start_time)} · ${s.business_role}`,
        date: s.created_at,
        read: ts <= seenAt,
      });
    });

    (reqs || []).forEach((r) => {
      const accepted = r.status === "accepted";
      list.push({
        id: `req-${r.id}`,
        kind: "request",
        title: accepted ? "Demande acceptée" : "Demande refusée",
        body: r.admin_response || (accepted ? "L'admin a validé ta demande." : "L'admin a refusé ta demande."),
        date: r.resolved_at!,
        read: new Date(r.resolved_at!).getTime() <= seenAt,
      });
    });

    (msgs || []).forEach((m) => {
      const c = m.content ?? "";
      list.push({
        id: `msg-${m.id}`,
        kind: "message",
        title: "Nouveau message",
        body: c.length > 90 ? c.slice(0, 90) + "…" : (c || "Pièce jointe"),
        date: m.created_at,
        read: !!m.read_at || new Date(m.created_at).getTime() <= seenAt,
      });
    });

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(list.slice(0, 30));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();

    const ch = supabase.channel(`staff-notif-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `user_id=eq.${userId}` }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "modification_requests", filter: `user_id=eq.${userId}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` }, load)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const markAllRead = useCallback(() => {
    if (!userId) return;
    const now = Date.now();
    localStorage.setItem(lastSeenKey(userId), String(now));
    setLastSeen(now);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [userId]);

  return { items, unread, markAllRead, lastSeen };
}
