import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { employees, getInitials } from "@/lib/mock-data";

export const Route = createFileRoute("/signalements")({
  component: SignalementsPage,
  head: () => ({ meta: [{ title: "Signalements — Shyft" }] }),
});

type Category = "Stock" | "Matériel" | "Hygiène" | "Autre";

interface Signalement {
  id: string;
  category: Category;
  message: string;
  studio: string;
  authorId: string;
  createdAt: string;
  resolved: boolean;
}

const CATEGORIES: Category[] = ["Stock", "Matériel", "Hygiène", "Autre"];
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const initial: Signalement[] = [
  { id: "s1", category: "Stock",    message: "Plus de lait entier, il reste juste 2 briques d'avoine.",      studio: "Skult Rhodes",    authorId: "1", createdAt: minutesAgo(12),   resolved: false },
  { id: "s2", category: "Hygiène",  message: "Plus de papier toilette dans les WC clients.",                 studio: "Skult Châtelain", authorId: "6", createdAt: minutesAgo(48),   resolved: false },
  { id: "s3", category: "Matériel", message: "Moulin à café qui chauffe et fait un bruit anormal.",          studio: "Skult Rhodes",    authorId: "5", createdAt: minutesAgo(120),  resolved: false },
  { id: "s4", category: "Stock",    message: "Sirop vanille épuisé.",                                        studio: "Skult Châtelain", authorId: "2", createdAt: minutesAgo(220),  resolved: false },
  { id: "s5", category: "Autre",    message: "Client a oublié sa veste hier soir, gardée au coffre.",        studio: "Skult Rhodes",    authorId: "3", createdAt: minutesAgo(1440), resolved: false },
  { id: "s6", category: "Hygiène",  message: "Bouteille de savon mains vide.",                               studio: "Skult Rhodes",    authorId: "1", createdAt: minutesAgo(2880), resolved: true  },
  { id: "s7", category: "Matériel", message: "Chaise terrasse cassée, pied avant fissuré.",                  studio: "Skult Châtelain", authorId: "9", createdAt: minutesAgo(4320), resolved: true  },
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
  const [items, setItems] = useState<Signalement[]>(initial);
  const [tab, setTab] = useState<"actifs" | "resolus">("actifs");
  const [studio, setStudio] = useState<"Tous" | string>("Tous");
  const [cat, setCat] = useState<"Toutes" | Category>("Toutes");

  const filtered = useMemo(() => {
    return [...items]
      .filter(s => tab === "actifs" ? !s.resolved : s.resolved)
      .filter(s => studio === "Tous" || s.studio === studio)
      .filter(s => cat === "Toutes" || s.category === cat)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, tab, studio, cat]);

  const activeCount = items.filter(s => !s.resolved).length;

  const setResolved = (id: string, val: boolean) => {
    setItems(prev => prev.map(s => s.id === id ? { ...s, resolved: val } : s));
    toast.success(val ? "Signalement résolu" : "Signalement rouvert");
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-5">
        <div style={{ fontSize: 20, fontWeight: 500 }}>Signalements</div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
          Remarques et réassorts remontés par l'équipe.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <Tab active={tab === "actifs"} onClick={() => setTab("actifs")}>
          À traiter <span style={{ marginLeft: 6, fontSize: 11, color: "var(--muted-foreground)" }}>{activeCount}</span>
        </Tab>
        <Tab active={tab === "resolus"} onClick={() => setTab("resolus")}>Résolus</Tab>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap" style={{ fontSize: 12 }}>
        <Select label="Studio" value={studio} options={["Tous", "Skult Rhodes", "Skult Châtelain"]} onChange={setStudio} />
        <Select label="Catégorie" value={cat} options={["Toutes", ...CATEGORIES]} onChange={(v) => setCat(v as typeof cat)} />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", fontSize: 13, color: "var(--muted-foreground)" }}>
          Aucun signalement.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {filtered.map((s, i) => {
            const emp = employees.find(e => e.id === s.authorId);
            return (
              <div key={s.id} className="flex items-start gap-4 px-4 py-3" style={{
                borderTop: i === 0 ? "none" : "0.5px solid var(--border)",
              }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    <div className="flex items-center justify-center rounded-full" style={{ width: 18, height: 18, fontSize: 9, fontWeight: 500, backgroundColor: "var(--muted)", color: "var(--foreground)" }}>
                      {emp ? getInitials(emp.firstName, emp.lastName) : "—"}
                    </div>
                    <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{emp ? `${emp.firstName} ${emp.lastName}` : "Inconnu"}</span>
                    <span>·</span>
                    <span>{s.studio.replace("Skult ", "")}</span>
                    <span>·</span>
                    <span>{formatRelative(s.createdAt)}</span>
                    <span>·</span>
                    <span>{s.category}</span>
                  </div>
                  <div style={{ fontSize: 13 }}>{s.message}</div>
                </div>
                <button
                  onClick={() => setResolved(s.id, !s.resolved)}
                  className="rounded-md px-3 py-1.5 shrink-0"
                  style={{
                    fontSize: 11, fontWeight: 500,
                    border: "0.5px solid var(--border)",
                    backgroundColor: s.resolved ? "transparent" : "var(--foreground)",
                    color: s.resolved ? "var(--muted-foreground)" : "var(--background)",
                  }}
                >
                  {s.resolved ? "Rouvrir" : "Résolu"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="px-3 py-2" style={{
      fontSize: 13,
      fontWeight: active ? 500 : 400,
      color: active ? "var(--foreground)" : "var(--muted-foreground)",
      borderBottom: active ? "1.5px solid var(--foreground)" : "1.5px solid transparent",
      marginBottom: -1,
    }}>{children}</button>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="rounded-md px-2 py-1" style={{
        fontSize: 12, border: "0.5px solid var(--border)", backgroundColor: "var(--card)",
      }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
