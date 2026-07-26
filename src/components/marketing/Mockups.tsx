/**
 * Reconstitutions d'interface Kadence pour le site vitrine.
 * Données 100% fictives — aucune donnée client réelle.
 */

const INK = "#1A1A1A";
const LINE = "rgba(26,26,26,0.10)";

function Chrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: "#fff", border: `1px solid ${LINE}`, boxShadow: "0 24px 60px -30px rgba(26,26,26,0.35)" }}
    >
      <div className="flex items-center gap-2 px-4" style={{ height: 40, borderBottom: `1px solid ${LINE}`, backgroundColor: "#FBFAF7" }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: "#E2DDD3", display: "inline-block" }} />
        <span style={{ width: 8, height: 8, borderRadius: 99, background: "#E2DDD3", display: "inline-block" }} />
        <span style={{ width: 8, height: 8, borderRadius: 99, background: "#E2DDD3", display: "inline-block" }} />
        <span style={{ fontSize: 11, color: "rgba(26,26,26,0.45)", marginLeft: 10, letterSpacing: "0.02em" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

const ROLE = {
  Barista: { bg: "#FAECE7", fg: "#8A3413" },
  Accueil: { bg: "#E4F0EE", fg: "#1F5B54" },
  Cuisine: { bg: "#F7E7EE", fg: "#7C2E4E" },
  Host: { bg: "#ECE8F6", fg: "#453A75" },
} as const;

type RoleKey = keyof typeof ROLE;

const WEEK = [
  { d: "Lun", n: "04" },
  { d: "Mar", n: "05" },
  { d: "Mer", n: "06" },
  { d: "Jeu", n: "07" },
  { d: "Ven", n: "08" },
  { d: "Sam", n: "09" },
  { d: "Dim", n: "10" },
];

const GRID: Array<Array<{ h: string; who: string; role: RoleKey } | null>> = [
  [
    { h: "07:30 – 15:00", who: "Camille", role: "Barista" },
    { h: "07:30 – 15:00", who: "Yanis", role: "Barista" },
    { h: "07:30 – 15:00", who: "Camille", role: "Barista" },
    { h: "08:00 – 16:00", who: "Nora", role: "Barista" },
    { h: "07:30 – 15:00", who: "Yanis", role: "Barista" },
    { h: "08:00 – 16:30", who: "Camille", role: "Barista" },
    null,
  ],
  [
    { h: "11:00 – 19:00", who: "Léa", role: "Accueil" },
    null,
    { h: "11:00 – 19:00", who: "Léa", role: "Accueil" },
    { h: "11:00 – 19:00", who: "Tom", role: "Accueil" },
    { h: "11:00 – 19:30", who: "Léa", role: "Accueil" },
    { h: "10:30 – 19:00", who: "Tom", role: "Accueil" },
    { h: "10:30 – 17:00", who: "Nora", role: "Accueil" },
  ],
  [
    null,
    { h: "17:30 – 21:15", who: "Sofia", role: "Cuisine" },
    { h: "17:30 – 21:15", who: "Marek", role: "Cuisine" },
    { h: "17:30 – 21:15", who: "Sofia", role: "Cuisine" },
    { h: "17:30 – 23:00", who: "Marek", role: "Cuisine" },
    { h: "17:30 – 23:00", who: "Sofia", role: "Cuisine" },
    null,
  ],
];

export function PlanningMock() {
  return (
    <Chrome title="Kadence · Planning · Semaine 32">
      <div className="px-4 py-4" style={{ backgroundColor: "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: INK }}>Août — Établissement Nord</div>
            <div style={{ fontSize: 11, color: "rgba(26,26,26,0.5)", marginTop: 2 }}>18 shifts · 3 postes · couverture 100%</div>
          </div>
          <div className="hidden sm:flex gap-2">
            <span className="rounded-full px-3 py-1" style={{ fontSize: 11, border: `1px solid ${LINE}`, color: "rgba(26,26,26,0.6)" }}>
              Semaine
            </span>
            <span className="rounded-full px-3 py-1" style={{ fontSize: 11, backgroundColor: "var(--coral)", color: "#fff" }}>
              Publié
            </span>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 640 }}>
            <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {WEEK.map((w) => (
                <div key={w.n} className="text-center pb-2" style={{ borderBottom: `1px solid ${LINE}` }}>
                  <div style={{ fontSize: 10, color: "rgba(26,26,26,0.45)", letterSpacing: "0.06em" }}>{w.d.toUpperCase()}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: INK, marginTop: 2 }}>{w.n}</div>
                </div>
              ))}
            </div>

            {GRID.map((row, ri) => (
              <div key={ri} className="grid mt-1.5" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {row.map((cell, ci) =>
                  cell ? (
                    <div
                      key={ci}
                      className="rounded-lg px-2 py-2"
                      style={{ backgroundColor: ROLE[cell.role].bg }}
                    >
                      <div style={{ fontSize: 10, color: ROLE[cell.role].fg, fontWeight: 500 }}>{cell.h}</div>
                      <div style={{ fontSize: 11, color: INK, marginTop: 3 }}>{cell.who}</div>
                      <div style={{ fontSize: 9, color: "rgba(26,26,26,0.45)", marginTop: 1 }}>{cell.role}</div>
                    </div>
                  ) : (
                    <div key={ci} className="rounded-lg" style={{ border: `1px dashed ${LINE}`, minHeight: 56 }} />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Chrome>
  );
}

export function PhoneMock() {
  return (
    <div
      className="rounded-[36px] p-2.5 mx-auto"
      style={{ width: 268, backgroundColor: "#1A1A1A", boxShadow: "0 30px 60px -25px rgba(26,26,26,0.5)" }}
    >
      <div className="rounded-[28px] overflow-hidden" style={{ backgroundColor: "#FAFAF8" }}>
        <div className="flex items-center justify-between px-5 pt-3 pb-1" style={{ fontSize: 10, color: "rgba(26,26,26,0.5)" }}>
          <span>9:41</span>
          <span>●●●</span>
        </div>
        <div className="px-4 pb-5">
          <div style={{ fontSize: 11, color: "rgba(26,26,26,0.5)", letterSpacing: "0.06em", marginTop: 8 }}>MERCREDI 6 AOÛT</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: INK, marginTop: 4 }}>Bonjour Camille</div>

          <div className="rounded-2xl p-4 mt-4" style={{ backgroundColor: "#1A1A1A" }}>
            <div style={{ fontSize: 10, color: "rgba(250,250,248,0.55)", letterSpacing: "0.06em" }}>SHIFT EN COURS</div>
            <div style={{ fontSize: 17, fontWeight: 500, color: "#FAFAF8", marginTop: 5 }}>07:30 – 15:00</div>
            <div style={{ fontSize: 11, color: "rgba(250,250,248,0.65)", marginTop: 2 }}>Barista · Établissement Nord</div>
            <div
              className="rounded-full text-center mt-4 py-2"
              style={{ backgroundColor: "var(--coral)", color: "#fff", fontSize: 12, fontWeight: 500 }}
            >
              Pointer mon départ
            </div>
          </div>

          <div style={{ fontSize: 11, color: "rgba(26,26,26,0.5)", marginTop: 16 }}>Avec moi aujourd'hui</div>
          {[
            ["Léa", "Accueil · 11:00"],
            ["Marek", "Cuisine · 17:30"],
          ].map(([n, r]) => (
            <div
              key={n}
              className="rounded-xl px-3 py-2.5 mt-2 flex items-center gap-3"
              style={{ backgroundColor: "#fff", border: `1px solid ${LINE}` }}
            >
              <span
                className="flex items-center justify-center rounded-full"
                style={{ width: 26, height: 26, backgroundColor: "#F3F1EC", fontSize: 10, color: INK }}
              >
                {n[0]}
              </span>
              <div>
                <div style={{ fontSize: 12, color: INK }}>{n}</div>
                <div style={{ fontSize: 10, color: "rgba(26,26,26,0.5)" }}>{r}</div>
              </div>
            </div>
          ))}

          <div className="rounded-xl px-3 py-2.5 mt-3" style={{ backgroundColor: "var(--coral-light)" }}>
            <div style={{ fontSize: 11, color: "var(--coral-dark)", fontWeight: 500 }}>Clôture à faire</div>
            <div style={{ fontSize: 10, color: "rgba(26,26,26,0.55)", marginTop: 2 }}>6 photos · 4 minutes</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClotureMock() {
  const items = [
    ["Machine rincée et purgée", true],
    ["Vitrine vidée et nettoyée", true],
    ["Sols et terrasse", true],
    ["Caisse comptée", false],
  ] as const;

  return (
    <Chrome title="Kadence · Clôture du soir">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div style={{ fontSize: 13, fontWeight: 500, color: INK }}>Checklist de fermeture</div>
          <span className="rounded-full px-2.5 py-1" style={{ fontSize: 10, backgroundColor: "#E4F0EE", color: "#1F5B54" }}>
            3 / 4
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {items.map(([label, done]) => (
            <div
              key={label}
              className="rounded-xl px-3 py-2.5 flex items-center gap-3"
              style={{ border: `1px solid ${LINE}`, backgroundColor: done ? "#FBFAF7" : "#fff" }}
            >
              <span
                className="flex items-center justify-center rounded-md"
                style={{
                  width: 18,
                  height: 18,
                  fontSize: 10,
                  color: done ? "#fff" : "transparent",
                  backgroundColor: done ? "var(--coral)" : "transparent",
                  border: done ? "none" : `1px solid ${LINE}`,
                }}
              >
                ✓
              </span>
              <span style={{ fontSize: 12, color: done ? "rgba(26,26,26,0.55)" : INK }}>{label}</span>
              <span className="ml-auto" style={{ fontSize: 10, color: "rgba(26,26,26,0.4)" }}>
                {done ? "photo" : "à faire"}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {["#EFE9E1", "#E7E1D8", "#F1EAE4"].map((c) => (
            <div key={c} className="rounded-lg" style={{ backgroundColor: c, height: 54 }} />
          ))}
        </div>
      </div>
    </Chrome>
  );
}

export function PointageMock() {
  const rows = [
    ["Camille D.", "07:28", "15:02", "à l'heure"],
    ["Léa M.", "11:06", "19:00", "retard 6 min"],
    ["Marek S.", "17:29", "—", "en service"],
  ];
  return (
    <Chrome title="Kadence · Pointage du jour">
      <div className="p-5">
        <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr", gap: 8 }}>
          {["Employé", "Arrivée", "Départ", "Statut"].map((h) => (
            <div key={h} style={{ fontSize: 10, letterSpacing: "0.06em", color: "rgba(26,26,26,0.45)" }}>
              {h.toUpperCase()}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-col">
          {rows.map(([n, a, d, s]) => (
            <div
              key={n}
              className="grid items-center py-3"
              style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr", gap: 8, borderTop: `1px solid ${LINE}` }}
            >
              <span style={{ fontSize: 12, color: INK }}>{n}</span>
              <span style={{ fontSize: 12, color: "rgba(26,26,26,0.65)" }}>{a}</span>
              <span style={{ fontSize: 12, color: "rgba(26,26,26,0.65)" }}>{d}</span>
              <span
                className="rounded-full px-2 py-1 justify-self-start"
                style={{
                  fontSize: 10,
                  backgroundColor: s === "à l'heure" ? "#E4F0EE" : s === "en service" ? "#F3F1EC" : "#FAECE7",
                  color: s === "à l'heure" ? "#1F5B54" : s === "en service" ? "rgba(26,26,26,0.6)" : "#8A3413",
                }}
              >
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Chrome>
  );
}
