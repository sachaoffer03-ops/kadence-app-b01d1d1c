import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Check, X, ChevronDown, Send, Clock, Search,
  AlertCircle, CalendarX, ArrowRightLeft, Ban, Inbox, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendReplacementProposals, cancelProposals } from "@/lib/proposals.functions";
import {
  getDemandesData,
  acceptCancelRequest,
  acceptTimeChangeRequest,
  acceptUnavailabilityRequest,
  refuseRequest,
} from "@/lib/demandes.functions";

export const Route = createFileRoute("/demandes")({
  component: DemandesPage,
  head: () => ({ meta: [{ title: "Demandes de modification — Kadence" }] }),
});

type Urgency = "normal" | "urgent" | "critique";
type Status = "pending" | "accepted" | "refused";
type ReqType = "cancel" | "time_change" | "unavailable" | "swap";

interface Row {
  id: string; user_id: string; shift_id: string | null;
  type: ReqType; reason: string; urgency: Urgency; status: Status;
  created_at: string; resolved_at: string | null;
  admin_response: string | null;
  proposed_start_time: string | null; proposed_end_time: string | null;
  proposed_start_date: string | null; proposed_end_date: string | null;
}
interface ProfileLite { id: string; first_name: string; last_name: string; status: string; }
interface ShiftLite { id: string; shift_date: string; start_time: string; end_time: string; business_role: string; studio_id: string | null; }
interface Proposal {
  id: string; shift_id: string; user_id: string; status: string; sent_at: string;
  responded_at: string | null; replacement_request_id: string | null;
}

const urgencyStyles: Record<Urgency, { bg: string; text: string; label: string }> = {
  critique: { bg: "var(--danger-bg)", text: "var(--danger-text)", label: "Critique" },
  urgent: { bg: "var(--warning-bg)", text: "var(--warning-text)", label: "Urgent" },
  normal: { bg: "var(--muted)", text: "var(--muted-foreground)", label: "Normal" },
};
const TYPE_META: Record<ReqType, { label: string; icon: typeof CalendarX }> = {
  cancel: { label: "Annulation", icon: Ban },
  time_change: { label: "Changement d'horaire", icon: ArrowRightLeft },
  unavailable: { label: "Indisponibilité", icon: CalendarX },
  swap: { label: "Échange", icon: ArrowRightLeft },
};
const formatTime = (t: string) => t.slice(0, 5).replace(":", "h");
const formatDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

