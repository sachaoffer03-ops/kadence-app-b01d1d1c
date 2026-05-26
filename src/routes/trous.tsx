import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, UserCheck, ChevronDown, ChevronUp, Check, AlertTriangle, Send, Clock, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getRoleStyle, hhmm, fullName } from "@/lib/staff-helpers";
import { useBusinessRoles } from "@/hooks/use-business-roles";
import { sendProposals, cancelProposals } from "@/lib/proposals.functions";
import { assignShiftDirect, deleteShift } from "@/lib/shifts.functions";

interface TrousSearch {
  studios?: string;
  week?: string;
}

export const Route = createFileRoute("/trous")({
  component: TrousPage,
  head: () => ({ meta: [{ title: "Trous à combler — Kadence" }] }),
  validateSearch: (search: Record<string, unknown>): TrousSearch => ({
    studios: typeof search.studios === "string" ? search.studios : undefined,
    week: typeof search.week === "string" ? search.week : undefined,
  }),
});

interface Hole {
  id: string; shift_date: string; start_time: string; end_time: string;
  business_role: string; studio_id: string | null;
}
interface ProfileRow { id: string; first_name: string; last_name: string; score: number | null }
interface Proposal {
  id: string; shift_id: string; user_id: string; status: string;
  sent_at: string; responded_at: string | null;
}

