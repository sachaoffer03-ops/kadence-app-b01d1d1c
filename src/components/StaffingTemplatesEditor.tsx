import { Fragment, useEffect, useState } from "react";
import { Plus, Trash2, Info, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dropdown } from "@/components/Dropdown";
import { useStudioBusinessRoles } from "@/hooks/use-studio-business-roles";
import { RoleSegmentsEditor } from "@/components/admin/RoleSegmentsEditor";
import {
  validateRoleSegments,
  type RoleSegment,
} from "@/lib/role-segments";


const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const ALL_CONTRACTS = ["CDI", "Étudiant", "Flexi"] as const;

interface Studio { id: string; name: string }
interface Template {
  id: string;
  studio_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  business_role: string;
  required_count: number;
  is_optional: boolean;
  required_contract: "Étudiant" | "Flexi" | "CDI" | null;
  allowed_contracts: string[] | null;
  allowed_roles: string[] | null;
  role_segments: RoleSegment[] | null;
}

const CONTRACTS = ["Tous", "CDI", "Étudiant", "Flexi"] as const;
const QUARTER_TIME_REGEX = /^([01]\d|2[0-3]):(00|15|30|45)$/;
const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (time: string) => {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const roundToQuarter = (time: string): string | null => {
  const v = time.slice(0, 5);
  if (!HHMM_REGEX.test(v)) return null;
  const [h, m] = v.split(":").map(Number);
  let total = h * 60 + Math.round(m / 15) * 15;
  if (total >= 24 * 60) total = 24 * 60 - 15;
  if (total < 0) total = 0;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

// Input dédié pour heures : buffer local, commit sur blur (avec arrondi 15 min)
function TimeInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value.slice(0, 5));
  useEffect(() => { setLocal(value.slice(0, 5)); }, [value]);
  return (
    <input
      type="time"
      step={900}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const rounded = roundToQuarter(local);
        if (!rounded) {
          setLocal(value.slice(0, 5));
          toast.error("Heure invalide", { description: "Format attendu HH:MM" });
          return;
        }
        if (rounded !== value.slice(0, 5)) {
          setLocal(rounded);
          onCommit(rounded);
        }
      }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="rounded-md px-2 py-1.5 outline-none"
      style={{ fontSize: 12, border: "0.5px solid var(--border)", backgroundColor: "var(--background)", width: 110 }}
    />
  );
}

interface Props {
  lockedStudioName?: string;
  hideHint?: boolean;
}

