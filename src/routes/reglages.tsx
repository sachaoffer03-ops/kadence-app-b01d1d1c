import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Puzzle, CreditCard, ScrollText, AlertTriangle, Lock, Plus, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dropdown } from "@/components/Dropdown";

export const Route = createFileRoute("/reglages")({
  component: ReglagesPage,
  head: () => ({ meta: [{ title: "Réglages — Kadence" }] }),
});

const tabs = [
  { id: "ai", label: "Algorithme IA", icon: Sparkles },
  { id: "templates", label: "Besoins par studio", icon: Puzzle },
  { id: "billing", label: "Facturation", icon: CreditCard },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "danger", label: "Zone dangereuse", icon: AlertTriangle },
] as const;

function ReglagesPage() {
  const [activeTab, setActiveTab] = useState<string>("ai");

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Réglages</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Configuration générale de Kadence.</p>
      </div>

      <div className="flex gap-6 flex-col md:flex-row">
        <div className="flex md:flex-col gap-1 shrink-0 overflow-x-auto md:w-[200px]">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors whitespace-nowrap"
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 500 : 400,
                  backgroundColor: isActive ? "var(--muted)" : "transparent",
                  color: tab.id === "danger" ? "var(--danger-text)" : isActive ? "var(--foreground)" : "var(--muted-foreground)",
                }}
              >
                <tab.icon size={15} strokeWidth={1.8} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === "ai" && <AISettings />}
          {activeTab === "templates" && <StaffingTemplates />}
          {!["ai", "templates"].includes(activeTab) && (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                {tabs.find((t) => t.id === activeTab)?.label}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Bientôt disponible</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AI Settings (persistés en DB) ──────────────────────────
function AISettings() {
  const [id, setId] = useState<string | null>(null);
  const [weights, setWeights] = useState({ performance: 40, equity: 30, preference: 20, random: 10 });
  const [rules, setRules] = useState({
    enforce_student_quota: true,
    enforce_rest_11h: true,
    enforce_max_weekly_cdi: true,
    strict_preferences: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("ai_planning_settings").select("*").order("updated_at", { ascending: false }).limit(1)
      .then(({ data }) => {
        const r = data?.[0];
        if (r) {
          setId(r.id);
          setWeights({
            performance: r.weight_performance,
            equity: r.weight_equity,
            preference: r.weight_preference,
            random: r.weight_random,
          });
          setRules({
            enforce_student_quota: r.enforce_student_quota,
            enforce_rest_11h: r.enforce_rest_11h,
            enforce_max_weekly_cdi: r.enforce_max_weekly_cdi,
            strict_preferences: r.strict_preferences,
          });
        }
        setLoading(false);
      });
  }, []);

  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  const save = async () => {
    if (total !== 100) return toast.error("Le total des poids doit faire 100%");
    setSaving(true);
    const payload = {
      weight_performance: weights.performance,
      weight_equity: weights.equity,
      weight_preference: weights.preference,
      weight_random: weights.random,
      ...rules,
    };
    const { error } = id
      ? await supabase.from("ai_planning_settings").update(payload).eq("id", id)
      : await supabase.from("ai_planning_settings").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Réglages enregistrés");
  };

  if (loading) return <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Pondération de l'algorithme</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Ajustez l'importance relative de chaque critère</div>
          </div>
          <span className="rounded-full px-2.5 py-1" style={{
            fontSize: 11, fontWeight: 500,
            backgroundColor: total === 100 ? "var(--success-bg)" : "var(--danger-bg)",
            color: total === 100 ? "var(--success-text)" : "var(--danger-text)",
          }}>
            Total : {total}%
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <WeightSlider label="Score de performance" value={weights.performance} onChange={(v) => setWeights((p) => ({ ...p, performance: v }))} description="Privilégie les employés les mieux notés" />
          <WeightSlider label="Équité de distribution" value={weights.equity} onChange={(v) => setWeights((p) => ({ ...p, equity: v }))} description="Répartit les shifts équitablement" />
          <WeightSlider label="Respect des préférences" value={weights.preference} onChange={(v) => setWeights((p) => ({ ...p, preference: v }))} description="Respecte les créneaux préférés" />
          <WeightSlider label="Variation aléatoire" value={weights.random} onChange={(v) => setWeights((p) => ({ ...p, random: v }))} description="Introduit de la diversité" />
        </div>
      </div>

      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Règles strictes</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Contraintes appliquées par l'IA pendant la génération</div>

        <div className="flex flex-col gap-3">
          <RuleToggle label="Quota 650h étudiants" description="Ne jamais dépasser le plafond légal" enabled={rules.enforce_student_quota} onChange={(v) => setRules((p) => ({ ...p, enforce_student_quota: v }))} />
          <RuleToggle label="Repos minimum 11h" description="11h de repos entre deux shifts (loi belge)" enabled={rules.enforce_rest_11h} onChange={(v) => setRules((p) => ({ ...p, enforce_rest_11h: v }))} />
          <RuleToggle label="Maximum 38h/semaine (CDI)" description="Limite légale pour les CDI" enabled={rules.enforce_max_weekly_cdi} onChange={(v) => setRules((p) => ({ ...p, enforce_max_weekly_cdi: v }))} />
          <RuleToggle label="Préférences strictes" description="Ne jamais assigner en dehors des préférences" enabled={rules.strict_preferences} onChange={(v) => setRules((p) => ({ ...p, strict_preferences: v }))} />
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving || total !== 100}
        className="self-start rounded-md px-4 py-2 flex items-center gap-2 transition-colors"
        style={{
          fontSize: 13, fontWeight: 500,
          backgroundColor: total === 100 ? "var(--foreground)" : "var(--muted)",
          color: total === 100 ? "var(--card)" : "var(--muted-foreground)",
          cursor: total === 100 && !saving ? "pointer" : "not-allowed",
        }}
      >
        <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer les réglages"}
      </button>
    </div>
  );
}

