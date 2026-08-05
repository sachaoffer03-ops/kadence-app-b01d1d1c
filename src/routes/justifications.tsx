import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, RefreshCw, Clock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { listJustificationsFn, reviewJustificationsFn, type JustificationRow } from "@/lib/justifications.functions";

export const Route = createFileRoute("/justifications")({
  component: JustificationsPage,
  head: () => ({
    meta: [
      { title: "Justifications de pointage — Kadence" },
      { name: "description", content: "Validez ou refusez les motifs de retard et de sortie anticipée saisis par les employés lors du pointage." },
      { property: "og:title", content: "Justifications de pointage — Kadence" },
      { property: "og:description", content: "Acceptez ou refusez en un clic les justifications de retard et de clôture des employés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "pending" | "accepted" | "refused" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "En attente" },
  { key: "accepted", label: "Acceptées" },
  { key: "refused", label: "Refusées" },
  { key: "all", label: "Toutes" },
];

function keyOf(r: JustificationRow) {
  return `${r.shift_id}:${r.kind}`;
}

function fmtDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function ecartLabel(r: JustificationRow) {
  if (r.minutes == null) return "—";
  if (r.kind === "late") return `+${r.minutes} min de retard`;
  return r.minutes < 0 ? `${Math.abs(r.minutes)} min plus tôt` : `+${r.minutes} min après la fin`;
}

function JustificationsPage() {
  const list = useServerFn(listJustificationsFn);
  const review = useServerFn(reviewJustificationsFn);
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<JustificationRow[]>([]);
  const [counts, setCounts] = useState({ pending: 0, accepted: 0, refused: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = async (t: Tab = tab) => {
    setLoading(true);
    try {
      const res = await list({ data: { status: t } });
      setRows(res.rows);
      setCounts(res.counts);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); /* eslint-disable-next-line */ }, [tab]);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map(keyOf)));
  const toggle = (k: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const decide = async (items: JustificationRow[], decision: "accepted" | "refused") => {
    if (items.length === 0) return;
    setBusy(true);
    try {
      await review({ data: { items: items.map((r) => ({ shiftId: r.shift_id, kind: r.kind })), decision } });
      toast.success(
        `${items.length} justification${items.length > 1 ? "s" : ""} ${decision === "accepted" ? "acceptée" : "refusée"}${items.length > 1 ? "s" : ""}`,
      );
      await load(tab);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(keyOf(r))), [rows, selected]);

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] md:text-[24px]" style={{ fontWeight: 500, letterSpacing: "-0.02em" }}>
            Justifications de pointage
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            Retards à l'arrivée et sorties hors horaire justifiés par les employés. Accepter neutralise l'impact sur le score, refuser le conserve.
          </p>
        </div>
        <button
          onClick={() => load(tab)}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2"
          style={{ fontSize: 12, fontWeight: 500, borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {TABS.map((t) => {
          const active = tab === t.key;
          const badge = t.key === "pending" ? counts.pending : t.key === "accepted" ? counts.accepted : t.key === "refused" ? counts.refused : undefined;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="rounded-md border px-3 py-1.5"
              style={{
                fontSize: 12,
                fontWeight: 500,
                borderColor: active ? "transparent" : "var(--border)",
                backgroundColor: active ? "var(--foreground)" : "var(--card)",
                color: active ? "var(--card)" : "var(--foreground)",
              }}
            >
              {t.label}
              {badge != null && badge > 0 ? ` · ${badge}` : ""}
            </button>
          );
        })}
      </div>

      {selectedRows.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 mt-4"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--coral-light)" }}
        >
          <span style={{ fontSize: 12, fontWeight: 500 }}>{selectedRows.length} sélectionnée{selectedRows.length > 1 ? "s" : ""}</span>
          <div className="flex gap-2 ml-auto">
            <button disabled={busy} onClick={() => decide(selectedRows, "accepted")} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--success-text)", color: "#fff" }}>
              <Check size={13} /> Tout accepter
            </button>
            <button disabled={busy} onClick={() => decide(selectedRows, "refused")} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--danger-text)", color: "#fff" }}>
              <X size={13} /> Tout refuser
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 24 }}>Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border p-8 text-center mt-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Aucune justification {tab === "pending" ? "en attente" : ""}</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>Tout est à jour.</div>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-xl border overflow-hidden mt-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: "var(--muted)" }}>
                  <Th style={{ width: 36 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </Th>
                  <Th>Employé</Th>
                  <Th>Shift</Th>
                  <Th>Rôle</Th>
                  <Th>Studio</Th>
                  <Th>Type / écart</Th>
                  <Th>Motif</Th>
                  <Th style={{ textAlign: "right" }}>Décision</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={keyOf(r)} style={{ borderTop: "1px solid var(--border)" }}>
                    <Td><input type="checkbox" checked={selected.has(keyOf(r))} onChange={() => toggle(keyOf(r))} /></Td>
                    <Td><span style={{ fontWeight: 500 }}>{r.user_name}</span></Td>
                    <Td>
                      <div>{fmtDate(r.shift_date)}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}</div>
                    </Td>
                    <Td>{r.business_role}</Td>
                    <Td>{r.studio_name ?? "—"}</Td>
                    <Td><KindBadge row={r} /></Td>
                    <Td style={{ maxWidth: 280 }}><span style={{ color: "var(--muted-foreground)" }}>{r.reason}</span></Td>
                    <Td style={{ textAlign: "right" }}><Decision row={r} busy={busy} onDecide={(d) => decide([r], d)} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden flex flex-col gap-3 mt-4">
            {rows.map((r) => (
              <div key={keyOf(r)} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{r.user_name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                      {fmtDate(r.shift_date)} · {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)} · {r.business_role}
                      {r.studio_name ? ` · ${r.studio_name}` : ""}
                    </div>
                  </div>
                  <input type="checkbox" checked={selected.has(keyOf(r))} onChange={() => toggle(keyOf(r))} />
                </div>
                <div className="mt-2"><KindBadge row={r} /></div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 8 }}>{r.reason}</div>
                <div className="mt-3"><Decision row={r} busy={busy} onDecide={(d) => decide([r], d)} /></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", ...style }}>
      {children}
    </th>
  );
}
function Td({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "10px 12px", verticalAlign: "top", ...style }}>{children}</td>;
}

