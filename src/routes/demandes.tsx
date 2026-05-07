import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X, Clock, ChevronRight } from "lucide-react";
import { modificationRequests, roleColors, getUrgencyColor, reasonIcons, employees, type ModificationRequest } from "@/lib/mock-data";

export const Route = createFileRoute("/demandes")({
  component: DemandesPage,
  head: () => ({ meta: [{ title: "Demandes de modification — Shifty" }] }),
});

function DemandesPage() {
  const [requests, setRequests] = useState(modificationRequests);
  const pending = requests.filter(r => r.status === 'en-attente');
  const handled = requests.filter(r => r.status !== 'en-attente');

  const handleAction = (id: string, action: 'acceptée' | 'refusée') => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: action } : r));
  };

  return (
    <div className="p-6" style={{ maxWidth: 1200 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Demandes de modification</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            {pending.length} demande{pending.length > 1 ? 's' : ''} en attente · triées par urgence
          </p>
        </div>
      </div>

      {/* Pending */}
      <div className="flex flex-col gap-3 mb-8">
        {pending.sort((a, b) => {
          const order = { critique: 0, urgent: 1, normal: 2 };
          return order[a.urgency] - order[b.urgency];
        }).map(req => (
          <RequestCard key={req.id} request={req} onAccept={() => handleAction(req.id, 'acceptée')} onRefuse={() => handleAction(req.id, 'refusée')} />
        ))}
        {pending.length === 0 && (
          <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--success-text)" }}>Aucune demande en attente</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>Toutes les demandes ont été traitées.</div>
          </div>
        )}
      </div>

      {/* Handled */}
      {handled.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 12 }}>
            Traitées récemment
          </h2>
          <div className="flex flex-col gap-2">
            {handled.map(req => (
              <div key={req.id} className="rounded-lg border px-5 py-3 flex items-center gap-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", opacity: 0.7 }}>
                <span style={{ fontSize: 18 }}>{reasonIcons[req.reason]}</span>
                <div className="flex-1">
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{req.employeeName}</span>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}> · {req.shiftDate} · {req.shiftTime}</span>
                </div>
                <span className="rounded-full px-2.5 py-1" style={{
                  fontSize: 11, fontWeight: 500,
                  backgroundColor: req.status === 'acceptée' ? "var(--success-bg)" : "var(--danger-bg)",
                  color: req.status === 'acceptée' ? "var(--success-text)" : "var(--danger-text)",
                }}>
                  {req.status === 'acceptée' ? 'Acceptée' : 'Refusée'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RequestCard({ request: req, onAccept, onRefuse }: { request: ModificationRequest; onAccept: () => void; onRefuse: () => void }) {
  const urgencyColor = getUrgencyColor(req.urgency);
  const roleColor = roleColors[req.role];
  const emp = employees.find(e => e.id === req.employeeId);

  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-start gap-4">
        {/* Reason icon */}
        <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 44, height: 44, backgroundColor: "var(--muted)", fontSize: 22 }}>
          {reasonIcons[req.reason]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: 14, fontWeight: 500 }}>{req.employeeName}</span>
            <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColor.bg, color: roleColor.text }}>
              {req.role}
            </span>
            <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: urgencyColor.bg, color: urgencyColor.text }}>
              {urgencyColor.label}
            </span>
          </div>

          {/* Shift info */}
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>
            {req.shiftDate} · {req.shiftTime} · {req.studio}
          </div>

          {/* Reason */}
          <div className="rounded-lg px-3 py-2.5 mb-3" style={{ backgroundColor: "var(--muted)" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 2 }}>
              Motif : {req.reasonLabel}
            </div>
            <div style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.5 }}>
              {req.comment}
            </div>
          </div>

          {/* Employee context */}
          <div className="flex items-center gap-4" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            <span>Score : <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{emp?.score}/10</span></span>
            <span>Contrat : <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{emp?.contract}</span></span>
            <span>Remplaçants potentiels : <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{req.replacementCount}</span></span>
            <span className="flex items-center gap-1"><Clock size={10} /> {req.submittedAt}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={onAccept}
            className="rounded-md px-4 py-2 flex items-center gap-1.5 transition-colors"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}
          >
            <Check size={14} /> Accepter
          </button>
          <button
            onClick={onRefuse}
            className="rounded-md px-4 py-2 flex items-center gap-1.5 transition-colors"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}
          >
            <X size={14} /> Refuser
          </button>
        </div>
      </div>
    </div>
  );
}