function elapsed(sentAt: string): string {
  const ms = Date.now() - new Date(sentAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const h = ms / 3600000;
  if (h < 1) return `${Math.round(ms / 60000)}min`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}j`;
}

function DemandesPage() {
  const [requests, setRequests] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [shifts, setShifts] = useState<Record<string, ShiftLite>>({});
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [kpis, setKpis] = useState({ pending: 0, urgent: 0, treatedToday: 0, avgResolutionMs: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  // pour les demandes unavailable : sélection par shift (clé = `${reqId}:${shiftId}`)
  const [selectedShift, setSelectedShift] = useState<Record<string, Set<string>>>({});
  const [openShiftPanel, setOpenShiftPanel] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);

  // Modals
  const [timeChangeModal, setTimeChangeModal] = useState<Row | null>(null);
  const [timeChangeStart, setTimeChangeStart] = useState("");
  const [timeChangeEnd, setTimeChangeEnd] = useState("");
  const [refuseModal, setRefuseModal] = useState<Row | null>(null);
  const [refuseReason, setRefuseReason] = useState("");

  const sendFn = useServerFn(sendReplacementProposals);
  const cancelFn = useServerFn(cancelProposals);
  const loadFn = useServerFn(getDemandesData);
  const acceptCancelFn = useServerFn(acceptCancelRequest);
  const acceptTimeFn = useServerFn(acceptTimeChangeRequest);
  const acceptUnavailFn = useServerFn(acceptUnavailabilityRequest);
  const refuseFn = useServerFn(refuseRequest);

  const loadAll = async () => {
    try {
      const d = await loadFn({ data: {} });
      setRequests(d.requests as Row[]);
      setProfiles(Object.fromEntries((d.profiles as ProfileLite[]).map((p) => [p.id, p])));
      setShifts(Object.fromEntries((d.shifts as ShiftLite[]).map((s) => [s.id, s])));
      setProposals(d.proposals as Proposal[]);
      setKpis(d.kpis);
    } catch (e: any) {
      toast.error(e.message || "Erreur chargement");
    }
  };

  useEffect(() => {
    loadAll();
    const ch = supabase.channel("demandes-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "modification_requests" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_proposals" }, loadAll)
      .subscribe();
    const tick = setInterval(() => force((n) => n + 1), 30000);
    return () => { supabase.removeChannel(ch); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const order: Record<Urgency, number> = { critique: 0, urgent: 1, normal: 2 };
  const pending = requests.filter(r => r.status === "pending").sort((a, b) => order[a.urgency] - order[b.urgency]);
  const handled = requests.filter(r => r.status !== "pending").slice(0, 20);

  const allEmployees = useMemo(() =>
    Object.values(profiles).filter((p) => p.status === "active")
      .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)),
    [profiles],
  );

  const propsByRequest = useMemo(() => {
    const m: Record<string, Proposal[]> = {};
    for (const p of proposals) {
      if (!p.replacement_request_id) continue;
      (m[p.replacement_request_id] ||= []).push(p);
    }
    return m;
  }, [proposals]);

  const toggleSelect = (reqId: string, uid: string) => {
    setSelected((prev) => {
      const cur = new Set(prev[reqId] || []);
      cur.has(uid) ? cur.delete(uid) : cur.add(uid);
      return { ...prev, [reqId]: cur };
    });
  };

  const sendProposals = async (reqId: string) => {
    const ids = Array.from(selected[reqId] || []);
    if (ids.length === 0) { toast.error("Sélectionnez au moins un employé"); return; }
    setBusy(true);
    try {
      const r = await sendFn({ data: { requestId: reqId, userIds: ids } });
      toast.success(`${r.count} proposition${r.count > 1 ? "s" : ""} envoyée${r.count > 1 ? "s" : ""}`);
      setSelected((prev) => ({ ...prev, [reqId]: new Set() }));
      loadAll();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setBusy(false); }
  };

  const cancelOne = async (proposalId: string) => {
    setBusy(true);
    try { await cancelFn({ data: { proposalIds: [proposalId] } }); toast("Annulée"); loadAll(); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setBusy(false); }
  };

  const toggleSelectShift = (reqId: string, shiftId: string, uid: string) => {
    const key = `${reqId}:${shiftId}`;
    setSelectedShift((prev) => {
      const cur = new Set(prev[key] || []);
      cur.has(uid) ? cur.delete(uid) : cur.add(uid);
      return { ...prev, [key]: cur };
    });
  };

  const sendProposalsForShift = async (reqId: string, shiftId: string) => {
    const key = `${reqId}:${shiftId}`;
    const ids = Array.from(selectedShift[key] || []);
    if (ids.length === 0) { toast.error("Sélectionnez au moins un employé"); return; }
    setBusy(true);
    try {
      const r = await sendFn({ data: { requestId: reqId, userIds: ids, shiftId } });
      toast.success(`${r.count} proposition${r.count > 1 ? "s" : ""} envoyée${r.count > 1 ? "s" : ""}`);
      setSelectedShift((prev) => ({ ...prev, [key]: new Set() }));
      setOpenShiftPanel((prev) => ({ ...prev, [key]: false }));
      loadAll();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setBusy(false); }
  };


  const acceptCancel = async (req: Row) => {
    setBusy(true);
    try {
      await acceptCancelFn({ data: { requestId: req.id, findReplacement: false } });
      toast.success("Annulation acceptée — shift libéré");
      setExpandedId(null);
      loadAll();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setBusy(false); }
  };

  const openTimeChange = (req: Row) => {
    setTimeChangeModal(req);
    setTimeChangeStart((req.proposed_start_time ?? "").slice(0, 5));
    setTimeChangeEnd((req.proposed_end_time ?? "").slice(0, 5));
  };

  const confirmTimeChange = async () => {
    if (!timeChangeModal) return;
    if (!timeChangeStart || !timeChangeEnd) { toast.error("Horaires requis"); return; }
    if (timeChangeStart >= timeChangeEnd) { toast.error("Fin doit être après début"); return; }
    setBusy(true);
    try {
      await acceptTimeFn({ data: {
        requestId: timeChangeModal.id,
        finalStart: timeChangeStart,
        finalEnd: timeChangeEnd,
      } });
      toast.success("Horaire mis à jour");
      setTimeChangeModal(null);
      setExpandedId(null);
      loadAll();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setBusy(false); }
  };

  const acceptUnavail = async (req: Row) => {
    setBusy(true);
    try {
      await acceptUnavailFn({ data: { requestId: req.id } });
      toast.success("Indisponibilité enregistrée");
      setExpandedId(null);
      loadAll();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setBusy(false); }
  };

  const openRefuse = (req: Row) => {
    setRefuseModal(req);
    setRefuseReason("");
  };

  const confirmRefuse = async () => {
    if (!refuseModal) return;
    if (!refuseReason.trim()) { toast.error("Motif requis"); return; }
    setBusy(true);
    try {
      const propIds = (propsByRequest[refuseModal.id] || []).filter((p) => p.status === "pending").map((p) => p.id);
      if (propIds.length > 0) {
        try { await cancelFn({ data: { proposalIds: propIds } }); } catch { /* ignore */ }
      }
      await refuseFn({ data: { requestId: refuseModal.id, response: refuseReason.trim() } });
      toast.success("Demande refusée");
      setRefuseModal(null);
      setExpandedId(null);
      loadAll();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Demandes de modification</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Annulations, changements d'horaire et indisponibilités à venir
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={Inbox} label="En attente" value={kpis.pending.toString()} accent="var(--foreground)" />
        <KpiCard icon={AlertCircle} label="Urgentes" value={kpis.urgent.toString()} accent={kpis.urgent > 0 ? "var(--danger-text)" : "var(--muted-foreground)"} />
        <KpiCard icon={Check} label="Traitées aujourd'hui" value={kpis.treatedToday.toString()} accent="var(--success-text)" />
        <KpiCard icon={TrendingUp} label="Temps moyen (30j)" value={formatDuration(kpis.avgResolutionMs)} accent="var(--muted-foreground)" />
      </div>

      {pending.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--success-text)" }}>Aucune demande en attente</div>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden mb-8" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          {pending.map(req => {
            const isExpanded = expandedId === req.id;
            const emp = profiles[req.user_id];
            const sh = req.shift_id ? shifts[req.shift_id] : null;
            const urg = urgencyStyles[req.urgency];
            const initials = emp ? `${emp.first_name?.[0] || ""}${emp.last_name?.[0] || ""}`.toUpperCase() : "—";
            const reqProps = propsByRequest[req.id] || [];
            const pendingProps = reqProps.filter((p) => p.status === "pending");
            const hasShift = !!sh;
            const sel = selected[req.id] || new Set<string>();
            const TypeIcon = (TYPE_META[req.type] || TYPE_META.cancel).icon;
            const filteredEmps = allEmployees.filter((e) =>
              e.id !== req.user_id &&
              !reqProps.some((p) => p.user_id === e.id && p.status === "pending") &&
              `${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()),
            );

            return (
              <div key={req.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                <div className="grid px-5 py-3 items-center gap-2"
                  style={{ gridTemplateColumns: "1fr 180px 160px 160px 40px", cursor: "pointer" }}
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 30, height: 30, backgroundColor: "var(--muted)", fontSize: 10, fontWeight: 500 }}>{initials}</div>
                    <div className="min-w-0">
                      <div style={{ fontSize: 13, fontWeight: 500 }} className="truncate">{emp ? `${emp.first_name} ${emp.last_name}` : "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }} className="truncate">{elapsed(req.created_at)}</div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    {req.type === "unavailable" && req.proposed_start_date ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{formatDate(req.proposed_start_date)}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>→ {req.proposed_end_date ? formatDate(req.proposed_end_date) : "—"}</div>
                      </>
                    ) : sh ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{formatDate(sh.shift_date)}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{formatTime(sh.start_time)} — {formatTime(sh.end_time)}</div>
                      </>
                    ) : <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Sans shift</span>}
                  </div>
                  <div className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                    <TypeIcon size={13} style={{ color: "var(--muted-foreground)" }} />
                    {(TYPE_META[req.type] || TYPE_META.cancel).label}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: urg.bg, color: urg.text }}>{urg.label}</span>
                    {pendingProps.length > 0 && (
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--coral-bg, #FCE8E0)", color: "var(--coral-dark, #B85A3C)" }}>
                        {pendingProps.length} en attente
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end">
                    <ChevronDown size={14} style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-4" style={{ backgroundColor: "var(--muted)" }}>
                    <div className="rounded-lg p-4 mb-3" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Motif</div>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>"{req.reason}"</div>

                      {req.type === "time_change" && req.proposed_start_time && req.proposed_end_time && (
                        <div className="mt-3 flex items-center gap-2" style={{ fontSize: 12 }}>
                          <span style={{ color: "var(--muted-foreground)" }}>Créneau proposé :</span>
                          <span style={{ fontWeight: 500 }}>{formatTime(req.proposed_start_time)} — {formatTime(req.proposed_end_time)}</span>
                          {sh && <span style={{ color: "var(--muted-foreground)" }}>(actuel : {formatTime(sh.start_time)} — {formatTime(sh.end_time)})</span>}
                        </div>
                      )}
                    </div>

                    {/* UNAVAILABLE — bloc par shift de la période */}
                    {req.type === "unavailable" && req.proposed_start_date && req.proposed_end_date && (() => {
                      const periodShifts = Object.values(shifts)
                        .filter((s) => s.shift_date >= req.proposed_start_date! && s.shift_date <= req.proposed_end_date!)
                        .filter((s) => {
                          // shift appartient à l'employé de la demande OU a été transféré (proposition acceptée pour ce shift+req)
                          const props = (propsByRequest[req.id] || []).filter((p) => p.shift_id === s.id);
                          const acceptedHere = props.find((p) => p.status === "accepted");
                          const ownedByEmp = (s as any).user_id === req.user_id;
                          return ownedByEmp || !!acceptedHere;
                        })
                        .sort((a, b) => (a.shift_date + a.start_time).localeCompare(b.shift_date + b.start_time));
                      const allReplaced = periodShifts.length > 0 && periodShifts.every((s) =>
                        (propsByRequest[req.id] || []).some((p) => p.shift_id === s.id && p.status === "accepted"),
                      );
                      return (
                        <div className="rounded-lg p-4 mb-3" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                          <div className="flex items-center justify-between mb-3">
                            <div style={{ fontSize: 12, fontWeight: 500 }}>
                              Shifts à remplacer ({periodShifts.length})
                            </div>
                            {allReplaced && (
                              <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
                                Tous remplacés
                              </span>
                            )}
                          </div>
                          {periodShifts.length === 0 ? (
                            <div className="text-center py-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                              Aucun shift planifié sur cette période.
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {periodShifts.map((s) => {
                                const props = (propsByRequest[req.id] || []).filter((p) => p.shift_id === s.id);
                                const accepted = props.find((p) => p.status === "accepted");
                                const pendingForShift = props.filter((p) => p.status === "pending");
                                const key = `${req.id}:${s.id}`;
                                const isOpen = !!openShiftPanel[key];
                                const sel = selectedShift[key] || new Set<string>();
                                const candidates = allEmployees.filter((e) =>
                                  e.id !== req.user_id &&
                                  !pendingForShift.some((p) => p.user_id === e.id),
                                );
                                return (
                                  <div key={s.id} className="rounded-md" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--muted)" }}>
                                    <div className="flex items-center gap-2 px-3 py-2" style={{ fontSize: 12 }}>
                                      <div className="flex-1 min-w-0">
                                        <div style={{ fontWeight: 500 }}>{formatDate(s.shift_date)} · {formatTime(s.start_time)}–{formatTime(s.end_time)}</div>
                                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.business_role}</div>
                                      </div>
                                      {accepted ? (
                                        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
                                          ✓ {profiles[accepted.user_id]?.first_name ?? "Remplaçant"}
                                        </span>
                                      ) : pendingForShift.length > 0 ? (
                                        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
                                          {pendingForShift.length} en attente
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => setOpenShiftPanel((p) => ({ ...p, [key]: !isOpen }))}
                                          className="rounded-md px-3 py-1"
                                          style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
                                        >
                                          {isOpen ? "Annuler" : "Trouver un remplaçant"}
                                        </button>
                                      )}
                                    </div>
                                    {pendingForShift.length > 0 && (
                                      <div className="px-3 pb-2 flex flex-col gap-1">
                                        {pendingForShift.map((p) => (
                                          <div key={p.id} className="flex items-center gap-2 px-2 py-1 rounded" style={{ fontSize: 11, backgroundColor: "var(--card)" }}>
                                            <span className="flex-1 truncate">{profiles[p.user_id] ? `${profiles[p.user_id].first_name} ${profiles[p.user_id].last_name}` : "—"}</span>
                                            <span style={{ color: "var(--muted-foreground)" }}>{elapsed(p.sent_at)}</span>
                                            <button onClick={() => cancelOne(p.id)} disabled={busy} style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Annuler</button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {isOpen && !accepted && pendingForShift.length === 0 && (
                                      <div className="px-3 pb-3">
                                        <div className="rounded-md max-h-40 overflow-y-auto mb-2" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
                                          {candidates.map((e) => {
                                            const isSel = sel.has(e.id);
                                            return (
                                              <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer" style={{ fontSize: 12, borderBottom: "0.5px solid var(--border)" }}>
                                                <input type="checkbox" checked={isSel} onChange={() => toggleSelectShift(req.id, s.id, e.id)} />
                                                <span>{e.first_name} {e.last_name}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                        <button
                                          onClick={() => sendProposalsForShift(req.id, s.id)}
                                          disabled={busy || sel.size === 0}
                                          className="rounded-md px-3 py-1.5 flex items-center gap-1.5"
                                          style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)", opacity: sel.size === 0 ? 0.4 : 1 }}
                                        >
                                          <Send size={11} /> Envoyer ({sel.size})
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Replacement search — available for any type with a shift */}
                    {hasShift && (
                      <div className="rounded-lg p-4 mb-3" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>
                          {pendingProps.length > 0 ? "Recherche de remplaçant en cours" : "Trouver un remplaçant (optionnel)"}
                        </div>
                        <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.5 }}>
                          {pendingProps.length > 0
                            ? "Si un employé accepte, le shift lui sera transféré automatiquement et la demande sera marquée acceptée. Vous pouvez aussi annuler les propositions pour reprendre la main."
                            : req.type === "cancel"
                              ? "Envoyez la proposition à d'autres employés. Si quelqu'un accepte, le shift lui est transféré automatiquement."
                              : req.type === "time_change"
                                ? "Si vous trouvez un remplaçant, le shift d'origine sera transféré (vous pourrez ensuite proposer un autre créneau à l'employé)."
                                : "Si vous trouvez un remplaçant, le shift lui sera transféré automatiquement."}
                        </p>

                        {reqProps.length > 0 && (
                          <div className="mb-3">
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Propositions envoyées</div>
                            <div className="flex flex-col gap-1">
                              {reqProps.map((p) => {
                                const u = profiles[p.user_id];
                                const name = u ? `${u.first_name} ${u.last_name}` : "—";
                                const statusColor = p.status === "accepted" ? { bg: "var(--success-bg)", t: "var(--success-text)" }
                                  : p.status === "declined" ? { bg: "var(--danger-bg)", t: "var(--danger-text)" }
                                  : p.status === "pending" ? { bg: "var(--warning-bg)", t: "var(--warning-text)" }
                                  : { bg: "var(--muted)", t: "var(--muted-foreground)" };
                                const statusLabel = p.status === "accepted" ? "Accepté"
                                  : p.status === "declined" ? "Refusé"
                                  : p.status === "pending" ? "En attente"
                                  : p.status === "expired" ? "Expirée"
                                  : "Annulée";
                                return (
                                  <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md" style={{ fontSize: 12, backgroundColor: "var(--muted)" }}>
                                    <div className="flex-1 truncate">{name}</div>
                                    <div className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                                      <Clock size={10} /> {elapsed(p.sent_at)}
                                    </div>
                                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: statusColor.bg, color: statusColor.t }}>{statusLabel}</span>
                                    {p.status === "pending" && (
                                      <button onClick={() => cancelOne(p.id)} disabled={busy}
                                        style={{ fontSize: 10, color: "var(--muted-foreground)", padding: "2px 6px" }}>
                                        Annuler
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {pendingProps.length > 0 && (
                              <button
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await cancelFn({ data: { proposalIds: pendingProps.map((p) => p.id) } });
                                    toast("Propositions annulées");
                                    loadAll();
                                  } catch (e: any) { toast.error(e.message || "Erreur"); }
                                  finally { setBusy(false); }
                                }}
                                disabled={busy}
                                className="mt-2 rounded-md px-3 py-1.5"
                                style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)" }}
                              >
                                Annuler toutes les propositions en attente
                              </button>
                            )}
                          </div>
                        )}

                        {pendingProps.length === 0 && (
                          <>
                            <div className="flex items-center gap-2 mb-2 rounded-md px-2 py-1.5" style={{ border: "0.5px solid var(--border)" }}>
                              <Search size={12} style={{ color: "var(--muted-foreground)" }} />
                              <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Rechercher un employé"
                                style={{ fontSize: 12, outline: "none", background: "transparent", flex: 1 }}
                              />
                            </div>
                            <div className="rounded-md mb-3 max-h-44 overflow-y-auto" style={{ border: "0.5px solid var(--border)" }}>
                              {filteredEmps.length === 0 ? (
                                <div className="py-3 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun employé</div>
                              ) : filteredEmps.map((e) => {
                                const isSel = sel.has(e.id);
                                return (
                                  <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer" style={{ fontSize: 12, borderBottom: "0.5px solid var(--border)" }}>
                                    <input type="checkbox" checked={isSel} onChange={() => toggleSelect(req.id, e.id)} />
                                    <span>{e.first_name} {e.last_name}</span>
                                  </label>
                                );
                              })}
                            </div>

                            <button onClick={() => sendProposals(req.id)} disabled={busy || sel.size === 0}
                              className="rounded-md px-4 py-2 flex items-center gap-1.5"
                              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)", opacity: sel.size === 0 ? 0.4 : 1 }}>
                              <Send size={12} /> Envoyer la proposition ({sel.size})
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Action bar — hidden when active replacement search is in progress */}
                    {pendingProps.length === 0 && (
                      <div className="rounded-lg p-4" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8 }}>
                          {req.type === "cancel" && hasShift && "Accepter libère le shift. Refuser ferme la demande."}
                          {req.type === "time_change" && "Accepter met à jour les horaires du shift."}
                          {req.type === "unavailable" && "Accepter enregistre l'indisponibilité et libère les shifts assignés sur la période."}
                          {req.type === "cancel" && !hasShift && "Aucun shift à libérer — répondez directement."}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {req.type === "cancel" && (
                            <button onClick={() => acceptCancel(req)} disabled={busy}
                              className="rounded-md px-4 py-2 flex items-center gap-1.5"
                              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                              <Check size={14} /> Accepter l'annulation
                            </button>
                          )}
                          {req.type === "time_change" && (
                            <button onClick={() => openTimeChange(req)} disabled={busy}
                              className="rounded-md px-4 py-2 flex items-center gap-1.5"
                              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                              <Check size={14} /> Accepter le changement
                            </button>
                          )}
                          {req.type === "unavailable" && (
                            <button onClick={() => acceptUnavail(req)} disabled={busy}
                              className="rounded-md px-4 py-2 flex items-center gap-1.5"
                              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                              <Check size={14} /> Enregistrer l'indispo
                            </button>
                          )}
                          <button onClick={() => openRefuse(req)} disabled={busy}
                            className="rounded-md px-4 py-2 flex items-center gap-1.5"
                            style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>
                            <X size={14} /> Refuser
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {handled.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 10 }}>Traitées récemment</div>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            {handled.map((req, i) => {
              const emp = profiles[req.user_id];
              return (
                <div key={req.id} className="flex items-center gap-4 px-5 py-3"
                  style={{ borderBottom: i < handled.length - 1 ? "0.5px solid var(--border)" : "none", opacity: 0.6 }}>
                  <div className="flex-1">
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{emp ? `${emp.first_name} ${emp.last_name}` : "—"}</span>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}> · {(TYPE_META[req.type] || TYPE_META.cancel).label}</span>
                  </div>
                  <span className="rounded-full px-2 py-0.5" style={{
                    fontSize: 10, fontWeight: 500,
                    backgroundColor: req.status === "accepted" ? "var(--success-bg)" : "var(--danger-bg)",
                    color: req.status === "accepted" ? "var(--success-text)" : "var(--danger-text)",
                  }}>
                    {req.status === "accepted" ? "Acceptée" : "Refusée"}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal: time change */}
      {timeChangeModal && (
        <Modal title="Valider le nouveau créneau" onClose={() => setTimeChangeModal(null)}>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
            Vous pouvez ajuster les horaires avant validation. Le shift sera mis à jour immédiatement.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Début</label>
              <input type="time" value={timeChangeStart} onChange={(e) => setTimeChangeStart(e.target.value)}
                className="w-full rounded-md px-3 py-2" style={{ fontSize: 13, border: "0.5px solid var(--border)" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Fin</label>
              <input type="time" value={timeChangeEnd} onChange={(e) => setTimeChangeEnd(e.target.value)}
                className="w-full rounded-md px-3 py-2" style={{ fontSize: 13, border: "0.5px solid var(--border)" }} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setTimeChangeModal(null)} disabled={busy}
              className="rounded-md px-4 py-2" style={{ fontSize: 12, border: "0.5px solid var(--border)" }}>
              Annuler
            </button>
            <button onClick={confirmTimeChange} disabled={busy}
              className="rounded-md px-4 py-2" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              Confirmer
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: refuse */}
      {refuseModal && (
        <Modal title="Refuser la demande" onClose={() => setRefuseModal(null)}>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
            Indiquez le motif du refus. L'employé sera notifié.
          </p>
          <textarea
            value={refuseReason}
            onChange={(e) => setRefuseReason(e.target.value)}
            placeholder="Motif du refus"
            rows={4}
            className="w-full rounded-md px-3 py-2 mb-4"
            style={{ fontSize: 13, border: "0.5px solid var(--border)", resize: "vertical" }}
          />
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setRefuseModal(null)} disabled={busy}
              className="rounded-md px-4 py-2" style={{ fontSize: 12, border: "0.5px solid var(--border)" }}>
              Annuler
            </button>
            <button onClick={confirmRefuse} disabled={busy || !refuseReason.trim()}
              className="rounded-md px-4 py-2"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--danger-text)", color: "var(--card)", opacity: refuseReason.trim() ? 1 : 0.4 }}>
              Refuser
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: typeof Inbox; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} style={{ color: "var(--muted-foreground)" }} />
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, color: accent }}>{value}</div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl"
        style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)", maxWidth: 460, width: "100%", padding: 20 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: 15, fontWeight: 500 }}>{title}</h2>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
