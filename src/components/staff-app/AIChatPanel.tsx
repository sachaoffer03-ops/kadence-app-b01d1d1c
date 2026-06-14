import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Mic, MicOff, ArrowRight, X } from "lucide-react";
import kadenceAvatar from "@/assets/kadence-avatar.png";
import ReactMarkdown from "react-markdown";
import { askKadenceAI, getChatHistory, getChatSuggestions } from "@/lib/ai-chat.functions";
import { useVoiceInput } from "@/hooks/use-voice-input";


type ChatActionType =
  | "open_dispos"
  | "open_signalement"
  | "open_planning"
  | "open_formation"
  | "open_proposals";

const ACTION_LABELS: Record<ChatActionType, string> = {
  open_dispos: "Déclarer mes dispos",
  open_signalement: "Faire un signalement",
  open_planning: "Voir mon planning",
  open_formation: "Voir mes formations",
  open_proposals: "Voir les propositions",
};

const VALID_ACTIONS = new Set<ChatActionType>(Object.keys(ACTION_LABELS) as ChatActionType[]);

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
  action?: ChatActionType | null;
  followups?: string[];
}

function parseAssistant(raw: string): { text: string; action: ChatActionType | null; followups: string[] } {
  let action: ChatActionType | null = null;
  let followups: string[] = [];
  let text = raw;

  const aMatch = text.match(/\[\[ACTION:([a-z_]+)\]\]/i);
  if (aMatch) {
    const t = aMatch[1].toLowerCase() as ChatActionType;
    if (VALID_ACTIONS.has(t)) action = t;
    text = text.replace(aMatch[0], "");
  }
  const fMatch = text.match(/\[\[FOLLOWUPS:([^\]]+)\]\]/i);
  if (fMatch) {
    followups = fMatch[1].split("|").map((s) => s.trim()).filter(Boolean).slice(0, 3);
    text = text.replace(fMatch[0], "");
  }
  return { text: text.trim(), action, followups };
}

function dispatchAction(type: ChatActionType) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("kadence:chat-action", { detail: { type } }));
}

export function AIChatPanel({ onClose }: { onClose?: () => void } = {}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const interimRef = useRef<string>("");

  const ask = useServerFn(askKadenceAI);
  const history = useServerFn(getChatHistory);
  const fetchSuggestions = useServerFn(getChatSuggestions);

  const voice = useVoiceInput({
    onResult: (text, isFinal) => {
      if (isFinal) {
        const next = (interimRef.current + " " + text).trim();
        interimRef.current = next;
        setInput(next);
      } else {
        setInput((interimRef.current + " " + text).trim());
      }
    },
    onError: (msg) => toast.error(msg),
  });

  const refreshSuggestions = async () => {
    try {
      const r = await fetchSuggestions();
      setSuggestions(r.suggestions ?? []);
    } catch { /* noop */ }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await history();
        setMessages((r.messages ?? []).map((m: any) => {
          if (m.role === "assistant") {
            const p = parseAssistant(m.content);
            return { id: m.id, role: "assistant", content: p.text, action: p.action, followups: p.followups };
          }
          return { id: m.id, role: m.role, content: m.content };
        }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoaded(true);
      }
      refreshSuggestions();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    if (voice.listening) voice.stop();
    interimRef.current = "";
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
      const p = parseAssistant(r.answer);
      setMessages((prev) => prev.map((m) =>
        m.id === loadId ? { ...m, content: p.text, loading: false, action: p.action, followups: p.followups } : m
      ));
      refreshSuggestions();
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

  const toggleMic = () => {
    if (voice.listening) {
      voice.stop();
    } else {
      interimRef.current = input;
      voice.start();
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
            <img src={kadenceAvatar} alt="Kadence" style={{ width: 22, height: 22 }} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--foreground)" }}>Kadence Assistant</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Pose-moi tes questions sur tes shifts, ton score, tes formations…</div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-full flex items-center justify-center transition active:scale-95"
              style={{ width: 32, height: 32, backgroundColor: "var(--muted)", color: "var(--foreground)", flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>


      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {loaded && messages.length === 0 && suggestions.length > 0 && (
          <div className="flex flex-col gap-3 px-1 pt-2">
            <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Quelques idées pour commencer
            </div>
            {suggestions.map((s) => (
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

        {messages.map((m, idx) => {
          const mine = m.role === "user";
          const isLast = idx === messages.length - 1;
          return (
            <div key={m.id} className="flex flex-col gap-1.5">
              <div className={`flex ${mine ? "justify-end" : "justify-start"} gap-1.5 items-end`}>
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
                  whiteSpace: mine ? "pre-wrap" : "normal",
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

              {/* CTA action bouton */}
              {!mine && !m.loading && m.action && (
                <div className="flex justify-start pl-8">
                  <button
                    onClick={() => dispatchAction(m.action!)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 transition active:scale-95"
                    style={{
                      backgroundColor: "var(--coral)",
                      color: "var(--coral-text)",
                      fontSize: 12.5,
                      fontWeight: 500,
                    }}
                  >
                    {ACTION_LABELS[m.action]}
                    <ArrowRight size={13} strokeWidth={2.2} />
                  </button>
                </div>
              )}

              {/* Follow-ups (uniquement sous le dernier message assistant) */}
              {!mine && !m.loading && isLast && (m.followups?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-8 pt-0.5">
                  {m.followups!.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={sending}
                      className="rounded-full px-3 py-1.5 transition active:scale-95"
                      style={{
                        backgroundColor: "#fff",
                        border: "0.5px solid rgba(0,0,0,0.12)",
                        fontSize: 11.5,
                        color: "var(--foreground)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="px-3 pt-2 pb-3 flex items-end gap-2" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)", backgroundColor: "#FAF8F4" }}>
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); interimRef.current = e.target.value; }}
          onKeyDown={onKey}
          placeholder={voice.listening ? "Je t'écoute…" : "Pose ta question…"}
          rows={1}
          disabled={sending}
          className="flex-1 rounded-2xl px-4 py-2.5 outline-none resize-none"
          style={{ fontSize: 13, border: "0.5px solid rgba(0,0,0,0.12)", backgroundColor: "#fff", maxHeight: 120 }}
        />
        {voice.supported && (
          <button
            onClick={toggleMic}
            disabled={sending}
            aria-label={voice.listening ? "Arrêter le micro" : "Dicter"}
            className="rounded-full flex items-center justify-center disabled:opacity-40 transition active:scale-95"
            style={{
              width: 40,
              height: 40,
              backgroundColor: voice.listening ? "var(--coral)" : "#fff",
              color: voice.listening ? "var(--coral-text)" : "var(--foreground)",
              border: voice.listening ? "none" : "0.5px solid rgba(0,0,0,0.12)",
              flexShrink: 0,
              animation: voice.listening ? "kadence-pulse 1.2s ease-in-out infinite" : undefined,
            }}>
            {voice.listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
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
  s.textContent = `
    @keyframes kadence-bounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-4px);opacity:1} }
    @keyframes kadence-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(240,153,123,0.6)} 50%{box-shadow:0 0 0 6px rgba(240,153,123,0)} }
  `;
  document.head.appendChild(s);
}
