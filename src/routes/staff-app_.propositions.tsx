import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Calendar, Clock, MapPin, Briefcase, Check, X, Inbox, Send, User as UserIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { acceptProposal, declineProposal, acceptReplacementProposal, getMyPendingProposals } from "@/lib/proposals.functions";

export const Route = createFileRoute("/staff-app/propositions")({
  component: PropositionsPage,
});

interface ProposalRow {
  id: string;
  status: string;
  sent_at: string;
  replacement_request_id: string | null;
  shift: {
    id: string; shift_date: string; start_time: string; end_time: string;
    business_role: string; studio_id: string | null; user_id: string | null;
    notes: string | null;
  };
  studio: { id: string; name: string; short_name: string | null; address: string | null; city: string | null } | null;
  sender: { id: string; first_name: string | null; last_name: string | null } | null;
}

function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function fmtElapsed(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}
function durationHours(start: string, end: string): string {
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function PropositionsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchFn = useServerFn(getMyPendingProposals);
  const acceptFn = useServerFn(acceptProposal);
  const acceptReplFn = useServerFn(acceptReplacementProposal);
  const declineFn = useServerFn(declineProposal);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const load = async () => {
    try {
      const r = await fetchFn();
      setProposals((r.proposals || []) as ProposalRow[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`propositions-page-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_proposals", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shifts" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const accept = async (p: ProposalRow) => {
    setBusy(p.id);
    try {
      const r = p.replacement_request_id
        ? await acceptReplFn({ data: { proposalId: p.id } })
        : await acceptFn({ data: { proposalId: p.id } });
      if (r.ok) toast.success("Shift accepté");
      else toast.error("Trop tard — un autre employé a déjà accepté ce shift");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const decline = async (p: ProposalRow) => {
    setBusy(p.id);
    try {
      await declineFn({ data: { proposalId: p.id } });
      toast("Proposition refusée");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setBusy(null);
    }
  };

  if (loading || !user) return <div className="p-8" style={{ fontSize: 13 }}>Chargement…</div>;

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#FAF8F4", maxWidth: 430, margin: "0 auto" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 border-b" style={{ backgroundColor: "#FAF8F4", borderColor: "rgba(0,0,0,0.06)" }}>
        <button onClick={() => navigate({ to: "/staff-app" })} className="rounded-full p-1.5" style={{ backgroundColor: "var(--muted)" }}>
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div style={{ fontSize: 16, fontWeight: 500 }}>Propositions de shift</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>
            {proposals.length === 0 ? "Aucune proposition en attente" : `${proposals.length} en attente`}
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 flex flex-col gap-4">
        {loadingData ? (
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</div>
        ) : proposals.length === 0 ? (
          <div className="rounded-xl p-8 text-center flex flex-col items-center gap-3" style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)" }}>
            <div className="rounded-full flex items-center justify-center" style={{ width: 56, height: 56, backgroundColor: "var(--muted)" }}>
              <Inbox size={24} style={{ color: "var(--muted-foreground)" }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Aucune proposition en attente</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Tu seras notifié dès qu'un admin t'envoie un shift à pourvoir.
            </div>
          </div>
        ) : (
          proposals.map((p) => {
            const studioName = p.studio?.short_name || p.studio?.name || "—";
            const senderName = p.sender ? `${p.sender.first_name || ""} ${p.sender.last_name || ""}`.trim() : "";
            const isRepl = !!p.replacement_request_id;
            return (
              <div key={p.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#fff", border: "2px solid var(--coral)" }}>
                {/* Bandeau */}
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: "var(--coral)", color: "#fff" }}>
                  <Send size={13} />
                  <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {isRepl ? "Remplacement à pourvoir" : "Nouvelle proposition"}
                  </span>
                  <span className="ml-auto" style={{ fontSize: 11, opacity: 0.85 }}>{fmtElapsed(p.sent_at)}</span>
                </div>

                {/* Corps */}
                <div className="px-5 py-4 flex flex-col gap-3">
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 500, textTransform: "capitalize", lineHeight: 1.2 }}>
                      {fmtDateLong(p.shift.shift_date)}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5" style={{ fontSize: 14, color: "var(--foreground)" }}>
                      <Clock size={14} style={{ color: "var(--muted-foreground)" }} />
                      <span>{String(p.shift.start_time).slice(0,5)} — {String(p.shift.end_time).slice(0,5)}</span>
                      <span style={{ color: "var(--muted-foreground)" }}>· {durationHours(p.shift.start_time, p.shift.end_time)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-1 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                    <div className="flex items-start gap-2.5 pt-3">
                      <Briefcase size={14} style={{ color: "var(--muted-foreground)", marginTop: 2 }} />
                      <div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Poste</div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{p.shift.business_role}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <MapPin size={14} style={{ color: "var(--muted-foreground)", marginTop: 2 }} />
                      <div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Studio</div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{studioName}</div>
                        {(p.studio?.address || p.studio?.city) && (
                          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>
                            {[p.studio?.address, p.studio?.city].filter(Boolean).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                    {senderName && (
                      <div className="flex items-start gap-2.5">
                        <UserIcon size={14} style={{ color: "var(--muted-foreground)", marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Envoyée par</div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{senderName}</div>
                        </div>
                      </div>
                    )}
                    {p.shift.notes && (
                      <div className="flex items-start gap-2.5">
                        <FileText size={14} style={{ color: "var(--muted-foreground)", marginTop: 2 }} />
                        <div className="flex-1">
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Note</div>
                          <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{p.shift.notes}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => accept(p)}
                      disabled={busy === p.id}
                      className="flex-1 rounded-md py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
                    >
                      <Check size={16} /> Accepter
                    </button>
                    <button
                      onClick={() => decline(p)}
                      disabled={busy === p.id}
                      className="flex-1 rounded-md py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ fontSize: 14, fontWeight: 500, backgroundColor: "transparent", color: "var(--muted-foreground)", border: "0.5px solid var(--border)" }}
                    >
                      <X size={16} /> Refuser
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", marginTop: 8 }}>
          <Calendar size={11} className="inline mr-1" />
          Si un autre employé accepte avant toi, la proposition disparaît automatiquement.
        </div>
      </div>
    </div>
  );
}
