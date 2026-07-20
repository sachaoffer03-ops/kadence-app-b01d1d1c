import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import {
  getTodayColleagues,
  type Colleague,
  type ShiftRelay,
} from "@/lib/colleagues.functions";
import { supabase } from "@/integrations/supabase/client";

function Avatar({ c, size = 40 }: { c: Colleague; size?: number }) {
  const initial = (c.firstName.charAt(0) || "?").toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: "var(--coral-light)",
        border: "0.5px solid var(--coral)",
        color: "var(--coral-dark)",
        fontSize: Math.round(size * 0.36),
        fontWeight: 500,
      }}
    >
      {c.avatarUrl ? (
        <img src={c.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initial
      )}
    </div>
  );
}

export function TodayColleaguesCard({ userId }: { userId: string }) {
  const fetchColleagues = useServerFn(getTodayColleagues);
  const [colleagues, setColleagues] = useState<Colleague[] | null>(null);
  const [relays, setRelays] = useState<ShiftRelay[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchColleagues({ data: undefined as any });
        if (!cancelled) {
          setColleagues(data.colleagues);
          setRelays(data.relays);
        }
      } catch {
        if (!cancelled) {
          setColleagues([]);
          setRelays([]);
        }
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

  const hasRelay = relays.some((r) => r.before || r.after);
  const hasColleagues = !!colleagues && colleagues.length > 0;
  if (!hasColleagues && !hasRelay) return null;

  return (
    <div
      className="rounded-2xl mb-5"
      style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", padding: 16 }}
    >
      {hasColleagues && (
        <>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: 0.3 }}>
            Aujourd'hui avec toi
          </div>
          <div className="flex items-center gap-3 overflow-x-auto" style={{ paddingBottom: 2 }}>
            {colleagues!.map((c) => (
              <div key={c.userId + c.startTime} className="flex flex-col items-center" style={{ minWidth: 56 }}>
                <Avatar c={c} size={44} />
                <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2, textAlign: "center", marginTop: 6 }}>
                  {c.firstName}
                </div>
                <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>
                  {c.startTime}–{c.endTime}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {hasRelay && (
        <>
          {hasColleagues && (
            <div
              style={{
                height: 1,
                backgroundColor: "rgba(0,0,0,0.06)",
                marginTop: 16,
                marginBottom: 14,
              }}
            />
          )}
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10, letterSpacing: 0.3 }}>
            Relais du poste
          </div>
          <div className="flex flex-col gap-3">
            {relays.map((r, i) => (
              <div key={i} className="flex flex-col gap-2">
                {relays.length > 1 && (
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                    {r.businessRole} · {r.myStart}–{r.myEnd}
                  </div>
                )}
                {r.before && (
                  <div className="flex items-center gap-2.5">
                    <Avatar c={r.before} size={32} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 12, fontWeight: 500 }}>
                        Avant toi · {r.before.firstName}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>
                        finit à {r.before.endTime}
                      </div>
                    </div>
                  </div>
                )}
                {r.after && (
                  <div className="flex items-center gap-2.5">
                    <Avatar c={r.after} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 500 }}>
                        <ArrowRight size={11} style={{ color: "var(--coral-dark)" }} />
                        Après toi · {r.after.firstName}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>
                        démarre à {r.after.startTime}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
