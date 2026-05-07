import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Send, UserPlus, Users, Sparkles, Clock, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { holeShifts, roleColors, getUrgencyColor, type HoleShift } from "@/lib/mock-data";

export const Route = createFileRoute("/trous")({
  component: TrousPage,
  head: () => ({ meta: [{ title: "Trous à combler — Shifty" }] }),
});

function TrousPage() {
  const [expandedHole, setExpandedHole] = useState<string | null>(holeShifts[0]?.id || null);

  const critique = holeShifts.filter(h => h.urgency === 'critique').length;
  const urgent = holeShifts.filter(h => h.urgency === 'urgent').length;

  return (
    <div className="p-6" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} style={{ color: "var(--danger-text)" }} />
            <h1 style={{ fontSize: 18, fontWeight: 500 }}>{holeShifts.length} trous à combler</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Shifts non couverts pour les prochains jours. Proposez, assignez ou lancez un appel collectif.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {critique > 0 && (
            <span className="rounded-full px-2.5 py-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}>
              {critique} critique{critique > 1 ? 's' : ''}
            </span>
          )}
          {urgent > 0 && (
            <span className="rounded-full px-2.5 py-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
              {urgent} urgent{urgent > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Holes list */}
      <div className="flex flex-col gap-3">
        {holeShifts.map((hole) => (
          <HoleCard
            key={hole.id}
            hole={hole}
            expanded={expandedHole === hole.id}
            onToggle={() => setExpandedHole(expandedHole === hole.id ? null : hole.id)}
          />
        ))}
      </div>
    </div>
  );
}

function HoleCard({ hole, expanded, onToggle }: { hole: HoleShift; expanded: boolean; onToggle: () => void }) {
  const urgencyColor = getUrgencyColor(hole.urgency);
  const roleColor = roleColors[hole.role];
  const [actionState, setActionState] = useState<Record<string, string>>({});

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all"
      style={{ backgroundColor: "var(--card)", borderColor: expanded ? "var(--coral)" : "var(--border)", borderWidth: expanded ? 1.5 : 1 }}
    >
      {/* Header row */}
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 text-left">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Role dot + urgency */}
          <div className="flex flex-col items-center gap-1">
            <span className="rounded-full" style={{ width: 10, height: 10, backgroundColor: roleColor.dot }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span style={{ fontSize: 14, fontWeight: 500 }}>{hole.role}</span>
              <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, backgroundColor: urgencyColor.bg, color: urgencyColor.text, fontWeight: 500 }}>
                {urgencyColor.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {hole.dateLabel} · {hole.time} · {hole.studio}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Raison</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{hole.reason}</div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Éligibles</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{hole.eligibleCount}</div>
          </div>
          {expanded ? <ChevronUp size={16} style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown size={16} style={{ color: "var(--muted-foreground)" }} />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5" style={{ borderTop: "0.5px solid var(--border)" }}>
          {/* Quick actions */}
          <div className="flex items-center gap-2 pt-4 pb-3">
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Actions rapides
            </span>
            <button
              className="rounded-md px-3 py-1.5 flex items-center gap-1.5 transition-colors"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
            >
              <Users size={13} />
              Appel collectif
            </button>
          </div>

          {/* Eligible employees */}
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-4 py-2" style={{ backgroundColor: "var(--muted)", borderBottom: "0.5px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <Sparkles size={12} style={{ color: "var(--coral)" }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>
                  Employés éligibles · triés par recommandation IA
                </span>
              </div>
            </div>
            {hole.eligible.map((emp, i) => (
              <div
                key={emp.employeeId}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < hole.eligible.length - 1 ? "0.5px solid var(--border)" : "none", opacity: emp.available ? 1 : 0.5 }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{emp.name}</span>
                    {emp.aiRecommended && (
                      <span className="rounded-full px-1.5 py-0.5 flex items-center gap-1" style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)" }}>
                        <Sparkles size={8} /> IA
                      </span>
                    )}
                    {!emp.available && (
                      <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
                        Non dispo
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    Score {emp.score}/10{emp.hoursLeft != null ? ` · ${emp.hoursLeft}h restantes` : ''}
                  </div>
                </div>
                {actionState[emp.employeeId] ? (
                  <span className="rounded-full px-2.5 py-1 flex items-center gap-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
                    <Check size={12} /> {actionState[emp.employeeId]}
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <ActionButton label="Proposer" icon={<Send size={11} />} onClick={() => setActionState(s => ({ ...s, [emp.employeeId]: 'Proposé' }))} />
                    <ActionButton label="Assigner" icon={<UserPlus size={11} />} variant="dark" onClick={() => setActionState(s => ({ ...s, [emp.employeeId]: 'Assigné' }))} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({ label, icon, variant, onClick }: { label: string; icon: React.ReactNode; variant?: 'dark'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md px-2.5 py-1.5 flex items-center gap-1 transition-colors"
      style={{
        fontSize: 11,
        fontWeight: 500,
        backgroundColor: variant === 'dark' ? "var(--foreground)" : "transparent",
        color: variant === 'dark' ? "var(--card)" : "var(--foreground)",
        border: variant === 'dark' ? "none" : "0.5px solid var(--border)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
