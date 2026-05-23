import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { HelpCircle, BookOpen } from "lucide-react";
import { TYPE_COLOR, TYPE_LABEL } from "./types";
import type { CourseFull } from "./types";
import { ContentPreview, QuizPreview } from "./ContentPreview";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: CourseFull;
}

export function StudentPreviewSheet({ open, onOpenChange, data }: Props) {
  const { course, sections } = data;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[680px] sm:max-w-[680px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 500 }}>
            <span style={{ fontSize: 22 }}>{course.icon ?? "📚"}</span>
            {course.title}
          </SheetTitle>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Mode aperçu — voici ce que verra l'étudiant
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-6 py-5">
          {sections.length === 0 && (
            <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "var(--background)", fontSize: 12, color: "var(--muted-foreground)" }}>
              <BookOpen size={20} style={{ margin: "0 auto 8px", color: "var(--muted-foreground)" }} />
              Ce parcours est vide pour l'instant.
            </div>
          )}
          {sections.map((sec, si) => (
            <div key={sec.id}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Section {si + 1} · {sec.title}
              </div>
              <div className="flex flex-col gap-4">
                {sec.modules.map((mod: any, mi: number) => (
                  <div key={mod.id} className="rounded-lg p-4" style={{ backgroundColor: "var(--background)" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
                      {mi + 1}. {mod.title}
                    </div>
                    <div className="flex flex-col gap-4">
                      {mod.contents.map((c: any) => (
                        <div key={c.id} className="rounded-md p-3" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                          <div className="flex items-center gap-2 mb-2">
                            <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TYPE_COLOR[c.type as keyof typeof TYPE_COLOR] }} />
                            <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{c.title}</span>
                            <span style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {TYPE_LABEL[c.type as keyof typeof TYPE_LABEL]}
                            </span>
                          </div>
                          {c.description && (
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8 }}>{c.description}</div>
                          )}
                          <ContentPreview content={c} />
                        </div>
                      ))}
                      {mod.quiz && (
                        <div className="rounded-md p-3" style={{ backgroundColor: "rgba(139, 92, 246, 0.06)", border: "0.5px solid rgba(139,92,246,0.25)" }}>
                          <div className="flex items-center gap-2 mb-3">
                            <HelpCircle size={13} style={{ color: "#8B5CF6" }} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>Quiz · {mod.quiz.questions.length} question{mod.quiz.questions.length !== 1 ? "s" : ""}</span>
                          </div>
                          <QuizPreview quiz={mod.quiz} hideAnswers />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-lg p-3 text-center" style={{ fontSize: 11, color: "var(--muted-foreground)", backgroundColor: "var(--background)" }}>
            Mode aperçu — aucune progression n'est sauvegardée
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
