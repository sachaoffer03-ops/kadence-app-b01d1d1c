import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, FileText, Image as ImageIcon, Video, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { updateContentProgress } from "@/lib/formation.functions";
import { VideoPlayer } from "./VideoPlayer";
import { PdfViewer } from "./PdfViewer";
import { ImageViewer } from "./ImageViewer";
import { MarkdownContent } from "./MarkdownContent";
import { QuizPlayer } from "./QuizPlayer";
import type { DetailModule } from "./types";

interface Props {
  module: DetailModule;
  firstName: string;
  initials: string;
  reviewMode?: boolean;
  onBack: () => void;
  onModuleComplete: () => void;
}

export function ModulePlayer({ module, firstName, initials, reviewMode, onBack, onModuleComplete }: Props) {
  const contents = module.contents;
  const hasQuiz = !!module.quiz;
  const totalSteps = contents.length + (hasQuiz ? 1 : 0);
  const [step, setStep] = useState(0);
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(() => new Set(contents.filter((c) => c.status === "completed").map((c) => c.id)));
  const updateProgress = useServerFn(updateContentProgress);
  const sentRef = useRef<Set<string>>(new Set());

  const isQuizStep = hasQuiz && step === contents.length;
  const currentContent = !isQuizStep ? contents[step] : null;

  const canNext = () => {
    if (!currentContent) return false;
    if (reviewMode) return true;
    return localCompleted.has(currentContent.id);
  };

  const markComplete = async (contentId: string) => {
    if (reviewMode) return;
    setLocalCompleted((s) => { const n = new Set(s); n.add(contentId); return n; });
    if (sentRef.current.has(`done_${contentId}`)) return;
    sentRef.current.add(`done_${contentId}`);
    try { await updateProgress({ data: { contentId, progress_pct: 100, completed: true } }); }
    catch (e: any) { toast.error(e.message); }
  };

  const pushProgress = async (contentId: string, pct: number, inc: number) => {
    if (reviewMode) return;
    try { await updateProgress({ data: { contentId, progress_pct: pct, time_spent_increment: inc } }); }
    catch {}
  };

  const renderContent = () => {
    if (!currentContent) return null;
    const done = localCompleted.has(currentContent.id);
    switch (currentContent.type) {
      case "video":
        if (!currentContent.url && !currentContent.external_url) return <Empty label="Vidéo manquante" />;
        return <VideoPlayer
          url={currentContent.url || currentContent.external_url!}
          durationHint={currentContent.duration_seconds}
          initials={initials}
          initialProgressPct={currentContent.progress_pct}
          alreadyCompleted={done}
          reviewMode={reviewMode}
          onProgress={(pct, inc) => pushProgress(currentContent.id, pct, inc)}
          onComplete={() => markComplete(currentContent.id)}
        />;
      case "pdf":
        if (!currentContent.url) return <Empty label="PDF manquant" />;
        return <PdfViewer url={currentContent.url} onComplete={() => markComplete(currentContent.id)} alreadyCompleted={done} />;
      case "image":
        if (!currentContent.url) return <Empty label="Image manquante" />;
        return <ImageViewer url={currentContent.url} description={currentContent.description} onComplete={() => markComplete(currentContent.id)} alreadyCompleted={done} />;
      case "text":
        return <MarkdownContent content={currentContent.text_content ?? ""} onComplete={() => markComplete(currentContent.id)} alreadyCompleted={done} />;
      default:
        return null;
    }
  };

  if (isQuizStep && module.quiz) {
    return (
      <QuizPlayer
        quiz={module.quiz}
        firstName={firstName}
        onBack={() => setStep(contents.length - 1)}
        onPassed={() => onModuleComplete()}
      />
    );
  }

  const TypeIcon = currentContent?.type === "video" ? Video : currentContent?.type === "image" ? ImageIcon : FileText;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
        <button onClick={onBack} className="flex items-center gap-1 mb-3" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          <ArrowLeft size={14} /> Mes modules
        </button>
        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", letterSpacing: "0.08em" }}>
          MODULE · {reviewMode ? "RÉVISION" : `ÉTAPE ${step + 1}/${totalSteps}`}
        </div>
        <div style={{ fontSize: 16, fontWeight: 500, marginTop: 2 }}>{module.title}</div>

        <div className="flex gap-1 mt-3">
          {Array.from({ length: totalSteps }).map((_, i) => {
            const stepContent = i < contents.length ? contents[i] : null;
            const isDone = stepContent ? localCompleted.has(stepContent.id) : false;
            const isQuiz = i >= contents.length;
            return (
              <div key={i} className="flex-1 rounded-full flex items-center justify-center" style={{ height: 4, backgroundColor: i === step ? "#F0997B" : isDone ? "#16A34A" : "var(--border)" }}>
                {isQuiz && i === step && <HelpCircle size={0} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {currentContent && (
          <div className="mb-3 flex items-center gap-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            <TypeIcon size={13} />
            <span>{currentContent.title}</span>
          </div>
        )}
        {renderContent()}
        {currentContent?.description && currentContent.type !== "image" && (
          <div className="mt-4 rounded-lg p-3" style={{ backgroundColor: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", letterSpacing: "0.08em", marginBottom: 4 }}>À RETENIR</div>
            {currentContent.description}
          </div>
        )}
      </div>

      <div className="px-5 py-3 flex items-center justify-between gap-2" style={{ borderTop: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
          className="flex items-center gap-1 px-3 py-2 rounded-md disabled:opacity-30"
          style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          <ArrowLeft size={14} /> Précédent
        </button>
        <div className="flex-1 text-center" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {!canNext() && currentContent?.type === "video" && !reviewMode && "Regarde 90% pour continuer"}
          {!canNext() && currentContent?.type === "text" && !reviewMode && "Lis jusqu'au bout pour continuer"}
        </div>
        <button onClick={() => setStep(Math.min(totalSteps - 1, step + 1))} disabled={!canNext() && !reviewMode}
          className="flex items-center gap-1 px-4 py-2 rounded-md disabled:opacity-30"
          style={{ fontSize: 13, fontWeight: 500, backgroundColor: canNext() || reviewMode ? "var(--foreground)" : "var(--muted)", color: canNext() || reviewMode ? "var(--card)" : "var(--muted-foreground)" }}>
          {canNext() && !reviewMode ? <Check size={14} /> : null}
          {step === totalSteps - 1 ? "Terminer" : "Suivant"} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "var(--muted)", fontSize: 12, color: "var(--muted-foreground)" }}>{label}</div>;
}
