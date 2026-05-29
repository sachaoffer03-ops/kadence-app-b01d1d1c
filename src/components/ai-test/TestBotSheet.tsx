import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Bot, X, Sparkles, ThumbsUp, ThumbsDown, Pencil, Trash2, UserCircle2, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { askKadenceAI, getChatHistory } from "@/lib/ai-chat.functions";
import { rateMessage, deleteMessageFeedback, listEmployeesForTest } from "@/lib/ai-admin.functions";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
  feedback?: { rating: "up" | "down" | "correction"; comment?: string | null; corrected_answer?: string | null } | null;
};

type Employee = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null };

const SUGGESTIONS = [
  "Quand est mon prochain shift ?",
  "Comment fonctionne le scoring ?",
  "Explique-moi la deadline des dispos.",
  "Quels sont les rôles métier disponibles ?",
];

export function TestBotSheet({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<{ msgId: string; mode: "down" | "correction" } | null>(null);
  const [editText, setEditText] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [impersonateId, setImpersonateId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = useServerFn(askKadenceAI);
  const history = useServerFn(getChatHistory);
  const rate = useServerFn(rateMessage);
  const delFb = useServerFn(deleteMessageFeedback);
  const listEmp = useServerFn(listEmployeesForTest);

  const loadMessages = async () => {
    const r = await history({ data: { is_test: true } });
    const msgs = (r.messages ?? []) as any[];
    const ids = msgs.map((m) => m.id);
    let fbMap = new Map<string, any>();
    if (ids.length > 0) {
      const { data: fbs } = await supabase
        .from("ai_message_feedback")
        .select("message_id, rating, comment, corrected_answer")
        .in("message_id", ids);
      fbMap = new Map((fbs ?? []).map((f: any) => [f.message_id, f]));
    }
    setMessages(msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      feedback: fbMap.get(m.id) ?? null,
    })));
  };

  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    (async () => {
      try {
        await loadMessages();
        const e = await listEmp();
        setEmployees(e.employees ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    setSending(true);
    setInput("");
    const tmpUser = `tmp-u-${Date.now()}`;
    const tmpAsst = `tmp-a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tmpUser, role: "user", content: q },
      { id: tmpAsst, role: "assistant", content: "…", loading: true },
    ]);
    try {
      await ask({ data: { question: q, is_test: true, impersonate_user_id: impersonateId } });
      await loadMessages();
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tmpAsst && m.id !== tmpUser));
      toast.error(e?.message || "Erreur de l'assistant");
    } finally {
      setSending(false);
    }
  };

  const doRate = async (msg: Msg, rating: "up" | "down" | "correction", payload?: { comment?: string; corrected_answer?: string }) => {
    if (msg.id.startsWith("tmp-")) return;
    try {
      await rate({ data: { message_id: msg.id, rating, comment: payload?.comment, corrected_answer: payload?.corrected_answer } });
      setMessages((prev) => prev.map((m) =>
        m.id === msg.id
          ? { ...m, feedback: { rating, comment: payload?.comment ?? null, corrected_answer: payload?.corrected_answer ?? null } }
          : m
      ));
      toast.success(
        rating === "up" ? "Validé — le bot continuera dans ce style"
        : rating === "down" ? "Feedback enregistré"
        : "Correction enregistrée — le bot va apprendre"
      );
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
  };

  const removeFeedback = async (msg: Msg) => {
    if (msg.id.startsWith("tmp-")) return;
    try {
      await delFb({ data: { message_id: msg.id } });
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, feedback: null } : m));
    } catch (e: any) {
      toast.error(e?.message || "Impossible de retirer le feedback");
    }
  };

  const submitEdit = async () => {
    if (!editing) return;
    const text = editText.trim();
    if (!text) { toast.error("Ajoute une remarque"); return; }
    const msg = messages.find((m) => m.id === editing.msgId);
    if (!msg) return;
    try {
      await doRate(msg, editing.mode, editing.mode === "correction" ? { corrected_answer: text } : { comment: text });
      setEditing(null);
      setEditText("");
    } catch (e: any) {
      toast.error(e?.message || "Erreur d'enregistrement");
    }
  };

  if (!open) return null;

  const impersonated = employees.find((e) => e.id === impersonateId);
  const impersonateLabel = impersonated
    ? `${impersonated.first_name ?? ""} ${impersonated.last_name ?? ""}`.trim() || "Employé"
    : "Toi (admin)";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", zIndex: 60 }}
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          width: "100%",
          maxWidth: 720,
          height: "min(90vh, 800px)",
          backgroundColor: "#FAF8F4",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid var(--border)", backgroundColor: "#fff" }}>
          <div className="flex items-center gap-3">
            <div className="rounded-full flex items-center justify-center" style={{ width: 38, height: 38, backgroundColor: "var(--coral)" }}>
              <Bot size={19} color="var(--coral-text)" strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Tester le bot</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Bac à sable isolé — n'apparaît pas dans les conversations employés.
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full transition" style={{ backgroundColor: "transparent" }}>
            <X size={18} />
          </button>
        </div>

        {/* Impersonation bar */}
        <div className="px-4 py-2 flex items-center gap-2 relative" style={{ borderBottom: "0.5px solid var(--border)", backgroundColor: "#fff" }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Tester en tant que :</span>
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition"
            style={{ fontSize: 11, backgroundColor: impersonateId ? "rgba(240,153,123,0.18)" : "#FAF8F4", border: "0.5px solid var(--border)", color: impersonateId ? "var(--coral)" : "var(--foreground)" }}
          >
            <UserCircle2 size={12} />
            {impersonateLabel}
            <ChevronDown size={12} />
          </button>
          {impersonateId && (
            <button type="button" onClick={() => setImpersonateId(null)} style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
              Réinitialiser
            </button>
          )}
          {showPicker && (
            <div className="absolute left-4 top-full mt-1 rounded-xl overflow-hidden shadow-lg z-10"
              style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)", width: 280, maxHeight: 300, overflowY: "auto" }}>
              <button
                type="button"
                onClick={() => { setImpersonateId(null); setShowPicker(false); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50"
                style={{ fontSize: 12 }}
              >
                Toi (admin) — pas d'impersonation
              </button>
              {employees.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { setImpersonateId(e.id); setShowPicker(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  style={{ fontSize: 12, borderTop: "0.5px solid var(--border)" }}
                >
                  {(e.first_name ?? "") + " " + (e.last_name ?? "")}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {loaded && messages.length === 0 && (
            <div className="flex flex-col gap-2 px-1 pt-2">
              <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                <Sparkles size={13} /> Quelques pistes pour tester le bot
              </div>
              {SUGGESTIONS.map((s) => (
                <button type="button" key={s} onClick={() => send(s)}
                  className="text-left rounded-2xl px-4 py-2.5 transition active:scale-[0.98]"
                  style={{
                    backgroundColor: "#fff",
                    border: "0.5px solid var(--border)",
                    fontSize: 13,
                  }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m) => {
            const mine = m.role === "user";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} gap-2 items-end`}>
                {!mine && (
                  <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, backgroundColor: "var(--coral)" }}>
                    <Bot size={14} color="var(--coral-text)" strokeWidth={2} />
                  </div>
                )}
                <div className="flex flex-col gap-1" style={{ maxWidth: "78%" }}>
                  <div className="rounded-2xl px-3.5 py-2.5" style={{
                    fontSize: 13,
                    lineHeight: 1.45,
                    backgroundColor: mine ? "var(--coral)" : "#fff",
                    color: mine ? "var(--coral-text)" : "var(--foreground)",
                    border: mine ? "none" : "0.5px solid var(--border)",
                    whiteSpace: mine ? "pre-wrap" : "normal",
                    wordBreak: "break-word",
                    opacity: m.loading ? 0.7 : 1,
                  }}>
                    {m.loading ? "…" : (mine ? m.content : (
                      <div className="kadence-md">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
                            ul: ({ children }) => <ul style={{ margin: "4px 0 8px", paddingLeft: 18 }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ margin: "4px 0 8px", paddingLeft: 18 }}>{children}</ol>,
                            li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
                            strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ))}
                  </div>

                  {!mine && !m.loading && !m.id.startsWith("tmp-") && (
                    <div className="flex items-center gap-1.5 pl-1">
                      {m.feedback ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
                          style={{
                            fontSize: 10,
                            backgroundColor: m.feedback.rating === "up" ? "rgba(45,138,95,0.12)"
                              : m.feedback.rating === "down" ? "rgba(196,68,68,0.12)"
                              : "rgba(240,153,123,0.18)",
                            color: m.feedback.rating === "up" ? "#2d8a5f"
                              : m.feedback.rating === "down" ? "#c44"
                              : "var(--coral)",
                          }}>
                          {m.feedback.rating === "up" ? "Validé" : m.feedback.rating === "down" ? "Mauvaise réponse" : "Corrigé"}
                          <button type="button" onClick={() => removeFeedback(m)} style={{ display: "inline-flex" }}>
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button type="button" onClick={() => doRate(m, "up")} className="p-1 rounded transition"
                            style={{ color: "var(--muted-foreground)" }} title="Valider">
                            <ThumbsUp size={12} />
                          </button>
                          <button type="button" onClick={() => { setEditing({ msgId: m.id, mode: "down" }); setEditText(""); }}
                            className="p-1 rounded transition" style={{ color: "var(--muted-foreground)" }} title="Marquer comme mauvaise réponse">
                            <ThumbsDown size={12} />
                          </button>
                          <button type="button" onClick={() => { setEditing({ msgId: m.id, mode: "correction" }); setEditText(""); }}
                            className="p-1 rounded transition" style={{ color: "var(--muted-foreground)" }} title="Corriger / nourrir l'IA">
                            <Pencil size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {editing?.msgId === m.id && (
                    <div className="rounded-xl p-2 flex flex-col gap-1.5" style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)" }}>
                      <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                        {editing.mode === "correction"
                          ? "Explique ce que le bot aurait dû répondre — ou donne-lui de nouvelles consignes de style/ton."
                          : "Pourquoi cette réponse n'est-elle pas bonne ?"}
                      </div>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        placeholder={editing.mode === "correction" ? "La bonne réponse / consigne…" : "Commentaire…"}
                        className="outline-none resize-none rounded p-2"
                        style={{ fontSize: 12, border: "0.5px solid var(--border)" }}
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button type="button" onClick={() => { setEditing(null); setEditText(""); }}
                          className="px-2 py-1 rounded" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                          Annuler
                        </button>
                        <button type="button" onClick={submitEdit}
                          className="px-2.5 py-1 rounded" style={{ fontSize: 11, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="px-4 pt-3 pb-4 flex items-end gap-2" style={{ borderTop: "0.5px solid var(--border)", backgroundColor: "#fff" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Pose une question au bot…"
            rows={1}
            disabled={sending}
            className="flex-1 rounded-2xl px-4 py-2.5 outline-none resize-none"
            style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "#FAF8F4", maxHeight: 140 }}
          />
          <button type="button" onClick={() => send(input)} disabled={!input.trim() || sending}
            className="rounded-full flex items-center justify-center disabled:opacity-40 transition active:scale-95"
            style={{ width: 40, height: 40, backgroundColor: "var(--coral)", color: "var(--coral-text)", flexShrink: 0 }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
