import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Dropdown } from "@/components/Dropdown";
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
  SlidersHorizontal,
  Pencil,
  Trash2,
  X,
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
  head: () => ({ meta: [{ title: "Studios & postes — Shyft" }] }),
});

const baseStudioTabs: Studio[] = ["Skult Rhodes", "Skult Châtelain"];
const subTabs = [
  "Informations",
  "Horaires d'ouverture",
  "Besoins en staff",
  "Exceptions",
  "Checklists",
] as const;

const allRoles: Role[] = ["Barista", "Accueil", "Host", "Cuisine"];

/* ------------------------------------------------------------------ */
/* Mock data                                                            */
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

const initialInfos: Record<Studio, StudioInfo> = {
  "Skult Rhodes": {
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
  "Skult Châtelain": {
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
};

interface DayHours {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

const initialWeek: Record<Studio, DayHours[]> = {
  "Skult Rhodes": [
    { day: "Lundi", open: "07h00", close: "18h00", closed: false },
    { day: "Mardi", open: "07h00", close: "18h00", closed: false },
    { day: "Mercredi", open: "07h00", close: "18h00", closed: false },
    { day: "Jeudi", open: "07h00", close: "18h00", closed: false },
    { day: "Vendredi", open: "07h00", close: "23h00", closed: false },
    { day: "Samedi", open: "08h00", close: "23h00", closed: false },
    { day: "Dimanche", open: "08h00", close: "17h00", closed: false },
  ],
  "Skult Châtelain": [
    { day: "Lundi", open: "08h00", close: "18h00", closed: true },
    { day: "Mardi", open: "08h00", close: "18h00", closed: false },
    { day: "Mercredi", open: "08h00", close: "22h00", closed: false },
    { day: "Jeudi", open: "08h00", close: "18h00", closed: false },
    { day: "Vendredi", open: "08h00", close: "23h00", closed: false },
    { day: "Samedi", open: "09h00", close: "23h00", closed: false },
    { day: "Dimanche", open: "09h00", close: "16h00", closed: false },
  ],
};

interface RoleSchedule {
  open: string;
  close: string;
}

const initialRoleHours: Record<Studio, Partial<Record<Role, RoleSchedule>>> = {
  "Skult Rhodes": {
    Barista: { open: "07h00", close: "18h00" },
    Accueil: { open: "08h00", close: "18h00" },
    Host: { open: "11h00", close: "23h00" },
    Cuisine: { open: "08h00", close: "16h00" },
  },
  "Skult Châtelain": {
    Barista: { open: "08h00", close: "23h00" },
    Accueil: { open: "08h00", close: "22h00" },
    Host: { open: "17h00", close: "23h00" },
    Cuisine: { open: "09h00", close: "16h00" },
  },
};

const initialActive: Record<Studio, Role[]> = {
  "Skult Rhodes": ["Barista", "Accueil", "Host", "Cuisine"],
  "Skult Châtelain": ["Barista", "Accueil", "Host", "Cuisine"],
};

interface ShiftNeeds {
  id: string;
  label: string;
  start: string;
  end: string;
  needs: Record<Role, number>;
}

const initialNeeds: Record<Studio, ShiftNeeds[]> = {
  "Skult Rhodes": [
    { id: "s1", label: "Matin", start: "07h00", end: "12h00", needs: { Barista: 2, Accueil: 1, Host: 0, Cuisine: 1 } },
    { id: "s2", label: "Midi", start: "12h00", end: "17h00", needs: { Barista: 2, Accueil: 1, Host: 1, Cuisine: 1 } },
    { id: "s3", label: "Soir", start: "17h00", end: "23h00", needs: { Barista: 2, Accueil: 1, Host: 1, Cuisine: 1 } },
  ],
  "Skult Châtelain": [
    { id: "s1", label: "Matin", start: "08h00", end: "13h00", needs: { Barista: 1, Accueil: 1, Host: 0, Cuisine: 1 } },
    { id: "s2", label: "Après-midi", start: "13h00", end: "18h00", needs: { Barista: 2, Accueil: 1, Host: 0, Cuisine: 1 } },
    { id: "s3", label: "Soir", start: "18h00", end: "23h00", needs: { Barista: 2, Accueil: 1, Host: 1, Cuisine: 1 } },
  ],
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function StudiosPage() {
  const [activeStudio, setActiveStudio] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(0);

  const [extraStudios, setExtraStudios] = useState<Studio[]>([]);
  const [deletedBase, setDeletedBase] = useState<Studio[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newStudioName, setNewStudioName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Studio | null>(null);

  const studioTabs = useMemo(
    () => [...baseStudioTabs.filter((s) => !deletedBase.includes(s)), ...extraStudios],
    [extraStudios, deletedBase]
  );

  const [infos, setInfos] = useState<Record<Studio, StudioInfo>>(initialInfos);
  const [activeRoles, setActiveRoles] = useState<Record<Studio, Role[]>>(initialActive);
  const [customRoles, setCustomRoles] = useState<Record<Studio, string[]>>({
    "Skult Rhodes": [],
    "Skult Châtelain": [],
  });
  const [week, setWeek] = useState<Record<Studio, DayHours[]>>(initialWeek);
  const [roleHours, setRoleHours] = useState<Record<Studio, Partial<Record<Role, RoleSchedule>>>>(initialRoleHours);
  const [needs, setNeeds] = useState<Record<Studio, ShiftNeeds[]>>(initialNeeds);

  const studio = studioTabs[activeStudio] as Studio;

  const createStudio = () => {
    const name = newStudioName.trim() as Studio;
    if (!name) return;
    if (studioTabs.includes(name)) {
      setNewStudioName("");
      return;
    }
    setExtraStudios((p) => [...p, name]);
    setInfos((p) => ({
      ...p,
      [name]: {
        name,
        address: "",
        postalCity: "",
        phone: "",
        email: "",
        manager: "",
        capacity: 0,
        surface: "",
        opened: new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        notes: "",
      },
    }));
    setActiveRoles((p) => ({ ...p, [name]: ["Barista", "Accueil"] }));
    setCustomRoles((p) => ({ ...p, [name]: [] }));
    setWeek((p) => ({
      ...p,
      [name]: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((d) => ({
        day: d,
        open: "08h00",
        close: "18h00",
        closed: false,
      })),
    }));
    setRoleHours((p) => ({
      ...p,
      [name]: {
        Barista: { open: "08h00", close: "18h00" },
        Accueil: { open: "08h00", close: "18h00" },
      },
    }));
    setNeeds((p) => ({
      ...p,
      [name]: [
        { id: "s1", label: "Matin", start: "08h00", end: "13h00", needs: { Barista: 1, Accueil: 1, Host: 0, Cuisine: 0 } },
        { id: "s2", label: "Après-midi", start: "13h00", end: "18h00", needs: { Barista: 1, Accueil: 1, Host: 0, Cuisine: 0 } },
      ],
    }));
    setActiveStudio(studioTabs.length);
    setNewStudioName("");
    setShowNewModal(false);
  };

  const deleteStudio = (name: Studio) => {
    const idx = studioTabs.indexOf(name);
    if (baseStudioTabs.includes(name)) {
      setDeletedBase((p) => (p.includes(name) ? p : [...p, name]));
    } else {
      setExtraStudios((p) => p.filter((s) => s !== name));
    }
    if (idx >= 0 && activeStudio >= idx) {
      setActiveStudio(Math.max(0, activeStudio - 1));
    }
    setConfirmDelete(null);
  };

  return (
    <div className="p-6">
      <div
        className="flex items-center gap-1 mb-5"
        style={{ borderBottom: "0.5px solid var(--border)" }}
      >
        {studioTabs.map((tab, i) => {
          const isActive = activeStudio === i;
          return (
            <button
              key={tab}
              onClick={() => setActiveStudio(i)}
              className="px-4 py-2 transition-colors"
              style={{
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                borderBottom: isActive ? "2px solid var(--foreground)" : "2px solid transparent",
                marginBottom: -0.5,
              }}
            >
              {tab}
            </button>
          );
        })}
        <button
          onClick={() => setShowNewModal(true)}
          className="px-4 py-2 transition-colors"
          style={{
            fontSize: 13,
            fontWeight: 400,
            color: "var(--coral)",
            marginBottom: -0.5,
          }}
        >
          + Nouveau studio
        </button>
      </div>

      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowNewModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-xl p-5 w-full max-w-sm"
            style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}
          >
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Nouveau studio</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 14 }}>
              Donne un nom à ton nouveau studio. Tu pourras compléter les informations ensuite.
            </div>
            <input
              autoFocus
              value={newStudioName}
              onChange={(e) => setNewStudioName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createStudio();
                if (e.key === "Escape") setShowNewModal(false);
              }}
              placeholder="Ex. Skult Sablon"
              className="w-full rounded-md px-2.5 py-2 mb-4"
              style={{
                fontSize: 13,
                border: "0.5px solid var(--border)",
                backgroundColor: "var(--background)",
              }}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="rounded-md px-3 py-1.5"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  border: "0.5px solid var(--border)",
                }}
              >
                Annuler
              </button>
              <button
                onClick={createStudio}
                disabled={!newStudioName.trim()}
                className="rounded-md px-3 py-1.5"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: "var(--foreground)",
                  color: "var(--card)",
                  opacity: newStudioName.trim() ? 1 : 0.4,
                }}
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

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

      {studioTabs.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Aucun studio</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Crée ton premier studio avec le bouton "+ Nouveau studio".
          </div>
        </div>
      ) : (
        <>
          {activeSubTab === 0 && (
            <InformationsTab
              info={infos[studio]}
              onChange={(patch) =>
                setInfos((p) => ({ ...p, [studio]: { ...p[studio], ...patch } }))
              }
              activeRoles={activeRoles[studio]}
              onToggleRole={(role) =>
                setActiveRoles((p) => ({
                  ...p,
                  [studio]: p[studio].includes(role)
                    ? p[studio].filter((r) => r !== role)
                    : [...p[studio], role],
                }))
              }
              customRoles={customRoles[studio]}
              onAddCustomRole={(name) =>
                setCustomRoles((p) => ({
                  ...p,
                  [studio]: p[studio].includes(name) ? p[studio] : [...p[studio], name],
                }))
              }
              onRemoveCustomRole={(name) =>
                setCustomRoles((p) => ({
                  ...p,
                  [studio]: p[studio].filter((r) => r !== name),
                }))
              }
              onRequestDelete={() => setConfirmDelete(studio)}
            />
          )}
          {activeSubTab === 1 && (
            <HorairesTab
              studio={studio}
              week={week[studio]}
              setWeek={(next) => setWeek((p) => ({ ...p, [studio]: next }))}
              activeRoles={activeRoles[studio]}
              roleHours={roleHours[studio]}
              setRoleHours={(role, sched) =>
                setRoleHours((p) => ({ ...p, [studio]: { ...p[studio], [role]: sched } }))
              }
            />
          )}
          {activeSubTab === 2 && (
            <BesoinsTab
              studio={studio}
              activeRoles={activeRoles[studio]}
              shifts={needs[studio]}
              setShifts={(next) => setNeeds((p) => ({ ...p, [studio]: next }))}
            />
          )}
          {activeSubTab === 3 && <ExceptionsTab studio={studio} />}
          {activeSubTab === 4 && <ChecklistsTab studio={studio} />}
        </>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-xl p-5 w-full max-w-sm"
            style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}
          >
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
              Supprimer ce studio ?
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{confirmDelete}</span> sera supprimé,
              avec ses horaires, ses besoins en staff et ses checklists. Cette action est définitive.
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-md px-3 py-1.5"
                style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}
              >
                Annuler
              </button>
              <button
                onClick={() => deleteStudio(confirmDelete)}
                className="rounded-md px-3 py-1.5"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: "var(--danger-text)",
                  color: "var(--card)",
                }}
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Informations                                                        */
/* ------------------------------------------------------------------ */

