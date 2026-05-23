import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Clock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet } from "@/components/staff-app/shared";
import { acceptProposal, declineProposal, acceptReplacementProposal, getMyPendingProposals } from "@/lib/proposals.functions";

interface ProposalView {
  id: string;
  status: string;
  sent_at: string;
  replacement_request_id: string | null;
  shift: {
    id: string; shift_date: string; start_time: string; end_time: string;
    business_role: string; studio_id: string | null; user_id: string | null;
  };
}

function elapsed(sentAt: string): string {
  const ms = Date.now() - new Date(sentAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

export function useProposals(userId: string) {
  const [proposals, setProposals] = useState<ProposalView[]>([]);
  const fetchFn = useServerFn(getMyPendingProposals);

  const load = async () => {
    try {
      const res = await fetchFn();
      setProposals((res.proposals || []) as ProposalView[]);
    } catch (e) {
      console.error("[useProposals] error:", e);
      setProposals([]);
    }
  };

  useEffect(() => {
    if (!userId) return;
    load();
    const ch = supabase
      .channel(`proposals-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_proposals", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { proposals, reload: load };
}

export function ProposalsSheet({ open, onClose, studios, proposals, reload }: {
  open: boolean; onClose: () => void; studios: Record<string, string>;
  proposals: ProposalView[]; reload: () => Promise<void>;
}) {
  const acceptFn = useServerFn(acceptProposal);
  const acceptReplFn = useServerFn(acceptReplacementProposal);
  const declineFn = useServerFn(declineProposal);
  const [busy, setBusy] = useState<string | null>(null);

  const accept = async (p: ProposalView) => {
    setBusy(p.id);
    try {
      const r = p.replacement_request_id
        ? await acceptReplFn({ data: { proposalId: p.id } })
        : await acceptFn({ data: { proposalId: p.id } });
      if (r.ok) toast.success("Shift accepté !");
      else toast.error("Trop tard, un autre employé a déjà accepté ce shift");
      reload();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const decline = async (id: string) => {
    setBusy(id);
    try {
      await declineFn({ data: { proposalId: id } });
      toast("Proposition refusée");
      reload();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setBusy(null);
    }
  };

  // History (proposals that are no longer actionable: responded, expired, or shift taken by someone else)
  const [history, setHistory] = useState<ProposalView[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      setUserId(uid);
      const { data } = await supabase
        .from("shift_proposals")
        .select("id,status,sent_at,replacement_request_id,shift:shifts(id,shift_date,start_time,end_time,business_role,studio_id,user_id)")
        .eq("user_id", uid)
        .order("sent_at", { ascending: false })
        .limit(15);
      const pendingIds = new Set(proposals.map(p => p.id));
      const hist = (data || []).filter((p: any) => p.shift && !pendingIds.has(p.id)) as ProposalView[];
      setHistory(hist);
    })();
  }, [open, proposals]);

  const statusLabel = (p: ProposalView): { label: string; bg: string; color: string } => {
    if (p.status === "accepted") return { label: "Acceptée", bg: "var(--success-bg)", color: "var(--success-text)" };
    if (p.status === "declined") return { label: "Refusée", bg: "var(--muted)", color: "var(--muted-foreground)" };
    if (p.status === "expired") return { label: "Expirée", bg: "var(--muted)", color: "var(--muted-foreground)" };
    if (p.status === "cancelled") return { label: "Annulée", bg: "var(--muted)", color: "var(--muted-foreground)" };
    // pending mais shift déjà pris
    if (p.shift.user_id && p.shift.user_id !== userId && !p.replacement_request_id) {
      return { label: "Trop tard — déjà pris", bg: "var(--warning-bg)", color: "var(--warning-text)" };
    }
    return { label: "En attente", bg: "var(--warning-bg)", color: "var(--warning-text)" };
  };

  return (
    <Sheet open={open} onClose={onClose} title="Propositions de shift">
      {proposals.length === 0 && history.length === 0 ? (
        <div className="px-2 py-8 text-center" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Aucune proposition pour le moment.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {proposals.map((p) => {
            const sname = p.shift.studio_id ? (studios[p.shift.studio_id] || "—") : "—";
            const dateLabel = new Date(p.shift.shift_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
            return (
              <div key={p.id} className="rounded-xl border p-4" style={{ backgroundColor: "#fff", borderColor: "var(--coral)" }}>
                <div className="flex items-center gap-2 mb-1" style={{ fontSize: 11, color: "var(--coral-dark)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <Send size={11} /> Nouvelle proposition
                </div>
                <div style={{ fontSize: 16, fontWeight: 500, textTransform: "capitalize" }}>{dateLabel}</div>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
                  {String(p.shift.start_time).slice(0,5)} — {String(p.shift.end_time).slice(0,5)} · {p.shift.business_role} · {sname.replace("Skult ", "")}
                </div>
                <div className="flex items-center gap-1 mt-2" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  <Clock size={10} /> envoyée {elapsed(p.sent_at)}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => accept(p)} disabled={busy === p.id}
                    className="flex-1 rounded-md py-2.5 flex items-center justify-center gap-1.5"
                    style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}>
                    <Check size={14} /> Accepter
                  </button>
                  <button onClick={() => decline(p.id)} disabled={busy === p.id}
                    className="flex-1 rounded-md py-2.5 flex items-center justify-center gap-1.5"
                    style={{ fontSize: 13, fontWeight: 500, backgroundColor: "transparent", color: "var(--muted-foreground)", border: "0.5px solid var(--border)" }}>
                    <X size={14} /> Refuser
                  </button>
                </div>
              </div>
            );
          })}

          {history.length > 0 && (
            <>
              <div className="mt-3 mb-1" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Historique
              </div>
              {history.map((p) => {
                const sname = p.shift.studio_id ? (studios[p.shift.studio_id] || "—") : "—";
                const dateLabel = new Date(p.shift.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
                const s = statusLabel(p);
                return (
                  <div key={p.id} className="rounded-md px-3 py-2.5 flex items-center justify-between gap-3" style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)" }}>
                    <div className="min-w-0">
                      <div style={{ fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>
                        {dateLabel} · {String(p.shift.start_time).slice(0,5)}–{String(p.shift.end_time).slice(0,5)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                        {p.shift.business_role} · {sname.replace("Skult ", "")} · envoyée {elapsed(p.sent_at)}
                      </div>
                    </div>
                    <span className="rounded-full px-2 py-0.5 shrink-0" style={{ fontSize: 10, fontWeight: 500, backgroundColor: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

