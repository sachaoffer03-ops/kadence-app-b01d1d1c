import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X, Clock, AlertCircle, ChevronDown } from "lucide-react";
import { modificationRequests, roleColors, employees, type ModificationRequest } from "@/lib/mock-data";

export const Route = createFileRoute("/demandes")({
  component: DemandesPage,
  head: () => ({ meta: [{ title: "Demandes de modification — Shifty" }] }),
});

const urgencyStyles: Record<string, { bg: string; text: string; label: string }> = {
  critique: { bg: "var(--danger-bg)", text: "var(--danger-text)", label: "Critique" },
  urgent: { bg: "var(--warning-bg)", text: "var(--warning-text)", label: "Urgent" },
  normal: { bg: "var(--muted)", text: "var(--muted-foreground)", label: "Normal" },
};

function DemandesPage() {
  const [requests, setRequests] = useState(modificationRequests);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pending = requests
    .filter((r) => r.status === "en-attente")
    .sort((a, b) => {
      const order = { critique: 0, urgent: 1, normal: 2 };
      return order[a.urgency] - order[b.urgency];
    });
  const handled = requests.filter((r) => r.status !== "en-attente");

  const handleAction = (id: string, action: "acceptée" | "refusée") => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: action } : r)));
    setExpandedId(null);
  };

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Demandes de modification</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          {pending.length} demande{pending.length > 1 ? "s" : ""} en attente
        </p>
      </div>

      {/* Pending requests */}
      {pending.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--success-text)" }}>Aucune demande en attente</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>Toutes les demandes ont été traitées.</div>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden mb-8" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          {/* Header */}
          <div className="grid px-5 py-2.5" style={{ gridTemplateColumns: "1fr 120px 100px 140px 120px", borderBottom: "0.5px solid var(--border)" }}>
            {["Employé", "Shift", "Motif", "Urgence", ""].map((h) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {pending.map((req) => {
            const isExpanded = expandedId === req.id;
            const emp = employees.find((e) => e.id === req.employeeId);
            const urg = urgencyStyles[req.urgency];
            const roleColor = roleColors[req.role];

            return (
              <div key={req.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                {/* Main row */}
                <div
                  className="grid px-5 py-3 items-center transition-colors"
                  style={{ gridTemplateColumns: "1fr 120px 100px 140px 120px", cursor: "pointer" }}
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  {/* Employee */}
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 30, height: 30, backgroundColor: roleColor.bg, color: roleColor.text, fontSize: 10, fontWeight: 500 }}>
                      {req.employeeName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{req.employeeName}</div>
                      <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                        <span className="rounded-full" style={{ width: 5, height: 5, backgroundColor: roleColor.dot }} />
                        {req.role} · {req.studio.replace("Skult ", "")}
                      </div>
                    </div>
                  </div>

                  {/* Shift */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{req.shiftDate.split(" ").slice(0, 2).join(" ")}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{req.shiftTime}</div>
                  </div>

                  {/* Reason */}
                  <div style={{ fontSize: 12 }}>{req.reasonLabel}</div>

                  {/* Urgency */}
                  <div className="flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: urg.bg, color: urg.text }}>
                      {urg.label}
                    </span>
                  </div>

                  {/* Expand */}
                  <div className="flex items-center justify-end gap-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    <Clock size={11} /> {req.submittedAt}
                    <ChevronDown size={14} style={{ marginLeft: 4, transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-5 pb-4" style={{ backgroundColor: "var(--muted)" }}>
                    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                      {/* Comment */}
                      <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
                        "{req.comment}"
                      </div>

                      {/* Context row */}
                      <div className="flex items-center gap-6 mb-4" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                        <span>Score : <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{emp?.score}/10</span></span>
                        <span>Contrat : <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{emp?.contract}</span></span>
                        <span>Remplaçants : <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{req.replacementCount} disponibles</span></span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAction(req.id, "acceptée"); }}
                          className="rounded-md px-4 py-2 flex items-center gap-1.5 transition-colors"
                          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                        >
                          <Check size={14} /> Accepter
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAction(req.id, "refusée"); }}
                          className="rounded-md px-4 py-2 flex items-center gap-1.5 transition-colors"
                          style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                        >
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

      {/* Handled */}
      {handled.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 10 }}>
            Traitées récemment
          </div>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            {handled.map((req, i) => (
              <div
                key={req.id}
                className="flex items-center gap-4 px-5 py-3"
                style={{ borderBottom: i < handled.length - 1 ? "0.5px solid var(--border)" : "none", opacity: 0.6 }}
              >
                <div className="flex-1">
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{req.employeeName}</span>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}> · {req.shiftDate} · {req.shiftTime}</span>
                </div>
                <span className="rounded-full px-2 py-0.5" style={{
                  fontSize: 10, fontWeight: 500,
                  backgroundColor: req.status === "acceptée" ? "var(--success-bg)" : "var(--danger-bg)",
                  color: req.status === "acceptée" ? "var(--success-text)" : "var(--danger-text)",
                }}>
                  {req.status === "acceptée" ? "Acceptée" : "Refusée"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
