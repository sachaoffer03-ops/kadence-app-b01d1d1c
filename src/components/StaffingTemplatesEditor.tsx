import { useEffect, useState } from "react";
import { Plus, Trash2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dropdown } from "@/components/Dropdown";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const ROLES = ["Barista", "Accueil", "Host", "Cuisine"] as const;

interface Studio { id: string; name: string }
interface Template {
  id: string;
  studio_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  business_role: typeof ROLES[number];
  required_count: number;
}

interface Props {
  /** Si fourni : verrouille la sélection sur ce studio (par nom). */
  lockedStudioName?: string;
  /** Cache la bannière info "modifications enregistrées immédiatement". */
  hideHint?: boolean;
}

export function StaffingTemplatesEditor({ lockedStudioName, hideHint }: Props) {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [studioId, setStudioId] = useState<string>("");

  const reload = async () => {
    const [s, t] = await Promise.all([
      supabase.from("studios").select("id, name").order("name"),
      supabase.from("staffing_templates").select("*").order("day_of_week").order("start_time"),
    ]);
    if (s.data) {
      setStudios(s.data);
      // Sélection initiale : studio verrouillé si fourni, sinon premier
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
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [lockedStudioName]);

  const addRow = async () => {
    if (!studioId) return toast.error("Aucun studio");
    const { error } = await supabase.from("staffing_templates").insert({
      studio_id: studioId,
      day_of_week: 0,
      start_time: "10:00",
      end_time: "15:00",
      business_role: "Barista",
      required_count: 1,
    });
    if (error) return toast.error(error.message);
    reload();
  };

  const updateRow = async (id: string, patch: Partial<Template>) => {
    setTemplates((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from("staffing_templates").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteRow = async (id: string) => {
    setTemplates((p) => p.filter((t) => t.id !== id));
    await supabase.from("staffing_templates").delete().eq("id", id);
    toast.success("Besoin supprimé");
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
            Tes modifications sont enregistrées immédiatement. Pour les appliquer au planning existant, va sur <a href="/planning/generate" style={{ textDecoration: "underline", fontWeight: 500 }}>Planning › Générer</a> et choisis la période à recalculer.
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

        {filtered.length === 0 ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "var(--muted)" }}>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun besoin défini. Ajoutez le premier ci-dessous.</div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full" style={{ fontSize: 12, borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead>
                <tr style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>
                  <th className="text-left px-2 py-1" style={{ fontSize: 10 }}>Jour</th>
                  <th className="text-left px-2 py-1" style={{ fontSize: 10 }}>Début</th>
                  <th className="text-left px-2 py-1" style={{ fontSize: 10 }}>Fin</th>
                  <th className="text-left px-2 py-1" style={{ fontSize: 10 }}>Rôle</th>
                  <th className="text-left px-2 py-1" style={{ fontSize: 10 }}>Nombre</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td className="px-2 py-1">
                      <Dropdown value={DAYS[t.day_of_week]} options={DAYS} onChange={(v) => updateRow(t.id, { day_of_week: DAYS.indexOf(v) })} minWidth={120} />
                    </td>
                    <td className="px-2 py-1">
                      <input type="time" value={t.start_time.slice(0, 5)} onChange={(e) => updateRow(t.id, { start_time: e.target.value })}
                        className="rounded-md px-2 py-1.5 outline-none"
                        style={{ fontSize: 12, border: "0.5px solid var(--border)", backgroundColor: "var(--background)", width: 110 }} />
                    </td>
                    <td className="px-2 py-1">
                      <input type="time" value={t.end_time.slice(0, 5)} onChange={(e) => updateRow(t.id, { end_time: e.target.value })}
                        className="rounded-md px-2 py-1.5 outline-none"
                        style={{ fontSize: 12, border: "0.5px solid var(--border)", backgroundColor: "var(--background)", width: 110 }} />
                    </td>
                    <td className="px-2 py-1">
                      <Dropdown value={t.business_role} options={[...ROLES]} onChange={(v) => updateRow(t.id, { business_role: v as typeof ROLES[number] })} minWidth={120} />
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={addRow}
          className="mt-3 rounded-md px-3 py-2 flex items-center gap-2 transition-colors"
          style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>
          <Plus size={13} /> Ajouter un besoin
        </button>
      </div>
    </div>
  );
}