const editableFields: { key: keyof StudioInfo; label: string; icon: React.ElementType }[] = [
  { key: "address", label: "Adresse", icon: MapPin },
  { key: "postalCity", label: "Code postal & ville", icon: MapPin },
  { key: "manager", label: "Responsable", icon: User },
  { key: "phone", label: "Téléphone", icon: Phone },
  { key: "email", label: "Email", icon: Mail },
  { key: "capacity", label: "Capacité", icon: Users },
  { key: "surface", label: "Surface", icon: SlidersHorizontal },
];

function InformationsTab({
  info,
  onChange,
  activeRoles,
  onToggleRole,
  customRoles,
  onAddCustomRole,
  onRemoveCustomRole,
  onRequestDelete,
}: {
  info: StudioInfo;
  onChange: (patch: Partial<StudioInfo>) => void;
  activeRoles: Role[];
  onToggleRole: (r: Role) => void;
  customRoles: string[];
  onAddCustomRole: (name: string) => void;
  onRemoveCustomRole: (name: string) => void;
  onRequestDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [newRole, setNewRole] = useState("");

  const submitNewRole = () => {
    const v = newRole.trim();
    if (!v) return;
    onAddCustomRole(v);
    setNewRole("");
  };

  return (
    <div className="grid grid-cols-3 gap-4">
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
            onClick={() => setEditing((e) => !e)}
            className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
            style={{
              fontSize: 12,
              fontWeight: 500,
              border: "0.5px solid var(--border)",
              backgroundColor: editing ? "var(--foreground)" : "transparent",
              color: editing ? "var(--card)" : "var(--foreground)",
            }}
          >
            {editing ? <Check size={12} /> : <Pencil size={12} />}
            {editing ? "Terminer" : "Modifier"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {editableFields.map((f) => (
            <EditableRow
              key={f.key}
              icon={f.icon}
              label={f.label}
              value={String(info[f.key])}
              editing={editing}
              onChange={(v) =>
                onChange({
                  [f.key]: f.key === "capacity" ? Number(v) || 0 : v,
                } as Partial<StudioInfo>)
              }
            />
          ))}
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
          {editing ? (
            <textarea
              value={info.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              rows={3}
              className="w-full rounded-md px-2.5 py-2"
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                border: "0.5px solid var(--border)",
                backgroundColor: "var(--card)",
                resize: "vertical",
              }}
            />
          ) : (
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{info.notes}</div>
          )}
        </div>
      </div>

      {/* Postes actifs */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Postes actifs</div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 14 }}>
          Rôles disponibles dans ce studio
        </div>
        <div className="flex flex-col gap-2">
          {activeRoles.map((role) => (
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
              <button
                onClick={() => onToggleRole(role)}
                className="rounded-md p-1"
                style={{ color: "var(--muted-foreground)" }}
                title="Retirer ce poste"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {customRoles.map((role) => (
            <div
              key={role}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ backgroundColor: "var(--muted)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full"
                  style={{ width: 8, height: 8, backgroundColor: "var(--muted-foreground)" }}
                />
                <span style={{ fontSize: 13 }}>{role}</span>
                <span
                  className="rounded-full px-1.5 py-0.5"
                  style={{
                    fontSize: 9,
                    fontWeight: 500,
                    color: "var(--muted-foreground)",
                    border: "0.5px solid var(--border)",
                  }}
                >
                  Personnalisé
                </span>
              </div>
              <button
                onClick={() => onRemoveCustomRole(role)}
                className="rounded-md p-1"
                style={{ color: "var(--muted-foreground)" }}
                title="Supprimer ce poste"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {allRoles.filter((r) => !activeRoles.includes(r)).length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: "0.5px solid var(--border)" }}>
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
              Ajouter un poste
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allRoles
                .filter((r) => !activeRoles.includes(r))
                .map((r) => (
                  <button
                    key={r}
                    onClick={() => onToggleRole(r)}
                    className="rounded-full px-2.5 py-1 flex items-center gap-1.5"
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      border: "0.5px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <Plus size={10} />
                    <span
                      className="rounded-full"
                      style={{ width: 6, height: 6, backgroundColor: roleColors[r].dot }}
                    />
                    {r}
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="mt-3 pt-3" style={{ borderTop: "0.5px solid var(--border)" }}>
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
            Créer un nouveau poste
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewRole();
              }}
              placeholder="Ex. Pâtissier"
              className="flex-1 rounded-md px-2 py-1.5"
              style={{
                fontSize: 12,
                border: "0.5px solid var(--border)",
                backgroundColor: "var(--card)",
              }}
            />
            <button
              onClick={submitNewRole}
              disabled={!newRole.trim()}
              className="rounded-md px-2.5 py-1.5 flex items-center gap-1"
              style={{
                fontSize: 11,
                fontWeight: 500,
                backgroundColor: "var(--foreground)",
                color: "var(--card)",
                opacity: newRole.trim() ? 1 : 0.4,
              }}
            >
              <Plus size={11} />
              Créer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableRow({
  icon: Icon,
  label,
  value,
  editing,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
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
        {editing ? (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-md px-2 py-1"
            style={{
              fontSize: 13,
              border: "0.5px solid var(--border)",
              backgroundColor: "var(--card)",
            }}
          />
        ) : (
          <div style={{ fontSize: 13 }}>{value}</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Horaires d'ouverture + horaires par poste                           */
/* ------------------------------------------------------------------ */

function HorairesTab({
  studio,
  week,
  setWeek,
  activeRoles,
  roleHours,
  setRoleHours,
}: {
  studio: Studio;
  week: DayHours[];
  setWeek: (next: DayHours[]) => void;
  activeRoles: Role[];
  roleHours: Partial<Record<Role, RoleSchedule>>;
  setRoleHours: (role: Role, sched: RoleSchedule) => void;
}) {
  const update = (idx: number, patch: Partial<DayHours>) => {
    setWeek(week.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  };

  const totalHours = useMemo(() => {
    return week.reduce((sum, h) => {
      if (h.closed) return sum;
      const [oh, om] = h.open.replace("h", ":").split(":").map(Number);
      const [ch, cm] = h.close.replace("h", ":").split(":").map(Number);
      return sum + (ch + cm / 60 - (oh + om / 60));
    }, 0);
  }, [week]);

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
              Horaires d'ouverture par défaut du studio
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
          {week.map((h, idx) => (
            <div
              key={h.day}
              className="px-5 py-3 grid items-center gap-4"
              style={{
                gridTemplateColumns: "120px 1fr 1fr 90px",
                borderBottom: idx < week.length - 1 ? "0.5px solid var(--border)" : "none",
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
                className="rounded-full px-2.5 py-1"
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

      {/* Horaires par poste */}
      <div
        className="rounded-xl border overflow-hidden mb-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="px-5 py-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Horaires par poste</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Plage horaire générale pendant laquelle chaque poste est actif
          </div>
        </div>
        <div>
          {activeRoles.map((role, idx) => {
            const sched = roleHours[role] ?? { open: "09h00", close: "18h00" };
            return (
              <div
                key={role}
                className="px-5 py-3 grid items-center gap-4"
                style={{
                  gridTemplateColumns: "120px 1fr 1fr 1fr",
                  borderBottom:
                    idx < activeRoles.length - 1 ? "0.5px solid var(--border)" : "none",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full"
                    style={{ width: 8, height: 8, backgroundColor: roleColors[role].dot }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{role}</span>
                </div>
                <TimeInput
                  value={sched.open}
                  disabled={false}
                  onChange={(v) => setRoleHours(role, { ...sched, open: v })}
                  label="Début"
                />
                <TimeInput
                  value={sched.close}
                  disabled={false}
                  onChange={(v) => setRoleHours(role, { ...sched, close: v })}
                  label="Fin"
                />
                <div />
              </div>
            );
          })}
          {activeRoles.length === 0 && (
            <div
              className="px-5 py-6 text-center"
              style={{ fontSize: 12, color: "var(--muted-foreground)" }}
            >
              Aucun poste actif. Ajoutez-en dans l'onglet Informations.
            </div>
          )}
        </div>
      </div>

      <div
        className="rounded-xl px-5 py-4 flex items-start gap-3"
        style={{ backgroundColor: "var(--info-bg)" }}
      >
        <Info size={16} style={{ color: "var(--info-text)", marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "var(--info-text)", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 500 }}>{studio}</span> ouvre{" "}
          <span style={{ fontWeight: 500 }}>{totalHours.toFixed(0)} heures par semaine</span>. Les
          plages par poste définissent les bornes globales — les shifts précis se règlent dans
          Besoins en staff.
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
/* Besoins en staff — shifts modifiables                               */
/* ------------------------------------------------------------------ */

function BesoinsTab({
  studio,
  activeRoles,
  shifts,
  setShifts,
}: {
  studio: Studio;
  activeRoles: Role[];
  shifts: ShiftNeeds[];
  setShifts: (next: ShiftNeeds[]) => void;
}) {
  const updateShift = (id: string, patch: Partial<ShiftNeeds>) => {
    setShifts(shifts.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const updateNeed = (id: string, role: Role, delta: number) => {
    setShifts(
      shifts.map((s) =>
        s.id === id
          ? { ...s, needs: { ...s.needs, [role]: Math.max(0, (s.needs[role] ?? 0) + delta) } }
          : s,
      ),
    );
  };

  const addShift = () => {
    const id = `s${Date.now()}`;
    setShifts([
      ...shifts,
      {
        id,
        label: "Nouveau shift",
        start: "09h00",
        end: "17h00",
        needs: { Barista: 0, Accueil: 0, Host: 0, Cuisine: 0 },
      },
    ]);
  };

  const removeShift = (id: string) => setShifts(shifts.filter((s) => s.id !== id));

  const totalDaily = shifts.reduce(
    (sum, s) => sum + activeRoles.reduce((a, r) => a + (s.needs[r] ?? 0), 0),
    0,
  );

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          {shifts.length} créneau{shifts.length > 1 ? "x" : ""} · {totalDaily} personnes / jour
        </div>
        <button
          onClick={addShift}
          className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
          style={{
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: "var(--foreground)",
            color: "var(--card)",
          }}
        >
          <Plus size={12} />
          Ajouter un shift
        </button>
      </div>

      <div
        className="grid gap-4 mb-5"
        style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(shifts.length, 1), 3)}, minmax(0, 1fr))` }}
      >
        {shifts.map((shift) => (
          <div
            key={shift.id}
            className="rounded-xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <input
                value={shift.label}
                onChange={(e) => updateShift(shift.id, { label: e.target.value })}
                className="rounded-md px-2 py-1 -ml-2"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  border: "0.5px solid transparent",
                  backgroundColor: "transparent",
                  width: "100%",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
              />
              <button
                onClick={() => removeShift(shift.id)}
                className="rounded-md p-1 shrink-0"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <TimeInput
                label="Début"
                disabled={false}
                value={shift.start}
                onChange={(v) => updateShift(shift.id, { start: v })}
              />
              <TimeInput
                label="Fin"
                disabled={false}
                value={shift.end}
                onChange={(v) => updateShift(shift.id, { end: v })}
              />
            </div>

            <div className="flex flex-col gap-3">
              {activeRoles.map((role) => (
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
                      onClick={() => updateNeed(shift.id, role, -1)}
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
                      {shift.needs[role] ?? 0}
                    </span>
                    <button
                      onClick={() => updateNeed(shift.id, role, 1)}
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
                {activeRoles.reduce((a, r) => a + (shift.needs[r] ?? 0), 0)} personnes
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
          <span style={{ fontWeight: 500 }}>{studio}</span> a besoin de{" "}
          <span style={{ fontWeight: 500 }}>{totalDaily} personnes par jour</span> sur{" "}
          {shifts.length} créneau{shifts.length > 1 ? "x" : ""}.
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Exceptions — version sobre + édition complète                       */
/* ------------------------------------------------------------------ */

type ExceptionType = "fermeture" | "événement" | "ajustement";

interface ExceptionItem {
  id: string;
  dateLabel: string;
  type: ExceptionType;
  title: string;
  description: string;
  hoursAdjust?: string;
  impact: { role: Role; delta: number }[];
}

const exceptionTypes: ExceptionType[] = ["fermeture", "événement", "ajustement"];

function ExceptionsTab({ studio }: { studio: Studio }) {
  const [items, setItems] = useState<ExceptionItem[]>(() =>
    studioExceptions
      .filter((e) => e.studio === studio)
      .map((e) => ({
        id: e.id,
        dateLabel: e.dateLabel,
        type: e.type,
        title: e.title,
        description: e.description,
        hoursAdjust: e.hoursAdjust,
        impact: e.impact,
      })),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExceptionItem | null>(null);

  const startCreate = () => {
    setEditingId("__new__");
    setDraft({
      id: `ex-${Date.now()}`,
      dateLabel: "",
      type: "fermeture",
      title: "",
      description: "",
      hoursAdjust: "",
      impact: [],
    });
  };
  const startEdit = (it: ExceptionItem) => {
    setEditingId(it.id);
    setDraft({ ...it, impact: [...it.impact] });
  };
  const cancel = () => {
    setEditingId(null);
    setDraft(null);
  };
  const save = () => {
    if (!draft || !draft.title.trim() || !draft.dateLabel.trim()) return;
    setItems((prev) =>
      editingId === "__new__"
        ? [...prev, draft]
        : prev.map((i) => (i.id === editingId ? draft : i)),
    );
    cancel();
  };
  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editingId === id) cancel();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            Exceptions à venir
            <span
              style={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                marginLeft: 8,
                fontWeight: 400,
              }}
            >
              {items.length} programmée{items.length > 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
            Fermetures, événements et ajustements ponctuels
          </div>
        </div>
        <button
          onClick={startCreate}
          className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
          style={{
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: "var(--foreground)",
            color: "var(--card)",
          }}
        >
          <Plus size={12} />
          Ajouter
        </button>
      </div>

      {editingId === "__new__" && draft && (
        <ExceptionForm
          draft={draft}
          setDraft={setDraft}
          onCancel={cancel}
          onSave={save}
          title="Nouvelle exception"
        />
      )}

      {items.length === 0 && editingId !== "__new__" ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Aucune exception programmée.
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          {items.map((ex, idx) => {
            const isEditing = editingId === ex.id;
            const typeLabel =
              ex.type === "fermeture"
                ? "Fermeture"
                : ex.type === "événement"
                  ? "Événement"
                  : "Ajustement";
            if (isEditing && draft) {
              return (
                <div
                  key={ex.id}
                  className="p-4"
                  style={{
                    borderBottom: idx < items.length - 1 ? "0.5px solid var(--border)" : "none",
                  }}
                >
                  <ExceptionForm
                    draft={draft}
                    setDraft={setDraft}
                    onCancel={cancel}
                    onSave={save}
                    title="Modifier l'exception"
                    embedded
                  />
                </div>
              );
            }
            return (
              <div
                key={ex.id}
                className="px-5 py-4 flex items-start gap-4"
                style={{
                  borderBottom: idx < items.length - 1 ? "0.5px solid var(--border)" : "none",
                }}
              >
                <div className="shrink-0" style={{ width: 110 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{ex.dateLabel}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                    {typeLabel}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{ex.title}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      lineHeight: 1.5,
                    }}
                  >
                    {ex.description}
                  </div>
                  {(ex.impact.length > 0 || ex.hoursAdjust) && (
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {ex.hoursAdjust && (
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                          {ex.hoursAdjust}
                        </span>
                      )}
                      {ex.impact.map((i, k) => (
                        <span
                          key={k}
                          style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                        >
                          {i.role} {i.delta > 0 ? `+${i.delta}` : i.delta}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(ex)}
                    className="rounded-md p-1.5"
                    style={{ color: "var(--muted-foreground)" }}
                    title="Modifier"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => remove(ex.id)}
                    className="rounded-md p-1.5"
                    style={{ color: "var(--muted-foreground)" }}
                    title="Supprimer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function ExceptionForm({
  draft,
  setDraft,
  onCancel,
  onSave,
  title,
  embedded = false,
}: {
  draft: ExceptionItem;
  setDraft: (d: ExceptionItem) => void;
  onCancel: () => void;
  onSave: () => void;
  title: string;
  embedded?: boolean;
}) {
  const setImpact = (role: Role, delta: number) => {
    const others = draft.impact.filter((i) => i.role !== role);
    setDraft({
      ...draft,
      impact: delta === 0 ? others : [...others, { role, delta }],
    });
  };
  const getImpact = (role: Role) => draft.impact.find((i) => i.role === role)?.delta ?? 0;

  return (
    <div
      className={embedded ? "rounded-lg p-4" : "rounded-xl border p-4 mb-4"}
      style={{
        backgroundColor: embedded ? "var(--muted)" : "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <button
          onClick={onCancel}
          className="rounded-md p-1"
          style={{ color: "var(--muted-foreground)" }}
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <FormField label="Date">
          <input
            value={draft.dateLabel}
            onChange={(e) => setDraft({ ...draft, dateLabel: e.target.value })}
            placeholder="Sam. 14 juin"
            className="w-full rounded-md px-2 py-1.5"
            style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}
          />
        </FormField>
        <FormField label="Type">
          <Dropdown
            value={draft.type.charAt(0).toUpperCase() + draft.type.slice(1)}
            options={exceptionTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1))}
            onChange={(v) => setDraft({ ...draft, type: v.toLowerCase() as ExceptionType })}
            minWidth={180}
          />
        </FormField>
        <FormField label="Horaires (optionnel)">
          <input
            value={draft.hoursAdjust ?? ""}
            onChange={(e) => setDraft({ ...draft, hoursAdjust: e.target.value })}
            placeholder="18h–02h"
            className="w-full rounded-md px-2 py-1.5"
            style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}
          />
        </FormField>
      </div>

      <FormField label="Titre">
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Jazz live, Fermeture exceptionnelle…"
          className="w-full rounded-md px-2 py-1.5"
          style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}
        />
      </FormField>

      <div className="mt-3">
        <FormField label="Description">
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2}
            className="w-full rounded-md px-2 py-1.5"
            style={{
              fontSize: 13,
              border: "0.5px solid var(--border)",
              backgroundColor: "var(--card)",
              resize: "vertical",
            }}
          />
        </FormField>
      </div>

      <div className="mt-3">
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
          Impact staff (par rôle)
        </div>
        <div className="grid grid-cols-4 gap-2">
          {allRoles.map((r) => (
            <div
              key={r}
              className="flex items-center justify-between rounded-md px-2 py-1.5"
              style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="rounded-full"
                  style={{ width: 6, height: 6, backgroundColor: roleColors[r].dot }}
                />
                <span style={{ fontSize: 11 }}>{r}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setImpact(r, getImpact(r) - 1)}
                  className="rounded p-0.5"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Minus size={10} />
                </button>
                <span style={{ fontSize: 11, minWidth: 18, textAlign: "center", fontWeight: 500 }}>
                  {getImpact(r) > 0 ? `+${getImpact(r)}` : getImpact(r)}
                </span>
                <button
                  onClick={() => setImpact(r, getImpact(r) + 1)}
                  className="rounded p-0.5"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1.5"
          style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}
        >
          Annuler
        </button>
        <button
          onClick={onSave}
          disabled={!draft.title.trim() || !draft.dateLabel.trim()}
          className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
          style={{
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: "var(--foreground)",
            color: "var(--card)",
            opacity: draft.title.trim() && draft.dateLabel.trim() ? 1 : 0.4,
          }}
        >
          <Check size={12} />
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: "var(--muted-foreground)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Checklists — édition complète                                        */
/* ------------------------------------------------------------------ */

interface ChecklistItem {
  id: string;
  label: string;
  photoRequired: boolean;
  aiValidation: boolean;
}

interface ChecklistModel {
  id: string;
  role: Role;
  items: ChecklistItem[];
  completionRate: number;
}

function ChecklistsTab({ studio }: { studio: Studio }) {
  const [models, setModels] = useState<ChecklistModel[]>(() =>
    checklistTemplates
      .filter((c) => c.studio === studio)
      .map((c) => ({
        id: c.id,
        role: c.role,
        completionRate: c.completionRate,
        items: c.items.map((it) => ({
          id: it.id,
          label: it.label,
          photoRequired: it.photoRequired,
          aiValidation: it.aiValidation,
        })),
      })),
  );
  const [openId, setOpenId] = useState<string | null>(models[0]?.id ?? null);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [newTaskByModel, setNewTaskByModel] = useState<Record<string, string>>({});
  const [creatingNew, setCreatingNew] = useState(false);

  const missingRoles = allRoles.filter((r) => !models.some((c) => c.role === r));

  const updateModel = (id: string, patch: Partial<ChecklistModel>) =>
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const addTask = (modelId: string) => {
    const label = (newTaskByModel[modelId] ?? "").trim();
    if (!label) return;
    setModels((prev) =>
      prev.map((m) =>
        m.id === modelId
          ? {
              ...m,
              items: [
                ...m.items,
                { id: `t-${Date.now()}`, label, photoRequired: false, aiValidation: false },
              ],
            }
          : m,
      ),
    );
    setNewTaskByModel((p) => ({ ...p, [modelId]: "" }));
  };

  const updateItem = (modelId: string, itemId: string, patch: Partial<ChecklistItem>) =>
    setModels((prev) =>
      prev.map((m) =>
        m.id === modelId
          ? { ...m, items: m.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
          : m,
      ),
    );

  const removeItem = (modelId: string, itemId: string) =>
    setModels((prev) =>
      prev.map((m) =>
        m.id === modelId ? { ...m, items: m.items.filter((it) => it.id !== itemId) } : m,
      ),
    );

  const removeModel = (id: string) => {
    setModels((prev) => prev.filter((m) => m.id !== id));
    if (openId === id) setOpenId(null);
    if (editingModelId === id) setEditingModelId(null);
  };

  const createModel = (role: Role) => {
    const id = `c-${Date.now()}`;
    setModels((prev) => [...prev, { id, role, items: [], completionRate: 0 }]);
    setOpenId(id);
    setCreatingNew(false);
  };

  const availableRolesForNew = allRoles.filter((r) => !models.some((m) => m.role === r));

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
          onClick={() => setCreatingNew(true)}
          disabled={availableRolesForNew.length === 0}
          className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
          style={{
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: "var(--foreground)",
            color: "var(--card)",
            opacity: availableRolesForNew.length === 0 ? 0.4 : 1,
          }}
        >
          <Plus size={12} />
          Nouveau modèle
        </button>
      </div>

      {creatingNew && (
        <div
          className="rounded-xl border p-4 mb-3"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div style={{ fontSize: 13, fontWeight: 500 }}>Choisir un rôle</div>
            <button
              onClick={() => setCreatingNew(false)}
              className="rounded-md p-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableRolesForNew.map((r) => (
              <button
                key={r}
                onClick={() => createModel(r)}
                className="rounded-full px-3 py-1.5 flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}
              >
                <span
                  className="rounded-full"
                  style={{ width: 8, height: 8, backgroundColor: roleColors[r].dot }}
                />
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-4">
        {models.map((c) => {
          const open = openId === c.id;
          const editing = editingModelId === c.id;
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
                      {c.items.length} tâche{c.items.length > 1 ? "s" : ""} ·{" "}
                      {c.completionRate}% de complétion moyenne
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  {open ? "Masquer" : "Voir"}
                </span>
              </button>

              {open && (
                <div className="px-5 py-4" style={{ borderTop: "0.5px solid var(--border)" }}>
                  {c.items.length === 0 ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted-foreground)",
                        marginBottom: 12,
                        fontStyle: "italic",
                      }}
                    >
                      Aucune tâche pour ce modèle.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 mb-3">
                      {c.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between rounded-lg px-3 py-2"
                          style={{ backgroundColor: "var(--muted)" }}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div
                              className="rounded"
                              style={{
                                width: 14,
                                height: 14,
                                border: "0.5px solid var(--border)",
                                backgroundColor: "var(--card)",
                                flexShrink: 0,
                              }}
                            />
                            {editing ? (
                              <input
                                value={it.label}
                                onChange={(e) =>
                                  updateItem(c.id, it.id, { label: e.target.value })
                                }
                                className="flex-1 rounded-md px-2 py-1"
                                style={{
                                  fontSize: 13,
                                  border: "0.5px solid var(--border)",
                                  backgroundColor: "var(--card)",
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: 13 }}>{it.label}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 ml-2">
                            <ToggleTag
                              icon={Camera}
                              label="Photo"
                              active={it.photoRequired}
                              onClick={() =>
                                updateItem(c.id, it.id, { photoRequired: !it.photoRequired })
                              }
                            />
                            <ToggleTag
                              icon={Sparkles}
                              label="IA"
                              active={it.aiValidation}
                              onClick={() =>
                                updateItem(c.id, it.id, { aiValidation: !it.aiValidation })
                              }
                            />
                            {editing && (
                              <button
                                onClick={() => removeItem(c.id, it.id)}
                                className="rounded-md p-1"
                                style={{ color: "var(--muted-foreground)" }}
                                title="Supprimer"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <input
                      value={newTaskByModel[c.id] ?? ""}
                      onChange={(e) =>
                        setNewTaskByModel((p) => ({ ...p, [c.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addTask(c.id);
                      }}
                      placeholder="Nouvelle tâche…"
                      className="flex-1 rounded-md px-2.5 py-1.5"
                      style={{
                        fontSize: 13,
                        border: "0.5px solid var(--border)",
                        backgroundColor: "var(--card)",
                      }}
                    />
                    <button
                      onClick={() => addTask(c.id)}
                      disabled={!(newTaskByModel[c.id] ?? "").trim()}
                      className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        backgroundColor: "var(--foreground)",
                        color: "var(--card)",
                        opacity: (newTaskByModel[c.id] ?? "").trim() ? 1 : 0.4,
                      }}
                    >
                      <Plus size={12} />
                      Ajouter
                    </button>
                  </div>

                  <div
                    className="flex items-center justify-between pt-3"
                    style={{ borderTop: "0.5px solid var(--border)" }}
                  >
                    <button
                      onClick={() => setEditingModelId(editing ? null : c.id)}
                      className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        border: "0.5px solid var(--border)",
                      }}
                    >
                      {editing ? <Check size={12} /> : <Pencil size={12} />}
                      {editing ? "Terminer" : "Modifier le modèle"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer le modèle ${c.role} ?`)) removeModel(c.id);
                      }}
                      className="rounded-md flex items-center gap-1.5 px-3 py-1.5"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--danger-text)",
                        border: "0.5px solid var(--border)",
                      }}
                    >
                      <Trash2 size={12} />
                      Supprimer le modèle
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
          className="rounded-xl p-4"
          style={{ border: "1px dashed var(--border)", backgroundColor: "transparent" }}
        >
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>
            Pas encore de modèle pour :
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {missingRoles.map((r) => (
              <button
                key={r}
                onClick={() => createModel(r)}
                className="rounded-full px-2.5 py-1 flex items-center gap-1.5"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  border: "0.5px solid var(--border)",
                }}
              >
                <Plus size={10} />
                <span
                  className="rounded-full"
                  style={{ width: 6, height: 6, backgroundColor: roleColors[r].dot }}
                />
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ToggleTag({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5"
      style={{
        fontSize: 10,
        fontWeight: 500,
        backgroundColor: active ? "var(--coral-light)" : "var(--card)",
        color: active ? "var(--coral-dark)" : "var(--muted-foreground)",
        border: "0.5px solid var(--border)",
      }}
    >
      <Icon size={9} />
      {label}
    </button>
  );
}