export function StaffingTemplatesEditor({ lockedStudioName, hideHint }: Props) {
  const [studioId, setStudioId] = useState<string>("");
  const { names: STUDIO_ROLES } = useStudioBusinessRoles(studioId || null);
  const ROLES = STUDIO_ROLES;

  const [studios, setStudios] = useState<Studio[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  // studioId déclaré plus haut (avant le hook useStudioBusinessRoles)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const reload = async () => {
    const runQueries = async () => {
      const [s, t] = await Promise.all([
        supabase.from("studios").select("id, name").order("name"),
        supabase.from("staffing_templates").select("*").order("day_of_week").order("start_time"),
      ]);
      return { s, t };
    };

    try {
      let { s, t } = await runQueries();

      // Retry once on transient error (race auth au mount)
      if (s.error || t.error) {
        console.warn("[StaffingTemplatesEditor] 1re tentative en erreur, retry…", {
          studiosError: s.error,
          templatesError: t.error,
        });
        await new Promise((r) => setTimeout(r, 400));
        ({ s, t } = await runQueries());
      }

      if (s.error) {
        console.error("[StaffingTemplatesEditor] studios query error", s.error);
        throw new Error(`studios: ${s.error.message}`);
      }
      if (t.error) {
        console.error("[StaffingTemplatesEditor] staffing_templates query error", t.error);
        throw new Error(`staffing_templates: ${t.error.message}`);
      }

      if (s.data) {
        setStudios(s.data);
        if (s.data.length) {
          if (lockedStudioName) {
            const m = s.data.find((x) => x.name === lockedStudioName);
            if (m) setStudioId(m.id);
          } else if (!studioId) {
            setStudioId(s.data[0].id);
          }
        }
      }
      if (t.data) setTemplates(t.data as Template[]);
    } catch (e: any) {
      console.error("[StaffingTemplatesEditor] reload failed", e);
      toast.error("Erreur de chargement des besoins", { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [lockedStudioName]);

  const addRow = async () => {
    if (!studioId) return toast.error("Aucun studio");
    if (ROLES.length === 0) return toast.error("Configure d'abord un rôle métier pour ce studio");
    const { error } = await supabase.from("staffing_templates").insert({
      studio_id: studioId,
      day_of_week: 0,
      start_time: "10:00",
      end_time: "15:00",
      business_role: ROLES[0],
      required_count: 1,
      is_optional: false,
      required_contract: null,
      allowed_contracts: [],
      allowed_roles: [],
    });
    if (error) return toast.error("Ajout impossible", { description: error.message });
    reload();
  };

  const updateRow = async (id: string, patch: Partial<Template>) => {
    const prev = templates;
    const current = prev.find((t) => t.id === id);
    if (patch.start_time !== undefined) {
      patch.start_time = patch.start_time.slice(0, 5);
      if (!QUARTER_TIME_REGEX.test(patch.start_time)) return;
    }
    if (patch.end_time !== undefined) {
      patch.end_time = patch.end_time.slice(0, 5);
      if (!QUARTER_TIME_REGEX.test(patch.end_time)) return;
    }

    if (current && (patch.start_time !== undefined || patch.end_time !== undefined)) {
      const newStart = (patch.start_time ?? current.start_time).slice(0, 5);
      const newEnd = (patch.end_time ?? current.end_time).slice(0, 5);
      if (toMinutes(newStart) >= toMinutes(newEnd)) {
        toast.error("Horaire invalide", { description: "L'heure de fin doit être après l'heure de début." });
        return;
      }
    }

    // If start/end time changes and segments exist, adjust segments to keep DB constraint valid
    if (current?.role_segments && (patch.start_time !== undefined || patch.end_time !== undefined)) {
      const newStart = (patch.start_time ?? current.start_time).slice(0, 5);
      const newEnd = (patch.end_time ?? current.end_time).slice(0, 5);
      const segs = current.role_segments.map((s) => ({ ...s, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5) }));
      segs[0] = { ...segs[0], start_time: newStart };
      segs[segs.length - 1] = { ...segs[segs.length - 1], end_time: newEnd };
      const stillValid = validateRoleSegments(segs, newStart, newEnd, ROLES).ok;
      (patch as any).role_segments = stillValid ? segs : null;
      if (!stillValid) {
        toast.message("Multi-rôles désactivé (les segments ne tenaient plus dans le nouvel horaire)");
      }
    }
    setTemplates((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from("staffing_templates").update(patch as any).eq("id", id);
    if (error) {
      toast.error("Modification non enregistrée", { description: error.message });
      setTemplates(prev); // rollback optimistic update
    }
  };

  const deleteRow = async (id: string) => {
    const prev = templates;
    setTemplates((p) => p.filter((t) => t.id !== id));
    const { error } = await supabase.from("staffing_templates").delete().eq("id", id);
    if (error) {
      toast.error("Suppression impossible", { description: error.message });
      setTemplates(prev);
      return;
    }
    toast.success("Besoin supprimé");
  };


  const toggleExpanded = (id: string) => {
    setExpanded((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleInArray = async (t: Template, field: "allowed_roles" | "allowed_contracts", value: string) => {
    const cur = (t[field] ?? []) as string[];
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    await updateRow(t.id, { [field]: next } as Partial<Template>);
  };

  if (loading) return <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>;
  if (studios.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Créez d'abord des studios pour configurer les besoins.</div>
      </div>
    );
  }

  const filtered = templates.filter((t) => t.studio_id === studioId);
  const totalShifts = filtered.reduce((sum, t) => sum + t.required_count, 0);

  return (
    <div className="flex flex-col gap-4">
      {!hideHint && (
        <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: "var(--info-bg)" }}>
          <Info size={14} style={{ color: "var(--info-text)", marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: "var(--info-text)", lineHeight: 1.5 }}>
            Tes modifications sont enregistrées immédiatement. Pour les appliquer au planning existant, va sur <a href="/planning" style={{ textDecoration: "underline", fontWeight: 500 }}>Planning</a> et lance une nouvelle génération.
          </div>
        </div>
      )}
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Besoins hebdomadaires</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>L'IA crée chaque semaine ces shifts pour le studio sélectionné.</div>
          </div>
          {!lockedStudioName && (
            <Dropdown
              value={studios.find((s) => s.id === studioId)?.name ?? ""}
              options={studios.map((s) => s.name)}
              onChange={(v) => setStudioId(studios.find((s) => s.name === v)?.id ?? "")}
              minWidth={180}
            />
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>
          {filtered.length} créneau{filtered.length > 1 ? "x" : ""} · {totalShifts} shift{totalShifts > 1 ? "s" : ""}/semaine
        </div>

        {ROLES.length === 0 && studioId && (
          <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: "var(--warn-bg, var(--muted))", border: "0.5px solid var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>⚠️ Aucun rôle configuré pour ce studio.</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              Va dans l'onglet « Information » pour activer les rôles métier de ce studio avant de configurer les besoins de staff.
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "var(--muted)" }}>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun besoin défini. Ajoutez le premier ci-dessous.</div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full" style={{ fontSize: 12, borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead>
                <tr style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>
                  <th></th>
                  <th className="text-left px-2 py-1" style={{ fontSize: 10 }}>Jour</th>
                  <th className="text-left px-2 py-1" style={{ fontSize: 10 }}>Début</th>
                  <th className="text-left px-2 py-1" style={{ fontSize: 10 }}>Fin</th>
                  <th className="text-left px-2 py-1" style={{ fontSize: 10 }}>Rôle</th>
                  <th className="text-left px-2 py-1" style={{ fontSize: 10 }}>Contrat</th>
                  <th className="text-left px-2 py-1" style={{ fontSize: 10 }}>Type</th>
                  <th className="text-left px-2 py-1" style={{ fontSize: 10 }}>Nombre</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const isOpen = expanded.has(t.id);
                  const allowedRoles = t.allowed_roles ?? [];
                  const allowedContracts = t.allowed_contracts ?? [];
                  const hasAdvanced = allowedRoles.length > 0 || allowedContracts.length > 0;
                  return (
                    <Fragment key={t.id}>
                      <tr>
                        <td className="px-1">
                          <button onClick={() => toggleExpanded(t.id)}
                            className="rounded-md p-1 transition-colors"
                            title="Polyvalence (rôles & contrats)"
                            style={{ color: hasAdvanced ? "var(--coral-dark)" : "var(--muted-foreground)" }}>
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>

                        <td className="px-2 py-1">
                          <Dropdown value={DAYS[t.day_of_week]} options={DAYS} onChange={(v) => updateRow(t.id, { day_of_week: DAYS.indexOf(v) })} minWidth={120} />
                        </td>
                        <td className="px-2 py-1">
                          <input type="time" step={900} value={t.start_time.slice(0, 5)} onChange={(e) => updateRow(t.id, { start_time: e.target.value })}
                            className="rounded-md px-2 py-1.5 outline-none"
                            style={{ fontSize: 12, border: "0.5px solid var(--border)", backgroundColor: "var(--background)", width: 110 }} />
                        </td>
                        <td className="px-2 py-1">
                          <input type="time" step={900} value={t.end_time.slice(0, 5)} onChange={(e) => updateRow(t.id, { end_time: e.target.value })}
                            className="rounded-md px-2 py-1.5 outline-none"
                            style={{ fontSize: 12, border: "0.5px solid var(--border)", backgroundColor: "var(--background)", width: 110 }} />
                        </td>
                        <td className="px-2 py-1">
                          {t.role_segments ? (
                            <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5"
                              style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--coral)", backgroundColor: "var(--coral-light, var(--background))", color: "var(--coral-dark, var(--foreground))" }}>
                              <Layers size={11} />
                              Multi · {t.role_segments.length} segments
                            </div>
                          ) : (
                            <Dropdown value={t.business_role} options={[...ROLES]} onChange={(v) => updateRow(t.id, { business_role: v })} minWidth={120} />
                          )}
                        </td>

                        <td className="px-2 py-1">
                          <Dropdown
                            value={t.required_contract ?? "Tous"}
                            options={[...CONTRACTS]}
                            onChange={(v) => updateRow(t.id, { required_contract: v === "Tous" ? null : (v as "CDI" | "Étudiant" | "Flexi") })}
                            minWidth={110}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Dropdown
                            value={t.is_optional ? "Renfort" : "Obligatoire"}
                            options={["Obligatoire", "Renfort"]}
                            onChange={(v) => updateRow(t.id, { is_optional: v === "Renfort" })}
                            minWidth={120}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" min={0} max={20} value={t.required_count} onChange={(e) => updateRow(t.id, { required_count: Math.max(0, Number(e.target.value)) })}
                            className="rounded-md px-2 py-1.5 outline-none"
                            style={{ fontSize: 12, border: "0.5px solid var(--border)", backgroundColor: "var(--background)", width: 70 }} />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <button onClick={() => deleteRow(t.id)} className="rounded-md p-1.5 transition-colors"
                            style={{ color: "var(--danger-text)" }}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td></td>
                          <td colSpan={8} className="px-2 py-2">
                            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--muted)" }}>
                              {/* Section Multi-rôles */}
                              <div className="rounded-md p-2.5 mb-3" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Layers size={13} style={{ color: "var(--coral)" }} />
                                    <div style={{ fontSize: 12, fontWeight: 500 }}>Besoin multi-rôles</div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (t.role_segments) {
                                        if (!confirm("Repasser ce besoin en mono-rôle ? Les segments seront perdus.")) return;
                                        updateRow(t.id, { role_segments: null } as any);
                                      } else {
                                        const start = t.start_time.slice(0, 5);
                                        const end = t.end_time.slice(0, 5);
                                        const [sh, sm] = start.split(":").map(Number);
                                        const [eh, em] = end.split(":").map(Number);
                                        const totalMin = (eh * 60 + em) - (sh * 60 + sm);
                                        if (totalMin < 30) return toast.error("Créneau trop court pour 2 segments");
                                        const midMin = Math.round(((sh * 60 + sm) + totalMin / 2) / 15) * 15;
                                        const midH = Math.floor(midMin / 60);
                                        const midM = midMin % 60;
                                        const mid = `${String(midH).padStart(2, "0")}:${String(midM).padStart(2, "0")}`;
                                        const r1 = t.business_role || ROLES[0];
                                        const r2 = ROLES.find((r) => r !== r1) ?? r1;
                                        const segs: RoleSegment[] = [
                                          { role: r1, start_time: start, end_time: mid },
                                          { role: r2, start_time: mid, end_time: end },
                                        ];
                                        updateRow(t.id, { role_segments: segs, business_role: r1 } as any);
                                      }
                                    }}
                                    className="rounded-md px-2 py-1"
                                    style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)" }}
                                  >
                                    {t.role_segments ? "Désactiver" : "Activer"}
                                  </button>
                                </div>
                                {t.role_segments && (
                                  <RoleSegmentsEditor
                                    shiftStart={t.start_time.slice(0, 5)}
                                    shiftEnd={t.end_time.slice(0, 5)}
                                    segments={t.role_segments}
                                    onChange={(segs) => {
                                      const v = validateRoleSegments(segs, t.start_time.slice(0, 5), t.end_time.slice(0, 5), ROLES);
                                      // Toujours stocker le 1er segment comme rôle principal
                                      const primary = segs[0]?.role || t.business_role;
                                      if (v.ok) {
                                        updateRow(t.id, { role_segments: segs, business_role: primary } as any);
                                      } else {
                                        // mise à jour locale optimiste sans persister (le bouton sauvegarde indirectement via debounce ou next valid edit)
                                        setTemplates((prev) => prev.map((x) => x.id === t.id ? { ...x, role_segments: segs, business_role: primary } : x));
                                      }
                                    }}
                                    knownRoles={ROLES}
                                  />
                                )}
                              </div>

                              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8, lineHeight: 1.5 }}>
                                Polyvalence — laisse vide pour utiliser le rôle et le contrat ci-dessus. Coche plusieurs options pour autoriser n'importe lequel.
                              </div>
                              <div className="flex flex-col gap-2">
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 4 }}>Rôles autorisés</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {ROLES.map((r) => {
                                      const on = allowedRoles.includes(r);

                                      return (
                                        <button key={r} onClick={() => toggleInArray(t, "allowed_roles", r)}
                                          className="rounded-full px-2.5 py-1 transition-colors"
                                          style={{
                                            fontSize: 11,
                                            border: "0.5px solid var(--border)",
                                            backgroundColor: on ? "var(--foreground)" : "var(--background)",
                                            color: on ? "var(--card)" : "var(--foreground)",
                                          }}>
                                          {r}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );

                })}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={addRow}
          disabled={ROLES.length === 0}
          className="mt-3 rounded-md px-3 py-2 flex items-center gap-2 transition-colors"
          style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", opacity: ROLES.length === 0 ? 0.5 : 1, cursor: ROLES.length === 0 ? "not-allowed" : "pointer" }}>
          <Plus size={13} /> Ajouter un besoin
        </button>
      </div>
    </div>
  );
}
