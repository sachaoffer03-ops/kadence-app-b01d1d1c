import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Check, Search, Star } from "lucide-react";
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
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
};

function FeedbacksPage() {
  const [items, setItems] = useState<FB[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [shifts, setShifts] = useState<Record<string, ShiftLite>>({});
  const [studios, setStudios] = useState<Record<string, StudioLite>>({});
  const [search, setSearch] = useState("");
  const [minRating, setMinRating] = useState<"tous" | "low">("tous");
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(f => {
      if (minRating === "low" && f.rating >= 4) return false;
      if (q) {
        const emp = profiles[f.author_id];
        const name = emp ? `${emp.first_name} ${emp.last_name}`.toLowerCase() : "";
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, minRating, profiles]);

  const avg = items.length ? (items.reduce((s, f) => s + f.rating, 0) / items.length).toFixed(1) : "—";
  const lowCount = items.filter(f => f.rating < 3).length;
  const unread = items.filter(f => !f.read_at).length;

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
        link: "/staff-app",
        priority: "normal",
        category: "general",
      });
    }
    setReplyingId(null); setDraft("");
    toast.success("Réponse envoyée");
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Feedbacks</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          {items.length} retour{items.length > 1 ? "s" : ""} · {unread} non lu{unread > 1 ? "s" : ""} · note moyenne {avg}/5 · {lowCount} note{lowCount > 1 ? "s" : ""} basse{lowCount > 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
          <Search size={13} style={{ color: "var(--muted-foreground)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un employé"
            className="outline-none bg-transparent" style={{ fontSize: 12, width: 200 }} />
        </div>
        <button onClick={() => setMinRating(minRating === "low" ? "tous" : "low")}
          className="rounded-md px-3 py-1.5"
          style={{
            fontSize: 12, fontWeight: 500,
            backgroundColor: minRating === "low" ? "var(--danger-bg)" : "transparent",
            color: minRating === "low" ? "var(--danger-text)" : "var(--muted-foreground)",
            border: "0.5px solid var(--border)",
          }}>
          {minRating === "low" ? "✓ " : ""}Notes basses uniquement
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", fontSize: 13, color: "var(--muted-foreground)" }}>
          Aucun feedback.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(f => {
            const emp = profiles[f.author_id];
            const sh = f.shift_id ? shifts[f.shift_id] : null;
            const studioName = sh?.studio_id ? studios[sh.studio_id]?.name : "";
            const initials = emp ? `${emp.first_name?.[0] || ""}${emp.last_name?.[0] || ""}`.toUpperCase() : "—";
            const isUnread = !f.read_at;

            return (
              <div key={f.id} onClick={() => isUnread && markRead(f.id)}
                className="rounded-lg border p-4"
                style={{ backgroundColor: "var(--card)", borderColor: isUnread ? "var(--coral)" : "var(--border)", borderLeftWidth: isUnread ? 2 : 1 }}>
                <div className="flex items-start gap-3">
                  <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 32, height: 32, backgroundColor: "var(--muted)", fontSize: 11, fontWeight: 500 }}>{initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 12 }}>
                      <span style={{ fontWeight: 500 }}>{emp ? `${emp.first_name} ${emp.last_name}` : "—"}</span>
                      {sh && (<><span style={{ color: "var(--muted-foreground)" }}>·</span>
                        <span style={{ color: "var(--muted-foreground)" }}>{sh.business_role}{studioName ? ` · ${studioName.replace("Skult ", "")}` : ""}</span></>)}
                      <span style={{ color: "var(--muted-foreground)" }}>·</span>
                      <span style={{ color: "var(--muted-foreground)" }}>{fmtRel(f.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} size={14}
                          fill={n <= f.rating ? "var(--coral)" : "transparent"}
                          color={n <= f.rating ? "var(--coral)" : "rgba(0,0,0,0.2)"} strokeWidth={1.4} />
                      ))}
                    </div>
                    {f.message && <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{f.message}</div>}
                    {f.admin_reply && (
                      <div className="mt-3 rounded-md px-3 py-2" style={{ backgroundColor: "var(--muted)", fontSize: 12 }}>
                        <span style={{ fontWeight: 500 }}>Ta réponse : </span>{f.admin_reply}
                      </div>
                    )}
                    {!f.admin_reply && replyingId !== f.id && (
                      <button onClick={(e) => { e.stopPropagation(); setReplyingId(f.id); setDraft(""); markRead(f.id); }}
                        className="mt-2 rounded-md px-2.5 py-1 flex items-center gap-1.5"
                        style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)" }}>
                        <MessageSquare size={11} /> Répondre
                      </button>
                    )}
                    {replyingId === f.id && (
                      <div className="mt-2 flex gap-2 items-start">
                        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
                          placeholder="Ta réponse à l'employé…"
                          className="flex-1 rounded-md border px-2.5 py-2 outline-none resize-none"
                          style={{ fontSize: 12, borderColor: "var(--border)" }} />
                        <div className="flex flex-col gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); submitReply(f.id); }}
                            className="rounded-md px-3 py-1.5"
                            style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                            <Check size={11} className="inline" /> Envoyer
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setReplyingId(null); }}
                            style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                            Annuler
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
