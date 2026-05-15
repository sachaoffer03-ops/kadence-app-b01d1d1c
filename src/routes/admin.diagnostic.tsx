import { createFileRoute, Link } from "@tanstack/react-router";
import { DevOnly } from "@/components/DevOnly";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { runDiagnostic } from "@/lib/diagnostic.functions";

export const Route = createFileRoute("/admin/diagnostic")({
  component: () => (<DevOnly label="Le diagnostic planning"><DiagnosticPage /></DevOnly>),
  head: () => ({ meta: [{ title: "Diagnostic — Kadence" }] }),
});

const EXPECTED_TPL: Record<string, { start: string; end: string; req?: string; allowed?: string[] }> = {
  Lundi: { start: "07:00:00", end: "15:30:00", req: "CDI" },
  Mardi: { start: "07:00:00", end: "14:30:00", req: "CDI" },
  Mercredi: { start: "07:00:00", end: "14:30:00", req: "CDI" },
  Jeudi: { start: "07:00:00", end: "14:30:00", req: "CDI" },
  Vendredi: { start: "07:00:00", end: "16:30:00", req: "CDI" },
  Samedi: { start: "08:30:00", end: "15:30:00", allowed: ["CDI", "Étudiant", "Flexi"] },
  Dimanche: { start: "08:30:00", end: "15:30:00", allowed: ["CDI", "Étudiant", "Flexi"] },
};

