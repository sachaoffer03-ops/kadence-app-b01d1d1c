import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Puzzle, CreditCard, ScrollText, AlertTriangle, Lock, Save, ShieldCheck, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StaffingTemplatesEditor } from "@/components/StaffingTemplatesEditor";

export const Route = createFileRoute("/reglages")({
  component: ReglagesPage,
  head: () => ({ meta: [{ title: "Réglages — Kadence" }] }),
});

const tabs = [
  { id: "ai", label: "Algorithme IA", icon: Sparkles },
  { id: "templates", label: "Besoins par studio", icon: Puzzle },
  { id: "admins", label: "Administrateurs", icon: ShieldCheck },
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
          {activeTab === "templates" && <StaffingTemplatesEditor />}
          {activeTab === "admins" && <AdminsSettings />}
          {!["ai", "templates", "admins"].includes(activeTab) && (
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
  const [rules, setRules] = useState({
    enforce_student_quota: true,
    enforce_rest_11h: true,
    enforce_max_weekly_cdi: true,
    strict_preferences: false,
  });
  const [bounds, setBounds] = useState({ min: 3, max: 6 });
  const [weekly, setWeekly] = useState({ student: 15, flexi: 20, cdi: 48 });
  const [deadlineDay, setDeadlineDay] = useState<number>(25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("ai_planning_settings").select("*").order("updated_at", { ascending: false }).limit(1)
      .then(({ data }) => {
        const r = data?.[0] as any;
        if (r) {
          setId(r.id);
          setRules({
            enforce_student_quota: r.enforce_student_quota,
            enforce_rest_11h: r.enforce_rest_11h,
            enforce_max_weekly_cdi: r.enforce_max_weekly_cdi,
            strict_preferences: r.strict_preferences,
          });
          setBounds({ min: r.min_shift_hours ?? 3, max: r.max_shift_hours ?? 6 });
          setWeekly({
            student: r.max_weekly_student_hours ?? 15,
            flexi: r.max_weekly_flexi_hours ?? 20,
            cdi: r.max_weekly_cdi_hours ?? 48,
          });
          setDeadlineDay((r as any).availability_lock_day ?? r.availability_deadline_day ?? 25);
        }
        setLoading(false);
      });
  }, []);

  const save = async () => {
    if (bounds.min < 1 || bounds.max < bounds.min) return toast.error("Les bornes min/max sont invalides");
    setSaving(true);
    const payload = {
      min_shift_hours: bounds.min,
      max_shift_hours: bounds.max,
      max_weekly_student_hours: weekly.student,
      max_weekly_flexi_hours: weekly.flexi,
      max_weekly_cdi_hours: weekly.cdi,
      availability_deadline_day: deadlineDay,
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
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Règles strictes</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Contraintes appliquées par l'IA pendant la génération</div>

        <div className="flex flex-col gap-3">
          <RuleToggle label="Quota 650h étudiants" description="Ne jamais dépasser le plafond légal" enabled={rules.enforce_student_quota} onChange={(v) => setRules((p) => ({ ...p, enforce_student_quota: v }))} />
          <RuleToggle label="Repos minimum 11h" description="11h de repos entre deux shifts (loi belge)" enabled={rules.enforce_rest_11h} onChange={(v) => setRules((p) => ({ ...p, enforce_rest_11h: v }))} />
          <RuleToggle label={`Maximum ${weekly.cdi}h/semaine (CDI)`} description="Limite légale pour les CDI" enabled={rules.enforce_max_weekly_cdi} onChange={(v) => setRules((p) => ({ ...p, enforce_max_weekly_cdi: v }))} />
          <RuleToggle label="Préférences strictes" description="Ne jamais assigner en dehors des préférences" enabled={rules.strict_preferences} onChange={(v) => setRules((p) => ({ ...p, strict_preferences: v }))} />
        </div>
      </div>

      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Bornes des shifts générés</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Durée minimale et maximale d'un bloc créé par l'IA (heures)</div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
            Min
            <input type="number" min={1} max={8} value={bounds.min}
              onChange={(e) => setBounds((p) => ({ ...p, min: Math.max(1, Number(e.target.value)) }))}
              className="rounded-md px-2 py-1 outline-none" style={{ width: 70, fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
            h
          </label>
          <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
            Max
            <input type="number" min={bounds.min} max={12} value={bounds.max}
              onChange={(e) => setBounds((p) => ({ ...p, max: Math.max(bounds.min, Number(e.target.value)) }))}
              className="rounded-md px-2 py-1 outline-none" style={{ width: 70, fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
            h
          </label>
        </div>
      </div>

      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Plafonds hebdomadaires par contrat</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Heures maximum qu'un employé peut faire par semaine selon son contrat.</div>
        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
            Étudiant
            <input type="number" min={1} max={48} value={weekly.student}
              onChange={(e) => setWeekly((p) => ({ ...p, student: Math.max(1, Number(e.target.value)) }))}
              className="rounded-md px-2 py-1 outline-none" style={{ width: 70, fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
            h
          </label>
          <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
            Flexi
            <input type="number" min={1} max={48} value={weekly.flexi}
              onChange={(e) => setWeekly((p) => ({ ...p, flexi: Math.max(1, Number(e.target.value)) }))}
              className="rounded-md px-2 py-1 outline-none" style={{ width: 70, fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
            h
          </label>
          <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
            CDI
            <input type="number" min={1} max={60} value={weekly.cdi}
              onChange={(e) => setWeekly((p) => ({ ...p, cdi: Math.max(1, Number(e.target.value)) }))}
              className="rounded-md px-2 py-1 outline-none" style={{ width: 70, fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
            h
          </label>
        </div>
      </div>

      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Jour limite de saisie des dispos</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>
          Jusqu'à quel jour du mois les employés peuvent saisir leurs dispos pour le mois suivant. Ex : 25 = les dispos de juillet doivent être saisies avant le 25 juin 23h59.
        </div>
        <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
          Jour
          <input type="number" min={1} max={28} value={deadlineDay}
            onChange={(e) => setDeadlineDay(Math.min(28, Math.max(1, Number(e.target.value))))}
            className="rounded-md px-2 py-1 outline-none" style={{ width: 70, fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
          <span style={{ color: "var(--muted-foreground)" }}>du mois</span>
        </label>
      </div>

      <div className="flex items-center gap-2 self-start flex-wrap">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md px-4 py-2 flex items-center gap-2 transition-colors"
          style={{
            fontSize: 13, fontWeight: 500,
            backgroundColor: "var(--foreground)",
            color: "var(--card)",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer les réglages"}
        </button>
        <RecalcScoresButton />
      </div>
    </div>
  );
}

function RecalcScoresButton() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { recalculateAllScores } = await import("@/lib/scoring.functions");
      const res = await recalculateAllScores();
      toast.success(`${res.count} score${res.count > 1 ? "s" : ""} recalculé${res.count > 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error(e?.message || "Erreur recalcul");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={run}
      disabled={busy}
      className="rounded-md px-4 py-2 flex items-center gap-2"
      style={{ fontSize: 13, fontWeight: 500, border: "0.5px solid var(--border)", color: "var(--foreground)" }}
    >
      <Sparkles size={14} /> {busy ? "Recalcul en cours…" : "Recalculer tous les scores"}
    </button>
  );
}

// (Legacy StaffingTemplates inline supprimé : voir StaffingTemplatesEditor.tsx)

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

// ── Administrateurs ─────────────────────────────────────────
function AdminsSettings() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const reload = async () => {
    setLoading(true);
    try {
      const { listAdmins } = await import("@/lib/admins.functions");
      const res = await listAdmins();
      setAdmins(res.admins);
    } catch (e: any) {
      toast.error(e?.message || "Erreur chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      return toast.error("Tous les champs sont requis");
    }
    setSubmitting(true);
    try {
      const { createAdminAccount } = await import("@/lib/admins.functions");
      await createAdminAccount({ data: { email: email.trim(), password, first_name: firstName.trim(), last_name: lastName.trim() } });
      toast.success("Compte administrateur créé");
      setFirstName(""); setLastName(""); setEmail(""); setPassword("");
      setShowForm(false);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Comptes administrateurs</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Les administrateurs ont 100% des accès : gestion des employés, planning, studios, réglages, données.
            </div>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md px-3 py-2 flex items-center gap-2 shrink-0"
              style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
            >
              <Plus size={14} /> Nouvel admin
            </button>
          )}
        </div>

        {showForm && (
          <div className="rounded-lg p-4 mb-4 flex flex-col gap-3" style={{ backgroundColor: "var(--muted)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Prénom
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className="rounded-md px-2 py-1.5 outline-none"
                  style={{ fontSize: 13, color: "var(--foreground)", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
              </label>
              <label className="flex flex-col gap-1" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Nom
                <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="rounded-md px-2 py-1.5 outline-none"
                  style={{ fontSize: 13, color: "var(--foreground)", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
              </label>
              <label className="flex flex-col gap-1" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="rounded-md px-2 py-1.5 outline-none"
                  style={{ fontSize: 13, color: "var(--foreground)", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
              </label>
              <label className="flex flex-col gap-1" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Mot de passe
                <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 caractères minimum"
                  className="rounded-md px-2 py-1.5 outline-none"
                  style={{ fontSize: 13, color: "var(--foreground)", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
              </label>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Le compte est créé immédiatement, sans email de confirmation. Communique l'email et le mot de passe à la personne.
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowForm(false); setFirstName(""); setLastName(""); setEmail(""); setPassword(""); }}
                className="rounded-md px-3 py-1.5" style={{ fontSize: 13, border: "0.5px solid var(--border)", color: "var(--foreground)" }}>
                Annuler
              </button>
              <button onClick={submit} disabled={submitting}
                className="rounded-md px-3 py-1.5 flex items-center gap-2"
                style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)", opacity: submitting ? 0.6 : 1 }}>
                {submitting && <Loader2 size={13} className="animate-spin" />}
                Créer le compte admin
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {loading ? (
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
          ) : admins.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun administrateur.</div>
          ) : admins.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--muted)" }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldCheck size={14} style={{ color: "var(--coral)" }} />
                <div className="min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 500 }} className="truncate">
                    {(a.first_name || "") + " " + (a.last_name || "")}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }} className="truncate">{a.email}</div>
                </div>
              </div>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Admin</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
