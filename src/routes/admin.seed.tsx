import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DevOnly } from "@/components/DevOnly";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  FlaskConical, ArrowLeft, Loader2, RotateCcw, Trash2, Copy,
  AlertTriangle, Sparkles, User, Pencil, LogOut, RefreshCw, Calendar, ListChecks,
} from "lucide-react";
import {
  getDemoStatus, resetDemoEnvironment, cleanupAllDemoData,
  regenerateEmployee, regenerateJuneAvailabilities, regenerateChecklists,
  purgeNonDemoEmployees,
} from "@/lib/seed-demo.functions";

export const Route = createFileRoute("/admin/seed")({
  component: () => (<DevOnly label="L'environnement de démo"><SeedDemoPage /></DevOnly>),
  head: () => ({ meta: [{ title: "Environnement de démo — Kadence" }] }),
});

type DemoStatus = Awaited<ReturnType<typeof getDemoStatus>>;
type Emp = DemoStatus["employees"][number];

const ACCENT = "#6366F1";
const ACCENT_BG = "#EEF2FF";
const ROLE_COLORS: Record<string, string> = {
  Barista: "#D97706", Accueil: "#2563EB", Host: "#7C3AED", Cuisine: "#DC2626",
};

function SeedDemoPage() {
  const fetchStatus = useServerFn(getDemoStatus);
  const reset = useServerFn(resetDemoEnvironment);
  const cleanup = useServerFn(cleanupAllDemoData);
  const regenEmp = useServerFn(regenerateEmployee);
  const regenAvails = useServerFn(regenerateJuneAvailabilities);
  const regenChecklists = useServerFn(regenerateChecklists);
  const purgeOthers = useServerFn(purgeNonDemoEmployees);

  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [switchModal, setSwitchModal] = useState<Emp | null>(null);

  const load = async () => {
    setLoading(true);
    try { setStatus(await fetchStatus()); }
    catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`${label} copié`);
  };

  const handleReset = async () => {
    if (!confirm("Réinitialiser l'environnement de démo complet (5 employés) ? Toutes les données démo actuelles seront remplacées.")) return;
    setBusy("reset");
    try {
      const r = await reset();
      toast.success("Environnement créé", {
        description: `${r.employees.length} employés · ${r.log.length} étapes · ${(r.duration_ms / 1000).toFixed(1)}s`,
      });
      await load();
    } catch (e: any) { toast.error("Erreur reset", { description: e?.message }); }
    finally { setBusy(null); }
  };

  const handleRegenEmp = async (email: string) => {
    if (!confirm(`Régénérer ce compte ? Il sera supprimé puis recréé from scratch.`)) return;
    setBusy(`emp:${email}`);
    try {
      await regenEmp({ data: { email } });
      toast.success("Compte régénéré");
      await load();
    } catch (e: any) { toast.error(e?.message); }
    finally { setBusy(null); }
  };

  const handleRegenAvails = async () => {
    setBusy("avails");
    try { const r = await regenAvails(); toast.success(`Dispos régénérées (${r.regenerated} employés)`); }
    catch (e: any) { toast.error(e?.message); }
    finally { setBusy(null); }
  };

  const handleRegenChecklists = async () => {
    setBusy("checklists");
    try { const r = await regenChecklists(); toast.success(`${r.count} templates checklist régénérés`); }
    catch (e: any) { toast.error(e?.message); }
    finally { setBusy(null); }
  };

  const handleCleanup = async () => {
    if (deleteInput !== "SUPPRIMER") { toast.error("Tape SUPPRIMER pour confirmer"); return; }
    setBusy("cleanup");
    try {
      const r = await cleanup({ data: { confirm: "DELETE" } });
      toast.success(`${r.deletedProfiles} profil(s) démo supprimé(s)`);
      setShowDelete(false); setDeleteInput("");
      await load();
    } catch (e: any) { toast.error(e?.message); }
    finally { setBusy(null); }
  };

  const handleSwitchTo = async (emp: Emp) => {
    try {
      await supabase.auth.signOut();
      window.location.href = `/login?email=${encodeURIComponent(emp.config.email)}`;
    } catch (e: any) { toast.error(e?.message); }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-1 mb-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={12} /> Retour
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="rounded-lg flex items-center justify-center" style={{ width: 40, height: 40, backgroundColor: ACCENT_BG, color: ACCENT }}>
          <FlaskConical size={20} strokeWidth={1.6} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.2 }}>Environnement de démo — 5 employés fictifs</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Outil de développement</div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 24, lineHeight: 1.6 }}>
        Crée un environnement complet pour tester l'app de bout en bout côté admin ET côté employé.
        5 profils 100% remplis · 12 checklists (3 phases × 4 rôles) · dispos juin 2026.
      </p>

      {/* Actions globales */}
      <div className="flex flex-col md:flex-row gap-2 mb-6">
        <button onClick={handleReset} disabled={!!busy}
          className="flex-1 rounded-xl px-4 py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ fontSize: 13, fontWeight: 500, backgroundColor: ACCENT, color: "#fff", border: "none" }}>
          {busy === "reset" ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
          Réinitialiser l'environnement complet
        </button>
        <button onClick={handleRegenAvails} disabled={!!busy}
          className="rounded-xl border px-4 py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          {busy === "avails" ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
          Régénérer dispos juin
        </button>
        <button onClick={handleRegenChecklists} disabled={!!busy}
          className="rounded-xl border px-4 py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          {busy === "checklists" ? <Loader2 size={16} className="animate-spin" /> : <ListChecks size={16} />}
          Régénérer checklists
        </button>
      </div>

      {loading && (
        <div className="rounded-xl border p-6 flex items-center justify-center gap-2" style={{ borderColor: "var(--border)" }}>
          <Loader2 size={16} className="animate-spin" /> <span style={{ fontSize: 13 }}>Chargement…</span>
        </div>
      )}

      {!loading && status && !status.anyExists && (
        <div className="rounded-xl border p-6 mb-4 text-center" style={{ borderColor: "var(--border)" }}>
          <Sparkles size={20} style={{ color: ACCENT, margin: "0 auto 8px" }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucun environnement de démo</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Clique sur "Réinitialiser" en haut pour créer les 5 comptes démo.
          </div>
        </div>
      )}

      {!loading && status && status.anyExists && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {status.employees.map((emp) => (
            <EmployeeCard
              key={emp.config.email}
              emp={emp}
              password={status.password}
              busy={busy === `emp:${emp.config.email}`}
              onCopy={copy}
              onRegen={() => handleRegenEmp(emp.config.email)}
              onSwitch={() => setSwitchModal(emp)}
            />
          ))}
        </div>
      )}

      {!loading && status?.anyExists && (
        <div className="flex flex-col gap-2">
          <button
            onClick={async () => {
              if (!confirm("Supprimer TOUS les employés qui ne sont pas les 5 démo ? (les profils protégés sont préservés)")) return;
              setBusy("purge-others");
              try {
                const r = await purgeOthers({ data: { confirm: "DELETE" } });
                toast.success(`${r.deleted} employé(s) supprimé(s)`, {
                  description: r.failed.length ? `${r.failed.length} échec(s)` : undefined,
                });
                await load();
              } catch (e: any) { toast.error(e?.message); }
              finally { setBusy(null); }
            }}
            disabled={!!busy}
            className="w-full rounded-xl border px-4 py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ fontSize: 13, fontWeight: 500, borderColor: "#F59E0B44", backgroundColor: "#FFFBEB", color: "#B45309" }}>
            {busy === "purge-others" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Supprimer tous les autres employés (garder uniquement les 5 démo)
          </button>
          <button onClick={() => setShowDelete(true)} disabled={!!busy}
            className="w-full rounded-xl border px-4 py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ fontSize: 13, fontWeight: 500, borderColor: "#DC262644", backgroundColor: "#FEF2F2", color: "#B91C1C" }}>
            <Trash2 size={16} /> Tout supprimer (y compris les 5 démo)
          </button>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="rounded-2xl p-6 max-w-md w-full" style={{ backgroundColor: "var(--card)" }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} style={{ color: "#DC2626" }} />
              <span style={{ fontSize: 15, fontWeight: 500 }}>Tout supprimer ?</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6, marginBottom: 12 }}>
              Supprime les 5 employés démo et toutes leurs données. Les vrais utilisateurs ne sont pas affectés. Tape <strong>SUPPRIMER</strong> pour confirmer.
            </p>
            <input autoFocus value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="SUPPRIMER"
              className="w-full rounded-md border px-3 py-2 mb-4"
              style={{ fontSize: 13, borderColor: "var(--border)", fontFamily: "monospace" }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowDelete(false); setDeleteInput(""); }}
                className="rounded-md px-3 py-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Annuler</button>
              <button onClick={handleCleanup} disabled={busy === "cleanup" || deleteInput !== "SUPPRIMER"}
                className="rounded-md px-3 py-2 flex items-center gap-2 disabled:opacity-50"
                style={{ fontSize: 12, fontWeight: 500, backgroundColor: "#DC2626", color: "#fff", border: "none" }}>
                {busy === "cleanup" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {switchModal && (
        <SwitchToModal emp={switchModal} password={status?.password ?? ""}
          onCopy={copy} onConfirm={() => handleSwitchTo(switchModal)}
          onClose={() => setSwitchModal(null)} />
      )}
    </div>
  );
}

