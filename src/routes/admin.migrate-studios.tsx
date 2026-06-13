import { createFileRoute, Link } from "@tanstack/react-router";
import { DevOnly } from "@/components/DevOnly";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { previewStudioMigration, executeStudioMigration } from "@/lib/migrate-studios.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/admin/migrate-studios")({
  component: () => (<DevOnly label="L'outil de migration des studios"><MigrateStudiosPage /></DevOnly>),
});

function MigrateStudiosPage() {
  const preview = useServerFn(previewStudioMigration);
  const execute = useServerFn(executeStudioMigration);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof preview>> | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof execute>> | null>(null);

  async function load() {
    setLoading(true);
    try { setData(await preview({})); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function run() {
    if (!data?.pairs.length) return;
    if (!confirm("Cette opération est destructive et irréversible. Confirmer ?")) return;
    setRunning(true);
    try {
      const res = await execute({ data: { pairs: data.pairs.map(p => ({ src_id: p.src.id, dst_id: p.dst.id })) } });
      setResult(res);
      toast.success("Migration terminée");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <div className="p-6">Chargement…</div>;

  const p = data?.preview;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">Migration des studios — v2</h1>
        <Button variant="outline" onClick={load} disabled={running}>Recharger</Button>
      </div>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Diagnostic</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="py-1">Nom</th><th>Templates</th><th>Employés</th><th>Shifts</th><th>Profils</th><th>ID</th></tr>
          </thead>
          <tbody>
            {data?.studios.map(s => (
              <tr key={s.id} className="border-t">
                <td className="py-1">{s.name}</td>
                <td>{s.staffing_templates}</td>
                <td>{s.user_studios}</td>
                <td>{s.shifts}</td>
                <td>{s.profiles}</td>
                <td className="text-xs text-muted-foreground font-mono">{s.id.slice(0, 8)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Paires détectées (doublon → vrai)</h2>
        {data?.pairs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun doublon détecté — rien à migrer.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data?.pairs.map(p => (
              <li key={p.src.id} className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive">{p.src.name}</span>
                <ArrowRight size={14} />
                <span className="px-2 py-0.5 rounded bg-primary/10">{p.dst.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {p && data && data.pairs.length > 0 && (
        <Card className="p-4 border-yellow-500/40 bg-yellow-50 dark:bg-yellow-950/20">
          <div className="flex gap-3">
            <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <div className="font-medium">Stratégie de migration (transaction atomique)</div>
              <ul className="list-disc ml-5 space-y-1">
                <li>Supprimer les <strong>{p.totalShifts}</strong> anciens shifts (table shifts vidée)</li>
                <li>Supprimer les <strong>{p.oldTemplatesOnReal}</strong> anciens staffing_templates des vrais studios</li>
                <li>Migrer les <strong>{p.newTemplatesToMove}</strong> nouveaux staffing_templates des doublons vers les vrais studios</li>
                <li>Rebrancher les <strong>{p.employeesToMove}</strong> liens employé→studio des doublons vers les vrais</li>
                <li>Rebrancher les <strong>{p.profilesToMove}</strong> profils dont le studio principal pointe le doublon</li>
                <li>Supprimer les <strong>{data.pairs.length}</strong> studios doublons</li>
              </ul>
              <p className="text-muted-foreground">
                Tout s'exécute dans une seule transaction PostgreSQL : si une étape échoue, rollback complet.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Button onClick={run} disabled={running || !data?.pairs.length} variant="destructive">
          {running ? "Migration en cours…" : "Lancer la migration"}
        </Button>
        <Link to="/admin/demo-tools"><Button variant="outline">Retour aux outils démo</Button></Link>
      </div>

      {result && (
        <Card className="p-4 space-y-3 border-primary">
          <h2 className="font-medium">Résultat de la migration</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <Stat label="Shifts supprimés" value={(result.report as any)?.shifts_deleted} />
            <Stat label="Anciens templates supprimés" value={(result.report as any)?.old_templates_deleted} />
            <Stat label="Nouveaux templates migrés" value={(result.report as any)?.templates_moved} />
            <Stat label="Liens employés migrés" value={(result.report as any)?.user_studios_moved} />
            <Stat label="Liens dédupliqués" value={(result.report as any)?.user_studios_dedup} />
            <Stat label="Profils rebranchés" value={(result.report as any)?.profiles_moved} />
            <Stat label="Studios supprimés" value={(result.report as any)?.studios_deleted} />
          </div>
          <div>
            <h3 className="font-medium mb-1 mt-3">État final</h3>
            <ul className="text-sm space-y-1">
              {result.finalStudios.map(s => (
                <li key={s.id}>
                  <span className="font-medium">{s.name}</span> — {s.staffing_templates} templates, {s.user_studios} employés, {s.shifts} shifts, {s.profiles} profils
                </li>
              ))}
            </ul>
          </div>
          <Link to="/planning"><Button>Voir le planning <ArrowRight size={14} className="ml-1" /></Button></Link>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-medium tabular-nums">{value ?? 0}</div>
    </div>
  );
}
