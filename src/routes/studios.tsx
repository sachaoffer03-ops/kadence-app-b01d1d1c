import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Minus,
  Plus,
  Info,
  MapPin,
  Phone,
  Mail,
  User,
  Users,
  Camera,
  Sparkles,
  Calendar,
  CalendarOff,
  PartyPopper,
  SlidersHorizontal,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";
import {
  roleColors,
  type Role,
  type Studio,
  checklistTemplates,
  studioExceptions,
} from "@/lib/mock-data";

export const Route = createFileRoute("/studios")({
  component: StudiosPage,
  head: () => ({ meta: [{ title: "Studios & postes — Shifty" }] }),
});

const studioTabs = ["Skult Rhodes", "Skult Châtelain", "+ Nouveau studio"] as const;
const subTabs = [
  "Informations",
  "Horaires d'ouverture",
  "Besoins en staff",
  "Exceptions",
  "Checklists",
] as const;

const allRoles: Role[] = ["Barista", "Accueil", "Host", "Cuisine"];

/* ------------------------------------------------------------------ */
/* Mock data — informations & horaires                                 */
/* ------------------------------------------------------------------ */

interface StudioInfo {
  name: Studio;
  address: string;
  postalCity: string;
  phone: string;
  email: string;
  manager: string;
  capacity: number;
  surface: string;
  opened: string;
  notes: string;
}

const studioInfos: StudioInfo[] = [
  {
    name: "Skult Rhodes",
    address: "Avenue de Rhodes 12",
    postalCity: "1180 Uccle, Bruxelles",
    phone: "+32 2 374 12 34",
    email: "rhodes@skultstudios.be",
    manager: "Sacha",
    capacity: 48,
    surface: "120 m²",
    opened: "Mars 2023",
    notes:
      "Studio principal — espace lumineux avec terrasse arrière. Cuisine équipée four à pain. Brunchs servis jusqu'à 15h le weekend.",
  },
  {
    name: "Skult Châtelain",
    address: "Place du Châtelain 8",
    postalCity: "1050 Ixelles, Bruxelles",
    phone: "+32 2 538 56 78",
    email: "chatelain@skultstudios.be",
    manager: "Sacha",
    capacity: 36,
    surface: "85 m²",
    opened: "Septembre 2024",
    notes:
      "Quartier vivant — forte affluence le mercredi (marché) et en soirée. Petite cuisine, carte simplifiée. Service jazz live le samedi soir.",
  },
];

