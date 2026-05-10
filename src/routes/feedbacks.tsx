import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessageSquare, Check, Search, X } from "lucide-react";
import { toast } from "sonner";
import { feedbackEntries, roleColors, getInitials, type FeedbackEntry, type Role, type Studio } from "@/lib/mock-data";

export const Route = createFileRoute("/feedbacks")({
  component: FeedbacksPage,
  head: () => ({ meta: [{ title: "Feedbacks — Kadence" }] }),
});

function ratingColor(v: number) { return v >= 4 ? "var(--success-text)" : v >= 3 ? "var(--foreground)" : "var(--danger-text)"; }
function ratingBg(v: number) { return v >= 4 ? "var(--success-bg)" : v >= 3 ? "var(--muted)" : "var(--danger-bg)"; }

const allRoles: (Role | "tous")[] = ["tous", "Barista", "Accueil", "Host", "Cuisine"];

function FeedbacksPage() {
  const [reads, setReads] = useState<Set<string>>(new Set());
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [studio, setStudio] = useState<Studio | "tous">("tous");
  const [role, setRole] = useState<Role | "tous">("tous");
  const [minRating, setMinRating] = useState<"tous" | "low">("tous");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return feedbackEntries.filter((f) => {
      if (studio !== "tous" && f.studio !== studio) return false;
      if (role !== "tous" && f.role !== role) return false;
      if (minRating === "low" && f.shiftRating >= 4) return false;
      if (q && !f.employeeName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, studio, role, minRating]);

  const avg = (k: keyof FeedbackEntry) => (feedbackEntries.reduce((s, f) => s + (f[k] as number), 0) / feedbackEntries.length).toFixed(1);
  const lowCount = feedbackEntries.filter((f) => f.shiftRating < 3).length;
  const unread = feedbackEntries.length - reads.size;

  const markRead = (id: string) => { setReads((p) => new Set(p).add(id)); };
  const submitReply = (id: string) => {
    const v = draft.trim();
    if (!v) { toast.error("Réponse vide"); return; }
    setReplies((p) => ({ ...p, [id]: v }));
    setReplyingId(null);
    setDraft("");
    setReads((p) => new Set(p).add(id));
    toast.success("Réponse envoyée à l'employé");
  };

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Feedbacks post-shift</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          {feedbackEntries.length} feedbacks reçus · {unread} non lu{unread > 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <AvgCard label="Satisfaction shift" value={avg("shiftRating")} />
        <AvgCard label="Ambiance équipe" value={avg("teamRating")} />
        <AvgCard label="Auto-évaluation" value={avg("selfRating")} />
        <AvgCard label="Notes basses" value={lowCount.toString()} hideBar color={lowCount > 0 ? "var(--danger-text)" : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
          <Search size={13} style={{ color: "var(--muted-foreground)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ fontSize: 12, background: "transparent", outline: "none", border: "none", width: 180 }} />
          {search && <X size={12} style={{ cursor: "pointer" }} onClick={() => setSearch("")} />}
        </div>
        <Chips value={studio} onChange={(v) => setStudio(v as Studio | "tous")}
          options={[{ value: "tous", label: "Tous studios" }, { value: "Skult Rhodes", label: "Rhodes" }, { value: "Skult Châtelain", label: "Châtelain" }]} />
        <Chips value={role} onChange={(v) => setRole(v as Role | "tous")}
          options={allRoles.map((r) => ({ value: r, label: r === "tous" ? "Tous rôles" : r }))} />
        <Chips value={minRating} onChange={(v) => setMinRating(v as "tous" | "low")}
          options={[{ value: "tous", label: "Toutes notes" }, { value: "low", label: "Notes < 4 ⚠" }]} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <div className="grid px-5 py-2.5" style={{ gridTemplateColumns: "1fr 80px 80px 80px 100px", borderBottom: "0.5px solid var(--border)" }}>
          {["Employé", "Shift", "Équipe", "Soi", ""].map((h, i) => (
            <div key={h + i} className={i > 0 && i < 4 ? "text-center" : ""} style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-8 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun feedback.</div>
        ) : filtered.map((fb, i) => {
          const rc = roleColors[fb.role];
          const isRead = reads.has(fb.id);
          const replied = replies[fb.id];
          const replying = replyingId === fb.id;
          return (
            <div key={fb.id} style={{ borderBottom: i < filtered.length - 1 ? "0.5px solid var(--border)" : "none", opacity: isRead ? 0.85 : 1 }}>
              <div className="grid px-5 py-3 items-center" style={{ gridTemplateColumns: "1fr 80px 80px 80px 100px" }}>
                <div className="flex items-center gap-2.5">
                  {!isRead && <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: "var(--coral)" }} />}
                  <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 30, height: 30, backgroundColor: rc.bg, color: rc.text, fontSize: 10, fontWeight: 500 }}>
                    {getInitials(fb.employeeName.split(" ")[0], fb.employeeName.split(" ")[1] || "")}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: isRead ? 400 : 500 }}>{fb.employeeName}</div>
                    <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      <span className="rounded-full" style={{ width: 5, height: 5, backgroundColor: rc.dot }} />
                      {fb.role} · {fb.studio.replace("Skult ", "")} · {fb.date}
                    </div>
                  </div>
                </div>
                <div className="flex justify-center"><RatingBadge value={fb.shiftRating} /></div>
                <div className="flex justify-center"><RatingBadge value={fb.teamRating} /></div>
                <div className="flex justify-center"><RatingBadge value={fb.selfRating} /></div>
                <div className="flex justify-end gap-1">
                  {!isRead && (
                    <button onClick={() => markRead(fb.id)} title="Marquer comme lu" className="rounded-md p-1.5" style={{ border: "0.5px solid var(--border)" }}>
                      <Check size={12} />
                    </button>
                  )}
                  <button onClick={() => { setReplyingId(replying ? null : fb.id); setDraft(replied || ""); }} title="Répondre" className="rounded-md p-1.5"
                    style={{ border: "0.5px solid var(--border)", backgroundColor: replied ? "var(--success-bg)" : undefined, color: replied ? "var(--success-text)" : undefined }}>
                    <MessageSquare size={12} />
                  </button>
                </div>
              </div>

              {fb.comment && (
                <div className="px-5 pb-3" style={{ paddingLeft: 62 }}>
                  <div className="rounded-md px-3 py-2" style={{ backgroundColor: "var(--muted)", fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    "{fb.comment}"
                  </div>
                </div>
              )}

              {replied && !replying && (
                <div className="px-5 pb-3" style={{ paddingLeft: 62 }}>
                  <div className="rounded-md px-3 py-2 flex items-start gap-2" style={{ backgroundColor: "var(--success-bg)", fontSize: 12, color: "var(--success-text)", lineHeight: 1.5 }}>
                    <MessageSquare size={12} style={{ marginTop: 2 }} />
                    <div><span style={{ fontWeight: 500 }}>Votre réponse :</span> {replied}</div>
                  </div>
                </div>
              )}

              {replying && (
                <div className="px-5 pb-4" style={{ paddingLeft: 62 }}>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
                    placeholder="Répondre à l'employé…"
                    style={{ width: "100%", minHeight: 70, padding: 8, fontSize: 12, border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--background)", outline: "none" }} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => submitReply(fb.id)} className="rounded-md px-3 py-1.5"
                      style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>Envoyer</button>
                    <button onClick={() => setReplyingId(null)} className="rounded-md px-3 py-1.5"
                      style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Annuler</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} className="rounded-full px-2.5 py-1"
            style={{ fontSize: 11, fontWeight: active ? 500 : 400,
              backgroundColor: active ? "var(--foreground)" : "transparent",
              color: active ? "var(--card)" : "var(--muted-foreground)",
              border: active ? "none" : "0.5px solid var(--border)" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function AvgCard({ label, value, hideBar, color }: { label: string; value: string; hideBar?: boolean; color?: string }) {
  const num = Number(value);
  const c = color || (hideBar ? "var(--foreground)" : ratingColor(num));
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 24, fontWeight: 500, color: c }}>{value}</span>
        {!hideBar && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>/5</span>}
      </div>
      {!hideBar && (
        <div className="mt-2" style={{ width: "100%", height: 3, borderRadius: 2, backgroundColor: "var(--muted)" }}>
          <div style={{ width: `${(num / 5) * 100}%`, height: "100%", borderRadius: 2, backgroundColor: c }} />
        </div>
      )}
    </div>
  );
}

function RatingBadge({ value }: { value: number }) {
  return (
    <span className="rounded-md px-2 py-0.5" style={{ fontSize: 12, fontWeight: 500, backgroundColor: ratingBg(value), color: ratingColor(value) }}>
      {value}/5
    </span>
  );
}
