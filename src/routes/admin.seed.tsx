import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DevOnly } from "@/components/DevOnly";
import { toast } from "sonner";
import {
  FlaskConical, ArrowLeft, Loader2, RotateCcw, Clock, ExternalLink,
  Trash2, Copy, CheckCircle2, AlertTriangle, Sparkles,
} from "lucide-react";
import {
  getDemoStatus, resetDemoEnvironment, renewTestableShift, cleanupAllDemoData,
} from "@/lib/seed-demo.functions";

export const Route = createFileRoute("/admin/seed")({
  component: () => (<DevOnly label="L'environnement de démo"><SeedDemoPage /></DevOnly>),
  head: () => ({ meta: [{ title: "Environnement de démo — Kadence" }] }),
});

type DemoStatus = Awaited<ReturnType<typeof getDemoStatus>>;

function SeedDemoPage() {
  const fetchStatus = useServerFn(getDemoStatus);
  const reset = useServerFn(resetDemoEnvironment);
  const renew = useServerFn(renewTestableShift);
  const cleanup = useServerFn(cleanupAllDemoData);

  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "reset" | "renew" | "cleanup">(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const load = async () => {
    setLoading(true);
    try { setStatus(await fetchStatus()); } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const handleReset = async () => {
    if (!confirm("Réinitialiser l'environnement de démo Clara ? Toutes ses données actuelles seront remplacées.")) return;
    setBusy("reset");
    try {
      const r = await reset();
      toast.success("Environnement de démo créé", { description: `${r.log.length} étapes · ${(r.duration_ms / 1000).toFixed(1)}s` });
      await load();
    } catch (e: any) { toast.error("Erreur reset", { description: e?.message }); }
    finally { setBusy(null); }
  };

  const handleRenew = async () => {
    setBusy("renew");
    try {
      await renew();
      toast.success("Nouveau shift testable dans 15 minutes");
      await load();
    } catch (e: any) { toast.error("Erreur", { description: e?.message }); }
    finally { setBusy(null); }
  };

  const handleCleanup = async () => {
    if (deleteInput !== "DELETE") { toast.error("Tape DELETE pour confirmer"); return; }
    setBusy("cleanup");
    try {
      const r = await cleanup({ data: { confirm: "DELETE" } });
      toast.success("Données démo supprimées", { description: `${r.deletedProfiles} profil(s) supprimé(s)` });
      setShowDelete(false); setDeleteInput("");
      await load();
    } catch (e: any) { toast.error("Erreur", { description: e?.message }); }
    finally { setBusy(null); }
  };

  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`${label} copié`);
  };

  const accent = "#6366F1"; // indigo pour signifier "outil dev"
  const accentBg = "#EEF2FF";

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-1 mb-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={12} /> Retour
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="rounded-lg flex items-center justify-center" style={{ width: 40, height: 40, backgroundColor: accentBg, color: accent }}>
          <FlaskConical size={20} strokeWidth={1.6} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.2 }}>Environnement de démo</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Outil de développement</div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 24, lineHeight: 1.6 }}>
        Crée un employé fictif (Clara Martens) avec un mois de données réalistes pour tester l'app côté employé sans devoir tout configurer à la main.
      </p>

      {loading && (
        <div className="rounded-xl border p-6 flex items-center justify-center gap-2" style={{ borderColor: "var(--border)" }}>
          <Loader2 size={16} className="animate-spin" /> <span style={{ fontSize: 13 }}>Chargement…</span>
        </div>
      )}

      {!loading && status && status.exists && (
        <>
          <div className="rounded-xl border p-5 mb-4" style={{ borderColor: accent + "44", backgroundColor: accentBg }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} style={{ color: accent }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: accent }}>Environnement actif</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
              {status.profile.name} <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>· {status.profile.contract}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.8 }}>
              {status.summary.pastShifts} shifts passés · {status.summary.futureShifts} shifts futurs · {status.summary.demands} demandes · {status.summary.notifs} notifications · {status.summary.docs} document(s)
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 8 }}>
              Dernière mise à jour : {new Date(status.profile.updatedAt).toLocaleString("fr-FR")}
            </div>
          </div>

          <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Identifiants Clara
            </div>
            <div className="grid grid-cols-2 gap-3" style={{ fontSize: 12 }}>
              <button onClick={() => copy(status.credentials.email, "Email")}
                className="rounded-md border px-3 py-2 flex items-center justify-between hover:bg-[var(--muted)]"
                style={{ borderColor: "var(--border)" }}>
                <span style={{ fontFamily: "monospace" }}>{status.credentials.email}</span>
                <Copy size={12} style={{ color: "var(--muted-foreground)" }} />
              </button>
              <button onClick={() => copy(status.credentials.password, "Mot de passe")}
                className="rounded-md border px-3 py-2 flex items-center justify-between hover:bg-[var(--muted)]"
                style={{ borderColor: "var(--border)" }}>
                <span style={{ fontFamily: "monospace" }}>{status.credentials.password}</span>
                <Copy size={12} style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 8, lineHeight: 1.5 }}>
              Déconnecte-toi puis reconnecte-toi avec ces identifiants pour voir l'app comme Clara.
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-6">
            <button onClick={handleReset} disabled={!!busy}
              className="rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition disabled:opacity-50"
              style={{ fontSize: 13, fontWeight: 500, backgroundColor: accent, color: "#fff", border: "none" }}>
              {busy === "reset" ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              Réinitialiser l'environnement
            </button>

            <button onClick={handleRenew} disabled={!!busy}
              className="rounded-xl border px-4 py-3 flex items-center justify-center gap-2 transition disabled:opacity-50"
              style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)", backgroundColor: "#fff" }}>
              {busy === "renew" ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
              Renouveler shift testable (+15 min)
            </button>

            <a href="/staff-app" target="_blank" rel="noopener noreferrer"
              className="rounded-xl border px-4 py-3 flex items-center justify-center gap-2 transition"
              style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)", backgroundColor: "#fff" }}>
              <ExternalLink size={16} /> Voir l'app comme Clara
            </a>

            <button onClick={() => setShowDelete(true)} disabled={!!busy}
              className="rounded-xl border px-4 py-3 flex items-center justify-center gap-2 transition disabled:opacity-50"
              style={{ fontSize: 13, fontWeight: 500, borderColor: "#DC262644", backgroundColor: "#FEF2F2", color: "#B91C1C" }}>
              <Trash2 size={16} /> Tout supprimer
            </button>
          </div>
        </>
      )}

      {!loading && status && !status.exists && (
        <div className="rounded-xl border p-6 mb-4 text-center" style={{ borderColor: "var(--border)" }}>
          <Sparkles size={20} style={{ color: accent, margin: "0 auto 8px" }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucun environnement de démo</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>
            Crée Clara et son univers de test en un clic.
          </div>
          <button onClick={handleReset} disabled={!!busy}
            className="rounded-xl px-5 py-3 inline-flex items-center gap-2 transition disabled:opacity-50"
            style={{ fontSize: 13, fontWeight: 500, backgroundColor: accent, color: "#fff", border: "none" }}>
            {busy === "reset" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Créer l'environnement de démo
          </button>
        </div>
      )}

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          Ce qui est créé
        </div>
        <ul style={{ fontSize: 12, lineHeight: 1.9, color: "var(--foreground)" }}>
          <li>· Clara Martens — Barista CDI, embauchée il y a 6 mois</li>
          <li>· 30 shifts passés clôturés (80% à l'heure, 20% en retard léger)</li>
          <li>· 5 shifts à venir dont 1 testable dans 15 min</li>
          <li>· 3 demandes : 1 pending urgente, 1 acceptée, 1 refusée</li>
          <li>· 5 notifications variées (urgent, normal, info)</li>
          <li>· 1 fiche de paie d'avril (placeholder)</li>
          <li>· Progression formation Barista à ~60% (si parcours publié)</li>
          <li>· Dispos sur 4 semaines</li>
        </ul>
      </div>

      {/* Modal suppression */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="rounded-2xl bg-white p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} style={{ color: "#DC2626" }} />
              <span style={{ fontSize: 15, fontWeight: 500 }}>Tout supprimer ?</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6, marginBottom: 12 }}>
              Cette action supprime Clara et toutes ses données. Les vrais utilisateurs ne sont pas affectés. Tape <strong>DELETE</strong> pour confirmer.
            </p>
            <input
              autoFocus
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-md border px-3 py-2 mb-4"
              style={{ fontSize: 13, borderColor: "var(--border)", fontFamily: "monospace" }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowDelete(false); setDeleteInput(""); }}
                className="rounded-md px-3 py-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Annuler
              </button>
              <button onClick={handleCleanup} disabled={busy === "cleanup" || deleteInput !== "DELETE"}
                className="rounded-md px-3 py-2 flex items-center gap-2 disabled:opacity-50"
                style={{ fontSize: 12, fontWeight: 500, backgroundColor: "#DC2626", color: "#fff", border: "none" }}>
                {busy === "cleanup" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
