import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createOrUpdateQuiz, deleteQuiz } from "@/lib/formation.functions";
import type { QuizWithChildren } from "./types";

interface DraftOption { option_text: string; is_correct: boolean }
interface DraftQuestion {
  question_text: string;
  question_type: "single_choice" | "multiple_choice" | "true_false";
  explanation: string;
  options: DraftOption[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  moduleId: string;
  existing: QuizWithChildren | null;
  onSaved: () => void;
}

export function QuizEditModal({ open, onOpenChange, moduleId, existing, onSaved }: Props) {
  const [title, setTitle] = useState("Quiz du module");
  const [passingScore, setPassingScore] = useState(80);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(createOrUpdateQuiz);
  const delQuiz = useServerFn(deleteQuiz);

  useEffect(() => {
    if (open) {
      setTitle(existing?.title ?? "Quiz du module");
      setPassingScore(existing?.passing_score ?? 80);
      setQuestions(
        existing?.questions.map((q: any) => ({
          question_text: q.question_text,
          question_type: q.question_type,
          explanation: q.explanation ?? "",
          options: q.options.map((o: any) => ({ option_text: o.option_text, is_correct: o.is_correct })),
        })) ?? []
      );
    }
  }, [open, existing]);

  const addQuestion = () => {
    setQuestions([...questions, {
      question_text: "", question_type: "single_choice", explanation: "",
      options: [{ option_text: "", is_correct: false }, { option_text: "", is_correct: false }],
    }]);
  };

  const updateQ = (i: number, patch: Partial<DraftQuestion>) => {
    setQuestions(questions.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  };
  const removeQ = (i: number) => setQuestions(questions.filter((_, idx) => idx !== i));

  const addOpt = (qi: number) => {
    setQuestions(questions.map((q, idx) => idx === qi ? { ...q, options: [...q.options, { option_text: "", is_correct: false }] } : q));
  };
  const updateOpt = (qi: number, oi: number, patch: Partial<DraftOption>) => {
    setQuestions(questions.map((q, idx) => idx === qi ? { ...q, options: q.options.map((o, j) => j === oi ? { ...o, ...patch } : o) } : q));
  };
  const removeOpt = (qi: number, oi: number) => {
    setQuestions(questions.map((q, idx) => idx === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q));
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) { toast.error(`Question ${i + 1}: texte vide`); return; }
      if (q.options.length < 2) { toast.error(`Question ${i + 1}: 2 options min`); return; }
      if (!q.options.some(o => o.is_correct)) { toast.error(`Question ${i + 1}: marque au moins une option correcte`); return; }
    }
    setSaving(true);
    try {
      await save({ data: {
        moduleId, title: title.trim(), passing_score: passingScore,
        questions: questions.map((q) => ({
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          explanation: q.explanation.trim() || null,
          options: q.options.map((o) => ({ option_text: o.option_text.trim(), is_correct: o.is_correct })),
        })),
      } });
      toast.success("Quiz enregistré"); onOpenChange(false); onSaved();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer définitivement ce quiz ?")) return;
    setSaving(true);
    try {
      await delQuiz({ data: { moduleId } });
      toast.success("Quiz supprimé"); onOpenChange(false); onSaved();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle style={{ fontSize: 16, fontWeight: 500 }}>{existing ? "Modifier le quiz" : "Créer un quiz"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Titre du quiz</Label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md"
                style={inputStyle} />
            </div>
            <div>
              <Label>Note minimale (%)</Label>
              <input type="number" min={0} max={100} value={passingScore}
                onChange={(e) => setPassingScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                className="w-full rounded-md" style={inputStyle} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {questions.map((q, qi) => (
              <div key={qi} className="rounded-lg p-3" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}>
                <div className="flex items-start gap-2 mb-2">
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginTop: 8 }}>{qi + 1}.</span>
                  <input value={q.question_text} onChange={(e) => updateQ(qi, { question_text: e.target.value })}
                    placeholder="Texte de la question"
                    className="flex-1 rounded-md" style={inputStyle} />
                  <select value={q.question_type} onChange={(e) => updateQ(qi, { question_type: e.target.value as any })}
                    style={{ ...inputStyle, width: 140 }}>
                    <option value="single_choice">Choix unique</option>
                    <option value="multiple_choice">Choix multiple</option>
                    <option value="true_false">Vrai/Faux</option>
                  </select>
                  <button onClick={() => removeQ(qi)} className="rounded-md p-1.5" style={{ color: "var(--danger-text)" }}>
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 mt-2 ml-4">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="checkbox" checked={opt.is_correct} onChange={(e) => updateOpt(qi, oi, { is_correct: e.target.checked })} />
                      <input value={opt.option_text} onChange={(e) => updateOpt(qi, oi, { option_text: e.target.value })}
                        placeholder={`Option ${oi + 1}`}
                        className="flex-1 rounded-md" style={{ ...inputStyle, padding: "5px 10px" }} />
                      <button onClick={() => removeOpt(qi, oi)} disabled={q.options.length <= 2} className="rounded-md p-1" style={{ color: "var(--muted-foreground)" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addOpt(qi)} className="rounded-md px-2 py-1 inline-flex items-center gap-1 self-start mt-1"
                    style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    <Plus size={11} /> Ajouter une option
                  </button>
                </div>

                <div className="mt-3">
                  <Label>Explication (optionnel)</Label>
                  <input value={q.explanation} onChange={(e) => updateQ(qi, { explanation: e.target.value })}
                    placeholder="Affichée après la réponse"
                    className="w-full rounded-md" style={inputStyle} />
                </div>
              </div>
            ))}
            <button onClick={addQuestion} className="rounded-lg px-3 py-2 flex items-center justify-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 500, border: "0.5px dashed var(--border)", color: "var(--muted-foreground)" }}>
              <Plus size={13} /> Ajouter une question
            </button>
          </div>
        </div>
        <DialogFooter className="flex !justify-between">
          {existing ? (
            <button onClick={handleDelete} disabled={saving} className="rounded-md px-3 py-2" style={{ fontSize: 12, color: "var(--danger-text)" }}>
              Supprimer le quiz
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={() => onOpenChange(false)} disabled={saving} className="rounded-md px-3 py-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Annuler</button>
            <button onClick={handleSave} disabled={saving} className="rounded-md px-3 py-2"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              {saving ? "..." : "Enregistrer le quiz"}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)",
  backgroundColor: "var(--card)",
};

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{children}</label>;
}
