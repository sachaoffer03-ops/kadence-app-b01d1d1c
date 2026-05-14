import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Clock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet } from "@/components/staff-app/shared";
import { acceptProposal, declineProposal, acceptReplacementProposal } from "@/lib/proposals.functions";

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

  const load = async () => {
    const { data } = await supabase
      .from("shift_proposals")
      .select("id,status,sent_at,replacement_request_id,shift:shifts!inner(id,shift_date,start_time,end_time,business_role,studio_id,user_id)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("sent_at", { ascending: false });
    // On accepte : (a) trous classiques (shift libre) ; (b) remplacements (shift encore assigné à l'employé d'origine)
    const list = (data || []).filter((p: any) => {
      if (!p.shift) return false;
      if (p.replacement_request_id) return p.shift.user_id !== userId; // pas à soi-même
      return !p.shift.user_id;
    }) as ProposalView[];
    setProposals(list);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`proposals-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_proposals", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  return { proposals, reload: load };
}

export function ProposalsSheet({ open, onClose, userId, studios }: {
  open: boolean; onClose: () => void; userId: string; studios: Record<string, string>;
}) {
  const acceptFn = useServerFn(acceptProposal);
  const acceptReplFn = useServerFn(acceptReplacementProposal);
  const declineFn = useServerFn(declineProposal);
  const { proposals, reload } = useProposals(userId);
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

  return (
    <Sheet open={open} onClose={onClose} title="Propositions de shift">
      {proposals.length === 0 ? (
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
        </div>
      )}
    </Sheet>
  );
}
