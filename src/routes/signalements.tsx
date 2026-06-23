import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Search, X, Package, Wrench, Sparkles, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/signalements")({
  component: SignalementsPage,
  head: () => ({ meta: [{ title: "Signalements — Kadence" }] }),
});

type Category = "stock" | "materiel" | "hygiene" | "autre";
const CAT_LABEL: Record<Category, string> = { stock: "Stock", materiel: "Matériel", hygiene: "Hygiène", autre: "Autre" };
const CAT_ICON: Record<Category, typeof Package> = { stock: Package, materiel: Wrench, hygiene: Sparkles, autre: MoreHorizontal };

interface Row {
  id: string; category: Category; message: string; studio_id: string | null;
  author_id: string; created_at: string; resolved: boolean; photos: string[] | null;
}
interface ProfileLite { id: string; first_name: string; last_name: string; avatar_url: string | null; }
interface StudioLite { id: string; name: string; }

const fmtRel = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
};

type Tab = "actifs" | "resolus";

function SignalementsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [studios, setStudios] = useState<Record<string, StudioLite>>({});
  const [tab, setTab] = useState<Tab>("actifs");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "toutes">("toutes");
  const [dismissing, setDismissing] = useState<Record<string, "strike" | "fade">>({});
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowRight") setLightbox((l) => l ? { ...l, index: (l.index + 1) % l.urls.length } : l);
      else if (e.key === "ArrowLeft") setLightbox((l) => l ? { ...l, index: (l.index - 1 + l.urls.length) % l.urls.length } : l);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    const load = async () => {
      const [{ data: rows }, { data: ps }, { data: sts }] = await Promise.all([
        supabase.from("signalements").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,first_name,last_name,avatar_url"),
        supabase.from("studios").select("id,name"),
      ]);
      if (rows) setItems(rows as Row[]);
      if (ps) setProfiles(Object.fromEntries(ps.map((p) => [p.id, p as ProfileLite])));
      if (sts) setStudios(Object.fromEntries(sts.map((s) => [s.id, s as StudioLite])));
    };
    load();
    const channel = supabase.channel("signalements-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "signalements" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const activeCount = items.filter(s => !s.resolved).length;
  const resolvedCount = items.length - activeCount;
  const stockCount = items.filter(s => !s.resolved && s.category === "stock").length;
  const todayCount = items.filter(s => {
    const d = new Date(s.created_at); const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(s => {
      if (tab === "actifs" ? s.resolved : !s.resolved) return false;
      if (catFilter !== "toutes" && s.category !== catFilter) return false;
      if (q) {
        const emp = profiles[s.author_id];
        const name = emp ? `${emp.first_name} ${emp.last_name}`.toLowerCase() : "";
        if (!name.includes(q) && !s.message.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, tab, catFilter, search, profiles]);

  const setResolved = async (id: string, val: boolean) => {
    if (val) {
      setDismissing((d) => ({ ...d, [id]: "strike" }));
      await new Promise((r) => setTimeout(r, 350));
      setDismissing((d) => ({ ...d, [id]: "fade" }));
      await new Promise((r) => setTimeout(r, 300));
    }
    const patch = {
      resolved: val,
      resolved_at: val ? new Date().toISOString() : null,
      resolved_by: val ? user?.id ?? null : null,
    };
    const { error } = await supabase.from("signalements").update(patch).eq("id", id);
    if (error) {
      setDismissing((d) => { const n = { ...d }; delete n[id]; return n; });
      toast.error("Erreur"); return;
    }
    setItems((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } as Row : r));
    setDismissing((d) => { const n = { ...d }; delete n[id]; return n; });
    toast.success(val ? "Signalement résolu" : "Signalement rouvert");
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Hero header */}
      <div className="rounded-xl p-5 md:p-7 mb-5" style={{ backgroundColor: "var(--coral-light)", borderRadius: 14 }}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 md:gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="rounded-full shrink-0" style={{ width: 6, height: 6, backgroundColor: "var(--coral)" }} />
              <span className="truncate" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Remontées de l'équipe
              </span>
            </div>
            <h1 className="text-[22px] md:text-[28px]" style={{ fontWeight: 500, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
              Signalements
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>
              {activeCount} à traiter{todayCount > 0 ? ` · ${todayCount} aujourd'hui` : ""}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 md:flex md:flex-wrap md:items-end md:gap-8">
            <div className="min-w-0">
              <div className="text-[20px] md:text-[28px]" style={{ fontWeight: 500, letterSpacing: "-0.02em", color: "var(--coral)" }}>
                {activeCount}
              </div>
              <div className="truncate" style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>À traiter</div>
            </div>
            <div className="min-w-0">
              <div className="text-[18px] md:text-[22px]" style={{ fontWeight: 500, letterSpacing: "-0.02em" }}>{stockCount}</div>
              <div className="truncate" style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>Stock</div>
            </div>
            <div className="min-w-0">
              <div className="text-[18px] md:text-[22px]" style={{ fontWeight: 500, letterSpacing: "-0.02em" }}>{resolvedCount}</div>
              <div className="truncate" style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>Résolus</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <TabBtn active={tab === "actifs"} onClick={() => setTab("actifs")}>
          À traiter <Count>{activeCount}</Count>
        </TabBtn>
        <TabBtn active={tab === "resolus"} onClick={() => setTab("resolus")}>
          Résolus <Count>{resolvedCount}</Count>
        </TabBtn>
      </div>

      {/* Search + category chips */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 flex-1" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <Search size={13} style={{ color: "var(--muted-foreground)" }} className="shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un employé ou un mot…"
            className="outline-none bg-transparent flex-1" style={{ fontSize: 12 }} />
          {search && (
            <button onClick={() => setSearch("")} className="shrink-0" style={{ color: "var(--muted-foreground)" }}>
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Chip active={catFilter === "toutes"} onClick={() => setCatFilter("toutes")}>Toutes</Chip>
          {(["stock", "materiel", "hygiene", "autre"] as Category[]).map(c => (
            <Chip key={c} active={catFilter === c} onClick={() => setCatFilter(c)}>{CAT_LABEL[c]}</Chip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="mx-auto rounded-full flex items-center justify-center mb-3" style={{ width: 40, height: 40, backgroundColor: "var(--muted)" }}>
            <AlertTriangle size={16} style={{ color: "var(--muted-foreground)" }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
            {tab === "actifs" ? "Tout est en ordre" : "Aucun signalement résolu"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {tab === "actifs" ? "Les remontées de l'équipe apparaîtront ici." : "Les signalements traités apparaîtront ici."}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(s => {
            const emp = profiles[s.author_id];
            const studioName = s.studio_id ? studios[s.studio_id]?.name : "";
            const initials = emp ? `${emp.first_name?.[0] || ""}${emp.last_name?.[0] || ""}`.toUpperCase() : "—";
            const Icon = CAT_ICON[s.category];
            const isStock = s.category === "stock";

            return (
              <div key={s.id}
                className="rounded-xl border p-4 md:p-5"
                style={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  transition: "opacity 300ms ease, max-height 300ms ease, padding 300ms ease",
                  opacity: dismissing[s.id] === "fade" ? 0 : 1,
                  maxHeight: dismissing[s.id] === "fade" ? 0 : 600,
                  paddingTop: dismissing[s.id] === "fade" ? 0 : undefined,
                  paddingBottom: dismissing[s.id] === "fade" ? 0 : undefined,
                  overflow: "hidden",
                }}>
                <div className="flex items-start gap-3">
                  <div className="rounded-full flex items-center justify-center shrink-0 overflow-hidden relative"
                    style={{ width: 38, height: 38, backgroundColor: isStock ? "var(--coral-light)" : "var(--muted)", color: isStock ? "var(--coral-text)" : "var(--foreground)", fontSize: 12, fontWeight: 500 }}>
                    {emp?.avatar_url ? (
                      <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0"
                    style={{
                      textDecoration: dismissing[s.id] ? "line-through" : "none",
                      color: dismissing[s.id] ? "var(--muted-foreground)" : undefined,
                      transition: "color 300ms ease",
                    }}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 13 }}>
                        <span style={{ fontWeight: 500 }}>{emp ? `${emp.first_name} ${emp.last_name}` : "—"}</span>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                          {CAT_LABEL[s.category]}{studioName ? ` · ${studioName.replace("Skult ", "")}` : ""}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{fmtRel(s.created_at)}</span>
                    </div>

                    <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.55 }}>{s.message}</div>

                    {s.photos && s.photos.length > 0 && (
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        {s.photos.map((url, idx) => (
                          <button key={idx} type="button"
                            onClick={() => setLightbox({ urls: s.photos!, index: idx })}
                            className="block rounded-md overflow-hidden hover:opacity-80 transition-opacity"
                            style={{ width: 60, height: 60, border: "0.5px solid var(--border)" }}>
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 mt-3">
                      <button onClick={() => setResolved(s.id, !s.resolved)}
                        disabled={!!dismissing[s.id]}
                        className="rounded-md px-3 py-1.5 flex items-center gap-1.5"
                        style={{
                          fontSize: 11, fontWeight: 500,
                          border: s.resolved ? "0.5px solid var(--border)" : "none",
                          backgroundColor: s.resolved ? "transparent" : "var(--foreground)",
                          color: s.resolved ? "var(--muted-foreground)" : "var(--card)",
                        }}>
                        {s.resolved ? "Rouvrir" : <><Check size={11} /> Marquer résolu</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            className="absolute top-4 right-4 rounded-full flex items-center justify-center"
            style={{ width: 36, height: 36, backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 18 }}
            aria-label="Fermer"
          >✕</button>

          {lightbox.urls.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox((l) => l ? { ...l, index: (l.index - 1 + l.urls.length) % l.urls.length } : l); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
                style={{ width: 40, height: 40, backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 20 }}
                aria-label="Précédent"
              >‹</button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox((l) => l ? { ...l, index: (l.index + 1) % l.urls.length } : l); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
                style={{ width: 40, height: 40, backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 20 }}
                aria-label="Suivant"
              >›</button>
            </>
          )}

          <img
            src={lightbox.urls[lightbox.index]}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-md"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
          />

          {lightbox.urls.length > 1 && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, fontVariantNumeric: "tabular-nums" }}
            >
              {lightbox.index + 1} / {lightbox.urls.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-3 py-2 flex items-center gap-1.5 transition-colors"
      style={{
        fontSize: 12, fontWeight: 500,
        color: active ? "var(--foreground)" : "var(--muted-foreground)",
        borderBottom: active ? "1.5px solid var(--coral)" : "1.5px solid transparent",
        marginBottom: -1,
      }}>
      {children}
    </button>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", backgroundColor: "var(--muted)", padding: "1px 6px", borderRadius: 999 }}>
      {children}
    </span>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="rounded-full px-3 py-1.5 transition-colors"
      style={{
        fontSize: 11, fontWeight: 500,
        border: "0.5px solid " + (active ? "var(--foreground)" : "var(--border)"),
        backgroundColor: active ? "var(--foreground)" : "var(--card)",
        color: active ? "var(--card)" : "var(--muted-foreground)",
      }}>
      {children}
    </button>
  );
}
