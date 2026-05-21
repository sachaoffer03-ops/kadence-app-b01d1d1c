import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, XCircle, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { startQuizAttempt, submitQuizAttempt } from "@/lib/formation.functions";
import type { DetailQuiz } from "./types";

interface Props {
  quiz: DetailQuiz;
  firstName: string;
  onBack: () => void;
  onPassed: (courseCompleted: boolean) => void;
}

type Result = Awaited<ReturnType<typeof submitQuizAttempt>>;

export function QuizPlayer({ quiz, firstName, onBack, onPassed }: Props) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptNumber, setAttemptNumber] = useState<number>((quiz.attemptCount ?? 0) + 1);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const start = useServerFn(startQuizAttempt);
  const submit = useServerFn(submitQuizAttempt);

  useEffect(() => {
    (async () => {
      try {
        const r = await start({ data: { quizId: quiz.id } });
        setAttemptId(r.attemptId);
        setAttemptNumber(r.attemptNumber);
      } catch (e: any) { toast.error(e.message); onBack(); }
    })();
  }, [quiz.id]);

  const total = quiz.questions.length;
  const q = quiz.questions[idx];
  const isMulti = q?.question_type === "multiple_choice";
  const selected = q ? (answers[q.id] ?? []) : [];

  const toggleOpt = (optId: string) => {
    if (!q) return;
    if (isMulti) {
      const next = selected.includes(optId) ? selected.filter((x) => x !== optId) : [...selected, optId];
      setAnswers({ ...answers, [q.id]: next });
    } else {
      setAnswers({ ...answers, [q.id]: [optId] });
    }
  };

  const handleNext = async () => {
    if (!attemptId || !q) return;
    if (selected.length === 0) return;
    if (idx < total - 1) { setIdx(idx + 1); return; }
    setSubmitting(true);
    try {
      const r = await submit({ data: {
        attemptId,
        answers: quiz.questions.map((qq: any) => ({ questionId: qq.id, selectedOptionIds: answers[qq.id] ?? [] })),
      } });
      setResult(r);
      if (r.passed) onPassed(r.courseCompleted);
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  // ---- RESULT screen ----
  if (result) {
    const passed = result.passed;
    return (
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col items-center text-center gap-3 py-6">
          {passed ? (
            <div className="rounded-full flex items-center justify-center" style={{ width: 72, height: 72, backgroundColor: "color-mix(in oklch, var(--success-bg, #16A34A) 18%, transparent)" }}>
              <CheckCircle2 size={36} strokeWidth={1.5} style={{ color: "#16A34A" }} />
            </div>
          ) : (
            <div className="rounded-full flex items-center justify-center" style={{ width: 72, height: 72, backgroundColor: "color-mix(in oklch, #E04545 18%, transparent)" }}>
              <XCircle size={36} strokeWidth={1.5} style={{ color: "#E04545" }} />
            </div>
          )}
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            {passed ? `Bien joué ${firstName} !` : `Pas tout à fait ${firstName}`}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            {result.correctCount}/{result.totalCount} bonnes réponses · {result.score}%
          </div>
          {!passed && (
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Il faut {result.passingScore}% minimum. Tentative {result.attemptNumber}/3.
            </div>
          )}
        </div>

        {!passed && (
          <div className="flex flex-col gap-2">
            {result.explanations.filter((e) => !e.wasCorrect).map((e) => (
              <div key={e.questionId} className="rounded-lg p-3" style={{ backgroundColor: "var(--muted)", border: "0.5px solid var(--border)" }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{e.questionText}</div>
                {e.explanation && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.5 }}>{e.explanation}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {passed ? (
            <button onClick={onBack} className="rounded-md py-3" style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              Retour au parcours
            </button>
          ) : result.attemptNumber < 3 ? (
            <>
              <button onClick={() => { setResult(null); setIdx(0); setAnswers({}); (async () => { const r = await start({ data: { quizId: quiz.id } }); setAttemptId(r.attemptId); setAttemptNumber(r.attemptNumber); })(); }}
                className="rounded-md py-3 flex items-center justify-center gap-2"
                style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                <RotateCw size={14} /> Retenter le quiz
              </button>
              <button onClick={onBack} className="rounded-md py-3" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Revoir le contenu
              </button>
            </>
          ) : (
            <>
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: "color-mix(in oklch, #E04545 8%, transparent)", border: "0.5px solid color-mix(in oklch, #E04545 25%, transparent)", fontSize: 12 }}>
                Tu as épuisé tes 3 tentatives. Ton manager a été notifié, il va t'accompagner.
              </div>
              <button onClick={onBack} className="rounded-md py-3" style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                Retour au parcours
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- QUIZ in progress ----
  if (!q || !attemptId) {
    return <div className="p-6 text-center" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 -ml-1"><ArrowLeft size={16} /></button>
        <div className="flex-1">
          <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", letterSpacing: "0.08em" }}>QUIZ · TENTATIVE {attemptNumber}/3</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{quiz.title}</div>
        </div>
      </div>

      <div className="flex gap-1.5">
        {quiz.questions.map((_: any, i: number) => (
          <div key={i} className="flex-1 rounded-full" style={{ height: 4, backgroundColor: i < idx ? "var(--foreground)" : i === idx ? "#F0997B" : "var(--border)" }} />
        ))}
      </div>

      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Question {idx + 1} sur {total}</div>

      <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{q.question_text}</div>
      {isMulti && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Plusieurs réponses possibles</div>}

      <div className="flex flex-col gap-2">
        {q.options.map((opt: any) => {
          const isSelected = selected.includes(opt.id);
          return (
            <button key={opt.id} onClick={() => toggleOpt(opt.id)}
              className="rounded-lg p-3 text-left transition-colors"
              style={{
                fontSize: 14, lineHeight: 1.4,
                backgroundColor: isSelected ? "color-mix(in oklch, #F0997B 12%, transparent)" : "var(--background)",
                border: `1px solid ${isSelected ? "#F0997B" : "var(--border)"}`,
                minHeight: 48,
              }}>
              {opt.option_text}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>
        Note minimum : {quiz.passing_score}%
      </div>

      <button onClick={handleNext} disabled={selected.length === 0 || submitting}
        className="rounded-md py-3 mt-2 transition-opacity disabled:opacity-40"
        style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
        {submitting ? "Envoi…" : idx === total - 1 ? "Valider mes réponses" : "Question suivante →"}
      </button>
    </div>
  );
}
