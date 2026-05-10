import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PackageSearch, Wrench, Sparkles, MoreHorizontal, Check, RotateCcw, Trash2, Clock, X, Send } from "lucide-react";
import { employees, getInitials } from "@/lib/mock-data";

export const Route = createFileRoute("/signalements")({
  component: SignalementsPage,
  head: () => ({ meta: [{ title: "Signalements — Shyft" }] }),
});

type Category = "Stock" | "Matériel" | "Hygiène" | "Autre";
type Status = "nouveau" | "en_cours" | "resolu";

interface Note { author: string; at: string; text: string }
interface Signalement {
  id: string;
  category: Category;
  title: string;
  details?: string;
  studio: string;
  authorId: string;
  createdAt: string; // ISO
  status: Status;
  notes: Note[];
}

const CATEGORIES: Category[] = ["Stock", "Matériel", "Hygiène", "Autre"];

const catMeta: Record<Category, { icon: React.ElementType; bg: string; text: string; dot: string }> = {
  "Stock":    { icon: PackageSearch, bg: "var(--coral-bg)",   text: "var(--coral-text)",   dot: "var(--coral)" },
  "Matériel": { icon: Wrench,        bg: "var(--info-bg)",    text: "var(--info-text)",    dot: "var(--info-text)" },
  "Hygiène":  { icon: Sparkles,      bg: "var(--success-bg)", text: "var(--success-text)", dot: "var(--success-text)" },
  "Autre":    { icon: MoreHorizontal,bg: "var(--muted)",      text: "var(--muted-foreground)", dot: "var(--muted-foreground)" },
};

const statusMeta: Record<Status, { label: string; bg: string; text: string }> = {
  nouveau:  { label: "Nouveau",  bg: "var(--coral-bg)",   text: "var(--coral-text)" },
  en_cours: { label: "En cours", bg: "var(--warning-bg)", text: "var(--warning-text)" },
  resolu:   { label: "Résolu",   bg: "var(--success-bg)", text: "var(--success-text)" },
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const initialSignalements: Signalement[] = [
  { id: "s1", category: "Stock",    title: "Plus de lait entier",                  details: "Il reste juste 2 briques d'avoine.", studio: "Skult Rhodes",    authorId: "1", createdAt: minutesAgo(12),   status: "nouveau",  notes: [] },
  { id: "s2", category: "Hygiène",  title: "Plus de papier toilette WC clients",   details: "Stock vide dans les deux toilettes.", studio: "Skult Châtelain", authorId: "6", createdAt: minutesAgo(48),   status: "nouveau",  notes: [] },
  { id: "s3", category: "Matériel", title: "Moulin à café qui chauffe",            details: "Bruit anormal depuis ce matin.",      studio: "Skult Rhodes",    authorId: "5", createdAt: minutesAgo(120),  status: "en_cours", notes: [{ author: "Sacha", at: minutesAgo(60), text: "Technicien contacté, passage demain matin." }] },
  { id: "s4", category: "Stock",    title: "Sirop vanille épuisé",                                                                  studio: "Skult Châtelain", authorId: "2", createdAt: minutesAgo(220),  status: "nouveau",  notes: [] },
  { id: "s5", category: "Autre",    title: "Client a oublié sa veste hier soir",   details: "Veste noire taille M, gardée au coffre.", studio: "Skult Rhodes",    authorId: "3", createdAt: minutesAgo(1440), status: "en_cours", notes: [] },
  { id: "s6", category: "Hygiène",  title: "Bouteille de savon mains vide",                                                          studio: "Skult Rhodes",    authorId: "1", createdAt: minutesAgo(2880), status: "resolu",   notes: [{ author: "Sacha", at: minutesAgo(2400), text: "Réapprovisionné." }] },
  { id: "s7", category: "Matériel", title: "Chaise terrasse cassée",               details: "Pied avant droit fissuré, dangereux.",  studio: "Skult Châtelain", authorId: "9", createdAt: minutesAgo(4320), status: "resolu",   notes: [] },
];

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.round(h / 24);
  return `il y a ${d}j`;
};

