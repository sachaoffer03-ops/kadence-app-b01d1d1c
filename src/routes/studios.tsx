import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Minus, Plus, Info } from "lucide-react";
import { roleColors, type Role } from "@/lib/mock-data";

export const Route = createFileRoute("/studios")({
  component: StudiosPage,
  head: () => ({
    meta: [{ title: "Studios & postes — Shifty" }],
  }),
});

const studioTabs = ["Skult Rhodes", "Skult Châtelain", "+ Nouveau studio"] as const;
const subTabs = ["Informations", "Horaires d'ouverture", "Besoins en staff", "Exceptions", "Checklists"] as const;

interface ShiftNeeds {
  label: string;
  time: string;
  needs: Record<Role, number>;
}

const defaultNeeds: ShiftNeeds[] = [
  { label: "Matin", time: "07h — 12h", needs: { Barista: 2, Accueil: 1, Host: 0, Cuisine: 1 } },
  { label: "Midi", time: "12h — 17h", needs: { Barista: 2, Accueil: 1, Host: 1, Cuisine: 1 } },
  { label: "Soir", time: "17h — 23h", needs: { Barista: 2, Accueil: 1, Host: 1, Cuisine: 1 } },
];

function StudiosPage() {
  const [activeStudio, setActiveStudio] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(2); // Besoins en staff
  const [needs, setNeeds] = useState<ShiftNeeds[]>(defaultNeeds);

  const updateNeed = (shiftIdx: number, role: Role, delta: number) => {
    setNeeds((prev) => prev.map((s, i) => {
      if (i !== shiftIdx) return s;
      return { ...s, needs: { ...s.needs, [role]: Math.max(0, s.needs[role] + delta) } };
    }));
  };

  const totalDaily = needs.reduce((sum, s) => sum + Object.values(s.needs).reduce((a, b) => a + b, 0), 0);

  return (
    <div className="p-6" style={{ maxWidth: 1200 }}>
      {/* Studio tabs */}
      <div className="flex items-center gap-1 mb-5" style={{ borderBottom: "0.5px solid var(--border)" }}>
        {studioTabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => i < 2 && setActiveStudio(i)}
            className="px-4 py-2 transition-colors"
            style={{
              fontSize: 13,
              fontWeight: activeStudio === i ? 500 : 400,
              color: i === 2 ? "var(--coral)" : activeStudio === i ? "var(--foreground)" : "var(--muted-foreground)",
              borderBottom: activeStudio === i ? "2px solid var(--foreground)" : "2px solid transparent",
              marginBottom: -0.5,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-6">
        {subTabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(i)}
            className="rounded-full px-3 py-1.5 transition-colors"
            style={{
              fontSize: 12,
              fontWeight: activeSubTab === i ? 500 : 400,
              backgroundColor: activeSubTab === i ? "var(--foreground)" : "transparent",
              color: activeSubTab === i ? "var(--card)" : "var(--muted-foreground)",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeSubTab === 2 ? (
        <>
          {/* Needs cards */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {needs.map((shift, shiftIdx) => (
              <div
                key={shift.label}
                className="rounded-xl border p-5"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{shift.label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{shift.time}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {(Object.keys(shift.needs) as Role[]).map((role) => (
                    <div key={role} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: roleColors[role].dot }} />
                        <span style={{ fontSize: 13 }}>{role}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateNeed(shiftIdx, role, -1)}
                          className="rounded-md flex items-center justify-center transition-colors"
                          style={{ width: 24, height: 24, border: "0.5px solid var(--border)" }}
                        >
                          <Minus size={12} />
                        </button>
                        <span style={{ fontSize: 14, fontWeight: 500, minWidth: 20, textAlign: "center" }}>
                          {shift.needs[role]}
                        </span>
                        <button
                          onClick={() => updateNeed(shiftIdx, role, 1)}
                          className="rounded-md flex items-center justify-center transition-colors"
                          style={{ width: 24, height: 24, border: "0.5px solid var(--border)" }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className="mt-4 pt-3"
                  style={{ borderTop: "0.5px solid var(--border)", fontSize: 12, color: "var(--muted-foreground)" }}
                >
                  Total : <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
                    {Object.values(shift.needs).reduce((a, b) => a + b, 0)} personnes
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Info banner */}
          <div
            className="rounded-xl px-5 py-4 flex items-start gap-3"
            style={{ backgroundColor: "var(--info-bg)" }}
          >
            <Info size={16} style={{ color: "var(--info-text)", marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: "var(--info-text)", lineHeight: 1.6 }}>
              <span style={{ fontWeight: 500 }}>{studioTabs[activeStudio]}</span> a besoin de{" "}
              <span style={{ fontWeight: 500 }}>{totalDaily} personnes par jour</span> réparties sur 3 créneaux.
              Le planning sera généré automatiquement en fonction de ces besoins et des disponibilités du staff.
            </div>
          </div>
        </>
      ) : (
        <StubContent tab={subTabs[activeSubTab]} />
      )}
    </div>
  );
}

function StubContent({ tab }: { tab: string }) {
  return (
    <div
      className="rounded-xl border p-8 text-center"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{tab}</div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
        Bientôt disponible
      </div>
    </div>
  );
}
