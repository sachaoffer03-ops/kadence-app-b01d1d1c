import { useEffect, useState } from "react";
import { ChevronRight, Inbox, AlertCircle, Replace } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  userId: string;
  onOpenMyRequests: () => void;
  onOpenSignal: () => void;
  onOpenRequest: () => void;
}

/**
 * Carte "À faire" unifiée — regroupe les actions courantes de l'employé.
 * Compteur live des demandes en attente.
 */
export function TodoCard({ userId, onOpenMyRequests, onOpenSignal, onOpenRequest }: Props) {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const { count } = await supabase
        .from("modification_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pending");
      if (!cancel) setPending(count || 0);
    };
    load();
    const ch = supabase.channel(`todo-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "modification_requests", filter: `user_id=eq.${userId}` },
        load
      ).subscribe();
    return () => { cancel = true; supabase.removeChannel(ch); };
  }, [userId]);

  const items: { icon: React.ReactNode; label: string; sub: string; onClick: () => void; badge?: number }[] = [
    {
      icon: <Inbox size={16} style={{ color: "var(--muted-foreground)" }} />,
      label: "Mes demandes",
      sub: pending > 0 ? `${pending} en attente de réponse` : "Aucune en attente",
      onClick: onOpenMyRequests,
      badge: pending > 0 ? pending : undefined,
    },
    {
      icon: <Replace size={16} style={{ color: "var(--muted-foreground)" }} />,
      label: "Faire une demande",
      sub: "Échange, modification, annulation",
      onClick: onOpenRequest,
    },
    {
      icon: <AlertCircle size={16} style={{ color: "var(--muted-foreground)" }} />,
      label: "Signaler un problème",
      sub: "Stock, matériel, hygiène",
      onClick: onOpenSignal,
    },
  ];

  return (
    <div
      className="rounded-xl overflow-hidden mb-5"
      style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}
    >
      {items.map((it, i) => (
        <button
          key={i}
          onClick={it.onClick}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
          style={{
            borderBottom: i < items.length - 1 ? "0.5px solid rgba(0,0,0,0.06)" : "none",
            cursor: "pointer",
          }}
        >
          {it.icon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, fontWeight: 500 }}>{it.label}</span>
              {it.badge !== undefined && (
                <span
                  className="rounded-full"
                  style={{
                    minWidth: 18, height: 18, padding: "0 6px",
                    fontSize: 10, fontWeight: 600,
                    backgroundColor: "var(--coral)", color: "var(--coral-text)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {it.badge}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{it.sub}</div>
          </div>
          <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
        </button>
      ))}
    </div>
  );
}
