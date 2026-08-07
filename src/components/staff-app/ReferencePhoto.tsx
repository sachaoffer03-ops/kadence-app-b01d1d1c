import { useEffect, useState } from "react";
import { Eye, X, Image as ImageIcon } from "lucide-react";
import { signChecklistPhoto } from "@/lib/checklist-photo-url";

/** Charge (et signe) l'URL de la photo de référence d'une zone. */
export function useReferencePhoto(rawUrl: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!rawUrl) { setUrl(null); return; }
    signChecklistPhoto(rawUrl).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [rawUrl]);
  return url;
}

/** Plein écran : modèle attendu, avec comparaison si l'employé a déjà pris sa photo. */
export function ReferenceLightbox({ open, onClose, label, referenceUrl, takenUrl }: {
  open: boolean;
  onClose: () => void;
  label: string;
  referenceUrl: string;
  takenUrl?: string | null;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ backgroundColor: "rgba(0,0,0,0.92)", paddingTop: "max(12px, env(safe-area-inset-top))", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 pb-3" style={{ color: "#fff" }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <button onClick={onClose} className="rounded-full p-2" style={{ backgroundColor: "rgba(255,255,255,0.12)" }} aria-label="Fermer">
          <X size={16} color="#fff" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Modèle attendu</div>
          <img src={referenceUrl} alt={`Modèle attendu — ${label}`} className="w-full rounded-xl" style={{ objectFit: "contain", maxHeight: "60vh" }} />
        </div>
        {takenUrl && (
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Ta photo</div>
            <img src={takenUrl} alt={`Ta photo — ${label}`} className="w-full rounded-xl" style={{ objectFit: "contain", maxHeight: "60vh" }} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Vignette discrète « Modèle » — s'ouvre en plein écran au tap. */
export function ReferenceThumb({ url, label, takenUrl }: { url: string; label: string; takenUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 w-full"
        style={{ backgroundColor: "var(--muted)" }}
      >
        <img src={url} alt="" className="rounded-md shrink-0" style={{ width: 34, height: 26, objectFit: "cover" }} />
        <span className="flex-1 text-left" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          Modèle attendu
        </span>
        <Eye size={13} style={{ color: "var(--coral-dark)" }} />
      </button>
      <ReferenceLightbox open={open} onClose={() => setOpen(false)} label={label} referenceUrl={url} takenUrl={takenUrl} />
    </>
  );
}

/** Placeholder de prise de vue : la référence en fond estompé + appel à l'action. */
export function ReferenceBackdrop({ url }: { url: string }) {
  return (
    <>
      <img src={url} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover", opacity: 0.28, filter: "saturate(0.7)" }} />
      <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(255,255,255,0.9)", fontSize: 10, fontWeight: 500 }}>
        <ImageIcon size={10} /> Modèle
      </div>
    </>
  );
}
