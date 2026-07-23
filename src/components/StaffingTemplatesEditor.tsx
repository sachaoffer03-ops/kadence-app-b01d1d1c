import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Info, ChevronDown, ChevronRight, Layers, Clock, History, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dropdown } from "@/components/Dropdown";
import { useStudioBusinessRoles } from "@/hooks/use-studio-business-roles";
import { RoleSegmentsEditor } from "@/components/admin/RoleSegmentsEditor";
import { setDirty } from "@/hooks/use-draft-state";
import {
  validateRoleSegments,
  type RoleSegment,
} from "@/lib/role-segments";
import { getStaffingHistory, type StaffingHistoryRow } from "@/lib/staffing-history.functions";


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

const toMinutes = (time: string) => {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const normalizeTimeInput = (raw: string): string | null => {
  let v = raw.trim().toLowerCase().replace(/[h.]/g, ":").replace(/\s+/g, "");
  if (/^\d{1,2}$/.test(v)) v = `${v}:00`;
  if (/^\d{3,4}$/.test(v)) v = `${v.slice(0, -2)}:${v.slice(-2)}`;
  const match = v.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  let total = h * 60 + Math.round(m / 15) * 15;
  if (total >= 24 * 60) total = 24 * 60 - 15;
  if (total < 0) total = 0;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

function TimeRangeCells({
  templateId,
  startTime,
  endTime,
  onCommit,
}: {
  templateId: string;
  startTime: string;
  endTime: string;
  onCommit: (start: string, end: string) => Promise<boolean> | boolean;
}) {
  const [draftStart, setDraftStart] = useState(startTime.slice(0, 5));
  const [draftEnd, setDraftEnd] = useState(endTime.slice(0, 5));
  const [status, setStatus] = useState<"saved" | "editing" | "saving" | "invalid" | "error">("saved");
  const commitRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ start: draftStart, end: draftEnd });
  const savedRef = useRef({ start: startTime.slice(0, 5), end: endTime.slice(0, 5) });
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    const active = typeof document !== "undefined" && (document.activeElement as HTMLElement | null)?.dataset.timeRangeId === templateId;
    savedRef.current = { start: startTime.slice(0, 5), end: endTime.slice(0, 5) };
    if (!active && !commitRef.current) {
      setDraftStart(startTime.slice(0, 5));
      setDraftEnd(endTime.slice(0, 5));
      latestRef.current = { start: startTime.slice(0, 5), end: endTime.slice(0, 5) };
      setStatus("saved");
    }
  }, [startTime, endTime, templateId]);

  const dirtyKey = `staffing-time-${templateId}`;
  useEffect(() => {
    const dirty = draftStart !== savedRef.current.start || draftEnd !== savedRef.current.end;
    setDirty(dirtyKey, dirty);
    return () => setDirty(dirtyKey, false);
  }, [draftStart, draftEnd, dirtyKey]);

  const commit = async (rawStart?: string, rawEnd?: string) => {
    const useStart = rawStart ?? latestRef.current.start;
    const useEnd = rawEnd ?? latestRef.current.end;
    const nextStart = normalizeTimeInput(useStart);
    const nextEnd = normalizeTimeInput(useEnd);
    if (!nextStart || !nextEnd) {
      setStatus("invalid");
      return false;
    }
    if (toMinutes(nextStart) >= toMinutes(nextEnd)) {
      setStatus("invalid");
      return false;
    }
    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
    latestRef.current = { start: nextStart, end: nextEnd };
    if (nextStart === savedRef.current.start && nextEnd === savedRef.current.end) {
      setStatus("saved");
      return true;
    }
    commitRef.current = true;
    setStatus("saving");
    const ok = await onCommitRef.current(nextStart, nextEnd);
    commitRef.current = false;
    if (!ok) {
      setDraftStart(savedRef.current.start);
      setDraftEnd(savedRef.current.end);
      latestRef.current = { start: savedRef.current.start, end: savedRef.current.end };
    }
    setStatus(ok ? "saved" : "error");
    return ok;
  };

  // Debounced autosave: enregistre 600 ms après la dernière frappe, sans avoir à blur.
  const scheduleDebouncedCommit = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void commit(); }, 600);
  };

  // Flush sur unmount (changement de sous-onglet, navigation) — best-effort.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const { start, end } = latestRef.current;
      if (start === savedRef.current.start && end === savedRef.current.end) return;
      const nextStart = normalizeTimeInput(start);
      const nextEnd = normalizeTimeInput(end);
      if (!nextStart || !nextEnd || toMinutes(nextStart) >= toMinutes(nextEnd)) return;
      // fire-and-forget — l'appel HTTP part avant le démontage du composant
      void onCommitRef.current(nextStart, nextEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleCommit = () => {
    window.setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active?.dataset.timeRangeId === templateId) return;
      void commit();
    }, 0);
  };

  const statusText =
    status === "saving" ? "Enregistrement…" :
    status === "invalid" ? "Vérifie début/fin" :
    status === "error" ? "Non enregistré" :
    status === "editing" ? "Modifié — enregistrement auto…" : "";
  const borderColor = status === "invalid" || status === "error" ? "var(--danger-text)" : "var(--border)";
  const inputStyle = {
    fontSize: 12,
    border: `0.5px solid ${borderColor}`,
    backgroundColor: "var(--background)",
    width: 88,
  };

  return (
    <>
      <td className="px-2 py-1">
        <input
          type="text"
          inputMode="numeric"
          aria-label="Heure de début"
          data-time-range-id={templateId}
          value={draftStart}
          onFocus={() => setStatus("editing")}
          onChange={(e) => {
            setDraftStart(e.target.value);
            latestRef.current = { ...latestRef.current, start: e.target.value };
            setStatus("editing");
            scheduleDebouncedCommit();
          }}
          onBlur={scheduleCommit}
          onKeyDown={(e) => { if (e.key === "Enter") void commit(); }}
          className="rounded-md px-2 py-1.5 outline-none"
          style={inputStyle}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="text"
          inputMode="numeric"
          aria-label="Heure de fin"
          data-time-range-id={templateId}
          value={draftEnd}
          onFocus={() => setStatus("editing")}
          onChange={(e) => {
            setDraftEnd(e.target.value);
            latestRef.current = { ...latestRef.current, end: e.target.value };
            setStatus("editing");
            scheduleDebouncedCommit();
          }}
          onBlur={scheduleCommit}
          onKeyDown={(e) => { if (e.key === "Enter") void commit(); }}
          className="rounded-md px-2 py-1.5 outline-none"
          style={inputStyle}
        />
        {statusText && (
          <div style={{
            fontSize: 10,
            color: status === "saving" || status === "editing" ? "var(--muted-foreground)" : "var(--danger-text)",
            marginTop: 3,
            whiteSpace: "nowrap",
          }}>
            {statusText}
          </div>
        )}
      </td>
    </>
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
    const { data, error } = await supabase.from("staffing_templates").insert({
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
    }).select().single();
    if (error || !data) return toast.error("Ajout impossible", { description: error?.message });
    // Append localement, sans reload, pour ne pas redécaler les lignes existantes
    setTemplates((p) => [...p, data as Template]);
  };


  const updateRow = async (id: string, patch: Partial<Template>): Promise<boolean> => {
    const prev = templates;
    const current = prev.find((t) => t.id === id);
    if (patch.start_time !== undefined) {
      patch.start_time = patch.start_time.slice(0, 5);
      if (!QUARTER_TIME_REGEX.test(patch.start_time)) return false;
    }
    if (patch.end_time !== undefined) {
      patch.end_time = patch.end_time.slice(0, 5);
      if (!QUARTER_TIME_REGEX.test(patch.end_time)) return false;
    }

    if (current && (patch.start_time !== undefined || patch.end_time !== undefined)) {
      const newStart = (patch.start_time ?? current.start_time).slice(0, 5);
      const newEnd = (patch.end_time ?? current.end_time).slice(0, 5);
      if (toMinutes(newStart) >= toMinutes(newEnd)) {
        toast.error("Horaire invalide", { description: "L'heure de fin doit être après l'heure de début." });
        return false;
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
      return false;
    }
    return true;
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

  const filtered = useMemo(
    () => templates.filter((t) => t.studio_id === studioId),
    [templates, studioId],
  );
  const totalShifts = filtered.reduce((sum, t) => sum + t.required_count, 0);

  const summary = useMemo(() => {
    let totalMinutes = 0;
    const byRole = new Map<string, number>(); // minutes per role
    const byDay = new Array(7).fill(0) as number[]; // staff-slots per day
    for (const t of filtered) {
      const [sh, sm] = t.start_time.slice(0, 5).split(":").map(Number);
      const [eh, em] = t.end_time.slice(0, 5).split(":").map(Number);
      const dur = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      const mins = dur * t.required_count;
      totalMinutes += mins;
      byDay[t.day_of_week] += t.required_count;
      if (t.role_segments && t.role_segments.length > 0) {
        for (const seg of t.role_segments) {
          const [ssh, ssm] = seg.start_time.slice(0, 5).split(":").map(Number);
          const [seh, sem] = seg.end_time.slice(0, 5).split(":").map(Number);
          const segMins = Math.max(0, (seh * 60 + sem) - (ssh * 60 + ssm)) * t.required_count;
          byRole.set(seg.role, (byRole.get(seg.role) ?? 0) + segMins);
        }
      } else {
        byRole.set(t.business_role, (byRole.get(t.business_role) ?? 0) + mins);
      }
    }
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const roles = Array.from(byRole.entries())
      .map(([role, m]) => ({ role, hours: Math.round((m / 60) * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours);
    const totalStaffDays = byDay.reduce((a, b) => a + b, 0);
    return { totalHours, roles, byDay, totalStaffDays };
  }, [filtered]);

  const [historyOpen, setHistoryOpen] = useState(false);

  if (loading) return <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>;
  if (studios.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Créez d'abord des studios pour configurer les besoins.</div>
      </div>
    );
  }



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

      {studioId && filtered.length > 0 && (
        <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Clock size={14} style={{ color: "var(--coral)" }} />
              <div style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>
                Résumé hebdomadaire
              </div>
            </div>
            <button
              onClick={() => setHistoryOpen(true)}
              className="rounded-md px-3 py-1.5 flex items-center gap-1.5 transition-colors"
              style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}
            >
              <History size={12} /> Historique
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Heures/semaine</div>
              <div style={{ fontSize: 22, fontWeight: 500, marginTop: 2 }}>{summary.totalHours.toString().replace(".", ",")}h</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Créneaux/semaine</div>
              <div style={{ fontSize: 22, fontWeight: 500, marginTop: 2 }}>{totalShifts}</div>
            </div>
            <div className="col-span-2">
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, marginBottom: 4 }}>Employés/jour</div>
              <div className="flex gap-1">
                {summary.byDay.map((n, i) => (
                  <div key={i} className="flex-1 text-center rounded-md py-1" style={{ backgroundColor: "var(--muted)", fontSize: 10 }}>
                    <div style={{ color: "var(--muted-foreground)" }}>{DAYS[i].slice(0, 3)}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{n}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {summary.roles.length > 0 && (
            <div className="mt-3 pt-3 flex flex-wrap gap-2" style={{ borderTop: "0.5px solid var(--border)" }}>
              {summary.roles.map((r) => (
                <div key={r.role} className="rounded-full px-2.5 py-1" style={{ fontSize: 11, backgroundColor: "var(--muted)" }}>
                  <span style={{ color: "var(--muted-foreground)" }}>{r.role} · </span>
                  <span style={{ fontWeight: 500 }}>{r.hours.toString().replace(".", ",")}h</span>
                </div>
              ))}
            </div>
          )}
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
                        <TimeRangeCells
                          templateId={t.id}
                          startTime={t.start_time}
                          endTime={t.end_time}
                          onCommit={(start, end) => updateRow(t.id, { start_time: start, end_time: end })}
                        />

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
      {historyOpen && studioId && (
        <HistoryModal
          studioId={studioId}
          studioName={studios.find((s) => s.id === studioId)?.name ?? ""}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}

function HistoryModal({ studioId, studioName, onClose }: { studioId: string; studioName: string; onClose: () => void }) {
  const fetchHistory = useServerFn(getStaffingHistory);
  const [rows, setRows] = useState<StaffingHistoryRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setRows(null); setErr(null);
    fetchHistory({ data: { studioId } })
      .then((r) => { if (!cancel) setRows(r); })
      .catch((e) => { if (!cancel) setErr(e?.message ?? "Erreur"); });
    return () => { cancel = true; };
  }, [fetchHistory, studioId]);

  const fmtMonth = (m: string) => {
    const [y, mm] = m.split("-");
    const d = new Date(Number(y), Number(mm) - 1, 1);
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Historique des besoins de staff</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{studioName} · basé sur les shifts publiés</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5" style={{ color: "var(--muted-foreground)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="overflow-auto p-4">
          {err && (
            <div className="rounded-md p-3" style={{ backgroundColor: "var(--danger-bg, var(--muted))", fontSize: 12, color: "var(--danger-text)" }}>
              {err}
            </div>
          )}
          {!rows && !err && (
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
          )}
          {rows && rows.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun shift publié pour ce studio.</div>
          )}
          {rows && rows.length > 0 && (
            <table className="w-full" style={{ fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--muted-foreground)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th className="text-left px-2 py-2" style={{ borderBottom: "0.5px solid var(--border)" }}>Mois</th>
                  <th className="text-right px-2 py-2" style={{ borderBottom: "0.5px solid var(--border)" }}>Heures/sem.</th>
                  <th className="text-right px-2 py-2" style={{ borderBottom: "0.5px solid var(--border)" }}>Total heures</th>
                  <th className="text-right px-2 py-2" style={{ borderBottom: "0.5px solid var(--border)" }}>Empl./jour</th>
                  <th className="text-right px-2 py-2" style={{ borderBottom: "0.5px solid var(--border)" }}>Jours actifs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month}>
                    <td className="px-2 py-2" style={{ borderBottom: "0.5px solid var(--border)", textTransform: "capitalize" }}>{fmtMonth(r.month)}</td>
                    <td className="text-right px-2 py-2" style={{ borderBottom: "0.5px solid var(--border)", fontWeight: 500 }}>{r.hoursPerWeek.toString().replace(".", ",")}h</td>
                    <td className="text-right px-2 py-2" style={{ borderBottom: "0.5px solid var(--border)", color: "var(--muted-foreground)" }}>{r.totalHours.toString().replace(".", ",")}h</td>
                    <td className="text-right px-2 py-2" style={{ borderBottom: "0.5px solid var(--border)", fontWeight: 500 }}>{r.avgEmpPerDay.toString().replace(".", ",")}</td>
                    <td className="text-right px-2 py-2" style={{ borderBottom: "0.5px solid var(--border)", color: "var(--muted-foreground)" }}>{r.activeDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

