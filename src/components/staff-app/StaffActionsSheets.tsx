import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, FormField, TextArea, PrimaryButton, fmtRelative } from "./shared";
import { AlertCircle, GraduationCap, Check, Play, Clock, X as XIcon, ChevronDown, CalendarOff, Camera } from "lucide-react";
import { createModificationRequest, cancelMyRequest } from "@/lib/demandes.functions";

type SignalCategory = "stock" | "materiel" | "hygiene" | "autre";
const CATS: { key: SignalCategory; label: string }[] = [
  { key: "stock", label: "Stock" },
  { key: "materiel", label: "Matériel" },
  { key: "hygiene", label: "Hygiène" },
  { key: "autre", label: "Autre" },
];

const MAX_PHOTOS = 3;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_DIMENSION = 1600;
const COMPRESSION_QUALITY = 0.82;

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (!blob) { resolve(file); return; }
          if (blob.size >= file.size) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        }, "image/jpeg", COMPRESSION_QUALITY);
      } catch {
        URL.revokeObjectURL(url);
        resolve(file);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible")); };
    img.src = url;
  });
}

export function SignalementSheet({ open, onClose, userId, studioId }: { open: boolean; onClose: () => void; userId: string; studioId: string | null }) {
  const [cat, setCat] = useState<SignalCategory>("stock");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCat("stock"); setMsg("");
      photos.forEach(p => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setUploadProgress(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup object URLs on unmount (fix memory leak)
  useEffect(() => {
    return () => { photos.forEach(p => URL.revokeObjectURL(p.preview)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) { toast.error(`Max ${MAX_PHOTOS} photos`); return; }
    const accepted: { file: File; preview: string }[] = [];
    for (const f of files.slice(0, remaining)) {
      const mime = (f.type || "").toLowerCase();
      const nameLower = f.name.toLowerCase();
      if (nameLower.endsWith(".heic") || nameLower.endsWith(".heif") || mime === "image/heic" || mime === "image/heif") {
        toast.error("Format HEIC non supporté. Réglages iPhone › Appareil photo › Formats › « Plus compatible ».");
        continue;
      }
      if (!ACCEPTED_MIME.includes(mime)) { toast.error("Format non supporté (JPG, PNG, WEBP)"); continue; }
      if (f.size > MAX_BYTES) { toast.error(`${f.name} dépasse 10 Mo`); continue; }
      accepted.push({ file: f, preview: URL.createObjectURL(f) });
    }
    if (accepted.length) setPhotos(prev => [...prev, ...accepted]);
  };

  const removePhoto = (i: number) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const submit = async () => {
    if (!msg.trim()) { toast.error("Décris le problème"); return; }
    setSubmitting(true);

    const uploadedPaths: string[] = [];
    const urls: string[] = [];
    try {
      for (let i = 0; i < photos.length; i++) {
        setUploadProgress({ current: i + 1, total: photos.length });
        let f: File;
        try { f = await compressImage(photos[i].file); }
        catch { f = photos[i].file; }
        const path = `${userId}/signalements/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, f, {
          contentType: f.type || "image/jpeg", upsert: false,
        });
        if (upErr) throw upErr;
        uploadedPaths.push(path);
        const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(path);
        urls.push(pub.publicUrl);
      }
    } catch (err) {
      if (uploadedPaths.length) {
        await supabase.storage.from("chat-attachments").remove(uploadedPaths).catch(() => {});
      }
      setSubmitting(false);
      setUploadProgress(null);
      toast.error("Erreur d'upload photo");
      return;
    }

    setUploadProgress(null);
    const { error } = await supabase.from("signalements").insert({
      author_id: userId, studio_id: studioId, category: cat, message: msg.trim(), photos: urls,
    });
    if (error) {
      if (uploadedPaths.length) {
        await supabase.storage.from("chat-attachments").remove(uploadedPaths).catch(() => {});
      }
      setSubmitting(false);
      toast.error("Erreur d'envoi");
      return;
    }
    setSubmitting(false);
    toast.success("Signalement envoyé");
    onClose();
  };

  const btnLabel = submitting
    ? (uploadProgress ? `Envoi photo ${uploadProgress.current}/${uploadProgress.total}…` : "Envoi…")
    : "Envoyer";

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
      <FormField label={`Photos (optionnel · ${photos.length}/${MAX_PHOTOS})`}>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative rounded-md overflow-hidden" style={{ aspectRatio: "1/1", border: "0.5px solid rgba(0,0,0,0.12)" }}>
              <img src={p.preview} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => removePhoto(i)} disabled={submitting}
                className="absolute top-1 right-1 rounded-full flex items-center justify-center"
                style={{ width: 20, height: 20, backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}>
                <XIcon size={12} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={submitting}
              className="rounded-md flex flex-col items-center justify-center gap-1"
              style={{ aspectRatio: "1/1", border: "0.5px dashed rgba(0,0,0,0.25)", backgroundColor: "#fff", color: "var(--muted-foreground)", fontSize: 10 }}>
              <Camera size={18} />
              Ajouter
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple
          onChange={onPickFiles} style={{ display: "none" }} />
      </FormField>
      <div className="mt-2"><PrimaryButton onClick={submit} disabled={submitting}>{btnLabel}</PrimaryButton></div>
    </Sheet>
  );
}


type ReqType = "cancel" | "time_change" | "unavailable";
type Urgency = "normal" | "urgent" | "critique";
const REQ_TYPES: { key: ReqType; label: string; desc: string; icon: typeof XIcon }[] = [
  { key: "cancel", label: "Annuler ce shift", desc: "Tu ne pourras pas être là", icon: XIcon },
  { key: "time_change", label: "Décaler", desc: "Propose un autre créneau le même jour", icon: Clock },
  { key: "unavailable", label: "Indispo future", desc: "Signale une période d'indisponibilité", icon: CalendarOff },
];

interface ShiftOption {
  id: string; shift_date: string; start_time: string; end_time: string; business_role: string;
}

function urgencyFromDate(shiftDate: string, startTime: string): Urgency {
  const dt = new Date(`${shiftDate}T${startTime}`).getTime();
  const diffH = (dt - Date.now()) / (1000 * 60 * 60);
  if (diffH < 24) return "critique";
  if (diffH < 72) return "urgent";
  return "normal";
}

export function RequestModificationSheet({ open, onClose, userId, shiftId }: { open: boolean; onClose: () => void; userId: string; shiftId: string | null }) {
  const [type, setType] = useState<ReqType>("cancel");
  const [urgency, setUrgency] = useState<Urgency>("normal");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [propStart, setPropStart] = useState("");
  const [propEnd, setPropEnd] = useState("");
  const [unavailStart, setUnavailStart] = useState("");
  const [unavailEnd, setUnavailEnd] = useState("");

  const createFn = useServerFn(createModificationRequest);

  useEffect(() => {
    if (!open) return;
    setType("cancel"); setUrgency("normal"); setReason("");
    setSelectedShift(shiftId || null);
    setPropStart(""); setPropEnd("");
    const today = new Date().toISOString().slice(0, 10);
    setUnavailStart(today); setUnavailEnd(today);

    (async () => {
      const { data } = await supabase.from("shifts")
        .select("id,shift_date,start_time,end_time,business_role")
        .eq("user_id", userId)
        .gte("shift_date", today)
        .order("shift_date").order("start_time");
      setShifts((data as ShiftOption[]) || []);
    })();
  }, [open, userId, shiftId]);

  useEffect(() => {
    if (!selectedShift) return;
    const s = shifts.find(x => x.id === selectedShift);
    if (!s) return;
    setUrgency(urgencyFromDate(s.shift_date, s.start_time));
    if (type === "time_change" && !propStart) {
      setPropStart(s.start_time.slice(0, 5));
      setPropEnd(s.end_time.slice(0, 5));
    }
  }, [selectedShift, shifts, type, propStart]);

  const needsShift = type === "cancel" || type === "time_change";

  const submit = async () => {
    if (reason.trim().length === 0) { toast.error("Indique la raison"); return; }
    if (needsShift && !selectedShift) { toast.error("Sélectionne un shift"); return; }
    if (type === "time_change" && (!propStart || !propEnd)) { toast.error("Indique le créneau proposé"); return; }
    if (type === "unavailable" && (!unavailStart || !unavailEnd)) { toast.error("Indique la période"); return; }
    if (type === "unavailable" && unavailStart > unavailEnd) { toast.error("La date de fin doit être après le début"); return; }

    setSubmitting(true);
    try {
      await createFn({
        data: {
          type,
          shiftId: needsShift ? selectedShift : null,
          reason: reason.trim(),
          urgency,
          proposedStartTime: type === "time_change" ? propStart : null,
          proposedEndTime: type === "time_change" ? propEnd : null,
          proposedStartDate: type === "unavailable" ? unavailStart : null,
          proposedEndDate: type === "unavailable" ? unavailEnd : null,
        },
      });
      toast.success("Demande envoyée, tu seras notifié de la décision");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const formatShiftLabel = (s: ShiftOption) => {
    const date = new Date(s.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    return `${date} · ${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)} · ${s.business_role}`;
  };

  const selected = shifts.find(s => s.id === selectedShift) || null;

  return (
    <Sheet open={open} onClose={onClose} title="Modifier un shift">
      <FormField label="Que veux-tu faire ?">
        <div className="flex flex-col gap-1.5">
          {REQ_TYPES.map(t => {
            const active = type === t.key;
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setType(t.key)} className="rounded-md px-3 py-2.5 flex items-center gap-3 text-left transition-colors"
                style={{
                  backgroundColor: active ? "var(--coral-light)" : "#fff",
                  border: `0.5px solid ${active ? "var(--coral)" : "rgba(0,0,0,0.12)"}`,
                }}>
                <Icon size={16} style={{ color: active ? "var(--coral-dark)" : "var(--muted-foreground)" }} />
                <div className="flex-1">
                  <div style={{ fontSize: 12, fontWeight: 500, color: active ? "var(--coral-dark)" : "var(--foreground)" }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </FormField>

      {needsShift && (
        <FormField label="Quel shift ?" hint={shifts.length === 0 ? undefined : "Choisis le shift concerné."}>
          {shifts.length === 0 ? (
            <div className="rounded-md px-3 py-3" style={{ fontSize: 12, backgroundColor: "var(--muted)", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              Aucun shift à venir.
            </div>
          ) : (
            <ShiftDropdown shifts={shifts} value={selected} onChange={(id) => setSelectedShift(id)} formatLabel={formatShiftLabel} />
          )}
        </FormField>
      )}

      {type === "time_change" && selected && (
        <FormField label="Nouveau créneau proposé">
          <div className="flex items-center gap-2">
            <input type="time" value={propStart} onChange={e => setPropStart(e.target.value)}
              className="rounded-md px-2.5 py-2 flex-1" style={{ fontSize: 12, border: "0.5px solid rgba(0,0,0,0.12)" }} />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>→</span>
            <input type="time" value={propEnd} onChange={e => setPropEnd(e.target.value)}
              className="rounded-md px-2.5 py-2 flex-1" style={{ fontSize: 12, border: "0.5px solid rgba(0,0,0,0.12)" }} />
          </div>
        </FormField>
      )}

      {type === "unavailable" && (
        <FormField label="Période d'indisponibilité">
          <div className="flex items-center gap-2">
            <input type="date" value={unavailStart} onChange={e => setUnavailStart(e.target.value)}
              className="rounded-md px-2.5 py-2 flex-1" style={{ fontSize: 12, border: "0.5px solid rgba(0,0,0,0.12)" }} />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>→</span>
            <input type="date" value={unavailEnd} onChange={e => setUnavailEnd(e.target.value)}
              className="rounded-md px-2.5 py-2 flex-1" style={{ fontSize: 12, border: "0.5px solid rgba(0,0,0,0.12)" }} />
          </div>
        </FormField>
      )}

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
      <FormField label="Raison" hint="Max 500 caractères.">
        <TextArea value={reason} onChange={(v) => setReason(v.slice(0, 500))} rows={4}
          placeholder="Ex: Examen ce matin-là / Maladie / Conflit avec un autre engagement..." />
      </FormField>
      <div className="mt-2"><PrimaryButton onClick={submit} disabled={submitting}>{submitting ? "Envoi…" : "Envoyer la demande"}</PrimaryButton></div>
    </Sheet>
  );
}

export function FormationsSheet({ open, onClose, userId: _userId }: { open: boolean; onClose: () => void; userId: string }) {
  return (
    <Sheet open={open} onClose={onClose} title="Formations">
      <div className="rounded-lg px-4 py-8 text-center flex flex-col items-center gap-3"
        style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}>
        <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, backgroundColor: "var(--coral-light)" }}>
          <GraduationCap size={20} style={{ color: "var(--coral-dark)" }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>Refonte en cours</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", maxWidth: 260, lineHeight: 1.5 }}>
          Le nouveau parcours de formation sera disponible bientôt.
        </div>
      </div>
    </Sheet>
  );
}


interface MyRequest {
  id: string; type: string; reason: string; status: string; urgency: string; created_at: string; admin_response: string | null; shift_id: string | null;
}
interface RequestShift { id: string; shift_date: string; start_time: string; end_time: string; business_role: string; }
interface MyRequestRow extends MyRequest { resolved_at: string | null }
type Tab = "ongoing" | "history";
export function MyRequestsSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const [items, setItems] = useState<MyRequestRow[]>([]);
  const [shiftsById, setShiftsById] = useState<Record<string, RequestShift>>({});
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("ongoing");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadRequests = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("modification_requests")
        .select("id,type,reason,status,urgency,created_at,admin_response,shift_id,resolved_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      if (cancelled) return;
      if (error) {
        toast.error("Impossible de charger tes demandes");
        setItems([]);
        setShiftsById({});
        setLoading(false);
        return;
      }

      const rows = (data || []) as MyRequestRow[];
      setItems(rows);
      const shiftIds = [...new Set(rows.map(r => r.shift_id).filter(Boolean) as string[])];
      if (shiftIds.length === 0) {
        setShiftsById({});
        setLoading(false);
        return;
      }

      const { data: shiftRows } = await supabase.from("shifts")
        .select("id,shift_date,start_time,end_time,business_role")
        .in("id", shiftIds);
      if (!cancelled) {
        setShiftsById(Object.fromEntries(((shiftRows || []) as RequestShift[]).map(s => [s.id, s])));
        setLoading(false);
      }
    };
    loadRequests();

    const channel = supabase.channel(`my-requests-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "modification_requests", filter: `user_id=eq.${userId}` }, loadRequests)
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
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
  const typeLabels: Record<string, string> = { swap: "Échange", cancel: "Annulation", time_change: "Changement d'horaire", unavailable: "Indisponibilité" };
  const urgencyLabels: Record<string, string> = { normal: "Normale", urgent: "Urgente", critique: "Critique" };

  const formatShift = (shiftId: string | null) => {
    if (!shiftId) return "Sans shift lié";
    const shift = shiftsById[shiftId];
    if (!shift) return "Shift non disponible";
    const date = new Date(shift.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    return `${date} · ${shift.start_time.slice(0,5)}–${shift.end_time.slice(0,5)} · ${shift.business_role}`;
  };

  const ongoing = items.filter(r => (r.status || "pending").toLowerCase() === "pending");
  const history = items.filter(r => (r.status || "pending").toLowerCase() !== "pending");
  const visible = tab === "ongoing" ? ongoing : history;

  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <Sheet open={open} onClose={onClose} title="Mes demandes">
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {([
          { key: "ongoing" as Tab, label: `En cours${ongoing.length ? ` · ${ongoing.length}` : ""}` },
          { key: "history" as Tab, label: `Historique${history.length ? ` · ${history.length}` : ""}` },
        ]).map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className="rounded-md py-2"
              style={{
                fontSize: 12, fontWeight: active ? 500 : 400,
                backgroundColor: active ? "var(--foreground)" : "#fff",
                color: active ? "var(--background)" : "var(--foreground)",
                border: `0.5px solid ${active ? "var(--foreground)" : "rgba(0,0,0,0.12)"}`,
              }}>{t.label}</button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg px-4 py-6 text-center" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", fontSize: 12, color: "var(--muted-foreground)" }}>
          {tab === "ongoing" ? "Aucune demande en cours." : "Aucune demande traitée pour le moment."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map(r => {
            const status = (r.status || "pending").toLowerCase();
            const s = statusLabels[status] || statusLabels.pending;
            return (
              <div key={r.id} className="rounded-xl px-4 py-3" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}>
                <div className="flex items-center justify-between mb-1">
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{typeLabels[r.type] || r.type}</div>
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>
                  Urgence {urgencyLabels[r.urgency] || r.urgency}
                </div>
                <div className="rounded-md px-3 py-2 mb-2" style={{ backgroundColor: "var(--muted)", fontSize: 12, color: "var(--muted-foreground)" }}>
                  {formatShift(r.shift_id)}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 10 }}>{r.reason}</div>

                {/* Timeline historique */}
                <div className="flex flex-col gap-2 pl-3" style={{ borderLeft: "1.5px solid var(--muted)" }}>
                  <TimelineStep
                    dotColor="var(--coral)"
                    title="Demande envoyée"
                    date={fmtDateTime(r.created_at)}
                  />
                  {status === "pending" ? (
                    <TimelineStep
                      dotColor="var(--warning-text)"
                      title="En attente de réponse"
                      date="L'admin doit valider ta demande"
                      muted
                    />
                  ) : (
                    <TimelineStep
                      dotColor={s.color}
                      title={status === "accepted" ? "Demande acceptée" : "Demande refusée"}
                      date={r.resolved_at ? fmtDateTime(r.resolved_at) : "Date inconnue"}
                      message={r.admin_response || undefined}
                    />
                  )}
                </div>

                {status === "pending" && (
                  <button onClick={() => cancel(r.id)} className="mt-3" style={{ fontSize: 11, color: "var(--danger-text)" }}>Annuler la demande</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

function TimelineStep({ dotColor, title, date, message, muted }: { dotColor: string; title: string; date: string; message?: string; muted?: boolean }) {
  return (
    <div className="relative">
      <span style={{ position: "absolute", left: -18, top: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor, boxShadow: "0 0 0 2px #fff" }} />
      <div style={{ fontSize: 12, fontWeight: 500, color: muted ? "var(--muted-foreground)" : "var(--foreground)" }}>{title}</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{date}</div>
      {message && <div className="mt-1 rounded-md px-2.5 py-1.5" style={{ backgroundColor: "var(--muted)", fontSize: 12, lineHeight: 1.4 }}>{message}</div>}
    </div>
  );
}

// ============================================================================
// Sélecteur de shift : menu déroulant propre, groupé par mois
// ============================================================================
function ShiftDropdown({
  shifts, value, onChange, formatLabel,
}: {
  shifts: ShiftOption[];
  value: ShiftOption | null;
  onChange: (id: string) => void;
  formatLabel: (s: ShiftOption) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Group by "Mois Année"
  const groups = shifts.reduce<Record<string, ShiftOption[]>>((acc, s) => {
    const d = new Date(s.shift_date);
    const key = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    (acc[key] = acc[key] || []).push(s);
    return acc;
  }, {});

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full rounded-md px-3 py-2.5 flex items-center justify-between text-left transition-colors"
        style={{
          fontSize: 12,
          fontWeight: value ? 500 : 400,
          backgroundColor: "#fff",
          border: `0.5px solid ${open ? "var(--coral)" : "rgba(0,0,0,0.12)"}`,
          color: value ? "var(--foreground)" : "var(--muted-foreground)",
        }}
      >
        <span className="truncate">{value ? formatLabel(value) : "Sélectionne un shift"}</span>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0, marginLeft: 8 }} />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 mt-1.5 rounded-lg overflow-hidden z-50"
          style={{
            backgroundColor: "#fff",
            border: "0.5px solid rgba(0,0,0,0.12)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {Object.entries(groups).map(([month, list]) => (
            <div key={month}>
              <div
                className="px-3 py-1.5 sticky top-0"
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "var(--muted-foreground)",
                  backgroundColor: "var(--muted)",
                  borderBottom: "0.5px solid rgba(0,0,0,0.06)",
                }}
              >
                {month}
              </div>
              {list.map(s => {
                const active = value?.id === s.id;
                const d = new Date(s.shift_date);
                const day = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { onChange(s.id); setOpen(false); }}
                    className="w-full px-3 py-2.5 flex items-center justify-between text-left transition-colors hover:bg-[var(--muted)]"
                    style={{
                      fontSize: 12,
                      backgroundColor: active ? "var(--coral-light)" : "transparent",
                      color: active ? "var(--coral-dark)" : "var(--foreground)",
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    <div className="flex flex-col">
                      <span style={{ textTransform: "capitalize" }}>{day}</span>
                      <span style={{ fontSize: 10, color: active ? "var(--coral-dark)" : "var(--muted-foreground)", marginTop: 1 }}>
                        {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)} · {s.business_role}
                      </span>
                    </div>
                    {active && <Check size={14} style={{ color: "var(--coral)" }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
