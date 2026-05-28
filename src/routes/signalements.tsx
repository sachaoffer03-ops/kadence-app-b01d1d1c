import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dropdown } from "@/components/Dropdown";

export const Route = createFileRoute("/signalements")({
  component: SignalementsPage,
  head: () => ({ meta: [{ title: "Signalements — Kadence" }] }),
});

type Category = "stock" | "materiel" | "hygiene" | "autre";
const CAT_LABEL: Record<Category, string> = { stock: "Stock", materiel: "Matériel", hygiene: "Hygiène", autre: "Autre" };

interface Row {
  id: string; category: Category; message: string; studio_id: string | null;
  author_id: string; created_at: string; resolved: boolean;
}
interface ProfileLite { id: string; first_name: string; last_name: string; }
interface StudioLite { id: string; name: string; }

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.round(h / 24)}j`;
};

function SignalementsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [studios, setStudios] = useState<Record<string, StudioLite>>({});
  const [tab, setTab] = useState<"actifs" | "resolus">("actifs");
  const [studio, setStudio] = useState<string>("Tous");
  const [cat, setCat] = useState<string>("Toutes");
  const [dismissing, setDismissing] = useState<Record<string, "strike" | "fade">>({});

  useEffect(() => {
    const load = async () => {
      const [{ data: rows }, { data: ps }, { data: sts }] = await Promise.all([
        supabase.from("signalements").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,first_name,last_name"),
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

  const studioNames = useMemo(() => ["Tous", ...Object.values(studios).map(s => s.name)], [studios]);

  const filtered = items
    .filter(s => tab === "actifs" ? !s.resolved : s.resolved)
    .filter(s => studio === "Tous" || (s.studio_id && studios[s.studio_id]?.name === studio))
    .filter(s => cat === "Toutes" || CAT_LABEL[s.category] === cat);

  const activeCount = items.filter(s => !s.resolved).length;

  const setResolved = async (id: string, val: boolean) => {
    if (val) {
      // Animate: strike-through, then fade out, then commit
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
    <div className="p-4 md:p-6 max-w-4xl">

      <div className="mb-5">
        <div style={{ fontSize: 20, fontWeight: 500 }}>Signalements</div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
          Remarques et réassorts remontés par l'équipe.
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <Tab active={tab === "actifs"} onClick={() => setTab("actifs")}>
          À traiter <span style={{ marginLeft: 6, fontSize: 11, color: "var(--muted-foreground)" }}>{activeCount}</span>
        </Tab>
        <Tab active={tab === "resolus"} onClick={() => setTab("resolus")}>Résolus</Tab>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap" style={{ fontSize: 12 }}>
        <Dropdown label="Studio" value={studio} options={studioNames} onChange={setStudio} />
        <Dropdown label="Catégorie" value={cat} options={["Toutes", "Stock", "Matériel", "Hygiène", "Autre"]} onChange={setCat} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", fontSize: 13, color: "var(--muted-foreground)" }}>
          Aucun signalement.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {filtered.map((s, i) => {
            const emp = profiles[s.author_id];
            const studioName = (s.studio_id && studios[s.studio_id]?.name) || "—";
            const initials = emp ? `${emp.first_name?.[0] || ""}${emp.last_name?.[0] || ""}`.toUpperCase() : "—";
            return (
              <div key={s.id} className="flex items-start gap-4 px-4 py-3"
                style={{
                  borderTop: i === 0 ? "none" : "0.5px solid var(--border)",
                  transition: "opacity 300ms ease, max-height 300ms ease, padding 300ms ease",
                  opacity: dismissing[s.id] === "fade" ? 0 : 1,
                  maxHeight: dismissing[s.id] === "fade" ? 0 : 200,
                  paddingTop: dismissing[s.id] === "fade" ? 0 : undefined,
                  paddingBottom: dismissing[s.id] === "fade" ? 0 : undefined,
                  overflow: "hidden",
                }}>
                <div className="flex-1 min-w-0"
                  style={{
                    textDecoration: dismissing[s.id] ? "line-through" : "none",
                    color: dismissing[s.id] ? "var(--muted-foreground)" : undefined,
                    transition: "color 300ms ease",
                  }}>
                  <div className="flex items-center gap-2 mb-1" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    <div className="flex items-center justify-center rounded-full" style={{ width: 18, height: 18, fontSize: 9, fontWeight: 500, backgroundColor: "var(--muted)", color: "var(--foreground)" }}>{initials}</div>
                    <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{emp ? `${emp.first_name} ${emp.last_name}` : "Inconnu"}</span>
                    <span>·</span><span>{studioName.replace("Skult ", "")}</span>
                    <span>·</span><span>{formatRelative(s.created_at)}</span>
                    <span>·</span><span>{CAT_LABEL[s.category]}</span>
                  </div>
                  <div style={{ fontSize: 13 }}>{s.message}</div>
                </div>
                <button onClick={() => setResolved(s.id, !s.resolved)}
                  disabled={!!dismissing[s.id]}
                  className="rounded-md px-3 py-1.5 shrink-0"
                  style={{
                    fontSize: 11, fontWeight: 500,
                    border: "0.5px solid var(--border)",
                    backgroundColor: s.resolved ? "transparent" : "var(--foreground)",
                    color: s.resolved ? "var(--muted-foreground)" : "var(--background)",
                  }}>
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
      fontSize: 13, fontWeight: active ? 500 : 400,
      color: active ? "var(--foreground)" : "var(--muted-foreground)",
      borderBottom: active ? "1.5px solid var(--foreground)" : "1.5px solid transparent",
      marginBottom: -1,
    }}>{children}</button>
  );
}
