import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Row {
  id: string;
  status: string;
  sent_at: string;
  responded_at: string | null;
  replacement_request_id: string | null;
  shift: {
    id: string; shift_date: string; start_time: string; end_time: string;
    business_role: string; studio_id: string | null;
  } | null;
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: "En attente", bg: "var(--warning-bg)", color: "var(--warning-text)" },
  accepted: { label: "Acceptée",   bg: "var(--success-bg)", color: "var(--success-text)" },
  declined: { label: "Refusée",    bg: "var(--danger-bg)",  color: "var(--danger-text)" },
  expired:  { label: "Expirée",    bg: "var(--muted)",      color: "var(--muted-foreground)" },
  cancelled:{ label: "Annulée",    bg: "var(--muted)",      color: "var(--muted-foreground)" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
function fmtRelative(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export function EmployeeProposalsCard({ userId, studios }: { userId: string; studios: Record<string, string> }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("shift_proposals")
        .select("id,status,sent_at,responded_at,replacement_request_id,shift:shifts(id,shift_date,start_time,end_time,business_role,studio_id)")
        .eq("user_id", userId)
        .order("sent_at", { ascending: false })
        .limit(50);
      if (active) {
        setRows((data || []) as any);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [userId]);

  const visible = showAll ? rows : rows.slice(0, 5);

  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <Send size={12} /> Propositions de shift
        </div>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{rows.length}</span>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucune proposition envoyée à cet employé.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((r) => {
            const s = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
            const studioName = r.shift?.studio_id ? (studios[r.shift.studio_id] || "—") : "—";
            return (
              <div key={r.id} className="rounded-md px-3 py-2 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--background)", border: "0.5px solid var(--border)" }}>
                <div className="min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>
                    {r.shift ? `${fmtDate(r.shift.shift_date)} · ${r.shift.start_time.slice(0,5)}–${r.shift.end_time.slice(0,5)}` : "Shift supprimé"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                    {r.shift ? `${r.shift.business_role} · ${studioName.replace("Skult ", "")}` : "—"}
                    {r.replacement_request_id && " · remplacement"}
                    {" · envoyée "}{fmtRelative(r.sent_at)}
                  </div>
                </div>
                <span className="rounded-full px-2 py-0.5 shrink-0" style={{ fontSize: 10, fontWeight: 500, backgroundColor: s.bg, color: s.color }}>
                  {s.label}
                </span>
              </div>
            );
          })}
          {rows.length > 5 && (
            <button onClick={() => setShowAll(!showAll)} className="mt-1 rounded-md py-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)", backgroundColor: "transparent" }}>
              {showAll ? "Réduire" : `Voir tout (${rows.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
