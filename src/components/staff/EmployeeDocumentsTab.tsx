import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Upload, Download, Trash2, MoreVertical, Eye, EyeOff, X, Pencil, Plus, FileSpreadsheet, FileCheck2, Paperclip } from "lucide-react";
import {
  listEmployeeDocuments,
  uploadEmployeeDocument,
  deleteEmployeeDocument,
  updateEmployeeDocument,
  getDocumentDownloadUrl,
} from "@/lib/documents.functions";

type DocType = "fiche_paie" | "contrat" | "attestation" | "autre";

interface EmployeeDoc {
  id: string;
  type: DocType;
  title: string;
  description: string | null;
  file_path: string;
  file_size_bytes: number;
  file_mime_type: string | null;
  period_start: string | null;
  period_end: string | null;
  first_viewed_at: string | null;
  created_at: string;
  uploaded_by: string | null;
}

const TYPE_LABEL: Record<DocType, string> = {
  fiche_paie: "Fiche de paie",
  contrat: "Contrat",
  attestation: "Attestation",
  autre: "Autre",
};

const FILTERS: { value: DocType | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "fiche_paie", label: "Fiches de paie" },
  { value: "contrat", label: "Contrats" },
  { value: "attestation", label: "Attestations" },
  { value: "autre", label: "Autres" },
];

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function fmtSize(b: number) {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / 1024 / 1024).toFixed(1)} Mo`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function iconForType(t: DocType) {
  if (t === "fiche_paie") return FileSpreadsheet;
  if (t === "contrat") return FileCheck2;
  if (t === "attestation") return FileText;
  return Paperclip;
}
function autoTitle(type: DocType) {
  const now = new Date();
  if (type === "fiche_paie") return `Fiche de paie — ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  if (type === "contrat") return `Contrat ${now.getFullYear()}`;
  if (type === "attestation") return "Attestation";
  return "Document";
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",").pop() || "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function EmployeeDocumentsTab({ userId, firstName }: { userId: string; firstName: string }) {
  const list = useServerFn(listEmployeeDocuments);
  const upload = useServerFn(uploadEmployeeDocument);
  const del = useServerFn(deleteEmployeeDocument);
  const update = useServerFn(updateEmployeeDocument);
  const getUrl = useServerFn(getDocumentDownloadUrl);

  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [uploaders, setUploaders] = useState<Record<string, { first_name: string; last_name: string }>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DocType | "all">("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeDoc | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EmployeeDoc | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await list({ data: { userId } });
      setDocs(r.documents as EmployeeDoc[]);
      setUploaders(r.uploaders);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [userId]);

  const filtered = filter === "all" ? docs : docs.filter(d => d.type === filter);

  const handleDownload = async (d: EmployeeDoc) => {
    try {
      const { url } = await getUrl({ data: { documentId: d.id } });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };
  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await del({ data: { documentId: confirmDelete.id } });
      toast.success("Document supprimé");
      setConfirmDelete(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500 }}>Documents de {firstName}</h2>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
            Fiches de paie, contrats et attestations. {docs.length} document{docs.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="rounded-md px-3 py-2 inline-flex items-center gap-1.5"
          style={{ backgroundColor: "var(--coral)", color: "var(--coral-text)", fontSize: 12, fontWeight: 500 }}
        >
          <Plus size={14} /> Uploader un document
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className="rounded-full px-3 py-1"
            style={{
              fontSize: 11, fontWeight: 500,
              backgroundColor: filter === f.value ? "var(--foreground)" : "var(--card)",
              color: filter === f.value ? "var(--background)" : "var(--muted-foreground)",
              border: "0.5px solid var(--border)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl h-16" style={{ backgroundColor: "var(--muted)", opacity: 0.5 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
          <FileText size={28} style={{ color: "var(--muted-foreground)", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Aucun document pour ce filtre.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(d => {
            const Icon = iconForType(d.type);
            const uploader = d.uploaded_by ? uploaders[d.uploaded_by] : null;
            return (
              <DocCard
                key={d.id}
                d={d}
                Icon={Icon}
                uploaderName={uploader ? `${uploader.first_name} ${uploader.last_name}` : "Admin"}
                onDownload={() => handleDownload(d)}
                onEdit={() => setEditing(d)}
                onDelete={() => setConfirmDelete(d)}
              />
            );
          })}
        </div>
      )}

      {uploadOpen && (
        <UploadModal
          userId={userId}
          onClose={() => setUploadOpen(false)}
          onUpload={async (payload) => {
            await upload({ data: payload });
            toast.success("Document uploadé");
            setUploadOpen(false);
            reload();
          }}
        />
      )}

      {editing && (
        <EditModal
          doc={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await update({ data: { documentId: editing.id, patch } });
            toast.success("Document mis à jour");
            setEditing(null);
            reload();
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Supprimer ce document ?"
          message={`Supprimer définitivement « ${confirmDelete.title} » ? L'employé ne pourra plus le télécharger.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function DocCard({ d, Icon, uploaderName, onDownload, onEdit, onDelete }: {
  d: EmployeeDoc; Icon: any; uploaderName: string;
  onDownload: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = [
    TYPE_LABEL[d.type],
    d.period_start ? `${new Date(d.period_start).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}` : null,
    fmtSize(d.file_size_bytes),
    `uploadé le ${fmtDate(d.created_at)} par ${uploaderName}`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
      <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 40, height: 40, backgroundColor: "var(--muted)" }}>
        <Icon size={18} style={{ color: "var(--muted-foreground)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div style={{ fontSize: 13, fontWeight: 500 }} className="truncate">{d.title}</div>
          {d.first_viewed_at ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ fontSize: 10, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
              <Eye size={10} /> Consulté le {fmtDate(d.first_viewed_at)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ fontSize: 10, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
              <EyeOff size={10} /> Non consulté
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }} className="truncate">{meta}</div>
      </div>
      <button onClick={onDownload} className="rounded-md px-2.5 py-1.5 inline-flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--muted)" }}>
        <Download size={12} /> Télécharger
      </button>
      <div className="relative">
        <button onClick={() => setMenuOpen(o => !o)} className="rounded-md p-1.5" style={{ backgroundColor: "var(--muted)" }}>
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-9 z-20 rounded-md py-1" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", minWidth: 140 }}>
              <button onClick={() => { setMenuOpen(false); onEdit(); }} className="w-full px-3 py-1.5 text-left inline-flex items-center gap-2" style={{ fontSize: 12 }}>
                <Pencil size={12} /> Modifier
              </button>
              <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full px-3 py-1.5 text-left inline-flex items-center gap-2" style={{ fontSize: 12, color: "#c43" }}>
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "var(--background)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 500 }}>{title}</h3>
          <button onClick={onClose} className="rounded-md p-1" style={{ backgroundColor: "var(--muted)" }}>
            <X size={14} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function UploadModal({ userId, onClose, onUpload }: {
  userId: string;
  onClose: () => void;
  onUpload: (payload: any) => Promise<void>;
}) {
  const [type, setType] = useState<DocType>("fiche_paie");
  const [title, setTitle] = useState(autoTitle("fiche_paie"));
  const [description, setDescription] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onTypeChange = (t: DocType) => {
    setType(t);
    setTitle(autoTitle(t));
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 10 Mo)"); return; }
    if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(f.type)) {
      toast.error("Type non supporté (PDF, PNG, JPG, WEBP)");
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    if (!file) { toast.error("Choisis un fichier"); return; }
    if (!title.trim()) { toast.error("Titre requis"); return; }
    setBusy(true);
    try {
      const fileBase64 = await fileToBase64(file);
      await onUpload({
        userId, type, title, description: description || null,
        periodStart: periodStart || null, periodEnd: periodEnd || null,
        fileBase64, fileName: file.name, fileMimeType: file.type,
      });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Uploader un document" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>Type de document</label>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            {(["fiche_paie", "contrat", "attestation", "autre"] as DocType[]).map(t => {
              const Icon = iconForType(t);
              const active = type === t;
              return (
                <button key={t} onClick={() => onTypeChange(t)}
                  className="rounded-lg p-2.5 inline-flex items-center gap-2"
                  style={{
                    border: `1px solid ${active ? "var(--coral)" : "var(--border)"}`,
                    backgroundColor: active ? "var(--coral-light)" : "var(--card)",
                    fontSize: 12, fontWeight: 500,
                  }}>
                  <Icon size={14} /> {TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Titre">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
            className="w-full rounded-md px-3 py-2" style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }} />
        </Field>

        <Field label="Description (facultatif)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2}
            className="w-full rounded-md px-3 py-2" style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)", resize: "vertical" }} />
        </Field>

        {type === "fiche_paie" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Début période">
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-md px-3 py-2" style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }} />
            </Field>
            <Field label="Fin période">
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-md px-3 py-2" style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }} />
            </Field>
          </div>
        )}

        <div>
          <label style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>Fichier (PDF, PNG, JPG, WEBP — max 10 Mo)</label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0] || null); }}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg p-5 text-center cursor-pointer mt-1.5"
            style={{ border: "1.5px dashed var(--border)", backgroundColor: "var(--card)" }}
          >
            <Upload size={20} style={{ color: "var(--muted-foreground)", margin: "0 auto 6px" }} />
            {file ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{file.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{fmtSize(file.size)}</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Glisse un fichier ou clique pour choisir</div>
            )}
            <input ref={inputRef} type="file" hidden
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => handleFile(e.target.files?.[0] || null)} />
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button onClick={onClose} className="flex-1 rounded-md py-2" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--muted)" }}>Annuler</button>
          <button onClick={submit} disabled={busy} className="flex-1 rounded-md py-2"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Upload..." : "Uploader"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function EditModal({ doc, onClose, onSave }: {
  doc: EmployeeDoc;
  onClose: () => void;
  onSave: (patch: any) => Promise<void>;
}) {
  const [type, setType] = useState<DocType>(doc.type);
  const [title, setTitle] = useState(doc.title);
  const [description, setDescription] = useState(doc.description ?? "");
  const [periodStart, setPeriodStart] = useState(doc.period_start ?? "");
  const [periodEnd, setPeriodEnd] = useState(doc.period_end ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onSave({
        type, title, description: description || null,
        period_start: periodStart || null, period_end: periodEnd || null,
      });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Modifier le document" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as DocType)}
            className="w-full rounded-md px-3 py-2" style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
            {(Object.keys(TYPE_LABEL) as DocType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Titre">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
            className="w-full rounded-md px-3 py-2" style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }} />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2}
            className="w-full rounded-md px-3 py-2" style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)", resize: "vertical" }} />
        </Field>
        {type === "fiche_paie" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Début période">
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-md px-3 py-2" style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }} />
            </Field>
            <Field label="Fin période">
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-md px-3 py-2" style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }} />
            </Field>
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          Fichier : {doc.file_path.split("/").pop()} · {fmtSize(doc.file_size_bytes)} (non modifiable)
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-md py-2" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--muted)" }}>Annuler</button>
          <button onClick={submit} disabled={busy} className="flex-1 rounded-md py-2"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <ModalShell title={title} onClose={onCancel}>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 16 }}>{message}</p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-md py-2" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--muted)" }}>Annuler</button>
        <button onClick={onConfirm} className="flex-1 rounded-md py-2" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "#c43", color: "#fff" }}>
          Supprimer
        </button>
      </div>
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