interface DayHours {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

const defaultHoursRhodes: DayHours[] = [
  { day: "Lundi", open: "07h00", close: "18h00", closed: false },
  { day: "Mardi", open: "07h00", close: "18h00", closed: false },
  { day: "Mercredi", open: "07h00", close: "18h00", closed: false },
  { day: "Jeudi", open: "07h00", close: "18h00", closed: false },
  { day: "Vendredi", open: "07h00", close: "23h00", closed: false },
  { day: "Samedi", open: "08h00", close: "23h00", closed: false },
  { day: "Dimanche", open: "08h00", close: "17h00", closed: false },
];

const defaultHoursChatelain: DayHours[] = [
  { day: "Lundi", open: "08h00", close: "18h00", closed: true },
  { day: "Mardi", open: "08h00", close: "18h00", closed: false },
  { day: "Mercredi", open: "08h00", close: "22h00", closed: false },
  { day: "Jeudi", open: "08h00", close: "18h00", closed: false },
  { day: "Vendredi", open: "08h00", close: "23h00", closed: false },
  { day: "Samedi", open: "09h00", close: "23h00", closed: false },
  { day: "Dimanche", open: "09h00", close: "16h00", closed: false },
];

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

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function StudiosPage() {
  const [activeStudio, setActiveStudio] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(0);

  const currentStudio = studioInfos[activeStudio];

  return (
    <div className="p-6">
      {/* Studio tabs */}
      <div
        className="flex items-center gap-1 mb-5"
        style={{ borderBottom: "0.5px solid var(--border)" }}
      >
        {studioTabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => i < 2 && setActiveStudio(i)}
            className="px-4 py-2 transition-colors"
            style={{
              fontSize: 13,
              fontWeight: activeStudio === i ? 500 : 400,
              color:
                i === 2
                  ? "var(--coral)"
                  : activeStudio === i
                    ? "var(--foreground)"
                    : "var(--muted-foreground)",
              borderBottom:
                activeStudio === i ? "2px solid var(--foreground)" : "2px solid transparent",
              marginBottom: -0.5,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
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

      {activeSubTab === 0 && <InformationsTab info={currentStudio} />}
      {activeSubTab === 1 && (
        <HorairesTab
          initial={activeStudio === 0 ? defaultHoursRhodes : defaultHoursChatelain}
          studioName={currentStudio.name}
        />
      )}
      {activeSubTab === 2 && <BesoinsTab studioName={currentStudio.name} />}
      {activeSubTab === 3 && <ExceptionsTab studio={currentStudio.name} />}
      {activeSubTab === 4 && <ChecklistsTab studio={currentStudio.name} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab — Informations                                                  */
/* ------------------------------------------------------------------ */

function InformationsTab({ info }: { info: StudioInfo }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Card principal */}
      <div
        className="col-span-2 rounded-xl border p-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{info.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
              Ouvert depuis {info.opened}
            </div>
          </div>
          <button
            className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
            style={{
              fontSize: 12,
              fontWeight: 500,
              border: "0.5px solid var(--border)",
            }}
          >
            <Pencil size={12} />
            Modifier
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow icon={MapPin} label="Adresse" value={`${info.address}\n${info.postalCity}`} />
          <InfoRow icon={User} label="Responsable" value={info.manager} />
          <InfoRow icon={Phone} label="Téléphone" value={info.phone} />
          <InfoRow icon={Mail} label="Email" value={info.email} />
          <InfoRow icon={Users} label="Capacité" value={`${info.capacity} couverts`} />
          <InfoRow icon={SlidersHorizontal} label="Surface" value={info.surface} />
        </div>

        <div className="mt-5 pt-4" style={{ borderTop: "0.5px solid var(--border)" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Notes internes
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{info.notes}</div>
        </div>
      </div>

      {/* Side card — postes actifs */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Postes actifs</div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 14 }}>
          Rôles disponibles dans ce studio
        </div>
        <div className="flex flex-col gap-2">
          {allRoles.map((role) => (
            <div
              key={role}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ backgroundColor: "var(--muted)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full"
                  style={{ width: 8, height: 8, backgroundColor: roleColors[role].dot }}
                />
                <span style={{ fontSize: 13 }}>{role}</span>
              </div>
              <Check size={14} style={{ color: "var(--muted-foreground)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} style={{ color: "var(--muted-foreground)", marginTop: 3, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 13, whiteSpace: "pre-line" }}>{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab — Horaires d'ouverture                                          */
/* ------------------------------------------------------------------ */

function HorairesTab({ initial, studioName }: { initial: DayHours[]; studioName: Studio }) {
  const [hours, setHours] = useState<DayHours[]>(initial);

  const update = (idx: number, patch: Partial<DayHours>) => {
    setHours((prev) => prev.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  };

  const totalHours = useMemo(() => {
    return hours.reduce((sum, h) => {
      if (h.closed) return sum;
      const [oh, om] = h.open.replace("h", ":").split(":").map(Number);
      const [ch, cm] = h.close.replace("h", ":").split(":").map(Number);
      return sum + (ch + cm / 60 - (oh + om / 60));
    }, 0);
  }, [hours]);

  return (
    <>
      <div
        className="rounded-xl border overflow-hidden mb-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: "0.5px solid var(--border)" }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Semaine type</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Horaires d'ouverture par défaut — peuvent être ajustés via Exceptions
            </div>
          </div>
          <div
            className="rounded-full px-2.5 py-1"
            style={{
              fontSize: 11,
              fontWeight: 500,
              backgroundColor: "var(--muted)",
              color: "var(--muted-foreground)",
            }}
          >
            {totalHours.toFixed(0)}h / semaine
          </div>
        </div>

        <div>
          {hours.map((h, idx) => (
            <div
              key={h.day}
              className="px-5 py-3 grid items-center gap-4"
              style={{
                gridTemplateColumns: "120px 1fr 1fr 90px",
                borderBottom: idx < hours.length - 1 ? "0.5px solid var(--border)" : "none",
                opacity: h.closed ? 0.5 : 1,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500 }}>{h.day}</div>
              <TimeInput
                value={h.open}
                disabled={h.closed}
                onChange={(v) => update(idx, { open: v })}
                label="Ouverture"
              />
              <TimeInput
                value={h.close}
                disabled={h.closed}
                onChange={(v) => update(idx, { close: v })}
                label="Fermeture"
              />
              <button
                onClick={() => update(idx, { closed: !h.closed })}
                className="rounded-full px-2.5 py-1 transition-colors"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  backgroundColor: h.closed ? "var(--danger-bg)" : "var(--muted)",
                  color: h.closed ? "var(--danger-text)" : "var(--muted-foreground)",
                }}
              >
                {h.closed ? "Fermé" : "Ouvert"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-xl px-5 py-4 flex items-start gap-3"
        style={{ backgroundColor: "var(--info-bg)" }}
      >
        <Info size={16} style={{ color: "var(--info-text)", marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "var(--info-text)", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 500 }}>{studioName}</span> ouvre{" "}
          <span style={{ fontWeight: 500 }}>{totalHours.toFixed(0)} heures par semaine</span>. Ces
          plages servent de base pour générer les shifts. Les jours fériés et événements
          spéciaux se gèrent dans l'onglet Exceptions.
        </div>
      </div>
    </>
  );
}

function TimeInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col">
      <span
        style={{
          fontSize: 9,
          fontWeight: 500,
          color: "var(--muted-foreground)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 2,
        }}
      >
        {label}
      </span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md px-2.5 py-1.5"
        style={{
          fontSize: 13,
          border: "0.5px solid var(--border)",
          backgroundColor: disabled ? "transparent" : "var(--card)",
          color: "var(--foreground)",
          width: 90,
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab — Besoins en staff                                              */
/* ------------------------------------------------------------------ */

function BesoinsTab({ studioName }: { studioName: Studio }) {
  const [needs, setNeeds] = useState<ShiftNeeds[]>(defaultNeeds);

  const updateNeed = (shiftIdx: number, role: Role, delta: number) => {
    setNeeds((prev) =>
      prev.map((s, i) => {
        if (i !== shiftIdx) return s;
        return { ...s, needs: { ...s.needs, [role]: Math.max(0, s.needs[role] + delta) } };
      }),
    );
  };

  const totalDaily = needs.reduce(
    (sum, s) => sum + Object.values(s.needs).reduce((a, b) => a + b, 0),
    0,
  );

  return (
    <>
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
                    <span
                      className="rounded-full"
                      style={{ width: 8, height: 8, backgroundColor: roleColors[role].dot }}
                    />
                    <span style={{ fontSize: 13 }}>{role}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateNeed(shiftIdx, role, -1)}
                      className="rounded-md flex items-center justify-center"
                      style={{ width: 24, height: 24, border: "0.5px solid var(--border)" }}
                    >
                      <Minus size={12} />
                    </button>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        minWidth: 20,
                        textAlign: "center",
                      }}
                    >
                      {shift.needs[role]}
                    </span>
                    <button
                      onClick={() => updateNeed(shiftIdx, role, 1)}
                      className="rounded-md flex items-center justify-center"
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
              style={{
                borderTop: "0.5px solid var(--border)",
                fontSize: 12,
                color: "var(--muted-foreground)",
              }}
            >
              Total :{" "}
              <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
                {Object.values(shift.needs).reduce((a, b) => a + b, 0)} personnes
              </span>
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-xl px-5 py-4 flex items-start gap-3"
        style={{ backgroundColor: "var(--info-bg)" }}
      >
        <Info size={16} style={{ color: "var(--info-text)", marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "var(--info-text)", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 500 }}>{studioName}</span> a besoin de{" "}
          <span style={{ fontWeight: 500 }}>{totalDaily} personnes par jour</span> réparties sur
          3 créneaux. Le planning sera généré automatiquement en fonction de ces besoins et des
          disponibilités du staff.
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tab — Exceptions                                                    */
/* ------------------------------------------------------------------ */

function ExceptionsTab({ studio }: { studio: Studio }) {
  const items = studioExceptions.filter((e) => e.studio === studio);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            Exceptions à venir
            <span
              style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: 8, fontWeight: 400 }}
            >
              {items.length} programmée{items.length > 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
            Fermetures, événements et ajustements ponctuels
          </div>
        </div>
        <button
          className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
          style={{
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: "var(--foreground)",
            color: "var(--card)",
          }}
        >
          <Plus size={12} />
          Ajouter une exception
        </button>
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Aucune exception programmée pour ce studio.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((ex) => (
            <ExceptionCard key={ex.id} ex={ex} />
          ))}
        </div>
      )}
    </>
  );
}

function ExceptionCard({ ex }: { ex: (typeof studioExceptions)[number] }) {
  const meta =
    ex.type === "fermeture"
      ? { Icon: CalendarOff, bg: "var(--danger-bg)", color: "var(--danger-text)", label: "Fermeture" }
      : ex.type === "événement"
        ? {
            Icon: PartyPopper,
            bg: "var(--coral-light)",
            color: "var(--coral-dark)",
            label: "Événement",
          }
        : {
            Icon: SlidersHorizontal,
            bg: "var(--warning-bg)",
            color: "var(--warning-text)",
            label: "Ajustement",
          };

  return (
    <div
      className="rounded-xl border p-4 flex items-start gap-4"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div
        className="rounded-lg flex items-center justify-center shrink-0"
        style={{ width: 36, height: 36, backgroundColor: meta.bg }}
      >
        <meta.Icon size={16} style={{ color: meta.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="rounded-full px-2 py-0.5"
            style={{ fontSize: 10, fontWeight: 500, backgroundColor: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{ex.dateLabel}</span>
          {ex.hoursAdjust && (
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              · {ex.hoursAdjust}
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{ex.title}</div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
          {ex.description}
        </div>
        {ex.impact.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Impact :</span>
            {ex.impact.map((i, k) => (
              <span
                key={k}
                className="rounded-full px-2 py-0.5 flex items-center gap-1"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  backgroundColor: roleColors[i.role].bg,
                  color: roleColors[i.role].text,
                }}
              >
                {i.role} {i.delta > 0 ? `+${i.delta}` : i.delta}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          className="rounded-md p-1.5"
          style={{ color: "var(--muted-foreground)", border: "0.5px solid var(--border)" }}
        >
          <Pencil size={12} />
        </button>
        <button
          className="rounded-md p-1.5"
          style={{ color: "var(--danger-text)", border: "0.5px solid var(--border)" }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab — Checklists                                                    */
/* ------------------------------------------------------------------ */

function ChecklistsTab({ studio }: { studio: Studio }) {
  const items = checklistTemplates.filter((c) => c.studio === studio);
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  const missingRoles = allRoles.filter((r) => !items.some((c) => c.role === r));

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Modèles de checklists</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
            Tâches à cocher en fin de shift, par rôle
          </div>
        </div>
        <button
          className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
          style={{
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: "var(--foreground)",
            color: "var(--card)",
          }}
        >
          <Plus size={12} />
          Nouveau modèle
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        {items.map((c) => {
          const open = openId === c.id;
          return (
            <div
              key={c.id}
              className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <button
                onClick={() => setOpenId(open ? null : c.id)}
                className="w-full px-5 py-3.5 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="rounded-full"
                    style={{ width: 10, height: 10, backgroundColor: roleColors[c.role].dot }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{c.role}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      {c.items.length} tâches · {c.completionRate}% de complétion moyenne
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CompletionPill rate={c.completionRate} />
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {open ? "Masquer" : "Voir"}
                  </span>
                </div>
              </button>

              {open && (
                <div
                  className="px-5 py-4"
                  style={{ borderTop: "0.5px solid var(--border)" }}
                >
                  <div className="flex flex-col gap-2 mb-4">
                    {c.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2"
                        style={{ backgroundColor: "var(--muted)" }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="rounded flex items-center justify-center"
                            style={{
                              width: 14,
                              height: 14,
                              border: "0.5px solid var(--border)",
                              backgroundColor: "var(--card)",
                            }}
                          />
                          <span style={{ fontSize: 13 }}>{it.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {it.photoRequired && <Tag icon={Camera} label="Photo" />}
                          {it.aiValidation && <Tag icon={Sparkles} label="IA" />}
                          <button
                            className="rounded-md p-1"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            <Pencil size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {c.frequentlySkipped.length > 0 && (
                    <div
                      className="rounded-lg px-3 py-2.5 flex items-start gap-2"
                      style={{ backgroundColor: "var(--warning-bg)" }}
                    >
                      <Info
                        size={13}
                        style={{
                          color: "var(--warning-text)",
                          marginTop: 1,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ fontSize: 11, color: "var(--warning-text)", lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 500 }}>Souvent oubliées :</span>{" "}
                        {c.frequentlySkipped.join(" · ")}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        border: "0.5px solid var(--border)",
                      }}
                    >
                      <Plus size={12} />
                      Ajouter une tâche
                    </button>
                    <button
                      className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        border: "0.5px solid var(--border)",
                      }}
                    >
                      <Pencil size={12} />
                      Modifier le modèle
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {missingRoles.length > 0 && (
        <div
          className="rounded-xl border-dashed p-4"
          style={{
            border: "1px dashed var(--border)",
            backgroundColor: "transparent",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>
            Pas encore de modèle pour :
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {missingRoles.map((r) => (
              <button
                key={r}
                className="rounded-full px-2.5 py-1 flex items-center gap-1.5"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  backgroundColor: roleColors[r].bg,
                  color: roleColors[r].text,
                }}
              >
                <Plus size={10} /> {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function Tag({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5"
      style={{
        fontSize: 10,
        fontWeight: 500,
        backgroundColor: "var(--card)",
        color: "var(--muted-foreground)",
        border: "0.5px solid var(--border)",
      }}
    >
      <Icon size={9} />
      {label}
    </span>
  );
}

function CompletionPill({ rate }: { rate: number }) {
  const color =
    rate >= 90 ? "var(--success-text)" : rate >= 75 ? "var(--warning-text)" : "var(--danger-text)";
  const bg =
    rate >= 90 ? "var(--success-bg)" : rate >= 75 ? "var(--warning-bg)" : "var(--danger-bg)";
  return (
    <span
      className="rounded-full px-2 py-0.5"
      style={{ fontSize: 10, fontWeight: 500, backgroundColor: bg, color }}
    >
      {rate}%
    </span>
  );
}
