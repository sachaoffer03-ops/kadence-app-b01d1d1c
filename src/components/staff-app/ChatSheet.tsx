import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Sheet } from "./shared";

interface Msg {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  meId: string;
  peerId: string;
  peerName: string;
  title?: string;
}

export function ChatSheet({ open, onClose, meId, peerId, peerName, title }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !meId || !peerId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.from("messages")
        .select("id,sender_id,recipient_id,content,read_at,created_at")
        .or(`and(sender_id.eq.${meId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${meId})`)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      setMessages((data as Msg[]) || []);
      // Marquer comme lus les messages reçus
      const toRead = (data as Msg[] | null)?.filter(m => m.recipient_id === meId && !m.read_at).map(m => m.id) || [];
      if (toRead.length > 0) {
        await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", toRead);
      }
    };
    load();

    const channel = supabase.channel(`messages-${meId}-${peerId}`)
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
  }, [open, meId, peerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const send = async () => {
    const txt = input.trim();
    if (!txt || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: meId, recipient_id: peerId, content: txt,
    });
    setSending(false);
    if (error) { toast.error("Échec de l'envoi"); return; }
    setInput("");
  };

  return (
    <Sheet open={open} onClose={onClose} title={title || `Conversation avec ${peerName}`}>
      <div ref={scrollRef} className="flex flex-col gap-2" style={{ minHeight: 320 }}>
        {messages.length === 0 && (
          <div className="text-center py-8" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Aucun message pour l'instant. Écris ton premier message ci-dessous.
          </div>
        )}
        {messages.map(m => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="rounded-2xl px-3.5 py-2" style={{
                maxWidth: "78%",
                fontSize: 13,
                lineHeight: 1.4,
                backgroundColor: mine ? "var(--coral)" : "#fff",
                color: mine ? "var(--coral-text)" : "var(--foreground)",
                border: mine ? "none" : "0.5px solid rgba(0,0,0,0.08)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {m.content}
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3 }}>
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-end gap-2 mt-3 sticky bottom-0 pt-2" style={{ backgroundColor: "#FAF8F4" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Écris un message…"
          rows={1}
          className="flex-1 rounded-xl px-3 py-2.5 outline-none resize-none"
          style={{ fontSize: 13, border: "0.5px solid rgba(0,0,0,0.12)", backgroundColor: "#fff", maxHeight: 120 }}
        />
        <button onClick={send} disabled={!input.trim() || sending}
          className="rounded-full flex items-center justify-center disabled:opacity-50"
          style={{ width: 40, height: 40, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
          <Send size={16} />
        </button>
      </div>
    </Sheet>
  );
}
