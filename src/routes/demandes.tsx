import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, ChevronDown, Send, Clock, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendReplacementProposals, cancelProposals } from "@/lib/proposals.functions";

export const Route = createFileRoute("/demandes")({
  component: DemandesPage,
  head: () => ({ meta: [{ title: "Demandes de modification — Kadence" }] }),
});

type Urgency = "normal" | "urgent" | "critique";
type Status = "pending" | "accepted" | "refused";
type ReqType = "swap" | "cancel" | "time_change";

interface Row {
  id: string; user_id: string; shift_id: string | null;
  type: ReqType; reason: string; urgency: Urgency; status: Status;
  created_at: string; admin_response: string | null;
}
interface ProfileLite { id: string; first_name: string; last_name: string; status: string; }
interface ShiftLite { id: string; shift_date: string; start_time: string; end_time: string; business_role: string; studio_id: string | null; }
interface Proposal {
  id: string; user_id: string; status: string; sent_at: string;
  responded_at: string | null; replacement_request_id: string | null;
}

const urgencyStyles: Record<Urgency, { bg: string; text: string; label: string }> = {
  critique: { bg: "var(--danger-bg)", text: "var(--danger-text)", label: "Critique" },
  urgent: { bg: "var(--warning-bg)", text: "var(--warning-text)", label: "Urgent" },
  normal: { bg: "var(--muted)", text: "var(--muted-foreground)", label: "Normal" },
};
const TYPE_LABEL: Record<ReqType, string> = { swap: "Échange", cancel: "Annulation", time_change: "Changement d'horaire" };
const formatTime = (t: string) => t.slice(0, 5).replace(":", "h");

function elapsed(sentAt: string): string {
  const ms = Date.now() - new Date(sentAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

function DemandesPage() {
  const [requests, setRequests] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [shifts, setShifts] = useState<Record<string, ShiftLite>>({});
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);

  const sendFn = useServerFn(sendReplacementProposals);
  const cancelFn = useServerFn(cancelProposals);

  const loadAll = async () => {
    const [{ data: rs }, { data: ps }, { data: ss }, { data: prs }] = await Promise.all([
      supabase.from("modification_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,first_name,last_name,status"),
      supabase.from("shifts").select("id,shift_date,start_time,end_time,business_role,studio_id"),
      supabase.from("shift_proposals").select("id,user_id,status,sent_at,responded_at,replacement_request_id").not("replacement_request_id", "is", null),
    ]);
    if (rs) setRequests(rs as Row[]);
    if (ps) setProfiles(Object.fromEntries(ps.map((p) => [p.id, p as ProfileLite])));
    if (ss) setShifts(Object.fromEntries(ss.map((s) => [s.id, s as ShiftLite])));
    if (prs) setProposals(prs as Proposal[]);
  };

  useEffect(() => {
    loadAll();
    const ch = supabase.channel("demandes-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "modification_requests" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_proposals" }, loadAll)
      .subscribe();
    const tick = setInterval(() => force((n) => n + 1), 30000);
    return () => { supabase.removeChannel(ch); clearInterval(tick); };
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

  const refuse = async (id: string) => {
    setBusy(true);
    const propIds = (propsByRequest[id] || []).filter((p) => p.status === "pending").map((p) => p.id);
    if (propIds.length > 0) {
      try { await cancelFn({ data: { proposalIds: propIds } }); } catch { /* ignore */ }
    }
    const { error } = await supabase.from("modification_requests").update({
      status: "refused", resolved_at: new Date().toISOString(),
    }).eq("id", id);
    setBusy(false);
    if (error) { toast.error("Erreur"); return; }
    setExpandedId(null);
    toast.success("Demande refusée");
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Demandes de modification</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          {pending.length} demande{pending.length > 1 ? "s" : ""} en attente
        </p>
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
            const filteredEmps = allEmployees.filter((e) =>
              e.id !== req.user_id &&
              !reqProps.some((p) => p.user_id === e.id && p.status === "pending") &&
              `${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()),
            );

            return (
              <div key={req.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                <div className="grid px-5 py-3 items-center"
                  style={{ gridTemplateColumns: "1fr 160px 120px 140px 60px", cursor: "pointer" }}
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 30, height: 30, backgroundColor: "var(--muted)", fontSize: 10, fontWeight: 500 }}>{initials}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{emp ? `${emp.first_name} ${emp.last_name}` : "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{sh ? sh.business_role : "—"}</div>
                    </div>
                  </div>
                  <div>
                    {sh ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{new Date(sh.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{formatTime(sh.start_time)} — {formatTime(sh.end_time)}</div>
                      </>
                    ) : <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Sans shift</span>}
                  </div>
                  <div style={{ fontSize: 12 }}>{TYPE_LABEL[req.type]}</div>
                  <div className="flex items-center gap-1.5">
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
                    </div>

                    {hasShift && (
                      <div className="rounded-lg p-4 mb-3" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>Chercher un remplaçant</div>
                        <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.5 }}>
                          Avant d'accepter, envoyez la proposition à d'autres employés. La demande sera acceptée automatiquement dès qu'un remplaçant accepte.
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
                          </div>
                        )}

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
                      </div>
                    )}

                    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8 }}>
                        {hasShift
                          ? "L'acceptation est automatique dès qu'un remplaçant accepte. Si personne n'est trouvé, vous pouvez refuser."
                          : "Aucun shift à remplacer — vous pouvez répondre directement."}
                      </div>
                      <div className="flex items-center gap-2">
                        {!hasShift && (
                          <button onClick={async (ev) => {
                            ev.stopPropagation();
                            const { error } = await supabase.from("modification_requests").update({
                              status: "accepted", resolved_at: new Date().toISOString(),
                            }).eq("id", req.id);
                            if (error) toast.error("Erreur"); else { setExpandedId(null); toast.success("Demande acceptée"); }
                          }}
                            className="rounded-md px-4 py-2 flex items-center gap-1.5"
                            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                            <Check size={14} /> Accepter
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); refuse(req.id); }} disabled={busy}
                          className="rounded-md px-4 py-2 flex items-center gap-1.5"
                          style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>
                          <X size={14} /> Refuser
                        </button>
                      </div>
                    </div>
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
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}> · {TYPE_LABEL[req.type]}</span>
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
    </div>
  );
}
