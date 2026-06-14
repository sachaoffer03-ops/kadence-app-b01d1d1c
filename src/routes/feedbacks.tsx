import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Check, Search, Star, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/feedbacks")({
  component: FeedbacksPage,
  head: () => ({ meta: [{ title: "Feedbacks — Kadence" }] }),
});

interface FB {
  id: string; rating: number; message: string | null;
  author_id: string; shift_id: string | null;
  created_at: string; read_at: string | null; admin_reply: string | null;
}
interface ProfileLite { id: string; first_name: string; last_name: string; }
interface ShiftLite { id: string; shift_date: string; business_role: string; studio_id: string | null; }
interface StudioLite { id: string; name: string; }

const fmtRel = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
};

type Tab = "tous" | "non_lus" | "basses";

function FeedbacksPage() {
  const [items, setItems] = useState<FB[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [shifts, setShifts] = useState<Record<string, ShiftLite>>({});
  const [studios, setStudios] = useState<Record<string, StudioLite>>({});
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("tous");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const load = async () => {
      const [{ data: fbs }, { data: ps }, { data: ss }, { data: sts }] = await Promise.all([
        supabase.from("feedbacks").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,first_name,last_name"),
        supabase.from("shifts").select("id,shift_date,business_role,studio_id"),
        supabase.from("studios").select("id,name"),
      ]);
      if (fbs) setItems(fbs as FB[]);
      if (ps) setProfiles(Object.fromEntries(ps.map(p => [p.id, p as ProfileLite])));
      if (ss) setShifts(Object.fromEntries(ss.map(s => [s.id, s as ShiftLite])));
      if (sts) setStudios(Object.fromEntries(sts.map(s => [s.id, s as StudioLite])));
    };
    load();
    const channel = supabase.channel("feedbacks-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedbacks" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const unreadCount = items.filter(f => !f.read_at).length;
  const lowCount = items.filter(f => f.rating < 3).length;
  const avg = items.length ? items.reduce((s, f) => s + f.rating, 0) / items.length : 0;
  const replyRate = items.length ? Math.round((items.filter(f => f.admin_reply).length / items.length) * 100) : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(f => {
      if (tab === "non_lus" && f.read_at) return false;
      if (tab === "basses" && f.rating >= 3) return false;
      if (q) {
        const emp = profiles[f.author_id];
        const name = emp ? `${emp.first_name} ${emp.last_name}`.toLowerCase() : "";
        const msg = (f.message || "").toLowerCase();
        if (!name.includes(q) && !msg.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, tab, profiles]);

  const markRead = async (id: string) => {
    await supabase.from("feedbacks").update({ read_at: new Date().toISOString() }).eq("id", id);
  };
  const submitReply = async (id: string) => {
    const v = draft.trim();
    if (!v) { toast.error("Réponse vide"); return; }
    const { data: fbRow } = await supabase.from("feedbacks")
      .select("author_id").eq("id", id).maybeSingle();
    const { error } = await supabase.from("feedbacks").update({
      admin_reply: v, read_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    if (fbRow?.author_id) {
      await supabase.from("notifications").insert({
        user_id: fbRow.author_id,
        type: "feedback_reply",
        title: "Réponse à ton feedback",
        body: v.length > 120 ? v.slice(0, 117) + "…" : v,
        link: "/staff-app?tab=profil",
        priority: "normal",
        category: "general",
      });
    }
    setReplyingId(null); setDraft("");
    toast.success("Réponse envoyée");
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Hero header */}
      <div className="rounded-xl p-6 md:p-7 mb-5" style={{ backgroundColor: "var(--coral-light)", borderRadius: 14 }}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: "var(--coral)" }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Retours de l'équipe
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              Feedbacks
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>
              {items.length} retour{items.length > 1 ? "s" : ""} reçu{items.length > 1 ? "s" : ""}
              {unreadCount > 0 ? ` · ${unreadCount} non lu${unreadCount > 1 ? "s" : ""}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-6 md:gap-8">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--coral)" }}>
                  {items.length ? avg.toFixed(1) : "—"}
                </span>
                <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>/ 5</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>Note moyenne</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>{lowCount}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>Notes basses</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>{replyRate}<span style={{ fontSize: 13, color: "var(--muted-foreground)", marginLeft: 2 }}>%</span></div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>Taux de réponse</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <TabBtn active={tab === "tous"} onClick={() => setTab("tous")}>
          Tous <Count>{items.length}</Count>
        </TabBtn>
        <TabBtn active={tab === "non_lus"} onClick={() => setTab("non_lus")}>
          Non lus <Count>{unreadCount}</Count>
        </TabBtn>
        <TabBtn active={tab === "basses"} onClick={() => setTab("basses")}>
          Notes basses <Count>{lowCount}</Count>
        </TabBtn>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 mb-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <Search size={13} style={{ color: "var(--muted-foreground)" }} className="shrink-0" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un employé ou un mot…"
          className="outline-none bg-transparent flex-1" style={{ fontSize: 12 }} />
        {search && (
          <button onClick={() => setSearch("")} className="shrink-0" style={{ color: "var(--muted-foreground)" }}>
            <X size={13} />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="mx-auto rounded-full flex items-center justify-center mb-3" style={{ width: 40, height: 40, backgroundColor: "var(--muted)" }}>
            <MessageSquare size={16} style={{ color: "var(--muted-foreground)" }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucun feedback</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {tab === "tous" ? "Les retours de l'équipe apparaîtront ici." : "Rien à afficher avec ce filtre."}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(f => {
            const emp = profiles[f.author_id];
            const sh = f.shift_id ? shifts[f.shift_id] : null;
            const studioName = sh?.studio_id ? studios[sh.studio_id]?.name : "";
            const initials = emp ? `${emp.first_name?.[0] || ""}${emp.last_name?.[0] || ""}`.toUpperCase() : "—";
            const isUnread = !f.read_at;
            const isLow = f.rating < 3;

            return (
              <div key={f.id} onClick={() => isUnread && markRead(f.id)}
                className="rounded-xl border p-4 md:p-5 transition-colors"
                style={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  cursor: isUnread ? "pointer" : "default",
                  position: "relative",
                }}>
                {isUnread && (
                  <span className="absolute rounded-full" style={{ top: 14, right: 14, width: 7, height: 7, backgroundColor: "var(--coral)" }} />
                )}
                <div className="flex items-start gap-3">
                  <div className="rounded-full flex items-center justify-center shrink-0"
                    style={{ width: 38, height: 38, backgroundColor: isLow ? "var(--danger-bg)" : "var(--coral-light)", color: isLow ? "var(--danger-text)" : "var(--coral-text)", fontSize: 12, fontWeight: 500 }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 13 }}>
                        <span style={{ fontWeight: 500 }}>{emp ? `${emp.first_name} ${emp.last_name}` : "—"}</span>
                        {sh && (
                          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                            {sh.business_role}{studioName ? ` · ${studioName.replace("Skult ", "")}` : ""}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{fmtRel(f.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-1 mt-2">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} size={13}
                          fill={n <= f.rating ? "var(--coral)" : "transparent"}
                          color={n <= f.rating ? "var(--coral)" : "var(--border)"} strokeWidth={1.5} />
                      ))}
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 6 }}>
                        {f.rating}/5
                      </span>
                    </div>

                    {f.message && (
                      <div style={{ fontSize: 13, marginTop: 10, lineHeight: 1.55, color: "var(--foreground)" }}>
                        {f.message}
                      </div>
                    )}

                    {f.admin_reply && (
                      <div className="mt-3 rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--muted)", borderLeft: "2px solid var(--coral)" }}>
                        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                          Ta réponse
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.5 }}>{f.admin_reply}</div>
                      </div>
                    )}

                    {!f.admin_reply && replyingId !== f.id && (
                      <button onClick={(e) => { e.stopPropagation(); setReplyingId(f.id); setDraft(""); markRead(f.id); }}
                        className="mt-3 rounded-md px-3 py-1.5 flex items-center gap-1.5 transition-colors"
                        style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)", color: "var(--foreground)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                        <MessageSquare size={11} /> Répondre
                      </button>
                    )}

                    {replyingId === f.id && (
                      <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--coral)", backgroundColor: "var(--coral-light)" }}>
                        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
                          autoFocus
                          placeholder="Ta réponse à l'employé…"
                          onClick={(e) => e.stopPropagation()}
                          className="w-full rounded-md border px-3 py-2 outline-none resize-none"
                          style={{ fontSize: 12, borderColor: "var(--border)", backgroundColor: "var(--card)", lineHeight: 1.5 }} />
                        <div className="flex items-center justify-end gap-2 mt-2">
                          <button onClick={(e) => { e.stopPropagation(); setReplyingId(null); }}
                            className="rounded-md px-3 py-1.5"
                            style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>
                            Annuler
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); submitReply(f.id); }}
                            className="rounded-md px-3 py-1.5 flex items-center gap-1.5"
                            style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                            <Check size={11} /> Envoyer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
