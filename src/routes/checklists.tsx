import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ClipboardCheck, Camera, Sparkles, GripVertical, Plus, Trash2, AlertTriangle } from "lucide-react";
import { checklistTemplates, roleColors, type ChecklistTemplate } from "@/lib/mock-data";

export const Route = createFileRoute("/checklists")({
  component: ChecklistsPage,
  head: () => ({ meta: [{ title: "Checklists — Shifty" }] }),
});

function ChecklistsPage() {
  const [selected, setSelected] = useState(checklistTemplates[0]?.id || '');
  const template = checklistTemplates.find(c => c.id === selected);

  return (
    <div className="p-6" style={{}}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Checklists de fin de shift</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Configurez les items de vérification par studio et par rôle.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MiniKpi label="Complétion globale" value={`${Math.round(checklistTemplates.reduce((s, c) => s + c.completionRate, 0) / checklistTemplates.length)}%`} />
        <MiniKpi label="Templates actifs" value={checklistTemplates.length.toString()} />
        <MiniKpi label="Items souvent oubliés" value={checklistTemplates.reduce((s, c) => s + c.frequentlySkipped.length, 0).toString()} color="var(--warning-text)" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left: template list */}
        <div className="flex flex-col gap-2">
          {checklistTemplates.map(cl => {
            const roleColor = roleColors[cl.role];
            const isSelected = cl.id === selected;
            return (
              <button
                key={cl.id}
                onClick={() => setSelected(cl.id)}
                className="rounded-lg border px-4 py-3 text-left transition-all"
                style={{
                  backgroundColor: isSelected ? "var(--foreground)" : "var(--card)",
                  borderColor: isSelected ? "var(--foreground)" : "var(--border)",
                  color: isSelected ? "var(--card)" : "var(--foreground)",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: isSelected ? "var(--coral)" : roleColor.dot }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{cl.role}</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {cl.studio.replace('Skult ', '')} · {cl.items.length} items · {cl.completionRate}%
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: detail */}
        {template && (
          <div className="col-span-2">
            <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: roleColors[template.role].dot }} />
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{template.role} — {template.studio}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {template.items.length} items · Complétion : {template.completionRate}%
                  </div>
                </div>
                <button className="rounded-md px-3 py-1.5 flex items-center gap-1 transition-colors" style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>
                  <Plus size={13} /> Ajouter un item
                </button>
              </div>

              {/* Items */}
              <div className="flex flex-col gap-1">
                {template.items.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors" style={{ cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                  >
                    <GripVertical size={14} style={{ color: "var(--muted-foreground)", cursor: "grab" }} />
                    <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>
                    <div className="flex items-center gap-2">
                      {item.photoRequired && (
                        <span className="rounded-full px-1.5 py-0.5 flex items-center gap-1" style={{ fontSize: 9, backgroundColor: "var(--info-bg)", color: "var(--info-text)" }}>
                          <Camera size={9} /> Photo
                        </span>
                      )}
                      {item.aiValidation && (
                        <span className="rounded-full px-1.5 py-0.5 flex items-center gap-1" style={{ fontSize: 9, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)" }}>
                          <Sparkles size={9} /> IA
                        </span>
                      )}
                      <Trash2 size={13} style={{ color: "var(--muted-foreground)", cursor: "pointer" }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Frequently skipped */}
              {template.frequentlySkipped.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "0.5px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={13} style={{ color: "var(--warning-text)" }} />
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--warning-text)" }}>Items souvent oubliés</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {template.frequentlySkipped.map(item => (
                      <span key={item} className="rounded-full px-2.5 py-1" style={{ fontSize: 11, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <span style={{ fontSize: 22, fontWeight: 500, color: color || "var(--foreground)" }}>{value}</span>
    </div>
  );
}
