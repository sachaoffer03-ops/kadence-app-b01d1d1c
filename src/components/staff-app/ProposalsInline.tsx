import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Check, X } from "lucide-react";
import { toast } from "sonner";
import { acceptProposal, declineProposal, acceptReplacementProposal } from "@/lib/proposals.functions";
import { useProposals } from "./ProposalsSheet";

export function ProposalsInline({ userId, studios }: {
  userId: string;
  studios: Record<string, string>;
}) {
  const { proposals, reload } = useProposals(userId);
  const acceptFn = useServerFn(acceptProposal);
  const acceptReplFn = useServerFn(acceptReplacementProposal);
  const declineFn = useServerFn(declineProposal);
  const [busy, setBusy] = useState<string | null>(null);

  if (!proposals || proposals.length === 0) return null;

  const accept = async (p: any) => {
    setBusy(p.id);
    try {
      const r = p.replacement_request_id
        ? await acceptReplFn({ data: { proposalId: p.id } })
        : await acceptFn({ data: { proposalId: p.id } });
      if (r.ok) toast.success("Shift accepté !");
      else toast.error("Trop tard, un autre employé a déjà accepté");
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
    <div className="flex flex-col gap-3 mb-4">
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--coral-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {proposals.length} proposition{proposals.length > 1 ? "s" : ""} en attente
      </div>
      {proposals.map((p: any) => {
        const sname = p.shift.studio_id ? (studios[p.shift.studio_id] || "—") : "—";
        const dateLabel = new Date(p.shift.shift_date).toLocaleDateString("fr-FR", {
          weekday: "long", day: "numeric", month: "long",
        });
        return (
          <div key={p.id} className="rounded-xl border p-4" style={{ backgroundColor: "#fff", borderColor: "var(--coral)" }}>
            <div className="flex items-center gap-2 mb-1" style={{ fontSize: 11, color: "var(--coral-dark)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <Send size={11} /> Nouvelle proposition
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, textTransform: "capitalize" }}>{dateLabel}</div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
              {String(p.shift.start_time).slice(0, 5)} — {String(p.shift.end_time).slice(0, 5)} · {p.shift.business_role} · {sname.replace("Skult ", "")}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => accept(p)}
                disabled={busy === p.id}
                className="flex-1 rounded-xl py-3 flex items-center justify-center gap-2"
                style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)", border: "none" }}
              >
                <Check size={16} /> Accepter
              </button>
              <button
                onClick={() => decline(p.id)}
                disabled={busy === p.id}
                className="flex-1 rounded-xl py-3 flex items-center justify-center gap-2"
                style={{ fontSize: 14, fontWeight: 500, backgroundColor: "transparent", color: "var(--muted-foreground)", border: "0.5px solid var(--border)" }}
              >
                <X size={16} /> Refuser
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