function DiagnosticPage() {
  const run = useServerFn(runDiagnostic);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    run({ data: undefined } as any).then(setData).catch((e: any) => setErr(e?.message || "Erreur")).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Diagnostic en cours…</div>;
  if (err) return <div className="p-8" style={{ color: "#b91c1c" }}>{err}</div>;
  if (!data) return null;

  // Anomalies
  const anomalies: { level: "warn" | "crit"; msg: string }[] = [];
  // S1 check
  const tplByStudioJour = new Map<string, any>();
  for (const t of data.s1) tplByStudioJour.set(`${t.studio}|${t.jour}`, t);
  const chatStudios = Array.from(new Set(data.s1.map((t: any) => t.studio))) as string[];
  for (const studio of chatStudios) {
    if (!studio.toLowerCase().includes("châtelain") && !studio.toLowerCase().includes("chatelain")) continue;
    for (const [jour, exp] of Object.entries(EXPECTED_TPL)) {
      const t = tplByStudioJour.get(`${studio}|${jour}`);
      if (!t) { anomalies.push({ level: "crit", msg: `S1: template manquant ${studio} ${jour}` }); continue; }
      if (t.start_time !== exp.start || t.end_time !== exp.end) {
        anomalies.push({ level: "crit", msg: `S1: ${studio} ${jour} horaires ${t.start_time}-${t.end_time} ≠ attendu ${exp.start}-${exp.end}` });
      }
      if (exp.req && t.required_contract !== exp.req) {
        anomalies.push({ level: "crit", msg: `S1: ${studio} ${jour} required_contract=${t.required_contract} ≠ ${exp.req}` });
      }
      if (exp.allowed) {
        const got = (t.allowed_contracts ?? []).slice().sort().join(",");
        const want = exp.allowed.slice().sort().join(",");
        if (got !== want) anomalies.push({ level: "warn", msg: `S1: ${studio} ${jour} allowed_contracts=[${got}] ≠ [${want}]` });
      }
    }
  }
  // S2
  const expected2 = ["Marco Bianchi", "Léa Bernardi", "Karim El Amrani"];
  for (const n of expected2) if (!data.s2.find((p: any) => p.nom === n)) anomalies.push({ level: "crit", msg: `S2: profil cuisine manquant: ${n}` });
  // S3 - Marco doit avoir lun-ven
  const marcoJours = new Set(data.s3.map((a: any) => a.jour));
  for (const j of ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]) if (!marcoJours.has(j)) anomalies.push({ level: "warn", msg: `S3: Marco pas dispo ${j}` });
  if (marcoJours.has("Samedi") || marcoJours.has("Dimanche")) anomalies.push({ level: "warn", msg: `S3: Marco dispo week-end → peut être placé en WE` });
  // S4
  if (!data.s4.length) anomalies.push({ level: "crit", msg: `S4: aucune dispo Léa/Karim — week-end cuisine restera vide` });
  // S6
  if (data.s6.target.includes("solo") || data.s6.cap.toLowerCase().includes("solo")) {
    anomalies.push({ level: "warn", msg: "S6: référence à 'solo' encore présente dans target/cap" });
  }
  // S7
  const exp = { target_weekly_cdi_hours: 35, cdi_hours_tolerance: 2, max_shift_hours_cdi: 8, default_score_when_null: 7 };
  if (data.settings) {
    for (const [k, v] of Object.entries(exp)) {
      if (Number(data.settings[k]) !== v) anomalies.push({ level: "warn", msg: `S7: ${k}=${data.settings[k]} ≠ ${v}` });
    }
  }

  const crit = anomalies.filter(a => a.level === "crit").length;
  const warn = anomalies.filter(a => a.level === "warn").length;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto" style={{ fontSize: 13 }}>
      <Link to="/admin/seeder" className="flex items-center gap-1 mb-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={12} /> Retour
      </Link>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 24 }}>Diagnostic planning cuisine</h1>

      {/* Verdict */}
      <Card>
        <Title>Diagnostic global</Title>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>
          {crit > 0 ? "🔴 Anomalies critiques à investiguer" : warn > 0 ? "🟡 Anomalies mineures à corriger" : "🟢 Pas d'anomalie détectée"}
        </div>
        {anomalies.length === 0 ? <div style={{ color: "var(--muted-foreground)" }}>Tout correspond aux attendus.</div> : (
          <ul style={{ paddingLeft: 16 }}>
            {anomalies.map((a, i) => (
              <li key={i} style={{ color: a.level === "crit" ? "#b91c1c" : "#a16207", marginBottom: 4 }}>
                {a.level === "crit" ? "🔴" : "🟡"} {a.msg}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* S1 */}
      <Card>
        <Title>1. Staffing templates cuisine</Title>
        <Table headers={["Studio", "Jour", "Début", "Fin", "Durée", "Req", "Allowed", "Conformité"]}
          rows={data.s1.map((t: any) => {
            const exp = EXPECTED_TPL[t.jour];
            const isChat = t.studio.toLowerCase().includes("châtelain") || t.studio.toLowerCase().includes("chatelain");
            let ok = true;
            if (isChat && exp) {
              if (t.start_time !== exp.start || t.end_time !== exp.end) ok = false;
              if (exp.req && t.required_contract !== exp.req) ok = false;
            }
            return [t.studio, t.jour, t.start_time, t.end_time, `${t.duree_heures}h`, t.required_contract ?? "—", (t.allowed_contracts ?? []).join(",") || "—", ok ? <Badge ok /> : <Badge />];
          })}
        />
      </Card>

      {/* S2 */}
      <Card>
        <Title>2. Profils cuisine</Title>
        <Table headers={["Nom", "Email", "Contrats", "Rôles", "Studios", "Score", "Status", "Test"]}
          rows={data.s2.map((p: any) => [p.nom, p.email, (p.contrats ?? []).join(","), (p.roles ?? []).join(","), (p.studios ?? []).join(","), p.score ?? "—", p.status, p.is_test ? "✓" : ""])}
        />
      </Card>

      {/* S3 */}
      <Card>
        <Title>3. Dispos Marco — semaine 1er juin 2026</Title>
        {data.s3.length === 0 ? <Empty>Aucune dispo Marco</Empty> :
          <Table headers={["Date", "Jour", "Début", "Fin", "Durée"]} rows={data.s3.map((a: any) => [a.avail_date, a.jour, a.start_time, a.end_time, `${a.duree}h`])} />}
      </Card>

      {/* S4 */}
      <Card>
        <Title>4. Dispos Léa & Karim — semaine 1er juin 2026</Title>
        {data.s4.length === 0 ? <Empty>Aucune dispo trouvée pour Léa et Karim sur cette semaine</Empty> :
          <Table headers={["Nom", "Date", "Jour", "Début", "Fin"]} rows={data.s4.map((a: any) => [a.nom, a.avail_date, a.jour, a.start_time, a.end_time])} />}
      </Card>

      {/* S5 */}
      <Card>
        <Title>5. Shifts Marco écrits (1-7 juin)</Title>
        {data.s5.length === 0 ? <Empty>Aucun shift écrit (probablement dry_run uniquement)</Empty> :
          <Table headers={["Date", "Jour", "Début", "Fin", "Rôle", "Studio", "Durée"]} rows={data.s5.map((s: any) => [s.shift_date, s.jour, s.start_time, s.end_time, s.business_role, s.studio, `${s.duree}h`])} />}
      </Card>

      {/* S6 */}
      <Card>
        <Title>6. Extraits du moteur ({data.s6.path})</Title>
        <Sub>Bloc target_weekly_cdi_hours</Sub>
        <Pre>{data.s6.target || "—"}</Pre>
        <Sub>Bloc kitchen_solo</Sub>
        <Pre>{data.s6.solo || "—"}</Pre>
        <Sub>Bloc max_shift_hours_cdi</Sub>
        <Pre>{data.s6.cap || "—"}</Pre>
      </Card>

      {/* S7 */}
      <Card>
        <Title>7. Settings IA actuels</Title>
        {data.settings ? (
          <Table headers={["Clé", "Valeur", "Attendu", "OK"]} rows={[
            ["target_weekly_cdi_hours", data.settings.target_weekly_cdi_hours, 35, Number(data.settings.target_weekly_cdi_hours) === 35 ? <Badge ok /> : <Badge />],
            ["cdi_hours_tolerance", data.settings.cdi_hours_tolerance, 2, Number(data.settings.cdi_hours_tolerance) === 2 ? <Badge ok /> : <Badge />],
            ["max_weekly_cdi_hours", data.settings.max_weekly_cdi_hours, 48, ""],
            ["max_shift_hours_cdi", data.settings.max_shift_hours_cdi, 8, Number(data.settings.max_shift_hours_cdi) === 8 ? <Badge ok /> : <Badge />],
            ["default_score_when_null", data.settings.default_score_when_null, 7, Number(data.settings.default_score_when_null) === 7 ? <Badge ok /> : <Badge />],
          ]} />
        ) : <Empty>Aucun settings</Empty>}
      </Card>
    </div>
  );
}

function Card({ children }: any) { return <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>{children}</div>; }
function Title({ children }: any) { return <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>{children}</div>; }
function Sub({ children }: any) { return <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 10, marginBottom: 4 }}>{children}</div>; }
function Empty({ children }: any) { return <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{children}</div>; }
function Pre({ children }: any) { return <pre style={{ fontFamily: "monospace", fontSize: 11, padding: 10, background: "var(--muted)", borderRadius: 6, overflowX: "auto", whiteSpace: "pre" }}>{children}</pre>; }
function Badge({ ok }: { ok?: boolean }) {
  return ok
    ? <span className="inline-flex items-center gap-1" style={{ color: "#16a34a", fontSize: 11 }}><CheckCircle2 size={12} /> ✅</span>
    : <span className="inline-flex items-center gap-1" style={{ color: "#b91c1c", fontSize: 11 }}><XCircle size={12} /> ❌</span>;
}
function Table({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead><tr>{headers.map((h, i) => <th key={i} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "0.5px solid var(--border)", fontWeight: 500, color: "var(--muted-foreground)", fontSize: 11 }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: "6px 8px", borderBottom: "0.5px solid var(--border)" }}>{c as any}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
