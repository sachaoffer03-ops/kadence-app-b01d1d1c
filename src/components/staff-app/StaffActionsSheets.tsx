import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, FormField, TextArea, PrimaryButton, fmtRelative } from "./shared";
import { AlertCircle, GraduationCap, Check, Play, Replace, Clock, X as XIcon } from "lucide-react";

type SignalCategory = "stock" | "materiel" | "hygiene" | "autre";
const CATS: { key: SignalCategory; label: string }[] = [
  { key: "stock", label: "Stock" },
  { key: "materiel", label: "Matériel" },
  { key: "hygiene", label: "Hygiène" },
  { key: "autre", label: "Autre" },
];

export function SignalementSheet({ open, onClose, userId, studioId }: { open: boolean; onClose: () => void; userId: string; studioId: string | null }) {
  const [cat, setCat] = useState<SignalCategory>("stock");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) { setCat("stock"); setMsg(""); } }, [open]);

  const submit = async () => {
    if (!msg.trim()) { toast.error("Décris le problème"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("signalements").insert({
      author_id: userId, studio_id: studioId, category: cat, message: msg.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error("Erreur d'envoi"); return; }
    toast.success("Signalement envoyé");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Signaler un problème">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle size={18} style={{ color: "var(--coral)" }} />
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Visible par l'admin et le manager</div>
      </div>
      <FormField label="Catégorie">
        <div className="grid grid-cols-4 gap-1.5">
          {CATS.map(c => (
            <button key={c.key} onClick={() => setCat(c.key)} className="rounded-md py-2"
              style={{
                fontSize: 11, fontWeight: cat === c.key ? 500 : 400,
                backgroundColor: cat === c.key ? "var(--coral)" : "#fff",
                color: cat === c.key ? "var(--coral-text)" : "var(--foreground)",
                border: `0.5px solid ${cat === c.key ? "var(--coral)" : "rgba(0,0,0,0.12)"}`,
              }}>{c.label}</button>
          ))}
        </div>
      </FormField>
      <FormField label="Message">
        <TextArea value={msg} onChange={setMsg} rows={5}
          placeholder="Ex: Plus de lait avoine, prévoir réassort / Moulin chauffe / WC à nettoyer..." />
      </FormField>
      <div className="mt-2"><PrimaryButton onClick={submit} disabled={submitting}>{submitting ? "Envoi…" : "Envoyer"}</PrimaryButton></div>
    </Sheet>
  );
}

type ReqType = "swap" | "cancel" | "time_change";
type Urgency = "normal" | "urgent" | "critique";
const REQ_TYPES: { key: ReqType; label: string; icon: typeof Replace }[] = [
  { key: "swap", label: "Échanger", icon: Replace },
  { key: "cancel", label: "Annuler", icon: XIcon },
  { key: "time_change", label: "Décaler", icon: Clock },
];

export function RequestModificationSheet({ open, onClose, userId, shiftId }: { open: boolean; onClose: () => void; userId: string; shiftId: string | null }) {
  const [type, setType] = useState<ReqType>("swap");
  const [urgency, setUrgency] = useState<Urgency>("normal");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) { setType("swap"); setUrgency("normal"); setReason(""); } }, [open]);

  const submit = async () => {
    if (!reason.trim()) { toast.error("Indique la raison"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("modification_requests").insert({
      user_id: userId, shift_id: shiftId, type, urgency, reason: reason.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error("Erreur d'envoi"); return; }
    toast.success("Demande envoyée à l'admin");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Demande de modification">
      <FormField label="Type">
        <div className="grid grid-cols-3 gap-1.5">
          {REQ_TYPES.map(t => {
            const active = type === t.key;
            return (
              <button key={t.key} onClick={() => setType(t.key)} className="rounded-md py-2.5 flex flex-col items-center gap-1"
                style={{
                  fontSize: 11, fontWeight: active ? 500 : 400,
                  backgroundColor: active ? "var(--coral)" : "#fff",
                  color: active ? "var(--coral-text)" : "var(--foreground)",
                  border: `0.5px solid ${active ? "var(--coral)" : "rgba(0,0,0,0.12)"}`,
                }}>
                <t.icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </FormField>
      <FormField label="Urgence">
        <div className="grid grid-cols-3 gap-1.5">
          {(["normal","urgent","critique"] as Urgency[]).map(u => {
            const labels: Record<Urgency, string> = { normal: "Normale", urgent: "Urgente", critique: "Critique" };
            const active = urgency === u;
            return (
              <button key={u} onClick={() => setUrgency(u)} className="rounded-md py-2"
                style={{
                  fontSize: 11, fontWeight: active ? 500 : 400,
                  backgroundColor: active ? "var(--foreground)" : "#fff",
                  color: active ? "var(--background)" : "var(--foreground)",
                  border: `0.5px solid ${active ? "var(--foreground)" : "rgba(0,0,0,0.12)"}`,
                }}>{labels[u]}</button>
            );
          })}
        </div>
      </FormField>
      <FormField label="Raison" hint="Sois précis : ça aide l'admin à décider rapidement.">
        <TextArea value={reason} onChange={setReason} rows={5}
          placeholder="Ex: Examen ce matin-là / Maladie / Conflit avec un autre engagement..." />
      </FormField>
      <div className="mt-2"><PrimaryButton onClick={submit} disabled={submitting}>{submitting ? "Envoi…" : "Envoyer la demande"}</PrimaryButton></div>
    </Sheet>
  );
}

interface FormationRow {
  id: string; title: string; description: string | null; duration_min: number | null;
  video_url: string | null; required_role: string | null;
}
interface CompletionRow { formation_id: string; }

export function FormationsSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const [formations, setFormations] = useState<FormationRow[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<FormationRow | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: f }, { data: c }] = await Promise.all([
        supabase.from("formations").select("id,title,description,duration_min,video_url,required_role").order("title"),
        supabase.from("formation_completions").select("formation_id").eq("user_id", userId),
      ]);
      setFormations(f || []);
      setCompleted(new Set((c || []).map((r: CompletionRow) => r.formation_id)));
    })();
  }, [open, userId]);

  const markDone = async (id: string) => {
    const { error } = await supabase.from("formation_completions").insert({ user_id: userId, formation_id: id });
    if (error) { toast.error("Erreur"); return; }
    setCompleted(prev => new Set(prev).add(id));
    toast.success("Formation validée");
    setActive(null);
  };

  return (
    <Sheet open={open} onClose={() => { setActive(null); onClose(); }} title={active ? active.title : "Formations"}>
      {!active && (
        <>
          {formations.length === 0 ? (
            <div className="rounded-lg px-4 py-6 text-center" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", fontSize: 12, color: "var(--muted-foreground)" }}>
              Aucune formation disponible
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {formations.map(f => {
                const done = completed.has(f.id);
                return (
                  <button key={f.id} onClick={() => setActive(f)} className="rounded-xl px-4 py-3 text-left flex items-center gap-3"
                    style={{ backgroundColor: "#fff", border: `0.5px solid ${done ? "var(--success-text)" : "rgba(0,0,0,0.08)"}` }}>
                    <div className="rounded-lg flex items-center justify-center" style={{ width: 36, height: 36, backgroundColor: done ? "var(--success-bg)" : "var(--coral-light)" }}>
                      {done ? <Check size={16} style={{ color: "var(--success-text)" }} /> : <GraduationCap size={16} style={{ color: "var(--coral-dark)" }} />}
                    </div>
                    <div className="flex-1">
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{f.title}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                        {f.duration_min ? `${f.duration_min} min` : "—"}{f.required_role ? ` · ${f.required_role}` : ""}{done ? " · validée" : ""}
                      </div>
                    </div>
                    <Play size={14} style={{ color: "var(--muted-foreground)" }} />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {active && (
        <>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 12 }}>
            {active.duration_min ? `${active.duration_min} min` : "Durée libre"}
          </div>
          {active.video_url ? (
            <video src={active.video_url} controls className="w-full rounded-lg mb-4" style={{ maxHeight: 280, backgroundColor: "#000" }} />
          ) : (
            <div className="rounded-lg flex items-center justify-center mb-4" style={{ height: 160, backgroundColor: "var(--muted)", fontSize: 12, color: "var(--muted-foreground)" }}>
              Pas de vidéo associée
            </div>
          )}
          {active.description && <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16, whiteSpace: "pre-wrap" }}>{active.description}</div>}
          {completed.has(active.id) ? (
            <div className="rounded-md py-3 text-center" style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
              <Check size={14} className="inline mr-1.5" /> Formation déjà validée
            </div>
          ) : (
            <PrimaryButton onClick={() => markDone(active.id)}>Marquer comme terminée</PrimaryButton>
          )}
          <button onClick={() => setActive(null)} className="w-full mt-2 py-2.5" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>← Retour à la liste</button>
        </>
      )}
    </Sheet>
  );
}

interface MyRequest {
  id: string; type: string; reason: string; status: string; urgency: string; created_at: string; admin_response: string | null;
}
export function MyRequestsSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const [items, setItems] = useState<MyRequest[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("modification_requests")
        .select("id,type,reason,status,urgency,created_at,admin_response")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      setItems(data || []);
    })();
  }, [open, userId]);

  const cancel = async (id: string) => {
    const { error } = await supabase.from("modification_requests").delete().eq("id", id);
    if (error) { toast.error("Impossible (déjà traitée ?)"); return; }
    setItems(prev => prev.filter(r => r.id !== id));
    toast.success("Demande annulée");
  };

  const statusLabels: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: "En attente", bg: "var(--warning-bg)", color: "var(--warning-text)" },
    accepted: { label: "Acceptée", bg: "var(--success-bg)", color: "var(--success-text)" },
    refused: { label: "Refusée", bg: "var(--danger-bg)", color: "var(--danger-text)" },
  };
  const typeLabels: Record<string, string> = { swap: "Échange", cancel: "Annulation", time_change: "Changement d'horaire" };

  return (
    <Sheet open={open} onClose={onClose} title="Mes demandes">
      {items.length === 0 ? (
        <div className="rounded-lg px-4 py-6 text-center" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", fontSize: 12, color: "var(--muted-foreground)" }}>
          Aucune demande pour le moment
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(r => {
            const s = statusLabels[r.status] || statusLabels.pending;
            return (
              <div key={r.id} className="rounded-xl px-4 py-3" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}>
                <div className="flex items-center justify-between mb-1">
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{typeLabels[r.type] || r.type}</div>
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 4 }}>{fmtRelative(r.created_at)}</div>
                <div style={{ fontSize: 13, lineHeight: 1.4 }}>{r.reason}</div>
                {r.admin_response && (
                  <div className="mt-2 rounded-md px-3 py-2" style={{ backgroundColor: "var(--muted)", fontSize: 12 }}>
                    <span style={{ fontWeight: 500 }}>Réponse : </span>{r.admin_response}
                  </div>
                )}
                {r.status === "pending" && (
                  <button onClick={() => cancel(r.id)} className="mt-2" style={{ fontSize: 11, color: "var(--danger-text)" }}>Annuler la demande</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