function elapsed(sentAt: string): string {
  const ms = Date.now() - new Date(sentAt).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}j ${h % 24}h`;
}

// Couleur du chronomètre selon urgence
function elapsedTone(sentAt: string): { bg: string; text: string } {
  const h = (Date.now() - new Date(sentAt).getTime()) / 3600000;
  if (h < 2) return { bg: "var(--success-bg)", text: "var(--success-text)" };
  if (h < 12) return { bg: "var(--warning-bg)", text: "var(--warning-text)" };
  return { bg: "var(--danger-bg)", text: "var(--danger-text)" };
}

function TrousPage() {
  const sendFn = useServerFn(sendProposals);
  const cancelFn = useServerFn(cancelProposals);
  const assignFn = useServerFn(assignShiftDirect);
  const deleteFn = useServerFn(deleteShift);

  const [holes, setHoles] = useState<Hole[]>([]);
  const [studios, setStudios] = useState<Map<string, string>>(new Map());
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profileRoles, setProfileRoles] = useState<Map<string, string[]>>(new Map());
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [filterRole, setFilterRole] = useState<string>("tous");
  const [tick, setTick] = useState(0);

  // Tick chaque seconde pour le chronomètre live
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const load = async () => {
    const today = new Date().toISOString().split("T")[0];
    const [{ data: h }, { data: st }, { data: p }, { data: ubr }, { data: pr }] = await Promise.all([
      supabase.from("shifts").select("id,shift_date,start_time,end_time,business_role,studio_id").is("user_id", null).gte("shift_date", today).order("shift_date").order("start_time"),
      supabase.from("studios").select("id,name"),
      supabase.from("profiles").select("id,first_name,last_name,score").eq("status", "active"),
      supabase.from("user_business_roles").select("user_id,role"),
      supabase.from("shift_proposals").select("id,shift_id,user_id,status,sent_at,responded_at").order("sent_at", { ascending: false }),
    ]);
    setHoles((h || []) as Hole[]);
    setStudios(new Map((st || []).map((s) => [s.id, s.name])));
    setProfiles((p || []) as ProfileRow[]);
    const m = new Map<string, string[]>();
    (ubr || []).forEach((r) => { const arr = m.get(r.user_id) || []; arr.push(r.role); m.set(r.user_id, arr); });
    setProfileRoles(m);
    setProposals((pr || []) as Proposal[]);
  };

  useEffect(() => {
    load();
    const ch1 = supabase.channel("trous-shifts").on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, load).subscribe();
    const ch2 = supabase.channel("trous-proposals").on("postgres_changes", { event: "*", schema: "public", table: "shift_proposals" }, load).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, []);


  const search = Route.useSearch();
  const studioFilter = useMemo(
    () => (search.studios ? new Set(search.studios.split(",").map((s: string) => s.trim()).filter(Boolean)) : null),
    [search.studios],
  );
  const weekFilter = search.week;
  const weekRange = useMemo(() => {
    if (!weekFilter) return null;
    const start = weekFilter;
    const d = new Date(weekFilter + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + 6);
    const end = d.toISOString().slice(0, 10);
    return { start, end };
  }, [weekFilter]);

  // Resolve studio ids matching name filter
  const studioIdsFilter = useMemo(() => {
    if (!studioFilter) return null;
    const ids = new Set<string>();
    studios.forEach((name, id) => {
      const short = name.replace(/^Skult\s+/i, "").toLowerCase();
      if (studioFilter.has(name) || studioFilter.has(short) || studioFilter.has(name.toLowerCase())) {
        ids.add(id);
      }
    });
    return ids;
  }, [studios, studioFilter]);

  const scoped = useMemo(() => {
    return holes.filter((h) => {
      if (studioIdsFilter && (!h.studio_id || !studioIdsFilter.has(h.studio_id))) return false;
      if (weekRange && (h.shift_date < weekRange.start || h.shift_date > weekRange.end)) return false;
      return true;
    });
  }, [holes, studioIdsFilter, weekRange]);

  const filtered = useMemo(
    () => scoped.filter((h) => filterRole === "tous" || h.business_role === filterRole),
    [scoped, filterRole],
  );

  const proposalsByShift = useMemo(() => {
    const m = new Map<string, Proposal[]>();
    proposals.forEach((p) => { const a = m.get(p.shift_id) || []; a.push(p); m.set(p.shift_id, a); });
    return m;
  }, [proposals]);

  const toggleSelect = (shiftId: string, userId: string) => {
    setSelected((prev) => {
      const set = new Set(prev[shiftId] || []);
      set.has(userId) ? set.delete(userId) : set.add(userId);
      return { ...prev, [shiftId]: set };
    });
  };

  const send = async (shiftId: string) => {
    const set = selected[shiftId];
    if (!set || set.size === 0) return;
    try {
      const r = await sendFn({ data: { shiftId, userIds: Array.from(set) } });
      toast.success(`${r.count} proposition${r.count > 1 ? "s" : ""} envoyée${r.count > 1 ? "s" : ""}`);
      setSelected((prev) => ({ ...prev, [shiftId]: new Set() }));
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const cancelOne = async (proposalId: string) => {
    try {
      await cancelFn({ data: { proposalIds: [proposalId] } });
      toast.success("Proposition annulée");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const { names: allRoles } = useBusinessRoles({ onlyActive: true });

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} style={{ color: filtered.length > 0 ? "var(--danger-text)" : "var(--success-text)" }} />
            <h1 style={{ fontSize: 18, fontWeight: 500 }}>
              {filtered.length} trou{filtered.length > 1 ? "s" : ""} à combler
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Sélectionnez un trou et envoyez une proposition à un ou plusieurs employés. Le premier qui accepte décroche le shift.</p>
        </div>
      </div>

      {(studioFilter || weekRange) && (
        <div className="rounded-xl border mb-4 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
          style={{ borderColor: "var(--coral)", backgroundColor: "var(--coral-light)" }}>
          <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 12, color: "var(--coral-dark)" }}>
            <span style={{ fontWeight: 500 }}>Filtre actif :</span>
            {studioFilter && <span>studios {Array.from(studioFilter).join(", ")}</span>}
            {studioFilter && weekRange && <span>·</span>}
            {weekRange && <span>semaine du {new Date(weekRange.start + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au {new Date(weekRange.end + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>}
          </div>
          <Link to="/trous" search={{}} className="rounded-md px-2.5 py-1 inline-flex items-center gap-1"
            style={{ fontSize: 11, fontWeight: 500, backgroundColor: "#fff", color: "var(--coral-dark)", border: "0.5px solid var(--coral)" }}>
            <X size={11} /> Voir tous les trous
          </Link>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500, marginRight: 4 }}>Rôle</span>
        {[{ value: "tous", label: "Tous" }, ...allRoles.map((r) => ({ value: r, label: r }))].map((opt) => {
          const a = filterRole === opt.value;
          const count = opt.value === "tous" ? scoped.length : scoped.filter((h) => h.business_role === opt.value).length;
          const rc = opt.value !== "tous" ? getRoleStyle(opt.value) : null;
          return (
            <button key={opt.value} onClick={() => setFilterRole(opt.value)} className="rounded-full px-2.5 py-1 flex items-center gap-1.5"
              style={{ fontSize: 11, fontWeight: a ? 500 : 400, backgroundColor: a ? "var(--foreground)" : "transparent", color: a ? "var(--card)" : "var(--muted-foreground)", border: a ? "none" : "0.5px solid var(--border)" }}>
              {opt.label}
              {count > 0 && (
                <span className="rounded-full inline-flex items-center justify-center"
                  style={{
                    minWidth: 16, height: 16, padding: "0 5px", fontSize: 10, fontWeight: 500,
                    backgroundColor: a ? "var(--card)" : (rc ? rc.bg : "var(--muted)"),
                    color: a ? "var(--foreground)" : (rc ? rc.text : "var(--muted-foreground)"),
                  }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border px-6 py-10 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Aucun trou à combler</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Tous les shifts sont attribués.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((hole) => {
            const isOpen = expanded === hole.id;
            const rc = getRoleStyle(hole.business_role);
            const studioName = hole.studio_id ? studios.get(hole.studio_id) || "—" : "—";
            const eligible = profiles.filter((p) => (profileRoles.get(p.id) || []).includes(hole.business_role));
            const others = profiles.filter((p) => !(profileRoles.get(p.id) || []).includes(hole.business_role));
            const allProps = proposalsByShift.get(hole.id) || [];
            const pendingProps = allProps.filter((p) => p.status === "pending");
            const sel = selected[hole.id] || new Set<string>();

            return (
              <div key={hole.id} className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: isOpen ? "var(--coral)" : "var(--border)", borderWidth: isOpen ? 1.5 : 1 }}>
                <button onClick={() => setExpanded(isOpen ? null : hole.id)} className="w-full flex items-center gap-4 px-5 py-4 text-left">
                  <span className="rounded-full shrink-0" style={{ width: 10, height: 10, backgroundColor: rc.dot }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{hole.business_role}</span>
                      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>·</span>
                      <span style={{ fontSize: 13 }}>{new Date(hole.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span>
                      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>·</span>
                      <span style={{ fontSize: 13 }}>{hhmm(hole.start_time)} — {hhmm(hole.end_time)}</span>
                      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>·</span>
                      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{studioName}</span>
                    </div>
                    {pendingProps.length > 0 && (() => {
                      const oldest = pendingProps[pendingProps.length - 1];
                      const tone = elapsedTone(oldest.sent_at);
                      return (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span style={{ fontSize: 11, color: "var(--coral-dark)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Send size={11} />
                            {pendingProps.length} en attente
                          </span>
                          <span
                            key={tick}
                            className="rounded-full inline-flex items-center gap-1 px-2 py-0.5 tabular-nums"
                            style={{ fontSize: 10, fontWeight: 500, backgroundColor: tone.bg, color: tone.text }}
                            title={`Envoyée le ${new Date(oldest.sent_at).toLocaleString("fr-FR")}`}
                          >
                            <Clock size={10} />
                            {elapsed(oldest.sent_at)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5" style={{ borderTop: "0.5px solid var(--border)" }}>
                    {/* Propositions en cours */}
                    {allProps.length > 0 && (
                      <div className="mt-4">
                        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          Propositions envoyées ({allProps.length})
                        </div>
                        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                          {allProps.map((prop, i) => {
                            const p = profiles.find((x) => x.id === prop.user_id);
                            const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
                              pending: { bg: "var(--warning-bg)", text: "var(--warning-text)", label: "en attente" },
                              accepted: { bg: "var(--success-bg)", text: "var(--success-text)", label: "accepté" },
                              declined: { bg: "var(--danger-bg)", text: "var(--danger-text)", label: "refusé" },
                              expired: { bg: "var(--muted)", text: "var(--muted-foreground)", label: "expiré" },
                              cancelled: { bg: "var(--muted)", text: "var(--muted-foreground)", label: "annulé" },
                            };
                            const ss = statusStyle[prop.status] || statusStyle.pending;
                            const isPending = prop.status === "pending";
                            const tone = isPending ? elapsedTone(prop.sent_at) : { bg: "var(--muted)", text: "var(--muted-foreground)" };
                            return (
                              <div key={prop.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: i === allProps.length - 1 ? "none" : "0.5px solid var(--border)" }}>
                                <div className="flex-1 min-w-0">
                                  <div style={{ fontSize: 12, fontWeight: 500 }}>{p ? fullName(p) : "—"}</div>
                                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>
                                    Envoyée le {new Date(prop.sent_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </div>
                                <span
                                  key={tick}
                                  className="rounded-full inline-flex items-center gap-1 px-2 py-0.5 tabular-nums"
                                  style={{ fontSize: 10, fontWeight: 500, backgroundColor: tone.bg, color: tone.text }}
                                  title={isPending ? "Temps écoulé depuis l'envoi" : "Temps avant réponse"}
                                >
                                  <Clock size={10} />
                                  {elapsed(prop.sent_at)}
                                </span>
                                <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: ss.bg, color: ss.text }}>{ss.label}</span>
                                {prop.status === "pending" && (
                                  <button onClick={() => cancelOne(prop.id)} title="Annuler" className="flex items-center justify-center rounded-md" style={{ width: 22, height: 22, color: "var(--muted-foreground)" }}>
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Sélection */}
                    <div className="mt-4 flex items-center justify-between">
                      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Choisir les destinataires
                      </div>
                      {sel.size > 0 && (
                        <button onClick={() => send(hole.id)} className="rounded-md px-3 py-1.5 flex items-center gap-1.5"
                          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}>
                          <Send size={12} /> Envoyer la proposition à {sel.size}
                        </button>
                      )}
                    </div>

                    <div className="mt-2">
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>
                        Employés éligibles ({eligible.length})
                      </div>
                      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                        {eligible.length === 0 ? (
                          <div className="px-4 py-6 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun employé n'a ce rôle.</div>
                        ) : eligible.map((p, i) => (
                          <EmpRow key={p.id} profile={p} roles={profileRoles.get(p.id) || []} primary={hole.business_role}
                            isLast={i === eligible.length - 1}
                            checked={sel.has(p.id)}
                            existingProposal={allProps.find((x) => x.user_id === p.id)}
                            onToggle={() => toggleSelect(hole.id, p.id)} />
                        ))}
                      </div>
                    </div>

                    {others.length > 0 && (
                      <div className="mt-4">
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>
                          Autres employés ({others.length})
                        </div>
                        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                          {others.map((p, i) => (
                            <EmpRow key={p.id} profile={p} roles={profileRoles.get(p.id) || []}
                              isLast={i === others.length - 1}
                              checked={sel.has(p.id)}
                              existingProposal={allProps.find((x) => x.user_id === p.id)}
                              onToggle={() => toggleSelect(hole.id, p.id)} />
                          ))}
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
    </div>
  );
}

function EmpRow({ profile, roles, primary, isLast, checked, existingProposal, onToggle }: {
  profile: ProfileRow; roles: string[]; primary?: string; isLast: boolean;
  checked: boolean; existingProposal?: Proposal; onToggle: () => void;
}) {
  const isPending = existingProposal?.status === "pending";
  const disabled = isPending; // ne pas re-proposer si déjà en attente
  return (
    <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer" style={{ borderBottom: isLast ? "none" : "0.5px solid var(--border)", opacity: disabled ? 0.55 : 1 }}>
      <input
        type="checkbox" checked={checked} disabled={disabled} onChange={onToggle}
        style={{ accentColor: "var(--coral)", width: 14, height: 14 }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/staff/$id" params={{ id: profile.id }} onClick={(e) => e.stopPropagation()} className="hover:underline" style={{ fontSize: 13, fontWeight: 500 }}>
            {fullName(profile)}
          </Link>
          {roles.map((r) => {
            const c = getRoleStyle(r);
            const m = primary === r;
            return <span key={r} className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 500, backgroundColor: c.bg, color: c.text, outline: m ? `1px solid ${c.dot}` : "none" }}>{r}</span>;
          })}
          {existingProposal && (
            <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>· déjà {existingProposal.status}</span>
          )}
        </div>
        {profile.score != null && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>Score {Number(profile.score).toFixed(1)}/10</div>}
      </div>
    </label>
  );
}
