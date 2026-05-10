import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/demandes")({
  component: DemandesPage,
  head: () => ({ meta: [{ title: "Demandes de modification — Kadence" }] }),
});

type Urgency = "normal" | "urgent" | "critique";
type Status = "pending" | "accepted" | "refused";
type ReqType = "swap" | "cancel" | "time_change";

interface Row {
  id: string; user_id: string; shift_id: string | null;
  type: ReqType; reason: string; urgency: Urgency; status: Status;
  created_at: string; admin_response: string | null;
}
interface ProfileLite { id: string; first_name: string; last_name: string; }
interface ShiftLite { id: string; shift_date: string; start_time: string; end_time: string; business_role: string; studio_id: string | null; }

const urgencyStyles: Record<Urgency, { bg: string; text: string; label: string }> = {
  critique: { bg: "var(--danger-bg)", text: "var(--danger-text)", label: "Critique" },
  urgent: { bg: "var(--warning-bg)", text: "var(--warning-text)", label: "Urgent" },
  normal: { bg: "var(--muted)", text: "var(--muted-foreground)", label: "Normal" },
};
const TYPE_LABEL: Record<ReqType, string> = { swap: "Échange", cancel: "Annulation", time_change: "Changement d'horaire" };

const formatTime = (t: string) => t.slice(0, 5).replace(":", "h");

function DemandesPage() {
  const [requests, setRequests] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [shifts, setShifts] = useState<Record<string, ShiftLite>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: rs }, { data: ps }, { data: ss }] = await Promise.all([
        supabase.from("modification_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,first_name,last_name"),
        supabase.from("shifts").select("id,shift_date,start_time,end_time,business_role,studio_id"),
      ]);
      if (rs) setRequests(rs as Row[]);
      if (ps) setProfiles(Object.fromEntries(ps.map((p) => [p.id, p as ProfileLite])));
      if (ss) setShifts(Object.fromEntries(ss.map((s) => [s.id, s as ShiftLite])));
    };
    load();
    const channel = supabase.channel("demandes-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "modification_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const order: Record<Urgency, number> = { critique: 0, urgent: 1, normal: 2 };
  const pending = requests.filter(r => r.status === "pending").sort((a, b) => order[a.urgency] - order[b.urgency]);
  const handled = requests.filter(r => r.status !== "pending").slice(0, 20);

  const handleAction = async (id: string, status: "accepted" | "refused") => {
    const { error } = await supabase.from("modification_requests").update({
      status, resolved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    setExpandedId(null);
    toast.success(status === "accepted" ? "Demande acceptée" : "Demande refusée");
  };

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Demandes de modification</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          {pending.length} demande{pending.length > 1 ? "s" : ""} en attente
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--success-text)" }}>Aucune demande en attente</div>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden mb-8" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          {pending.map(req => {
            const isExpanded = expandedId === req.id;
            const emp = profiles[req.user_id];
            const sh = req.shift_id ? shifts[req.shift_id] : null;
            const urg = urgencyStyles[req.urgency];
            const initials = emp ? `${emp.first_name?.[0] || ""}${emp.last_name?.[0] || ""}`.toUpperCase() : "—";

            return (
              <div key={req.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                <div className="grid px-5 py-3 items-center"
                  style={{ gridTemplateColumns: "1fr 160px 120px 140px 60px", cursor: "pointer" }}
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 30, height: 30, backgroundColor: "var(--muted)", fontSize: 10, fontWeight: 500 }}>{initials}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{emp ? `${emp.first_name} ${emp.last_name}` : "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{sh ? sh.business_role : "—"}</div>
                    </div>
                  </div>
                  <div>
                    {sh ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{new Date(sh.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{formatTime(sh.start_time)} — {formatTime(sh.end_time)}</div>
                      </>
                    ) : <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Sans shift</span>}
                  </div>
                  <div style={{ fontSize: 12 }}>{TYPE_LABEL[req.type]}</div>
                  <div>
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: urg.bg, color: urg.text }}>{urg.label}</span>
                  </div>
                  <div className="flex items-center justify-end">
                    <ChevronDown size={14} style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-4" style={{ backgroundColor: "var(--muted)" }}>
                    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                      <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>"{req.reason}"</div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleAction(req.id, "accepted"); }}
                          className="rounded-md px-4 py-2 flex items-center gap-1.5"
                          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                          <Check size={14} /> Accepter
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleAction(req.id, "refused"); }}
                          className="rounded-md px-4 py-2 flex items-center gap-1.5"
                          style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>
                          <X size={14} /> Refuser
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {handled.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 10 }}>Traitées récemment</div>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            {handled.map((req, i) => {
              const emp = profiles[req.user_id];
              return (
                <div key={req.id} className="flex items-center gap-4 px-5 py-3"
                  style={{ borderBottom: i < handled.length - 1 ? "0.5px solid var(--border)" : "none", opacity: 0.6 }}>
                  <div className="flex-1">
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{emp ? `${emp.first_name} ${emp.last_name}` : "—"}</span>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}> · {TYPE_LABEL[req.type]}</span>
                  </div>
                  <span className="rounded-full px-2 py-0.5" style={{
                    fontSize: 10, fontWeight: 500,
                    backgroundColor: req.status === "accepted" ? "var(--success-bg)" : "var(--danger-bg)",
                    color: req.status === "accepted" ? "var(--success-text)" : "var(--danger-text)",
                  }}>
                    {req.status === "accepted" ? "Acceptée" : "Refusée"}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
