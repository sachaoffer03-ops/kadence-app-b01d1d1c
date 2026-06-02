import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const dismissedKey = (uid: string) => `staff-notif-dismissed:${uid}`;
const MAX_DISMISSED = 200;

// Safe localStorage wrappers — certains navigateurs mobiles (mode privé,
// stockage bloqué, quota) lèvent une exception ; on isole pour ne JAMAIS
// crasher l'arbre React au montage.
function safeGet(key: string): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch { return null; }
}
function safeSet(key: string, value: string) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch { /* ignore */ }
}

export type StaffNotifKind = "shift" | "request" | "message" | "proposal";

export interface StaffNotif {
  id: string;
  kind: StaffNotifKind;
  title: string;
  body: string;
  date: string; // ISO
  read: boolean;
  link?: string | null;
}

const lastSeenKey = (uid: string) => `staff-notif-lastseen:${uid}`;

function fmtShiftDate(iso: string, start?: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return start ? `${date} · ${start.slice(0, 5)}` : date;
}

function kindFromType(type: string | null | undefined): StaffNotifKind {
  const t = (type || "").toLowerCase();
  if (t.includes("proposal") || t.includes("proposition")) return "proposal";
  if (t.includes("message")) return "message";
  if (t.includes("request") || t.includes("demande") || t.includes("modification")) return "request";
  return "shift";
}

export function useStaffNotifications(userId: string | undefined) {
  const [items, setItems] = useState<StaffNotif[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    if (!userId) return 0;
    return Number(safeGet(lastSeenKey(userId)) || 0);
  });
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (!userId) return new Set<string>();
    try {
      return new Set<string>(JSON.parse(safeGet(dismissedKey(userId)) || "[]"));
    } catch {
      return new Set<string>();
    }
  });

  const load = useCallback(async () => {
    if (!userId) return;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: shifts }, { data: reqs }, { data: msgs }, { data: notifs }] = await Promise.all([
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
      supabase.from("notifications")
        .select("id, type, title, body, read_at, created_at, link")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const seenAt = Number(safeGet(lastSeenKey(userId)) || 0);
    let dismissedIds: Set<string>;
    try { dismissedIds = new Set<string>(JSON.parse(safeGet(dismissedKey(userId)) || "[]")); }
    catch { dismissedIds = new Set<string>(); }
    const list: StaffNotif[] = [];

    (shifts || []).forEach((s) => {
      const ts = new Date(s.created_at).getTime();
      const id = `shift-${s.id}`;
      if (dismissedIds.has(id)) return;
      list.push({
        id,
        kind: "shift",
        title: "Planning généré",
        body: `Nouveau shift ${fmtShiftDate(s.shift_date, s.start_time)} · ${s.business_role}`,
        date: s.created_at,
        read: ts <= seenAt,
        link: `/staff-app?tab=planning&shift=${s.id}`,
      });
    });

    (reqs || []).forEach((r: any) => {
      const accepted = r.status === "accepted";
      list.push({
        id: `req-${r.id}`,
        kind: "request",
        title: accepted ? "Demande acceptée" : "Demande refusée",
        body: r.admin_response || (accepted ? "L'admin a validé ta demande." : "L'admin a refusé ta demande."),
        date: r.resolved_at!,
        read: new Date(r.resolved_at!).getTime() <= seenAt,
        link: `/staff-app?tab=planning&request=${r.id}`,
      });
    });

    (msgs || []).forEach((m: any) => {
      const c = m.content ?? "";
      list.push({
        id: `msg-${m.id}`,
        kind: "message",
        title: "Nouveau message",
        body: c.length > 90 ? c.slice(0, 90) + "…" : (c || "Pièce jointe"),
        date: m.created_at,
        read: !!m.read_at || new Date(m.created_at).getTime() <= seenAt,
        link: m.sender_id ? `/staff-app?tab=chat&thread=${m.sender_id}` : "/staff-app?tab=chat",
      });
    });

    (notifs || []).forEach((n: any) => {
      const isDuplicate =
        (n.type === "shift_published" || n.type === "planning_published") &&
        list.some((existing) => existing.kind === "shift");
      if (isDuplicate) return;
      list.push({
        id: `notif-${n.id}`,
        kind: kindFromType(n.type),
        title: n.title || "Notification",
        body: n.body || "",
        date: n.created_at,
        read: !!n.read_at || new Date(n.created_at).getTime() <= seenAt,
        link: n.link || null,
      });
    });

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(list.slice(0, 30));
  }, [userId]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedLoad = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { load(); }, 250);
  }, [load]);

  // Track seen IDs to detect newly arrived notifs (after first load)
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  useEffect(() => {
    if (items.length === 0) return;
    if (!initializedRef.current) {
      items.forEach((n) => seenIdsRef.current.add(n.id));
      initializedRef.current = true;
      return;
    }
    items.forEach((n) => {
      if (!seenIdsRef.current.has(n.id)) {
        seenIdsRef.current.add(n.id);
        if (!n.read) {
          toast(n.title, { description: n.body || undefined });
          // Native browser notification (off-app alerts)
          try {
            if (typeof window !== "undefined"
                && "Notification" in window
                && Notification.permission === "granted"
                && document.visibilityState !== "visible") {
              const notif = new Notification(n.title, {
                body: n.body || undefined,
                icon: "/favicon.ico",
                tag: n.id,
              });
              notif.onclick = () => {
                window.focus();
                if (n.link) window.location.assign(n.link);
                notif.close();
              };
            }
          } catch {}
        }
      }
    });
  }, [items]);

  useEffect(() => {
    if (!userId) return;
    initializedRef.current = false;
    seenIdsRef.current = new Set();
    load();

    const ch = supabase.channel(`staff-notif-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `user_id=eq.${userId}` }, debouncedLoad)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "modification_requests", filter: `user_id=eq.${userId}` }, debouncedLoad)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` }, debouncedLoad)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, debouncedLoad)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [userId, load, debouncedLoad]);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = Date.now();
    safeSet(lastSeenKey(userId), String(now));
    setLastSeen(now);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
  }, [userId]);

  const dismissNotif = useCallback(async (id: string) => {
    if (!userId) return;
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      // Cap localStorage size: keep only the most recent MAX_DISMISSED ids
      const arr = [...next];
      const capped = arr.length > MAX_DISMISSED ? arr.slice(-MAX_DISMISSED) : arr;
      safeSet(dismissedKey(userId), JSON.stringify(capped));
      return new Set(capped);
    });
    setItems((prev) => prev.filter((n) => n.id !== id));
    // Marquer aussi comme lu côté DB si c'est une vraie notification
    if (id.startsWith("notif-")) {
      const dbId = id.replace("notif-", "");
      await supabase.from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", dbId)
        .eq("user_id", userId);
    }
  }, [userId]);

  return { items, unread, markAllRead, dismissNotif, lastSeen };
}
