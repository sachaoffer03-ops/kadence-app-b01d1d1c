import { useEffect, useState } from "react";
import { Sheet, fmtTime, fmtDateLong, PrimaryButton, SecondaryButton } from "./shared";
import { roleColors, type Role } from "@/lib/role-colors";
import { Clock, MapPin, FileText, AlertCircle, CheckSquare, Bell, Download, Check, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ─── ShiftDetailSheet : détail d'un shift à venir / en cours ─── */
interface ShiftLite {
  id: string; shift_date: string; start_time: string; end_time: string;
  business_role: string; studio_id: string | null; notes?: string | null;
  clocked_in_at?: string | null;
  clocked_out_at?: string | null;
  minutes_late?: number | null;
}

export function ShiftDetailSheet({ open, onClose, shift, studios, onClockIn, onEndShift, onRequestModif }: {
  open: boolean; onClose: () => void;
  shift: ShiftLite | null;
  studios: Record<string, string>;
  onClockIn?: () => void;
  onEndShift?: () => void;
  onRequestModif?: () => void;
}) {
  const [handoff, setHandoff] = useState<string | null>(null);
  const [prevShiftIds, setPrevShiftIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !shift || !shift.studio_id) return;
    let cancelled = false;
    (async () => {
      // Cherche les shifts précédents (même studio + même poste)
      const { data: prevShifts } = await supabase.from("shifts")
        .select("id")
        .eq("studio_id", shift.studio_id!)
        .eq("business_role", shift.business_role as Role)
        .lte("shift_date", shift.shift_date)
        .order("shift_date", { ascending: false }).order("start_time", { ascending: false })
        .limit(5);
      if (cancelled) return;
      const ids = (prevShifts || []).map(s => s.id);
      setPrevShiftIds(ids);
      if (ids.length === 0) { setHandoff(null); return; }
      const { data: ho } = await supabase.from("shift_handoffs")
        .select("message,created_at")
        .in("shift_id", ids)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!cancelled) setHandoff(ho?.message || null);
    })();
    return () => { cancelled = true; };
  }, [open, shift]);

  // Realtime : si l'employé précédent dépose un handoff pendant qu'on a la sheet ouverte, on l'affiche tout de suite
  useEffect(() => {
    if (!open || !shift || prevShiftIds.length === 0) return;
    const channel = supabase.channel(`handoff-${shift.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shift_handoffs" }, (payload) => {
        const row = payload.new as { shift_id: string; message: string };
        if (prevShiftIds.includes(row.shift_id)) setHandoff(row.message);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, shift, prevShiftIds]);

  if (!shift) return null;
  const role = shift.business_role as Role;
  const rc = roleColors[role];
  const studioName = (shift.studio_id && studios[shift.studio_id]) || "—";
  const today = new Date().toISOString().slice(0, 10);
  const isToday = shift.shift_date === today;
  const isDone = !!shift.clocked_out_at;
  const isInService = !isDone && !!shift.clocked_in_at;
  const startTs = new Date(`${shift.shift_date}T${shift.start_time}`).getTime();
  const minsUntilStart = Math.ceil((startTs - Date.now()) / 60_000);
  const canStart = isToday && !shift.clocked_in_at && !isDone && minsUntilStart <= 5;
  const tooEarly = isToday && !shift.clocked_in_at && !isDone && minsUntilStart > 5;

  return (
    <Sheet open={open} onClose={onClose} title="Détail du shift">
      <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: rc?.bg, border: `0.5px solid ${rc?.dot}` }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: rc?.text, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{role}</div>
        <div style={{ fontSize: 16, fontWeight: 500, color: rc?.text, textTransform: "capitalize" }}>{fmtDateLong(shift.shift_date)}</div>
      </div>

      <Row icon={<Clock size={14} />} label="Horaires" value={`${fmtTime(shift.start_time)} — ${fmtTime(shift.end_time)}`} />
      <Row icon={<MapPin size={14} />} label="Studio" value={studioName} />

      {isDone && (
        <div className="rounded-lg px-4 py-3 mb-3" style={{ backgroundColor: "var(--success-bg)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Check size={12} style={{ color: "var(--success-text)" }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--success-text)" }}>Shift effectué</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--foreground)" }}>
            Pointé de {fmtTime(new Date(shift.clocked_in_at!).toTimeString().slice(0, 5))} à {fmtTime(new Date(shift.clocked_out_at!).toTimeString().slice(0, 5))}
            {shift.minutes_late ? ` · +${shift.minutes_late} min de retard` : ""}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
            Tes infos ont été transmises à l'admin. Ce shift est clôturé et ne peut plus être modifié.
          </div>
        </div>
      )}

      {shift.notes && (
        <div className="rounded-lg px-4 py-3 mb-3" style={{ backgroundColor: "var(--warning-bg)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <FileText size={12} style={{ color: "var(--warning-text)" }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--warning-text)" }}>Note du shift</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--foreground)" }}>{shift.notes}</div>
        </div>
      )}

      {handoff && !isDone && (
        <div className="rounded-lg px-4 py-3 mb-3" style={{ backgroundColor: "var(--coral-light)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle size={12} style={{ color: "var(--coral-dark)" }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--coral-dark)" }}>Message du shift précédent</span>
          </div>
          <div style={{ fontSize: 13 }}>{handoff}</div>
        </div>
      )}

      <div className="flex flex-col gap-2 mt-4">
        {canStart && onClockIn && (
          <PrimaryButton onClick={onClockIn}>
            <span className="inline-flex items-center justify-center gap-1.5">
              <Play size={14} /> Commencer mon shift
            </span>
          </PrimaryButton>
        )}
        {isInService && onEndShift && (
          <PrimaryButton onClick={onEndShift}>
            <span className="inline-flex items-center justify-center gap-1.5">
              <CheckSquare size={14} /> Terminer mon shift
            </span>
          </PrimaryButton>
        )}
        {!isDone && onRequestModif && <SecondaryButton onClick={onRequestModif}>Demander une modification</SecondaryButton>}
        {isDone && <SecondaryButton onClick={onClose}>Fermer</SecondaryButton>}
      </div>
    </Sheet>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-2.5 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <span style={{ color: "var(--muted-foreground)" }}>{icon}</span>
      <div className="flex-1">
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}

/* ─── DocumentsSheet : fiches de paie / contrats réels ─── */
import { useServerFn } from "@tanstack/react-start";
import { listMyDocuments, markDocumentViewed, getMyDocumentDownloadUrl } from "@/lib/documents.functions";
import { FileSpreadsheet, FileCheck2, Paperclip } from "lucide-react";
import { toast } from "sonner";

type DocType = "fiche_paie" | "contrat" | "attestation" | "autre";
const DOC_TYPE_LABEL: Record<DocType, string> = {
  fiche_paie: "Fiche de paie", contrat: "Contrat", attestation: "Attestation", autre: "Autre",
};
const DOC_FILTERS: { value: DocType | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "fiche_paie", label: "Fiches" },
  { value: "contrat", label: "Contrats" },
  { value: "attestation", label: "Attestations" },
  { value: "autre", label: "Autres" },
];
function docIconFor(t: DocType) {
  if (t === "fiche_paie") return FileSpreadsheet;
  if (t === "contrat") return FileCheck2;
  if (t === "attestation") return FileText;
  return Paperclip;
}
function fmtBytes(b: number) {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / 1024 / 1024).toFixed(1)} Mo`;
}

interface MyDoc {
  id: string; type: DocType; title: string; description: string | null;
  file_size_bytes: number; file_mime_type: string | null;
  period_start: string | null; period_end: string | null;
  first_viewed_at: string | null; created_at: string;
}

export function DocumentsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const list = useServerFn(listMyDocuments);
  const markViewed = useServerFn(markDocumentViewed);
  const getUrl = useServerFn(getMyDocumentDownloadUrl);
  const [docs, setDocs] = useState<MyDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<DocType | "all">("all");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    list({ data: {} }).then(r => setDocs(r.documents as MyDoc[])).finally(() => setLoading(false));
  }, [open]);

  const filtered = filter === "all" ? docs : docs.filter(d => d.type === filter);

  const openDoc = async (d: MyDoc) => {
    try {
      const [{ url }] = await Promise.all([
        getUrl({ data: { documentId: d.id } }),
        markViewed({ data: { documentId: d.id } }),
      ]);
      setDocs(prev => prev.map(x => x.id === d.id ? { ...x, first_viewed_at: x.first_viewed_at ?? new Date().toISOString() } : x));
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Mes documents">
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
        Tes fiches de paie, contrats et attestations.
      </div>

      <div className="flex gap-1.5 flex-wrap mb-3">
        {DOC_FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} className="rounded-full px-2.5 py-1"
            style={{
              fontSize: 11, fontWeight: 500,
              backgroundColor: filter === f.value ? "var(--foreground)" : "var(--card)",
              color: filter === f.value ? "var(--background)" : "var(--muted-foreground)",
              border: "0.5px solid rgba(0,0,0,0.08)",
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3].map(i => <div key={i} className="rounded-xl h-14" style={{ backgroundColor: "var(--muted)", opacity: 0.5 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl px-4 py-6 text-center" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <FileText size={24} style={{ color: "var(--muted-foreground)", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Aucun document pour le moment. Les fiches de paie et contrats apparaîtront ici quand ton manager les uploadera.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(d => {
            const Icon = docIconFor(d.type);
            const isNew = !d.first_viewed_at;
            return (
              <button key={d.id} onClick={() => openDoc(d)}
                className="rounded-xl px-4 py-3 flex items-center gap-3 text-left"
                style={{ backgroundColor: "#fff", border: `0.5px solid ${isNew ? "var(--coral)" : "rgba(0,0,0,0.08)"}` }}>
                <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 36, height: 36, backgroundColor: "var(--muted)" }}>
                  <Icon size={16} style={{ color: "var(--muted-foreground)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div style={{ fontSize: 13, fontWeight: 500 }} className="truncate">{d.title}</div>
                    {isNew && (
                      <span className="rounded-full px-1.5" style={{ fontSize: 9, fontWeight: 600, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
                        NOUVEAU
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }} className="truncate">
                    {DOC_TYPE_LABEL[d.type]} · {new Date(d.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} · {fmtBytes(d.file_size_bytes)}
                  </div>
                </div>
                <Download size={16} style={{ color: "var(--muted-foreground)" }} />
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

/* ─── NotificationsSheet ─── */
import { useStaffNotifications } from "@/hooks/use-staff-notifications";
import { Calendar, Replace as ReplaceIcon, MessageCircle, Send, X } from "lucide-react";
import { acceptProposal, declineProposal, acceptReplacementProposal } from "@/lib/proposals.functions";

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Hier";
  if (d < 7) return `Il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

interface PendingProposal {
  id: string;
  sent_at: string;
  replacement_request_id: string | null;
  shift: {
    id: string; shift_date: string; start_time: string; end_time: string;
    business_role: string; studio_id: string | null; user_id: string | null;
  };
}

export function NotificationsSheet({ open, onClose, userId, studios, onNavigate }: {
  open: boolean; onClose: () => void; userId: string;
  studios?: Record<string, string>;
  onNavigate?: (tab: "accueil" | "planning" | "pointage" | "chat") => void;
}) {
  const { items, unread, markAllRead } = useStaffNotifications(userId);
  const [proposals, setProposals] = useState<PendingProposal[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const acceptFn = useServerFn(acceptProposal);
  const acceptReplFn = useServerFn(acceptReplacementProposal);
  const declineFn = useServerFn(declineProposal);

  const loadProps = async () => {
    const { data } = await supabase
      .from("shift_proposals")
      .select("id,sent_at,replacement_request_id,shift:shifts!inner(id,shift_date,start_time,end_time,business_role,studio_id,user_id)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("sent_at", { ascending: false });
    const list = (data || []).filter((p: any) => {
      if (!p.shift) return false;
      if (p.replacement_request_id) return p.shift.user_id !== userId;
      return !p.shift.user_id;
    }) as PendingProposal[];
    setProposals(list);
  };

  useEffect(() => {
    if (!open) return;
    loadProps();
    const ch = supabase
      .channel(`notif-props-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_proposals", filter: `user_id=eq.${userId}` }, loadProps)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  // Marquer comme lu à la fermeture
  useEffect(() => {
    if (!open && unread > 0) markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const acceptProp = async (p: PendingProposal) => {
    setBusy(p.id);
    try {
      const r = p.replacement_request_id
        ? await acceptReplFn({ data: { proposalId: p.id } })
        : await acceptFn({ data: { proposalId: p.id } });
      if (r.ok) toast.success("Shift accepté !");
      else toast.error("Trop tard, un autre employé a déjà accepté ce shift");
      loadProps();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const declineProp = async (id: string) => {
    setBusy(id);
    try {
      await declineFn({ data: { proposalId: id } });
      toast("Proposition refusée");
      loadProps();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const iconFor = (kind: string) => {
    if (kind === "shift") return Calendar;
    if (kind === "request") return ReplaceIcon;
    if (kind === "message") return MessageCircle;
    if (kind === "proposal") return Send;
    return Bell;
  };

  const handleNotifClick = (n: typeof items[number]) => {
    onClose();
    if (n.kind === "proposal") {
      window.location.assign("/staff-app/propositions");
      return;
    }
    if (n.link) {
      window.location.assign(n.link);
      return;
    }
    if (!onNavigate) return;
    if (n.kind === "message") onNavigate("chat");
    else if (n.kind === "shift") onNavigate("planning");
    else onNavigate("accueil");
  };

  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          {unread > 0 || proposals.length > 0
            ? `${unread + proposals.length} à traiter`
            : "Tout est à jour"}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 11, fontWeight: 500, color: "var(--coral-dark)" }}>
            Tout marquer lu
          </button>
        )}
      </div>

      {/* Propositions de shift en attente — actionnables */}
      {proposals.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {proposals.map((p) => {
            const sname = p.shift.studio_id && studios ? (studios[p.shift.studio_id] || "—") : "—";
            const dateLabel = new Date(p.shift.shift_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
            return (
              <div key={p.id} className="rounded-xl p-3" style={{ backgroundColor: "#fff", border: "1px solid var(--coral)" }}>
                <div className="flex items-center gap-1.5 mb-1" style={{ fontSize: 10, color: "var(--coral-dark)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <Send size={10} /> Nouvelle proposition
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, textTransform: "capitalize" }}>{dateLabel}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                  {String(p.shift.start_time).slice(0,5)} — {String(p.shift.end_time).slice(0,5)} · {p.shift.business_role} · {sname.replace("Skult ", "")}
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button onClick={() => acceptProp(p)} disabled={busy === p.id}
                    className="flex-1 rounded-md py-2 flex items-center justify-center gap-1.5"
                    style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}>
                    <Check size={12} /> Accepter
                  </button>
                  <button onClick={() => declineProp(p.id)} disabled={busy === p.id}
                    className="flex-1 rounded-md py-2 flex items-center justify-center gap-1.5"
                    style={{ fontSize: 12, fontWeight: 500, backgroundColor: "transparent", color: "var(--muted-foreground)", border: "0.5px solid var(--border)" }}>
                    <X size={12} /> Refuser
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length === 0 && proposals.length === 0 ? (
        <div className="rounded-lg px-4 py-6 text-center" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", fontSize: 12, color: "var(--muted-foreground)" }}>
          Aucune notification pour l'instant.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(n => {
            const Icon = iconFor(n.kind);
            const clickable = !!(n.link || onNavigate);
            return (
              <button key={n.id} type="button"
                onClick={clickable ? () => handleNotifClick(n) : undefined}
                className="rounded-xl px-4 py-3 flex gap-3 text-left transition-colors"
                style={{
                  backgroundColor: n.read ? "#fff" : "var(--coral-light)",
                  border: "0.5px solid rgba(0,0,0,0.08)",
                  cursor: clickable ? "pointer" : "default",
                }}>
                <div className="rounded-full flex items-center justify-center mt-0.5 shrink-0"
                  style={{ width: 28, height: 28, backgroundColor: n.read ? "var(--muted)" : "var(--coral)", color: n.read ? "var(--muted-foreground)" : "var(--coral-text)" }}>
                  {n.read ? <Check size={12} /> : <Icon size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>{fmtRelative(n.date)}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

