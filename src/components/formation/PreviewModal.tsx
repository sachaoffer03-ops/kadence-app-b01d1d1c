import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContentPreview, QuizPreview } from "./ContentPreview";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  kind: "content" | "quiz";
  data: any;
}

export function PreviewModal({ open, onOpenChange, title, kind, data }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] w-[95vw] max-h-[90vh] overflow-y-auto p-0" style={{ backgroundColor: "var(--card)" }}>
        <DialogHeader className="px-6 pt-5 pb-4" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <DialogTitle style={{ fontSize: 14, fontWeight: 500 }}>Aperçu · {title}</DialogTitle>
        </DialogHeader>
        <div className="p-6">
          {kind === "content" ? <ContentPreview content={data} /> : <QuizPreview quiz={data} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