function KindBadge({ row }: { row: JustificationRow }) {
  const late = row.kind === "late";
  const Icon = late ? Clock : LogOut;
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-1"
      style={{ fontSize: 11, backgroundColor: late ? "var(--warning-bg)" : "var(--muted)", color: late ? "var(--warning-text)" : "var(--foreground)" }}>
      <Icon size={12} />
      {late ? "Arrivée" : "Sortie"} · {ecartLabel(row)}
    </div>
  );
}

function Decision({ row, busy, onDecide }: { row: JustificationRow; busy: boolean; onDecide: (d: "accepted" | "refused") => void }) {
  if (row.status !== "pending") {
    const ok = row.status === "accepted";
    return (
      <div className="inline-flex items-center gap-2">
        <span className="rounded-full px-2 py-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: ok ? "var(--success-bg)" : "var(--danger-bg)", color: ok ? "var(--success-text)" : "var(--danger-text)" }}>
          {ok ? "Acceptée · score non impacté" : "Refusée · score impacté"}
        </span>
        <button onClick={() => onDecide(ok ? "refused" : "accepted")} disabled={busy} style={{ fontSize: 11, color: "var(--muted-foreground)", textDecoration: "underline" }}>
          Changer
        </button>
      </div>
    );
  }
  return (
    <div className="inline-flex gap-2">
      <button disabled={busy} onClick={() => onDecide("accepted")} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5"
        style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--success-text)", color: "#fff" }}>
        <Check size={13} /> Accepter
      </button>
      <button disabled={busy} onClick={() => onDecide("refused")} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5"
        style={{ fontSize: 12, fontWeight: 500, borderColor: "var(--border)", color: "var(--danger-text)" }}>
        <X size={13} /> Refuser
      </button>
    </div>
  );
}
