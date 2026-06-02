import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTodayColleagues, type Colleague } from "@/lib/colleagues.functions";
import { supabase } from "@/integrations/supabase/client";

export function TodayColleaguesCard({ userId }: { userId: string }) {
  const fetchColleagues = useServerFn(getTodayColleagues);
  const [list, setList] = useState<Colleague[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchColleagues({ data: undefined as any });
        if (!cancelled) setList(data);
      } catch {
        if (!cancelled) setList([]);
      }
    };
    load();
    const ch = supabase
      .channel(`colleagues-${userId}-${Math.random().toString(36).slice(2, 10)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [userId, fetchColleagues]);

  if (!list || list.length === 0) return null;

  return (
    <div
      className="rounded-2xl mb-5"
      style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", padding: 16 }}
    >
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: 0.3 }}>
        Aujourd'hui avec toi
      </div>
      <div className="flex items-center gap-3 overflow-x-auto" style={{ paddingBottom: 2 }}>
        {list.map((c) => {
          const initial = (c.firstName.charAt(0) || "?").toUpperCase();
          return (
            <div key={c.userId + c.startTime} className="flex flex-col items-center" style={{ minWidth: 56 }}>
              <div
                className="rounded-full flex items-center justify-center overflow-hidden mb-1.5"
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: "var(--coral-light)",
                  border: "0.5px solid var(--coral)",
                  color: "var(--coral-dark)",
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  initial
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2, textAlign: "center" }}>
                {c.firstName}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>
                {c.startTime}–{c.endTime}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