function SignalementsPage() {
  const [items, setItems] = useState<Signalement[]>(initialSignalements);
  const [studio, setStudio] = useState<"Tous" | string>("Tous");
  const [cat, setCat] = useState<"Toutes" | Category>("Toutes");
  const [status, setStatus] = useState<"Tous" | Status>("Tous");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return [...items]
      .filter(s => studio === "Tous" || s.studio === studio)
      .filter(s => cat === "Toutes" || s.category === cat)
      .filter(s => status === "Tous" || s.status === status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, studio, cat, status]);

  const counts = useMemo(() => ({
    nouveau: items.filter(s => s.status === "nouveau").length,
    en_cours: items.filter(s => s.status === "en_cours").length,
    resolu: items.filter(s => s.status === "resolu").length,
  }), [items]);

  const update = (id: string, patch: Partial<Signalement>) => {
    setItems(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const remove = (id: string) => {
    setItems(prev => prev.filter(s => s.id !== id));
    setOpenId(null);
    toast.success("Signalement supprimé");
  };

  const opened = items.find(s => s.id === openId) || null;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div style={{ fontSize: 20, fontWeight: 500 }}>Signalements</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
            Réassorts, casse et remarques remontés par l'équipe en shift.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Stat label="Nouveaux" value={counts.nouveau} color="var(--coral-text)" bg="var(--coral-bg)" />
          <Stat label="En cours" value={counts.en_cours} color="var(--warning-text)" bg="var(--warning-bg)" />
          <Stat label="Résolus" value={counts.resolu} color="var(--success-text)" bg="var(--success-bg)" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <FilterGroup label="Studio" value={studio} options={["Tous", "Skult Rhodes", "Skult Châtelain"]} onChange={setStudio} />
        <FilterGroup label="Catégorie" value={cat} options={["Toutes", ...CATEGORIES]} onChange={(v) => setCat(v as typeof cat)} />
        <FilterGroup label="Statut" value={status === "Tous" ? "Tous" : statusMeta[status as Status].label} options={["Tous", "Nouveau", "En cours", "Résolu"]} onChange={(v) => {
          if (v === "Tous") setStatus("Tous");
          else if (v === "Nouveau") setStatus("nouveau");
          else if (v === "En cours") setStatus("en_cours");
          else setStatus("resolu");
        }} />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Aucun signalement</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>Les remarques de l'équipe apparaîtront ici en temps réel.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(s => {
            const emp = employees.find(e => e.id === s.authorId);
            const cm = catMeta[s.category];
            const sm = statusMeta[s.status];
            const Icon = cm.icon;
            return (
              <div key={s.id} className="rounded-xl border p-4 transition-colors" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", cursor: "pointer" }}
                onClick={() => setOpenId(s.id)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--foreground)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center rounded-md shrink-0" style={{ width: 36, height: 36, backgroundColor: cm.bg, color: cm.text }}>
                    <Icon size={16} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span style={{ fontSize: 11, color: cm.text, backgroundColor: cm.bg, padding: "1px 7px", borderRadius: 999, fontWeight: 500 }}>{s.category}</span>
                      <span style={{ fontSize: 11, color: sm.text, backgroundColor: sm.bg, padding: "1px 7px", borderRadius: 999, fontWeight: 500 }}>{sm.label}</span>
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>· {s.studio.replace("Skult ", "")}</span>
                      <span className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                        <Clock size={11} /> {formatRelative(s.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: s.details ? 4 : 0 }}>{s.title}</div>
                    {s.details && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{s.details}</div>}
                    {emp && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center justify-center rounded-full" style={{ width: 18, height: 18, fontSize: 9, fontWeight: 500, backgroundColor: "var(--muted)" }}>
                          {getInitials(emp.firstName, emp.lastName)}
                        </div>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{emp.firstName} {emp.lastName}</span>
                        {s.notes.length > 0 && (
                          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>· {s.notes.length} note{s.notes.length > 1 ? "s" : ""}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {s.status !== "resolu" && s.status !== "en_cours" && (
                      <QuickBtn label="Prendre" onClick={() => { update(s.id, { status: "en_cours" }); toast.success("Marqué en cours"); }} />
                    )}
                    {s.status !== "resolu" && (
                      <QuickBtn label="Résoudre" primary icon={<Check size={12} />} onClick={() => { update(s.id, { status: "resolu" }); toast.success("Signalement résolu"); }} />
                    )}
                    {s.status === "resolu" && (
                      <QuickBtn label="Rouvrir" icon={<RotateCcw size={12} />} onClick={() => { update(s.id, { status: "nouveau" }); toast("Signalement rouvert"); }} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {opened && (
        <DetailDrawer
          item={opened}
          onClose={() => setOpenId(null)}
          onUpdate={(patch) => update(opened.id, patch)}
          onAddNote={(text) => update(opened.id, { notes: [...opened.notes, { author: "Sacha", at: new Date().toISOString(), text }] })}
          onDelete={() => remove(opened.id)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className="rounded-lg px-3 py-1.5" style={{ backgroundColor: bg }}>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 16, fontWeight: 500, color }}>{value}</span>
        <span style={{ fontSize: 11, color, fontWeight: 500 }}>{label}</span>
      </div>
    </div>
  );
}

function FilterGroup({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--muted)" }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", padding: "0 8px" }}>{label}</span>
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} className="rounded-md px-2.5 py-1 transition-colors" style={{
          fontSize: 11, fontWeight: 500,
          backgroundColor: value === o ? "var(--card)" : "transparent",
          color: value === o ? "var(--foreground)" : "var(--muted-foreground)",
          boxShadow: value === o ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
        }}>{o}</button>
      ))}
    </div>
  );
}

