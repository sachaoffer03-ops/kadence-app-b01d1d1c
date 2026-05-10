import { useEffect, useState } from "react";
import { Sheet, fmtTime, fmtDateLong, PrimaryButton, SecondaryButton } from "./shared";
import { roleColors, type Role } from "@/lib/mock-data";
import { Clock, MapPin, FileText, AlertCircle, CheckSquare, Bell, Download, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ─── ShiftDetailSheet : détail d'un shift à venir / en cours ─── */
interface ShiftLite {
  id: string; shift_date: string; start_time: string; end_time: string;
  business_role: string; studio_id: string | null; notes?: string | null;
  clocked_in_at?: string | null;
}

export function ShiftDetailSheet({ open, onClose, shift, studios, onEndShift, onRequestModif }: {
  open: boolean; onClose: () => void;
  shift: ShiftLite | null;
  studios: Record<string, string>;
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

  return (
    <Sheet open={open} onClose={onClose} title="Détail du shift">
      <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: rc?.bg, border: `0.5px solid ${rc?.dot}` }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: rc?.text, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{role}</div>
        <div style={{ fontSize: 16, fontWeight: 500, color: rc?.text, textTransform: "capitalize" }}>{fmtDateLong(shift.shift_date)}</div>
      </div>

      <Row icon={<Clock size={14} />} label="Horaires" value={`${fmtTime(shift.start_time)} — ${fmtTime(shift.end_time)}`} />
      <Row icon={<MapPin size={14} />} label="Studio" value={studioName} />

      {shift.notes && (
        <div className="rounded-lg px-4 py-3 mb-3" style={{ backgroundColor: "var(--warning-bg)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <FileText size={12} style={{ color: "var(--warning-text)" }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--warning-text)" }}>Note du shift</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--foreground)" }}>{shift.notes}</div>
        </div>
      )}

      {handoff && (
        <div className="rounded-lg px-4 py-3 mb-3" style={{ backgroundColor: "var(--coral-light)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle size={12} style={{ color: "var(--coral-dark)" }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--coral-dark)" }}>Message du shift précédent</span>
          </div>
          <div style={{ fontSize: 13 }}>{handoff}</div>
        </div>
      )}

      <div className="flex flex-col gap-2 mt-4">
        {isToday && onEndShift && (
          <PrimaryButton onClick={onEndShift}>
            <span className="inline-flex items-center justify-center gap-1.5">
              <CheckSquare size={14} /> Terminer le shift
            </span>
          </PrimaryButton>
        )}
        {onRequestModif && <SecondaryButton onClick={onRequestModif}>Demander une modification</SecondaryButton>}
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

/* ─── DocumentsSheet : fiches de paie / contrats fictifs ─── */
const FAKE_DOCS = [
  { id: "1", title: "Fiche de paie - Avril 2026", type: "Fiche de paie", date: "30 avril 2026", size: "142 Ko" },
  { id: "2", title: "Fiche de paie - Mars 2026", type: "Fiche de paie", date: "31 mars 2026", size: "138 Ko" },
  { id: "3", title: "Contrat étudiant 2024-2025", type: "Contrat", date: "15 septembre 2024", size: "287 Ko" },
  { id: "4", title: "Attestation de présence", type: "Attestation", date: "12 février 2026", size: "98 Ko" },
];

export function DocumentsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Mes documents">
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
        Tes fiches de paie, contrats et attestations.
      </div>
      <div className="flex flex-col gap-2">
        {FAKE_DOCS.map(d => (
          <button key={d.id} onClick={() => { /* preview / download */ }}
            className="rounded-xl px-4 py-3 flex items-center gap-3 text-left"
            style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}>
            <div className="rounded-lg flex items-center justify-center" style={{ width: 36, height: 36, backgroundColor: "var(--muted)" }}>
              <FileText size={16} style={{ color: "var(--muted-foreground)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 500 }} className="truncate">{d.title}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{d.type} · {d.date} · {d.size}</div>
            </div>
            <Download size={16} style={{ color: "var(--muted-foreground)" }} />
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 16, textAlign: "center" }}>
        Documents fictifs — la vraie connexion arrive bientôt.
      </div>
    </Sheet>
  );
}

/* ─── NotificationsSheet ─── */
interface Notif { id: string; title: string; body: string; date: string; read: boolean; }

export function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [notifs, setNotifs] = useState<Notif[]>([
    { id: "1", title: "Nouveau planning publié", body: "Ton planning de la semaine prochaine est en ligne.", date: "Il y a 2h", read: false },
    { id: "2", title: "Demande acceptée", body: "Sacha a accepté ton échange du 14 mai.", date: "Hier", read: false },
    { id: "3", title: "Nouvelle formation disponible", body: "« Le menu Skult » a été ajoutée à ton parcours.", date: "Il y a 2 jours", read: true },
    { id: "4", title: "Rappel pointage", body: "Pense à pointer en arrivant et en partant.", date: "Il y a 4 jours", read: true },
  ]);

  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  const unread = notifs.filter(n => !n.read).length;

  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{unread} non lue{unread > 1 ? "s" : ""}</div>
        {unread > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 11, fontWeight: 500, color: "var(--coral-dark)" }}>
            Tout marquer lu
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {notifs.map(n => (
          <div key={n.id} className="rounded-xl px-4 py-3 flex gap-3"
            style={{ backgroundColor: n.read ? "#fff" : "var(--coral-light)", border: "0.5px solid rgba(0,0,0,0.08)" }}>
            <div className="rounded-full flex items-center justify-center mt-0.5"
              style={{ width: 28, height: 28, backgroundColor: n.read ? "var(--muted)" : "var(--coral)", color: n.read ? "var(--muted-foreground)" : "var(--coral-text)" }}>
              {n.read ? <Check size={12} /> : <Bell size={12} />}
            </div>
            <div className="flex-1">
              <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{n.body}</div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>{n.date}</div>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
