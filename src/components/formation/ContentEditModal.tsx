import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createContent, updateContent } from "@/lib/formation.functions";
import type { ContentRow, ContentType } from "./types";
import { TYPE_LABEL } from "./types";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ fontSize: 16, fontWeight: 500 }}>
            {existing ? "Modifier" : "Ajouter"} — {TYPE_LABEL[type]}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2 max-h-[60vh] overflow-y-auto">
          <Field label="Titre">
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md"
              style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
          </Field>
          <Field label="Description (optionnel)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-md"
              style={{ fontSize: 12, padding: "8px 12px", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
          </Field>

          {(type === "video" || type === "pdf" || type === "image") && (
            <Field label="Fichier">
              <div className="flex flex-col gap-2">
                <label className="rounded-md flex items-center justify-center gap-2 cursor-pointer"
                  style={{ padding: "10px", border: "0.5px dashed var(--border)", fontSize: 12, color: "var(--muted-foreground)" }}>
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? "Envoi…" : url ? "Remplacer le fichier" : `Choisir un ${TYPE_LABEL[type].toLowerCase()}`}
                  <input type="file" hidden accept={type === "video" ? "video/*" : type === "pdf" ? "application/pdf" : "image/*"}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                </label>
                {url && <div style={{ fontSize: 11, color: "var(--muted-foreground)", wordBreak: "break-all" }}>✓ Fichier prêt</div>}
              </div>
            </Field>
          )}

          {type === "video" && (
            <>
              <Field label="OU URL externe (YouTube, Vimeo…)">
                <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" className="w-full rounded-md"
                  style={{ fontSize: 12, padding: "8px 12px", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
              </Field>
              <Field label="Durée (secondes)">
                <input type="number" min={0} value={duration ?? ""} onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : null)}
                  className="w-32 rounded-md"
                  style={{ fontSize: 12, padding: "8px 12px", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
              </Field>
            </>
          )}

          {type === "text" && (
            <Field label="Contenu (markdown)">
              <textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={8} className="w-full rounded-md"
                style={{ fontSize: 12, padding: "8px 12px", border: "0.5px solid var(--border)", backgroundColor: "var(--background)", fontFamily: "monospace" }} />
            </Field>
          )}
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} disabled={saving} className="rounded-md px-3 py-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving || uploading} className="rounded-md px-3 py-2" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            {saving ? "..." : "Enregistrer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
