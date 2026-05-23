import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Loader2, Check, FileVideo, FileText, Image as ImageIcon, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createContent, updateContent } from "@/lib/formation.functions";
import type { ContentRow, ContentType } from "./types";
import { TYPE_LABEL } from "./types";
import { ContentPreview, PreviewFrame } from "./ContentPreview";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string;
  moduleId: string;
  type: ContentType;
  existing: ContentRow | null;
  onSaved: () => void;
}

function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(v.duration || 0) || null); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
  });
}

const TYPE_ICON = {
  video: FileVideo,
  pdf: FileText,
  image: ImageIcon,
  text: FileText,
  quiz: FileText,
} as const;

export function ContentEditModal({ open, onOpenChange, courseId, moduleId, type, existing, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [textContent, setTextContent] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = useServerFn(createContent);
  const update = useServerFn(updateContent);

  useEffect(() => {
    if (open) {
      setTitle(existing?.title ?? "");
      setDescription(existing?.description ?? "");
      setUrl(existing?.url ?? null);
      setExternalUrl(existing?.external_url ?? "");
      setTextContent(existing?.text_content ?? "");
      setDuration(existing?.duration_seconds ?? null);
    }
  }, [open, existing]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const bucket = type === "video" ? "training-videos" : "training-files";
      const ext = file.name.split(".").pop() || (type === "video" ? "mp4" : "bin");
      const path = `${courseId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      setUrl(signed?.signedUrl ?? null);
      if (type === "video") {
        const d = await readVideoDuration(file);
        if (d) setDuration(d);
      }
      toast.success("Fichier envoyé");
    } catch (e: any) {
      toast.error(e.message || "Upload échoué");
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    setSaving(true);
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        url: url || null,
        external_url: externalUrl.trim() || null,
        text_content: type === "text" ? (textContent || null) : null,
        duration_seconds: type === "video" ? duration : null,
      };
      if (existing) {
        await update({ data: { contentId: existing.id, ...payload } });
      } else {
        await create({ data: { moduleId, type, ...payload } });
      }
      toast.success("Enregistré"); onOpenChange(false); onSaved();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const Icon = TYPE_ICON[type] ?? FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
        <DialogHeader className="px-7 pt-6 pb-5" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, backgroundColor: "var(--muted)" }}>
              <Icon size={16} strokeWidth={1.5} style={{ color: "var(--foreground)" }} />
            </div>
            <div className="flex flex-col">
              <DialogTitle style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em" }}>
                {existing ? "Modifier le contenu" : "Nouveau contenu"}
              </DialogTitle>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                {TYPE_LABEL[type]}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="px-7 py-6 flex flex-col gap-5 max-h-[65vh] overflow-y-auto">
          <Field label="Titre">
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Introduction à la machine"
              className="w-full bg-transparent outline-none transition-colors"
              style={inputBare} onFocus={(e) => e.currentTarget.style.borderColor = "var(--foreground)"} onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"} />
          </Field>

          <Field label="Description" optional>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Quelques mots pour situer le contenu…"
              className="w-full bg-transparent outline-none transition-colors resize-none"
              style={inputBare} onFocus={(e) => e.currentTarget.style.borderColor = "var(--foreground)"} onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"} />
          </Field>

          {(type === "video" || type === "pdf" || type === "image") && (
            <Field label="Fichier">
              <label className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg transition-colors hover:bg-[var(--muted)]"
                style={{ padding: "22px 16px", border: `1px dashed ${url ? "var(--foreground)" : "var(--border)"}`, backgroundColor: url ? "var(--muted)" : "transparent" }}>
                {uploading ? (
                  <>
                    <Loader2 size={18} strokeWidth={1.5} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Envoi en cours…</span>
                  </>
                ) : url ? (
                  <>
                    <div className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, backgroundColor: "var(--foreground)" }}>
                      <Check size={14} strokeWidth={2} style={{ color: "var(--card)" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Fichier prêt</span>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Cliquer pour remplacer</span>
                  </>
                ) : (
                  <>
                    <Upload size={18} strokeWidth={1.5} style={{ color: "var(--muted-foreground)" }} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Déposer un fichier ou parcourir</span>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      {type === "video" ? "MP4, MOV, WebM" : type === "pdf" ? "PDF uniquement" : "PNG, JPG, WebP"}
                    </span>
                  </>
                )}
                <input type="file" hidden accept={type === "video" ? "video/*" : type === "pdf" ? "application/pdf" : "image/*"}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </label>
            </Field>
          )}

          {type === "video" && (
            <>
              <div className="flex items-center gap-3" style={{ marginTop: -4 }}>
                <div className="flex-1" style={{ height: "0.5px", backgroundColor: "var(--border)" }} />
                <span style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", letterSpacing: "0.08em" }}>OU</span>
                <div className="flex-1" style={{ height: "0.5px", backgroundColor: "var(--border)" }} />
              </div>

              <Field label="Lien externe" optional>
                <div className="flex items-center gap-2 rounded-md transition-colors" style={{ border: "0.5px solid var(--border)", padding: "0 12px", backgroundColor: "var(--background)" }}>
                  <Link2 size={13} strokeWidth={1.5} style={{ color: "var(--muted-foreground)" }} />
                  <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="YouTube, Vimeo…"
                    className="w-full bg-transparent outline-none"
                    style={{ fontSize: 13, padding: "9px 0" }} />
                </div>
              </Field>

              <Field label="Durée">
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={duration ?? ""} onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : null)}
                    placeholder="0"
                    className="bg-transparent outline-none transition-colors text-right"
                    style={{ ...inputBare, width: 90 }} />
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>secondes</span>
                </div>
              </Field>
            </>
          )}

          {type === "text" && (
            <Field label="Contenu" hint="Markdown supporté">
              <textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={10} placeholder="# Titre&#10;&#10;Votre contenu…"
                className="w-full bg-transparent outline-none transition-colors resize-none"
                style={{ ...inputBare, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, lineHeight: 1.6 }} />
            </Field>
          )}

          {type !== "quiz" && (
            <PreviewFrame>
              <ContentPreview content={{ type, title, url, external_url: externalUrl, text_content: textContent, duration_seconds: duration }} />
            </PreviewFrame>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-7 py-4" style={{ borderTop: "0.5px solid var(--border)", backgroundColor: "var(--muted)" }}>
          <button onClick={() => onOpenChange(false)} disabled={saving}
            className="rounded-md transition-colors hover:bg-[var(--card)]"
            style={{ fontSize: 12, fontWeight: 500, padding: "8px 14px", color: "var(--muted-foreground)" }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving || uploading}
            className="rounded-md transition-opacity disabled:opacity-50"
            style={{ fontSize: 12, fontWeight: 500, padding: "8px 16px", backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const inputBare: React.CSSProperties = {
  fontSize: 13,
  padding: "9px 12px",
  border: "0.5px solid var(--border)",
  borderRadius: 6,
  backgroundColor: "var(--background)",
};

function Field({ label, optional, hint, children }: { label: string; optional?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.005em" }}>
          {label}
          {optional && <span style={{ color: "var(--muted-foreground)", fontWeight: 400, marginLeft: 6 }}>· optionnel</span>}
        </label>
        {hint && <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
