import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, X } from "lucide-react";
import { toast } from "sonner";
import { getMyContributorStatus, submitSuggestion } from "@/lib/ai-suggestions.functions";
import { KNOWLEDGE_CATEGORIES } from "@/lib/ai-knowledge.functions";

export function ContributeAICard() {
  const checkFn = useServerFn(getMyContributorStatus);
  const submitFn = useServerFn(submitSuggestion);
  const [canContribute, setCanContribute] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [entryType, setEntryType] = useState<"text" | "faq">("text");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    checkFn({}).then((r) => setCanContribute(r.canContribute)).catch(() => {});
  }, []);

  if (!canContribute) return null;

  const reset = () => {
    setTitle(""); setContent(""); setCategory("general"); setEntryType("text");
  };

  const submit = async () => {
    if (title.trim().length < 3) return toast.error("Titre trop court");
    if (content.trim().length < 10) return toast.error("Contenu trop court");
    setSending(true);
    try {
      await submitFn({ data: { title: title.trim(), content: content.trim(), category, entry_type: entryType } });
      toast.success("Merci ! Votre suggestion a bien été envoyée.");
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl p-4 text-left flex items-start gap-3 transition-colors hover:bg-[var(--muted)]"
        style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}
      >
        <div
          className="rounded-lg flex items-center justify-center shrink-0"
          style={{ width: 38, height: 38, backgroundColor: "color-mix(in oklch, #F0997B 15%, transparent)" }}
        >
          <Sparkles size={18} style={{ color: "#F0997B" }} strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <div style={{ fontSize: 14, fontWeight: 500 }}>Aider l'assistant IA</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>
            Partage une info, une astuce ou une FAQ utile pour améliorer le bot.
          </div>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={() => !sending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-5 flex flex-col gap-3"
            style={{ backgroundColor: "var(--card)", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div style={{ fontSize: 16, fontWeight: 500 }}>Nouvelle suggestion</div>
              <button onClick={() => !sending && setOpen(false)} style={{ color: "var(--muted-foreground)" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              Décris une information utile pour l'équipe. Un admin la relira avant de l'ajouter au bot.
            </div>

            <div className="flex gap-1.5">
              {(["text", "faq"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEntryType(t)}
                  className="rounded-full px-3 py-1"
                  style={{
                    fontSize: 11, fontWeight: 500,
                    border: entryType === t ? "1px solid var(--coral)" : "0.5px solid var(--border)",
                    backgroundColor: entryType === t ? "var(--coral)" : "transparent",
                    color: entryType === t ? "var(--coral-text)" : "var(--foreground)",
                  }}
                >
                  {t === "text" ? "Info / Texte" : "FAQ"}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {entryType === "faq" ? "Question" : "Titre"}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder={entryType === "faq" ? "Ex: Que faire si la machine espresso fuit ?" : "Ex: Procédure ouverture studio"}
                className="w-full mt-1 rounded-md border px-3 py-2 outline-none"
                style={{ fontSize: 13, borderColor: "var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
              />
            </label>

            <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {entryType === "faq" ? "Réponse" : "Contenu"}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={8000}
                rows={6}
                placeholder="Décris l'information aussi précisément que possible…"
                className="w-full mt-1 rounded-md border px-3 py-2 outline-none resize-none"
                style={{ fontSize: 13, borderColor: "var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
              />
            </label>

            <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Catégorie
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full mt-1 rounded-md border px-3 py-2 outline-none"
                style={{ fontSize: 13, borderColor: "var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
              >
                {KNOWLEDGE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={sending}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-md py-3"
              style={{
                fontSize: 14, fontWeight: 500,
                backgroundColor: "var(--foreground)", color: "var(--card)",
                opacity: sending ? 0.5 : 1,
              }}
            >
              <Send size={14} /> {sending ? "Envoi…" : "Envoyer ma suggestion"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