function EmployeeCard({ emp, password, busy, onCopy, onRegen, onSwitch }: {
  emp: Emp; password: string; busy: boolean;
  onCopy: (v: string, l: string) => void; onRegen: () => void; onSwitch: () => void;
}) {
  const { config, profile, exists } = emp;
  const mainRole = config.business_roles[0] ?? "—";
  const roleColor = ROLE_COLORS[mainRole] ?? "#888";

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="rounded-full overflow-hidden flex items-center justify-center" style={{
          width: 44, height: 44, backgroundColor: "var(--muted)",
        }}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <User size={18} style={{ color: "var(--muted-foreground)" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 14, fontWeight: 500 }}>{config.first_name} {config.last_name}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            <span style={{ color: roleColor, fontWeight: 500 }}>{config.business_roles.join(" · ")}</span>
            {" · "}{config.contract} · {config.hourly_rate}€/h · Score {config.score}
          </div>
        </div>
        {!exists && (
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
            Non créé
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 mb-3" style={{ fontSize: 11 }}>
        <button onClick={() => onCopy(config.email, "Email")}
          className="rounded-md border px-2.5 py-1.5 flex items-center justify-between hover:bg-[var(--muted)]"
          style={{ borderColor: "var(--border)" }}>
          <span style={{ fontFamily: "monospace" }}>{config.email}</span>
          <Copy size={11} style={{ color: "var(--muted-foreground)" }} />
        </button>
        <button onClick={() => onCopy(password, "Mot de passe")}
          className="rounded-md border px-2.5 py-1.5 flex items-center justify-between hover:bg-[var(--muted)]"
          style={{ borderColor: "var(--border)" }}>
          <span style={{ fontFamily: "monospace" }}>{password}</span>
          <Copy size={11} style={{ color: "var(--muted-foreground)" }} />
        </button>
      </div>

      {exists && profile && (
        <div className="grid grid-cols-2 gap-1.5">
          <Link to="/staff/$id" params={{ id: profile.id }}
            className="rounded-md border px-2 py-1.5 flex items-center justify-center gap-1 hover:bg-[var(--muted)]"
            style={{ fontSize: 11, fontWeight: 500, borderColor: "var(--border)" }}>
            <User size={11} /> Profil admin
          </Link>
          <Link to="/staff/$id" params={{ id: profile.id }} search={{ edit: 1 }}
            className="rounded-md border px-2 py-1.5 flex items-center justify-center gap-1 hover:bg-[var(--muted)]"
            style={{ fontSize: 11, fontWeight: 500, borderColor: "var(--border)" }}>
            <Pencil size={11} /> Modifier
          </Link>
          <button onClick={onSwitch}
            className="rounded-md border px-2 py-1.5 flex items-center justify-center gap-1 hover:bg-[var(--muted)]"
            style={{ fontSize: 11, fontWeight: 500, borderColor: "var(--border)" }}>
            <LogOut size={11} /> Voir l'app comme
          </button>
          <button onClick={onRegen} disabled={busy}
            className="rounded-md border px-2 py-1.5 flex items-center justify-center gap-1 hover:bg-[var(--muted)] disabled:opacity-50"
            style={{ fontSize: 11, fontWeight: 500, borderColor: "var(--border)" }}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Régénérer
          </button>
        </div>
      )}
    </div>
  );
}

function SwitchToModal({ emp, password, onCopy, onConfirm, onClose }: {
  emp: Emp; password: string;
  onCopy: (v: string, l: string) => void; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="rounded-2xl p-6 max-w-md w-full" style={{ backgroundColor: "var(--card)" }}>
        <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>
          Tester l'app comme {emp.config.first_name}
        </h3>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6, marginBottom: 14 }}>
          Tu vas être déconnecté puis redirigé vers la page de connexion avec l'email pré-rempli.
          Tape le mot de passe ci-dessous pour entrer dans l'app de {emp.config.first_name}.
        </p>
        <div className="flex flex-col gap-2 mb-4" style={{ fontSize: 12 }}>
          <div className="rounded-md border px-3 py-2 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <span style={{ fontFamily: "monospace" }}>{emp.config.email}</span>
          </div>
          <button onClick={() => onCopy(password, "Mot de passe")}
            className="rounded-md border px-3 py-2 flex items-center justify-between hover:bg-[var(--muted)]"
            style={{ borderColor: "var(--border)" }}>
            <span style={{ fontFamily: "monospace" }}>{password}</span>
            <Copy size={12} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="rounded-md px-3 py-2"
            style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Annuler</button>
          <button onClick={onConfirm}
            className="rounded-md px-3 py-2 flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: ACCENT, color: "#fff", border: "none" }}>
            <LogOut size={12} /> Se déconnecter et continuer
          </button>
        </div>
      </div>
    </div>
  );
}
