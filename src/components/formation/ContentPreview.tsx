import ReactMarkdown from "react-markdown";
import { ExternalLink, FileText } from "lucide-react";

interface ContentLike {
  type: "video" | "pdf" | "image" | "text" | "quiz";
  title?: string;
  url?: string | null;
  external_url?: string | null;
  text_content?: string | null;
  duration_seconds?: number | null;
}

function ytId(u: string): string | null {
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function vimeoId(u: string): string | null {
  const m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function ContentPreview({ content }: { content: ContentLike }) {
  const { type, url, external_url, text_content, duration_seconds } = content;

  if (type === "video") {
    if (url) {
      return (
        <div className="flex flex-col gap-1.5">
          <video src={url} controls className="w-full rounded-lg bg-black" style={{ maxHeight: 360 }} />
          {duration_seconds ? (
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Durée détectée · {duration_seconds}s</span>
          ) : null}
        </div>
      );
    }
    if (external_url) {
      const yt = ytId(external_url);
      const vm = vimeoId(external_url);
      if (yt) {
        return <iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} className="w-full rounded-lg" style={{ aspectRatio: "16/9", border: 0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />;
      }
      if (vm) {
        return <iframe src={`https://player.vimeo.com/video/${vm}`} className="w-full rounded-lg" style={{ aspectRatio: "16/9", border: 0 }} allow="autoplay; fullscreen; picture-in-picture" />;
      }
      return (
        <a href={external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline" style={{ fontSize: 12 }}>
          <ExternalLink size={12} /> {external_url}
        </a>
      );
    }
    return <Empty label="Aucune vidéo" />;
  }

  if (type === "pdf") {
    if (!url) return <Empty label="Aucun PDF" />;
    return (
      <div className="flex flex-col gap-1.5">
        <iframe src={url} className="w-full rounded-lg" style={{ height: 400, border: "0.5px solid var(--border)" }} title="PDF" />
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline self-start" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          <ExternalLink size={11} /> Ouvrir dans un nouvel onglet
        </a>
      </div>
    );
  }

  if (type === "image") {
    if (!url) return <Empty label="Aucune image" />;
    return <img src={url} alt={content.title || ""} className="rounded-lg" style={{ maxWidth: "100%", maxHeight: 360, objectFit: "contain" }} />;
  }

  if (type === "text") {
    if (!text_content) return <Empty label="Aucun texte" />;
    return (
      <div className="prose prose-sm max-w-none" style={{ fontSize: 13, lineHeight: 1.65, color: "var(--foreground)" }}>
        <ReactMarkdown>{text_content}</ReactMarkdown>
      </div>
    );
  }

  return null;
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-4" style={{ backgroundColor: "var(--background)", color: "var(--muted-foreground)", fontSize: 12 }}>
      <FileText size={13} /> {label}
    </div>
  );
}

export function PreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg" style={{ border: "0.5px solid var(--border)", padding: 12, backgroundColor: "var(--background)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 8 }}>
        Aperçu
      </div>
      {children}
    </div>
  );
}

export function QuizPreview({ quiz, hideAnswers }: { quiz: any; hideAnswers?: boolean }) {
  if (!quiz?.questions?.length) return <Empty label="Aucune question" />;
  return (
    <div className="flex flex-col gap-4">
      {quiz.questions.map((q: any, i: number) => (
        <div key={q.id ?? i} className="rounded-lg p-3" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
            {i + 1}. {q.question_text || <span style={{ color: "var(--muted-foreground)" }}>(sans intitulé)</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            {q.options?.map((o: any, oi: number) => {
              const correct = !hideAnswers && o.is_correct;
              const wrong = !hideAnswers && !o.is_correct;
              return (
                <div key={o.id ?? oi} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{
                  fontSize: 12,
                  backgroundColor: hideAnswers ? "var(--background)" : correct ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.06)",
                  border: `0.5px solid ${hideAnswers ? "var(--border)" : correct ? "rgba(16,185,129,0.45)" : "rgba(239,68,68,0.25)"}`,
                  color: hideAnswers ? "var(--foreground)" : correct ? "#047857" : "var(--muted-foreground)",
                }}>
                  <span style={{ width: 14, display: "inline-block", textAlign: "center" }}>
                    {hideAnswers ? "○" : correct ? "✓" : wrong ? "✗" : ""}
                  </span>
                  <span className="flex-1">{o.option_text || <em style={{ color: "var(--muted-foreground)" }}>(vide)</em>}</span>
                </div>
              );
            })}
          </div>
          {!hideAnswers && q.explanation ? (
            <div className="mt-2 rounded-md px-2 py-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)", backgroundColor: "var(--background)" }}>
              💡 {q.explanation}
            </div>
          ) : null}
        </div>
      ))}
      {!hideAnswers && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          Score requis : ≥ {quiz.passing_score}%
        </div>
      )}
    </div>
  );
}