function QuickBtn({ label, onClick, primary, icon }: { label: string; onClick: () => void; primary?: boolean; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors" style={{
      fontSize: 11, fontWeight: 500,
      border: primary ? "none" : "0.5px solid var(--border)",
      backgroundColor: primary ? "var(--foreground)" : "var(--card)",
      color: primary ? "var(--background)" : "var(--foreground)",
    }}>
      {icon} {label}
    </button>
  );
}

function DetailDrawer({ item, onClose, onUpdate, onAddNote, onDelete }: {
  item: Signalement;
  onClose: () => void;
  onUpdate: (patch: Partial<Signalement>) => void;
  onAddNote: (text: string) => void;
  onDelete: () => void;
}) {
  const [note, setNote] = useState("");
  const emp = employees.find(e => e.id === item.authorId);
  const cm = catMeta[item.category];
  const Icon = cm.icon;

  const submit = () => {
    const t = note.trim();
    if (!t) return;
    if (t.length > 500) { toast.error("Note trop longue (max 500 car.)"); return; }
    onAddNote(t);
    setNote("");
    toast.success("Note ajoutée");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="h-full w-full max-w-md flex flex-col border-l" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center rounded-md" style={{ width: 28, height: 28, backgroundColor: cm.bg, color: cm.text }}>
              <Icon size={14} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Détails</div>
          </div>
          <button onClick={onClose} className="rounded p-1" style={{ color: "var(--muted-foreground)" }}><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>{item.title}</div>
          {item.details && <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 12 }}>{item.details}</div>}

          <div className="grid grid-cols-2 gap-2 mb-5">
            <Field label="Studio" value={item.studio} />
            <Field label="Catégorie" value={item.category} />
            <Field label="Signalé par" value={emp ? `${emp.firstName} ${emp.lastName}` : "—"} />
            <Field label="Créé" value={formatRelative(item.createdAt)} />
          </div>

          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Statut</div>
          <div className="flex gap-2 mb-5">
            {(["nouveau", "en_cours", "resolu"] as Status[]).map(st => {
              const sm = statusMeta[st];
              const on = item.status === st;
              return (
                <button key={st} onClick={() => onUpdate({ status: st })} className="rounded-md px-2.5 py-1.5" style={{
                  fontSize: 11, fontWeight: 500,
                  backgroundColor: on ? sm.bg : "transparent",
                  color: on ? sm.text : "var(--muted-foreground)",
                  border: `0.5px solid ${on ? sm.text : "var(--border)"}`,
                }}>{sm.label}</button>
              );
            })}
          </div>

          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Notes internes ({item.notes.length})</div>
          <div className="flex flex-col gap-2 mb-3">
            {item.notes.length === 0 && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucune note pour le moment.</div>}
            {item.notes.map((n, i) => (
              <div key={i} className="rounded-lg p-3" style={{ backgroundColor: "var(--muted)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{n.author}</span>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{formatRelative(n.at)}</span>
                </div>
                <div style={{ fontSize: 12 }}>{n.text}</div>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={500}
              placeholder="Ajouter une note interne…"
              rows={2}
              className="flex-1 rounded-md px-3 py-2 resize-none"
              style={{ fontSize: 12, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}
            />
            <button onClick={submit} disabled={!note.trim()} className="rounded-md p-2" style={{
              backgroundColor: "var(--foreground)", color: "var(--background)", opacity: note.trim() ? 1 : 0.5,
            }}><Send size={14} /></button>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={onDelete} className="flex items-center gap-1 rounded-md px-3 py-1.5" style={{ fontSize: 12, color: "var(--danger-text)", border: "0.5px solid var(--border)" }}>
            <Trash2 size={12} /> Supprimer
          </button>
          <button onClick={onClose} className="rounded-md px-3 py-1.5" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--background)" }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ backgroundColor: "var(--muted)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 500 }}>{value}</div>
    </div>
  );
}
