import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Video, FileText, Image as ImageIcon, HelpCircle, BookOpen } from "lucide-react";
import { fmtDuration, TYPE_COLOR } from "./types";
import type { CourseFull } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: CourseFull;
}

export function StudentPreviewSheet({ open, onOpenChange, data }: Props) {
  const { course, sections } = data;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 500 }}>
            <span style={{ fontSize: 22 }}>{course.icon ?? "📚"}</span>
            {course.title}
          </SheetTitle>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Aperçu de ce que verra l'employé</div>
        </SheetHeader>

        <div className="flex flex-col gap-5 py-5">
          {sections.length === 0 && (
            <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "var(--background)", fontSize: 12, color: "var(--muted-foreground)" }}>
              <BookOpen size={20} style={{ margin: "0 auto 8px", color: "var(--muted-foreground)" }} />
              Ce parcours est vide pour l'instant.
            </div>
          )}
          {sections.map((sec, si) => (
            <div key={sec.id}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Section {si + 1} · {sec.title}
              </div>
              <div className="flex flex-col gap-3">
                {sec.modules.map((mod: any, mi: number) => (
                  <div key={mod.id} className="rounded-lg p-3" style={{ backgroundColor: "var(--background)" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                      {mi + 1}. {mod.title}
                    </div>
                    <div className="flex flex-col gap-2">
                      {mod.contents.map((c: any) => (
                        <div key={c.id} className="flex items-start gap-2">
                          <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TYPE_COLOR[c.type as keyof typeof TYPE_COLOR], marginTop: 6, flexShrink: 0 }} />
                          {c.type === "video" && <Video size={13} style={{ color: "var(--muted-foreground)", marginTop: 2 }} />}
                          {c.type === "pdf" && <FileText size={13} style={{ color: "var(--muted-foreground)", marginTop: 2 }} />}
                          {c.type === "image" && <ImageIcon size={13} style={{ color: "var(--muted-foreground)", marginTop: 2 }} />}
                          {c.type === "text" && <FileText size={13} style={{ color: "var(--muted-foreground)", marginTop: 2 }} />}
                          <div className="flex-1 min-w-0">
                            <div style={{ fontSize: 12 }}>{c.title}</div>
                            {c.description && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{c.description}</div>}
                            {c.type === "video" && c.duration_seconds != null && (
                              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{fmtDuration(c.duration_seconds)}</div>
                            )}
                            {c.type === "text" && c.text_content && (
                              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, whiteSpace: "pre-wrap" }}>
                                {c.text_content.slice(0, 220)}{c.text_content.length > 220 ? "…" : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {mod.quiz && (
                        <div className="rounded-md px-2.5 py-2 flex items-center gap-2 mt-1" style={{ backgroundColor: "rgba(139, 92, 246, 0.08)" }}>
                          <HelpCircle size={13} style={{ color: "#8B5CF6" }} />
                          <span style={{ fontSize: 12 }}>Quiz à la fin — {mod.quiz.questions.length} questions</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-lg p-3 text-center" style={{ fontSize: 11, color: "var(--muted-foreground)", backgroundColor: "var(--background)", marginTop: 12 }}>
            Mode aperçu — aucune progression n'est sauvegardée
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
