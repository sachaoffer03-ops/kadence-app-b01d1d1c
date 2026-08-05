import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Repeat, Trash2, RefreshCw } from "lucide-react";
import {
  listRecurringAssignments,
  createRecurringAssignment,
  deleteRecurringAssignment,
  applyRecurringAssignment,
  type RecurringAssignment,
} from "@/lib/recurring-assignments.functions";
import { TimePicker24 } from "@/components/ui/time-picker-24";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleColors, type Role } from "@/lib/role-colors";

const CORAL = "#F0997B";
const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function fmt(t: string) {
  return t.slice(0, 5);
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });
}

export function RecurringAssignmentsCard({
  userId,
  firstName,
  studios,
  userStudioIds,
  businessRoles,
  canEdit,
}: {
  userId: string;
  firstName: string;
  studios: Record<string, string>;
  userStudioIds: string[];
  businessRoles: Role[];
  canEdit: boolean;
}) {
  const list = useServerFn(listRecurringAssignments);
  const create = useServerFn(createRecurringAssignment);
  const remove = useServerFn(deleteRecurringAssignment);
  const apply = useServerFn(applyRecurringAssignment);

  const [rows, setRows] = useState<RecurringAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const studioOptions = (userStudioIds.length > 0 ? userStudioIds : Object.keys(studios)).filter((s) => studios[s]);

  const [studioId, setStudioId] = useState("");
  const [role, setRole] = useState<string>("");
  const [weekday, setWeekday] = useState("1");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(addMonths(6));

  const reload = async () => {
    setLoading(true);
    try {
      setRows(await list({ data: { userId } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const valid = studioId && role && startTime && endTime && startTime < endTime && dateFrom <= dateTo;

  const onCreate = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const res = await create({
        data: {
          userId,
          studioId,
          businessRole: role,
          weekday: Number(weekday),
          startTime,
          endTime,
          dateFrom,
          dateTo,
        },
      });
      toast.success(
        `${res.created} shift${res.created > 1 ? "s" : ""} créé${res.created > 1 ? "s" : ""} · ${res.availabilities} dispo${res.availabilities > 1 ? "s" : ""} ajoutée${res.availabilities > 1 ? "s" : ""}${res.skipped ? ` · ${res.skipped} ignoré${res.skipped > 1 ? "s" : ""} (déjà occupé)` : ""}`,
      );
      setAdding(false);
      setStartTime("");
      setEndTime("");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4" style={{ color: CORAL }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Créneaux récurrents
          </span>
        </div>
        {canEdit && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5"
            style={{ backgroundColor: CORAL, color: "#fff", fontSize: 12, fontWeight: 500 }}
          >
            <Plus className="h-3.5 w-3.5" /> Whitelister
          </button>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 14 }}>
        {firstName} est assigné d'office sur ce créneau chaque semaine : les shifts sont créés et verrouillés,
        ses disponibilités sont remplies automatiquement, et la génération de planning ne peut pas les écraser.
      </p>

      {adding && (
        <div className="rounded-lg border p-4 mb-4 space-y-3" style={{ borderColor: "var(--border)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Studio</label>
              <Select value={studioId} onValueChange={setStudioId}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {studioOptions.map((s) => (
                    <SelectItem key={s} value={s}>{studios[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Poste</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {(businessRoles.length > 0 ? businessRoles : (["Barista", "Accueil", "Host", "Cuisine"] as Role[])).map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Jour</label>
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <SelectItem key={d} value={String(d)}>{DAYS[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Début</label>
                <div className="mt-1"><TimePicker24 value={startTime} onChange={setStartTime} step={15} /></div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Fin</label>
                <div className="mt-1"><TimePicker24 value={endTime} onChange={setEndTime} step={15} /></div>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>À partir du</label>
              <input
                type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full h-9 mt-1 rounded-md border px-2"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--background)", fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Jusqu'au</label>
              <input
                type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full h-9 mt-1 rounded-md border px-2"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--background)", fontSize: 13 }}
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                onClick={() => setDateTo(addMonths(m))}
                className="rounded-full border px-3 py-1"
                style={{ fontSize: 11, borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                {m} mois
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="rounded-lg border px-3 py-1.5" style={{ fontSize: 12, borderColor: "var(--border)" }}>
              Annuler
            </button>
            <button
              onClick={onCreate}
              disabled={!valid || saving}
              className="rounded-lg px-3 py-1.5"
              style={{ backgroundColor: valid && !saving ? CORAL : "var(--muted)", color: valid && !saving ? "#fff" : "var(--muted-foreground)", fontSize: 12, fontWeight: 500 }}
            >
              {saving ? "Création…" : "Créer les shifts"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun créneau récurrent.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const color = roleColors[r.business_role as Role]?.text ?? CORAL;
            return (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                <div className="min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    Tous les {DAYS[r.weekday]?.toLowerCase()} · {fmt(r.start_time)} — {fmt(r.end_time)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    <span style={{ color }}>{r.business_role}</span> · {r.studio_name?.replace("Skult ", "") ?? "—"} · du {fmtDate(r.date_from)} au {fmtDate(r.date_to)}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      title="Recréer les shifts manquants"
                      onClick={async () => {
                        try {
                          const res = await apply({ data: { id: r.id } });
                          toast.success(`${res.created} shift(s) ajouté(s), ${res.skipped} déjà en place`);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Erreur");
                        }
                      }}
                      className="rounded-lg border px-2 py-1.5"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
                    </button>
                    <button
                      title="Supprimer (retire aussi les shifts futurs non pointés)"
                      onClick={async () => {
                        if (!confirm("Supprimer ce créneau récurrent et les shifts futurs associés ?")) return;
                        try {
                          const res = await remove({ data: { id: r.id, removeFutureShifts: true } });
                          toast.success(`Créneau supprimé · ${res.removed} shift(s) retiré(s)`);
                          await reload();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Erreur");
                        }
                      }}
                      className="rounded-lg border px-2 py-1.5"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <Trash2 className="h-3.5 w-3.5" style={{ color: "#DC2626" }} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
