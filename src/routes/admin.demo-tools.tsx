import { createFileRoute } from "@tanstack/react-router";
import { DevOnly } from "@/components/DevOnly";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { SeederPage } from "./admin.seeder";
import { SeedDemoPage } from "./admin.seed";
import { QAPage } from "./admin.qa-test-suite";

export const Route = createFileRoute("/admin/demo-tools")({
  component: () => (
    <DevOnly label="Les outils de démo & tests">
      <DemoToolsPage />
    </DevOnly>
  ),
  head: () => ({ meta: [{ title: "Outils de démo & tests — Kadence" }] }),
});

function DemoToolsPage() {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 6 }}>
        🧪 Outils de démo & tests
      </h1>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 20 }}>
        Setup de l'environnement démo, seed des données fictives, et lancement de la QA Test Suite.
      </p>

      <div
        className="rounded-xl border p-4 mb-6 flex items-start gap-2"
        style={{
          borderColor: "#F59E0B66",
          backgroundColor: "#FFFBEB",
          color: "#92400E",
          fontSize: 12,
        }}
      >
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Attention :</strong> Les actions sur cette page modifient ou suppriment des données.
          À utiliser uniquement en environnement de démo/test.
        </div>
      </div>

      <Tabs defaultValue="seed" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="seed">🌱 Seed démo</TabsTrigger>
          <TabsTrigger value="qa">🧪 QA Test Suite</TabsTrigger>
        </TabsList>

        <TabsContent value="seed">
          <section className="mb-10">
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
              État de l'environnement démo
            </h2>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
              5 comptes démo prêts à l'emploi pour tester l'app côté admin et employé.
            </p>
            <SeedDemoPage />
          </section>

          <div style={{ height: 1, backgroundColor: "var(--border)", margin: "32px 0" }} />

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
              Actions disponibles — seed massif
            </h2>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
              Création de ~30 employés fictifs, attributions massives de rôles/studios/formations.
            </p>
            <SeederPage />
          </section>
        </TabsContent>

        <TabsContent value="qa">
          <QAPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