// ── Staffing Templates (besoins par studio/jour/créneau) ───
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

function StaffingTemplates() {
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
      if (s.data.length && !studioId) setStudioId(s.data[0].id);
    }
    if (t.data) setTemplates(t.data as Template[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

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
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Besoins hebdomadaires</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>L'IA crée chaque semaine ces shifts pour le studio sélectionné.</div>
          </div>
          <Dropdown
            value={studios.find((s) => s.id === studioId)?.name ?? ""}
            options={studios.map((s) => s.name)}
            onChange={(v) => setStudioId(studios.find((s) => s.name === v)?.id ?? "")}
            minWidth={180}
          />
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

function WeightSlider({ label, value, onChange, description }: { label: string; value: number; onChange: (v: number) => void; description: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 8 }}>{description}</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--coral-dark)", minWidth: 40, textAlign: "right" }}>{value}%</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full" style={{ accentColor: "var(--coral)", height: 4 }}
      />
    </div>
  );
}

function RuleToggle({ label, description, enabled, onChange, locked }: { label: string; description: string; enabled: boolean; onChange?: (v: boolean) => void; locked?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--muted)" }}>
      <div className="flex items-center gap-2">
        {locked && <Lock size={12} style={{ color: "var(--muted-foreground)" }} />}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{description}</div>
        </div>
      </div>
      <button
        onClick={() => !locked && onChange?.(!enabled)}
        className="rounded-full transition-colors"
        style={{
          width: 36, height: 20,
          backgroundColor: enabled ? "var(--coral)" : "var(--border)",
          opacity: locked ? 0.6 : 1,
          cursor: locked ? "not-allowed" : "pointer",
          position: "relative",
        }}
      >
        <span className="rounded-full absolute transition-all" style={{
          width: 16, height: 16, top: 2,
          left: enabled ? 18 : 2,
          backgroundColor: "#fff",
        }} />
      </button>
    </div>
  );
}
