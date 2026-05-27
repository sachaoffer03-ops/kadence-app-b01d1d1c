import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Bot, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { askKadenceAI, getChatHistory } from "@/lib/ai-chat.functions";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
}

const SUGGESTIONS = [
  "Quand est mon prochain shift ?",
  "Comment fonctionne le scoring ?",
  "Quelles formations je dois encore valider ?",
];

export function AIChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = useServerFn(askKadenceAI);
  const history = useServerFn(getChatHistory);

  useEffect(() => {
    (async () => {
      try {
        const r = await history();
        setMessages((r.messages ?? []).map((m: any) => ({
          id: m.id, role: m.role, content: m.content,
        })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoaded(true);
      }
    })();
  }, [history]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    setSending(true);
    setInput("");
    const userId = `tmp-u-${Date.now()}`;
    const loadId = `tmp-a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: q },
      { id: loadId, role: "assistant", content: "…", loading: true },
    ]);
    try {
      const r = await ask({ data: { question: q } });
      setMessages((prev) => prev.map((m) =>
        m.id === loadId ? { ...m, content: r.answer, loading: false } : m
      ));
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== loadId && m.id !== userId));
      toast.error(e?.message || "Erreur de l'assistant");
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div
      className="flex flex-col fixed left-1/2 -translate-x-1/2"
      style={{
        top: 0,
        bottom: "calc(80px + env(safe-area-inset-bottom))",
        width: "100%",
        maxWidth: 430,
        backgroundColor: "#FAF8F4",
        zIndex: 20,
      }}
    >

      {/* Header */}
      <div className="px-4 pt-5 pb-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)", backgroundColor: "#fff" }}>
        <div className="flex items-center gap-2.5">
          <div className="rounded-full flex items-center justify-center" style={{ width: 36, height: 36, backgroundColor: "var(--coral)" }}>
            <Bot size={18} color="var(--coral-text)" strokeWidth={1.8} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--foreground)" }}>Kadence Assistant</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Pose-moi tes questions sur tes shifts, ton score, tes formations…</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {loaded && messages.length === 0 && (
          <div className="flex flex-col gap-3 px-1 pt-2">
            <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              <Sparkles size={13} /> Quelques idées pour commencer
            </div>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)}
                className="text-left rounded-2xl px-4 py-3 transition active:scale-[0.98]"
                style={{
                  backgroundColor: "#fff",
                  border: "0.5px solid rgba(0,0,0,0.08)",
                  fontSize: 13,
                  color: "var(--foreground)",
                }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m) => {
          const mine = m.role === "user";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} gap-1.5 items-end`}>
              {!mine && (
                <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 24, height: 24, backgroundColor: "var(--coral)" }}>
                  <Bot size={13} color="var(--coral-text)" strokeWidth={2} />
                </div>
              )}
              <div className="rounded-2xl px-3.5 py-2.5" style={{
                maxWidth: "78%",
                fontSize: 13,
                lineHeight: 1.45,
                backgroundColor: mine ? "var(--coral)" : "#fff",
                color: mine ? "var(--coral-text)" : "var(--foreground)",
                border: mine ? "none" : "0.5px solid rgba(0,0,0,0.08)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                opacity: m.loading ? 0.7 : 1,
              }}>
                {m.loading ? <TypingDots /> : (
                  mine ? m.content : (
                    <div className="kadence-md">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
                          ul: ({ children }) => <ul style={{ margin: "4px 0 8px", paddingLeft: 18 }}>{children}</ul>,
                          ol: ({ children }) => <ol style={{ margin: "4px 0 8px", paddingLeft: 18 }}>{children}</ol>,
                          li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
                          strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: "var(--coral)", textDecoration: "underline" }}>{children}</a>,
                          code: ({ children }) => <code style={{ backgroundColor: "rgba(0,0,0,0.05)", padding: "1px 4px", borderRadius: 4, fontSize: 12 }}>{children}</code>,
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="px-3 pt-2 pb-3 flex items-end gap-2" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)", backgroundColor: "#FAF8F4" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Pose ta question…"
          rows={1}
          disabled={sending}
          className="flex-1 rounded-2xl px-4 py-2.5 outline-none resize-none"
          style={{ fontSize: 13, border: "0.5px solid rgba(0,0,0,0.12)", backgroundColor: "#fff", maxHeight: 120 }}
        />
        <button onClick={() => send(input)} disabled={!input.trim() || sending}
          className="rounded-full flex items-center justify-center disabled:opacity-40 transition active:scale-95"
          style={{ width: 40, height: 40, backgroundColor: "var(--coral)", color: "var(--coral-text)", flexShrink: 0 }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center" style={{ height: 16 }}>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </span>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span style={{
      width: 5, height: 5, borderRadius: "50%",
      backgroundColor: "var(--muted-foreground)",
      animation: "kadence-bounce 1s infinite",
      animationDelay: `${delay}ms`,
      display: "inline-block",
    }} />
  );
}

// inline keyframes once
if (typeof document !== "undefined" && !document.getElementById("kadence-bounce-style")) {
  const s = document.createElement("style");
  s.id = "kadence-bounce-style";
  s.textContent = `@keyframes kadence-bounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-4px);opacity:1} }`;
  document.head.appendChild(s);
}
