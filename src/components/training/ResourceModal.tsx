import { useEffect, useState } from "react";
import { Video, FileText, StickyNote, LinkIcon, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createResource, updateResource, uploadTrainingPdf, uploadTrainingVideo, getTrainingFileUrl } from "@/hooks/use-training";
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
  { type: "video", label: "Vidéo", description: "Lien externe ou fichier MP4", icon: Video },
  { type: "pdf", label: "PDF", description: "Document à uploader", icon: FileText },
  { type: "note", label: "Note texte", description: "Markdown / texte libre", icon: StickyNote },
  { type: "link", label: "Lien externe", description: "URL vers ressource", icon: LinkIcon },
];

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB

export function ResourceModal({ open, onOpenChange, folderId, stepId, resource, onSaved }: Props) {
  const [step, setStep] = useState<"choose" | "form">("choose");
  const [type, setType] = useState<ResourceType>("video");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSource, setVideoSource] = useState<"link" | "file">("link");
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState<number>(0);

  useEffect(() => {
    if (!open) return;
    if (resource) {
      setStep("form");
      setType(resource.type);
      setTitle(resource.title);
      setContent(resource.content);
      const isUploaded = !!resource.is_uploaded_video;
      setVideoSource(resource.type === "video" && isUploaded ? "file" : "link");
      if (resource.type === "video" && isUploaded) {
        getTrainingFileUrl(resource.content).then(setUploadedVideoUrl).catch(() => setUploadedVideoUrl(null));
      } else {
        setUploadedVideoUrl(null);
      }
    } else {
      setStep("choose");
      setType("video");
      setTitle("");
      setContent("");
      setFile(null);
      setVideoFile(null);
      setVideoSource("link");
      setUploadedVideoUrl(null);
    }
    setUploadPct(0);
  }, [open, resource]);

  // Prevent accidental close during upload
  useEffect(() => {
    if (!saving) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saving]);

  const pickType = (t: ResourceType) => { setType(t); setStep("form"); };

  const onPickVideoFile = (f: File | null) => {
    if (!f) { setVideoFile(null); return; }
    if (f.size > MAX_VIDEO_BYTES) {
      toast.error(`Fichier trop volumineux. Max 500 MB (le tien fait ${Math.round(f.size / (1024*1024))} MB)`);
      return;
    }
    const okExt = /\.(mp4|webm|mov)$/i.test(f.name);
    if (!okExt) {
      toast.error("Format non supporté. Utilise .mp4, .webm ou .mov");
      return;
    }
    setVideoFile(f);
  };

  const save = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    setSaving(true);
    try {
      let finalContent = content;
      let isUploadedVideo = false;

      if (type === "video") {
        if (videoSource === "file") {
          if (videoFile) {
            setUploadPct(1);
            finalContent = await uploadTrainingVideo(videoFile, folderId, stepId, setUploadPct);
            isUploadedVideo = true;
          } else if (resource?.is_uploaded_video) {
            // keep existing uploaded video
            isUploadedVideo = true;
            finalContent = resource.content;
          } else {
            toast.error("Fichier vidéo requis"); setSaving(false); return;
          }
        } else {
          if (!isValidVideoUrl(content)) { toast.error("URL invalide (YouTube, Vimeo ou Drive)"); setSaving(false); return; }
        }
      } else if (type === "pdf" && file) {
        finalContent = await uploadTrainingPdf(file, folderId, stepId);
      } else if (type === "link") {
        if (!isValidUrl(content)) { toast.error("URL invalide"); setSaving(false); return; }
      } else if (type === "note") {
        if (!content.trim()) { toast.error("Contenu requis"); setSaving(false); return; }
      } else if (type === "pdf" && !resource) {
        toast.error("Fichier PDF requis"); setSaving(false); return;
      }

      if (resource) {
        await updateResource(resource.id, { type, title: title.trim(), content: finalContent, is_uploaded_video: isUploadedVideo });
      } else {
        await createResource(stepId, { type, title: title.trim(), content: finalContent, is_uploaded_video: isUploadedVideo });
      }
      toast.success(resource ? "Ressource mise à jour" : "Ressource ajoutée");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
      setUploadPct(0);
    }
  };

  const videoPreview = type === "video" && videoSource === "link" && content && isValidVideoUrl(content)
    ? detectVideoEmbed(content).embedUrl : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (saving && !v) { toast.error("Upload en cours…"); return; } onOpenChange(v); }}>
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
                <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Type de vidéo</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button type="button" onClick={() => setVideoSource("link")} disabled={saving}
                    className="rounded-lg p-3 text-left transition-colors"
                    style={{
                      border: `0.5px solid ${videoSource === "link" ? "var(--coral)" : "var(--border)"}`,
                      backgroundColor: videoSource === "link" ? "var(--coral-light, #FFF1EC)" : "var(--background)",
                    }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>🔗 Lien externe</div>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>YouTube / Vimeo</div>
                  </button>
                  <button type="button" onClick={() => setVideoSource("file")} disabled={saving}
                    className="rounded-lg p-3 text-left transition-colors"
                    style={{
                      border: `0.5px solid ${videoSource === "file" ? "var(--coral)" : "var(--border)"}`,
                      backgroundColor: videoSource === "file" ? "var(--coral-light, #FFF1EC)" : "var(--background)",
                    }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>📁 Fichier vidéo</div>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>MP4 / WebM / MOV · max 500 MB</div>
                  </button>
                </div>

                {videoSource === "link" ? (
                  <div className="mt-3">
                    <input value={content} onChange={(e) => setContent(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full"
                      style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)" }} />
                    {videoPreview && (
                      <div className="mt-3 rounded-lg overflow-hidden" style={{ aspectRatio: "16/9", backgroundColor: "#000" }}>
                        <iframe src={videoPreview} className="w-full h-full" allowFullScreen title="preview" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3">
                    {uploadedVideoUrl && !videoFile && (
                      <div className="mb-2 rounded-lg overflow-hidden" style={{ backgroundColor: "#000" }}>
                        <video src={uploadedVideoUrl} controls preload="metadata" playsInline style={{ width: "100%", maxHeight: 280 }} />
                      </div>
                    )}
                    <label className="block rounded-lg cursor-pointer text-center py-6"
                      style={{ border: "1px dashed var(--border)", backgroundColor: "var(--background)" }}>
                      <Upload size={20} className="mx-auto mb-2" style={{ color: "var(--muted-foreground)" }} />
                      <div style={{ fontSize: 12 }}>{videoFile ? videoFile.name : (uploadedVideoUrl ? "Remplacer la vidéo" : "Cliquer pour choisir un fichier vidéo")}</div>
                      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>MP4 · WebM · MOV — max 500 MB</div>
                      <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" hidden
                        onChange={(e) => onPickVideoFile(e.target.files?.[0] ?? null)} disabled={saving} />
                    </label>
                    {videoFile && (
                      <div className="mt-2 flex items-center justify-between">
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                          {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                        <button onClick={() => setVideoFile(null)} disabled={saving}
                          className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                          <X size={11} /> Retirer
                        </button>
                      </div>
                    )}
                    {saving && uploadPct > 0 && (
                      <div className="mt-3">
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>
                          Upload en cours… {uploadPct}%
                        </div>
                        <div style={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "var(--muted)" }}>
                          <div style={{ width: `${uploadPct}%`, height: "100%", borderRadius: 3, backgroundColor: "var(--coral)", transition: "width 0.2s" }} />
                        </div>
                      </div>
                    )}
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
              {saving ? (uploadPct > 0 ? `Upload ${uploadPct}%…` : "...") : resource ? "Sauvegarder" : "Ajouter"}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
