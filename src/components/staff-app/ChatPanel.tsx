import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, MessageCircle } from "lucide-react";

interface Msg {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface Props {
  meId: string;
  peerId: string | null;
  peerName: string;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return "Aujourd'hui";
  if (target.getTime() === yest.getTime()) return "Hier";
  return target.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function ChatPanel({ meId, peerId, peerName }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!meId || !peerId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.from("messages")
        .select("id,sender_id,recipient_id,content,read_at,created_at")
        .or(`and(sender_id.eq.${meId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${meId})`)
        .order("created_at", { ascending: true })
        .limit(500);
      if (cancelled) return;
      setMessages((data as Msg[]) || []);
      const toRead = (data as Msg[] | null)?.filter(m => m.recipient_id === meId && !m.read_at).map(m => m.id) || [];
      if (toRead.length > 0) {
        await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", toRead);
      }
    };
    load();

    const channel = supabase.channel(`messages-tab-${meId}-${peerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Msg;
        if ((m.sender_id === meId && m.recipient_id === peerId) || (m.sender_id === peerId && m.recipient_id === meId)) {
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
          if (m.recipient_id === meId) {
            supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id).then(() => {});
          }
        }
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [meId, peerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  // Grouper les messages par jour
  const grouped = useMemo(() => {
    const out: { day: string; items: Msg[] }[] = [];
    for (const m of messages) {
      const k = m.created_at.slice(0, 10);
      const last = out[out.length - 1];
      if (last && last.day === k) last.items.push(m);
      else out.push({ day: k, items: [m] });
    }
    return out;
  }, [messages]);

  const send = async () => {
    const txt = input.trim();
    if (!txt || sending || !peerId) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: meId, recipient_id: peerId, content: txt,
    });
    setSending(false);
    if (error) { toast.error("Échec de l'envoi"); return; }
    setInput("");
  };

  const peerInitials = initialsOf(peerName);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)", backgroundColor: "#FAF8F4" }}>
      {/* Header conversation */}
      <div
        className="flex items-center gap-3 px-5 shrink-0"
        style={{
          paddingTop: 56,
          paddingBottom: 14,
          borderBottom: "0.5px solid rgba(0,0,0,0.06)",
          backgroundColor: "#FAF8F4",
        }}
      >
        <div
          className="rounded-full flex items-center justify-center shrink-0"
          style={{
            width: 42, height: 42,
            backgroundColor: "var(--coral-light)",
            border: "0.5px solid var(--coral)",
            color: "var(--coral-dark)",
            fontSize: 13, fontWeight: 500,
          }}
        >
          {peerInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.2 }}>{peerName}</div>
          <div className="flex items-center gap-1.5" style={{ marginTop: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "var(--success-text, #4A7C59)" }} />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Administrateur · répond en général dans la journée</span>
          </div>
        </div>
      </div>

      {!peerId ? (
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <div>
            <div
              className="rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ width: 56, height: 56, backgroundColor: "rgba(0,0,0,0.04)" }}
            >
              <MessageCircle size={22} strokeWidth={1.5} style={{ color: "var(--muted-foreground)" }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucun administrateur disponible</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              La conversation s'activera dès qu'un admin sera assigné à ton studio.
            </div>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center text-center px-2" style={{ paddingTop: 48 }}>
                <div
                  className="rounded-full flex items-center justify-center mb-4"
                  style={{
                    width: 64, height: 64,
                    backgroundColor: "var(--coral-light)",
                    border: "0.5px solid rgba(240,153,123,0.4)",
                  }}
                >
                  <MessageCircle size={26} strokeWidth={1.5} style={{ color: "var(--coral-dark)" }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
                  Démarre la conversation
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.55, maxWidth: 280 }}>
                  Signale ce qui manque, demande une info ou pose une question.
                  Ton admin verra ton message en temps réel.
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {grouped.map((g) => (
                  <div key={g.day} className="flex flex-col gap-1">
                    <div
                      className="self-center rounded-full px-3 py-1 my-2"
                      style={{
                        fontSize: 10,
                        color: "var(--muted-foreground)",
                        backgroundColor: "rgba(0,0,0,0.04)",
                        textTransform: "capitalize",
                      }}
                    >
                      {dayLabel(g.day)}
                    </div>
                    {g.items.map((m, i) => {
                      const mine = m.sender_id === meId;
                      const prev = g.items[i - 1];
                      const groupedWithPrev = prev && (prev.sender_id === m.sender_id) &&
                        (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 2 * 60 * 1000);
                      const next = g.items[i + 1];
                      const groupedWithNext = next && (next.sender_id === m.sender_id) &&
                        (new Date(next.created_at).getTime() - new Date(m.created_at).getTime() < 2 * 60 * 1000);
                      return (
                        <div
                          key={m.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          style={{ marginTop: groupedWithPrev ? 2 : 8 }}
                        >
                          <div className="flex flex-col" style={{ maxWidth: "78%", alignItems: mine ? "flex-end" : "flex-start" }}>
                            <div
                              className="px-4 py-2.5"
                              style={{
                                fontSize: 13.5,
                                lineHeight: 1.45,
                                backgroundColor: mine ? "var(--coral)" : "#fff",
                                color: mine ? "var(--coral-text)" : "var(--foreground)",
                                border: mine ? "none" : "0.5px solid rgba(0,0,0,0.06)",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                borderRadius: 18,
                                borderTopRightRadius: mine && groupedWithPrev ? 6 : 18,
                                borderBottomRightRadius: mine && groupedWithNext ? 6 : 18,
                                borderTopLeftRadius: !mine && groupedWithPrev ? 6 : 18,
                                borderBottomLeftRadius: !mine && groupedWithNext ? 6 : 18,
                                boxShadow: mine ? "none" : "0 1px 2px rgba(0,0,0,0.03)",
                              }}
                            >
                              {m.content}
                            </div>
                            {!groupedWithNext && (
                              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 3, paddingLeft: mine ? 0 : 4, paddingRight: mine ? 4 : 0 }}>
                                {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                {mine && m.read_at && <span style={{ marginLeft: 4 }}>· Lu</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div
            className="flex items-end gap-2 px-4 py-3 shrink-0"
            style={{
              borderTop: "0.5px solid rgba(0,0,0,0.06)",
              backgroundColor: "#FAF8F4",
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            }}
          >
            <div
              className="flex-1 flex items-end"
              style={{
                backgroundColor: "#fff",
                borderRadius: 22,
                border: "0.5px solid rgba(0,0,0,0.08)",
                paddingLeft: 16,
                paddingRight: 8,
                paddingTop: 6,
                paddingBottom: 6,
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Écris un message…"
                rows={1}
                className="flex-1 outline-none resize-none bg-transparent"
                style={{ fontSize: 13.5, lineHeight: 1.45, maxHeight: 120, paddingTop: 6, paddingBottom: 6 }}
              />
            </div>
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="rounded-full flex items-center justify-center transition-opacity disabled:opacity-30"
              style={{
                width: 44, height: 44,
                backgroundColor: "var(--coral)",
                color: "var(--coral-text)",
                flexShrink: 0,
              }}
              aria-label="Envoyer"
            >
              <Send size={17} strokeWidth={2} style={{ marginLeft: -1 }} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
