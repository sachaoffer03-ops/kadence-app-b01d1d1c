import { useEffect, useState } from "react";
import { Video, FileText, StickyNote, LinkIcon, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createResource, updateResource, uploadTrainingPdf } from "@/hooks/use-training";
import { detectVideoEmbed, isValidVideoUrl, isValidUrl } from "@/lib/training-presets";
import type { TrainingResource, ResourceType } from "@/types/training";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderId: string;
  stepId: string;
  resource?: TrainingResource | null;
  onSaved?: () => void;
}

const TYPE_OPTIONS: { type: ResourceType; label: string; description: string; icon: React.ElementType }[] = [
  { type: "video", label: "Vidéo", description: "YouTube, Vimeo, Drive", icon: Video },
  { type: "pdf", label: "PDF", description: "Document à uploader", icon: FileText },
  { type: "note", label: "Note texte", description: "Markdown / texte libre", icon: StickyNote },
  { type: "link", label: "Lien externe", description: "URL vers ressource", icon: LinkIcon },
];

export function ResourceModal({ open, onOpenChange, folderId, stepId, resource, onSaved }: Props) {
  const [step, setStep] = useState<"choose" | "form">("choose");
  const [type, setType] = useState<ResourceType>("video");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (resource) {
      setStep("form");
      setType(resource.type);
      setTitle(resource.title);
      setContent(resource.content);
    } else {
      setStep("choose");
      setType("video");
      setTitle("");
      setContent("");
      setFile(null);
    }
  }, [open, resource]);

  const pickType = (t: ResourceType) => { setType(t); setStep("form"); };

  const save = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    setSaving(true);
    try {
      let finalContent = content;

      if (type === "pdf" && file) {
        finalContent = await uploadTrainingPdf(file, folderId, stepId);
      } else if (type === "video") {
        if (!isValidVideoUrl(content)) { toast.error("URL invalide (YouTube, Vimeo ou Drive)"); setSaving(false); return; }
      } else if (type === "link") {
        if (!isValidUrl(content)) { toast.error("URL invalide"); setSaving(false); return; }
      } else if (type === "note") {
        if (!content.trim()) { toast.error("Contenu requis"); setSaving(false); return; }
      } else if (type === "pdf" && !resource) {
        toast.error("Fichier PDF requis"); setSaving(false); return;
      }

      if (resource) {
        await updateResource(resource.id, { type, title: title.trim(), content: finalContent });
      } else {
        await createResource(stepId, { type, title: title.trim(), content: finalContent });
      }
      toast.success(resource ? "Ressource mise à jour" : "Ressource ajoutée");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const videoPreview = type === "video" && content && isValidVideoUrl(content)
    ? detectVideoEmbed(content).embedUrl : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontSize: 16, fontWeight: 500 }}>
            {resource ? "Modifier la ressource" : step === "choose" ? "Type de ressource" : "Nouvelle ressource"}
          </DialogTitle>
        </DialogHeader>

        {step === "choose" ? (
          <div className="grid grid-cols-2 gap-3 py-2">
            {TYPE_OPTIONS.map((opt) => (
              <button key={opt.type} onClick={() => pickType(opt.type)}
                className="rounded-xl p-4 flex flex-col items-start gap-2 transition-colors hover:bg-muted text-left"
                style={{ border: "0.5px solid var(--border)" }}>
                <opt.icon size={20} style={{ color: "var(--coral)" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{opt.description}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Titre</label>
              <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre de la ressource"
                className="w-full mt-1.5"
                style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)" }} />
            </div>

            {type === "video" && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>URL</label>
                <input value={content} onChange={(e) => setContent(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full mt-1.5"
                  style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)" }} />
                {videoPreview && (
                  <div className="mt-3 rounded-lg overflow-hidden" style={{ aspectRatio: "16/9", backgroundColor: "#000" }}>
                    <iframe src={videoPreview} className="w-full h-full" allowFullScreen title="preview" />
                  </div>
                )}
              </div>
            )}

            {type === "pdf" && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fichier PDF</label>
                {resource && !file && (
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
                    Fichier actuel : <code>{content}</code>. Choisir un nouveau fichier pour remplacer.
                  </div>
                )}
                <label className="block mt-2 rounded-lg cursor-pointer text-center py-6"
                  style={{ border: "1px dashed var(--border)", backgroundColor: "var(--background)" }}>
                  <Upload size={20} className="mx-auto mb-2" style={{ color: "var(--muted-foreground)" }} />
                  <div style={{ fontSize: 12 }}>{file ? file.name : "Cliquer pour choisir un PDF"}</div>
                  <input type="file" accept="application/pdf" hidden
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                {file && (
                  <button onClick={() => setFile(null)} className="mt-2 flex items-center gap-1"
                    style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    <X size={11} /> Retirer
                  </button>
                )}
              </div>
            )}

            {type === "note" && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Contenu (markdown supporté)
                </label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  placeholder="# Bienvenue&#10;&#10;Voici quelques infos importantes..."
                  className="w-full mt-1.5 font-mono"
                  style={{ fontSize: 12, padding: "10px 12px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)", resize: "vertical" }} />
              </div>
            )}

            {type === "link" && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>URL</label>
                <input value={content} onChange={(e) => setContent(e.target.value)}
                  placeholder="https://..."
                  className="w-full mt-1.5"
                  style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)" }} />
              </div>
            )}
          </div>
        )}

        {step === "form" && (
          <DialogFooter>
            {!resource && (
              <button onClick={() => setStep("choose")} disabled={saving}
                className="rounded-md px-3 py-2 mr-auto" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                ← Retour
              </button>
            )}
            <button onClick={() => onOpenChange(false)} disabled={saving}
              className="rounded-md px-3 py-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Annuler
            </button>
            <button onClick={save} disabled={saving}
              className="rounded-md px-3 py-2"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              {saving ? "..." : resource ? "Sauvegarder" : "Ajouter"}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
