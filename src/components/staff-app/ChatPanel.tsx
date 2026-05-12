import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, MessageCircle, Plus, Camera, Image as ImageIcon, Paperclip, X, FileText, Download } from "lucide-react";

interface Msg {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  read_at: string | null;
  created_at: string;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
}

interface Props {
  meId: string;
  peerId: string | null;
  peerName: string;
}

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return "Aujourd'hui";
  if (target.getTime() === yest.getTime()) return "Hier";
  return target.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function fmtSize(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(1)} Mo`;
}

const MAX_BYTES = 20 * 1024 * 1024; // 20 Mo

export function ChatPanel({ meId, peerId, peerName }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const platform = useMemo(detectPlatform, []);

  useEffect(() => {
    if (!meId || !peerId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.from("messages")
        .select("id,sender_id,recipient_id,content,read_at,created_at,attachment_url,attachment_type,attachment_name,attachment_size")
        .or(`and(sender_id.eq.${meId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${meId})`)
        .order("created_at", { ascending: true })
        .limit(500);
      if (cancelled) return;
      setMessages((data as Msg[]) || []);
      const toRead = (data as Msg[] | null)?.filter(m => m.recipient_id === meId && !m.read_at).map(m => m.id) || [];
      if (toRead.length > 0) {
        await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", toRead);
      }
    };
    load();

    const channel = supabase.channel(`messages-tab-${meId}-${peerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Msg;
        if ((m.sender_id === meId && m.recipient_id === peerId) || (m.sender_id === peerId && m.recipient_id === meId)) {
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
          if (m.recipient_id === meId) {
            supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id).then(() => {});
          }
        }
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [meId, peerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const grouped = useMemo(() => {
    const out: { day: string; items: Msg[] }[] = [];
    for (const m of messages) {
      const k = m.created_at.slice(0, 10);
      const last = out[out.length - 1];
      if (last && last.day === k) last.items.push(m);
      else out.push({ day: k, items: [m] });
    }
    return out;
  }, [messages]);

  const send = async () => {
    const txt = input.trim();
    if (!txt || sending || !peerId) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: meId, recipient_id: peerId, content: txt,
    });
    setSending(false);
    if (error) { toast.error("Échec de l'envoi"); return; }
    setInput("");
  };

  const uploadAndSend = async (file: File) => {
    if (!peerId) return;
    if (file.size > MAX_BYTES) {
      toast.error("Fichier trop lourd", { description: "20 Mo maximum" });
      return;
    }
    setUploading(true);
    setAttachOpen(false);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${meId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      const { error } = await supabase.from("messages").insert({
        sender_id: meId,
        recipient_id: peerId,
        content: "",
        attachment_url: pub.publicUrl,
        attachment_type: file.type || "application/octet-stream",
        attachment_name: file.name,
        attachment_size: file.size,
      });
      if (error) throw error;
    } catch (e) {
      console.error(e);
      toast.error("Échec de l'envoi");
    } finally {
      setUploading(false);
    }
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) uploadAndSend(f);
  };

  const peerInitials = initialsOf(peerName);
  const isIOS = platform === "ios";

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)", backgroundColor: "#FAF8F4" }}>
      <div
        className="flex items-center gap-3 px-5 shrink-0"
        style={{ paddingTop: 56, paddingBottom: 14, borderBottom: "0.5px solid rgba(0,0,0,0.06)", backgroundColor: "#FAF8F4" }}
      >
        <div
          className="rounded-full flex items-center justify-center shrink-0"
          style={{ width: 42, height: 42, backgroundColor: "var(--coral-light)", border: "0.5px solid var(--coral)", color: "var(--coral-dark)", fontSize: 13, fontWeight: 500 }}
        >
          {peerInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.2 }}>{peerName}</div>
          <div className="flex items-center gap-1.5" style={{ marginTop: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "var(--success-text, #4A7C59)" }} />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Administrateur · répond en général dans la journée</span>
          </div>
        </div>
      </div>

      {!peerId ? (
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <div>
            <div className="rounded-full flex items-center justify-center mx-auto mb-4" style={{ width: 56, height: 56, backgroundColor: "rgba(0,0,0,0.04)" }}>
              <MessageCircle size={22} strokeWidth={1.5} style={{ color: "var(--muted-foreground)" }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucun administrateur disponible</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>La conversation s'activera dès qu'un admin sera assigné à ton studio.</div>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center text-center px-2" style={{ paddingTop: 48 }}>
                <div className="rounded-full flex items-center justify-center mb-4" style={{ width: 64, height: 64, backgroundColor: "var(--coral-light)", border: "0.5px solid rgba(240,153,123,0.4)" }}>
                  <MessageCircle size={26} strokeWidth={1.5} style={{ color: "var(--coral-dark)" }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Démarre la conversation</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.55, maxWidth: 280 }}>
                  Signale ce qui manque, demande une info ou pose une question. Ton admin verra ton message en temps réel.
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {grouped.map((g) => (
                  <div key={g.day} className="flex flex-col gap-1">
                    <div className="self-center rounded-full px-3 py-1 my-2" style={{ fontSize: 10, color: "var(--muted-foreground)", backgroundColor: "rgba(0,0,0,0.04)", textTransform: "capitalize" }}>
                      {dayLabel(g.day)}
                    </div>
                    {g.items.map((m, i) => {
                      const mine = m.sender_id === meId;
                      const prev = g.items[i - 1];
                      const groupedWithPrev = prev && (prev.sender_id === m.sender_id) && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 2 * 60 * 1000);
                      const next = g.items[i + 1];
                      const groupedWithNext = next && (next.sender_id === m.sender_id) && (new Date(next.created_at).getTime() - new Date(m.created_at).getTime() < 2 * 60 * 1000);
                      const isImage = m.attachment_type?.startsWith("image/");
                      const hasAttachment = !!m.attachment_url;
                      const hasText = !!(m.content && m.content.trim());

                      const radius = {
                        borderRadius: 18,
                        borderTopRightRadius: mine && groupedWithPrev ? 6 : 18,
                        borderBottomRightRadius: mine && groupedWithNext ? 6 : 18,
                        borderTopLeftRadius: !mine && groupedWithPrev ? 6 : 18,
                        borderBottomLeftRadius: !mine && groupedWithNext ? 6 : 18,
                      };

                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`} style={{ marginTop: groupedWithPrev ? 2 : 8 }}>
                          <div className="flex flex-col" style={{ maxWidth: "78%", alignItems: mine ? "flex-end" : "flex-start" }}>
                            {hasAttachment && isImage && (
                              <button
                                onClick={() => setLightbox({ url: m.attachment_url!, name: m.attachment_name || "image" })}
                                style={{
                                  ...radius,
                                  overflow: "hidden",
                                  padding: 0,
                                  border: mine ? "none" : "0.5px solid rgba(0,0,0,0.06)",
                                  marginBottom: hasText ? 4 : 0,
                                  backgroundColor: "rgba(0,0,0,0.04)",
                                  maxWidth: 240,
                                }}
                              >
                                <img src={m.attachment_url!} alt={m.attachment_name || ""} style={{ display: "block", width: "100%", height: "auto", maxHeight: 280, objectFit: "cover" }} />
                              </button>
                            )}
                            {hasAttachment && !isImage && (
                              <a
                                href={m.attachment_url!}
                                target="_blank"
                                rel="noreferrer"
                                download={m.attachment_name || undefined}
                                style={{
                                  ...radius,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: "10px 14px",
                                  backgroundColor: mine ? "var(--coral)" : "#fff",
                                  color: mine ? "var(--coral-text)" : "var(--foreground)",
                                  border: mine ? "none" : "0.5px solid rgba(0,0,0,0.06)",
                                  marginBottom: hasText ? 4 : 0,
                                  maxWidth: 260,
                                  boxShadow: mine ? "none" : "0 1px 2px rgba(0,0,0,0.03)",
                                }}
                              >
                                <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 36, height: 36, backgroundColor: mine ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.05)" }}>
                                  <FileText size={16} style={{ color: mine ? "var(--coral-text)" : "var(--muted-foreground)" }} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.attachment_name}</div>
                                  <div style={{ fontSize: 10.5, opacity: 0.7 }}>{fmtSize(m.attachment_size)}</div>
                                </div>
                                <Download size={14} style={{ opacity: 0.7, flexShrink: 0 }} />
                              </a>
                            )}
                            {hasText && (
                              <div
                                className="px-4 py-2.5"
                                style={{
                                  ...radius,
                                  fontSize: 13.5,
                                  lineHeight: 1.45,
                                  backgroundColor: mine ? "var(--coral)" : "#fff",
                                  color: mine ? "var(--coral-text)" : "var(--foreground)",
                                  border: mine ? "none" : "0.5px solid rgba(0,0,0,0.06)",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  boxShadow: mine ? "none" : "0 1px 2px rgba(0,0,0,0.03)",
                                }}
                              >
                                {m.content}
                              </div>
                            )}
                            {!groupedWithNext && (
                              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 3, paddingLeft: mine ? 0 : 4, paddingRight: mine ? 4 : 0 }}>
                                {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                {mine && m.read_at && <span style={{ marginLeft: 4 }}>· Lu</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div
            className="flex items-end gap-2 px-4 py-3 shrink-0"
            style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)", backgroundColor: "#FAF8F4", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <button
              onClick={() => setAttachOpen(true)}
              disabled={uploading}
              aria-label="Ajouter une pièce jointe"
              className="rounded-full flex items-center justify-center shrink-0 transition-colors"
              style={{
                width: 40, height: 40,
                backgroundColor: isIOS ? "transparent" : "rgba(0,0,0,0.04)",
                color: "var(--foreground)",
                border: isIOS ? "0.5px solid rgba(0,0,0,0.12)" : "none",
                opacity: uploading ? 0.5 : 1,
              }}
            >
              <Plus size={20} strokeWidth={isIOS ? 1.6 : 2} />
            </button>

            <div
              className="flex-1 flex items-end"
              style={{ backgroundColor: "#fff", borderRadius: 22, border: "0.5px solid rgba(0,0,0,0.08)", paddingLeft: 16, paddingRight: 8, paddingTop: 6, paddingBottom: 6 }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={uploading ? "Envoi en cours…" : "Écris un message…"}
                rows={1}
                className="flex-1 outline-none resize-none bg-transparent"
                style={{ fontSize: 13.5, lineHeight: 1.45, maxHeight: 120, paddingTop: 6, paddingBottom: 6 }}
              />
            </div>
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="rounded-full flex items-center justify-center transition-opacity disabled:opacity-30"
              style={{ width: 44, height: 44, backgroundColor: "var(--coral)", color: "var(--coral-text)", flexShrink: 0 }}
              aria-label="Envoyer"
            >
              <Send size={17} strokeWidth={2} style={{ marginLeft: -1 }} />
            </button>
          </div>
        </>
      )}

      {/* Inputs cachés (le navigateur ouvre la sélection native iOS/Android) */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFilePicked} />
      <input ref={photoRef} type="file" accept="image/*,video/*" hidden onChange={onFilePicked} />
      <input ref={fileRef} type="file" hidden onChange={onFilePicked} />

      {/* Sheet pièces jointes — design adapté plateforme */}
      {attachOpen && (
        <AttachSheet
          platform={platform}
          onClose={() => setAttachOpen(false)}
          onCamera={() => cameraRef.current?.click()}
          onPhoto={() => photoRef.current?.click()}
          onFile={() => fileRef.current?.click()}
        />
      )}

      {/* Lightbox image */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 rounded-full flex items-center justify-center"
            style={{ width: 40, height: 40, backgroundColor: "rgba(255,255,255,0.12)", color: "#fff" }}
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
          <img src={lightbox.url} alt={lightbox.name} style={{ maxWidth: "94vw", maxHeight: "88vh", objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}

function AttachSheet({
  platform, onClose, onCamera, onPhoto, onFile,
}: {
  platform: Platform;
  onClose: () => void;
  onCamera: () => void;
  onPhoto: () => void;
  onFile: () => void;
}) {
  const isIOS = platform === "ios";

  if (isIOS) {
    // iOS — Action sheet style (boutons empilés, séparateurs fins, bouton "Annuler" détaché)
    const Item = ({ icon, label, onClick, first, last }: { icon: React.ReactNode; label: string; onClick: () => void; first?: boolean; last?: boolean }) => (
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between px-5 active:bg-black/5 transition-colors"
        style={{
          paddingTop: 16, paddingBottom: 16,
          borderTop: first ? "none" : "0.5px solid rgba(0,0,0,0.08)",
          borderTopLeftRadius: first ? 14 : 0,
          borderTopRightRadius: first ? 14 : 0,
          borderBottomLeftRadius: last ? 14 : 0,
          borderBottomRightRadius: last ? 14 : 0,
          backgroundColor: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(20px)",
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 400, color: "var(--coral-dark)" }}>{label}</span>
        <span style={{ color: "var(--coral-dark)" }}>{icon}</span>
      </button>
    );

    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
        <div className="px-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
          <div className="overflow-hidden" style={{ borderRadius: 14, marginBottom: 8 }}>
            <Item first icon={<Camera size={20} strokeWidth={1.6} />} label="Prendre une photo" onClick={onCamera} />
            <Item icon={<ImageIcon size={20} strokeWidth={1.6} />} label="Photothèque" onClick={onPhoto} />
            <Item last icon={<Paperclip size={20} strokeWidth={1.6} />} label="Choisir un fichier" onClick={onFile} />
          </div>
          <button
            onClick={onClose}
            className="w-full active:bg-black/5 transition-colors"
            style={{
              paddingTop: 16, paddingBottom: 16,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.96)",
              fontSize: 17, fontWeight: 500, color: "var(--coral-dark)",
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  // Android / autre — bottom sheet Material (poignée, items en grille avec icônes circulaires)
  const Tile = ({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) => (
    <button onClick={onClick} className="flex flex-col items-center gap-2 active:opacity-70 transition-opacity" style={{ flex: 1 }}>
      <div className="rounded-full flex items-center justify-center" style={{ width: 56, height: 56, backgroundColor: color, color: "#fff" }}>
        {icon}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#FAF8F4",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.18)" }} />
        </div>
        <div className="px-5 pt-3 pb-1" style={{ fontSize: 13, fontWeight: 500, color: "var(--muted-foreground)" }}>
          Joindre
        </div>
        <div className="flex items-start gap-2 px-5 py-5">
          <Tile icon={<Camera size={22} strokeWidth={1.8} />} label="Caméra" onClick={onCamera} color="var(--coral)" />
          <Tile icon={<ImageIcon size={22} strokeWidth={1.8} />} label="Galerie" onClick={onPhoto} color="#7BA89A" />
          <Tile icon={<Paperclip size={22} strokeWidth={1.8} />} label="Fichier" onClick={onFile} color="#8C7BA8" />
        </div>
      </div>
    </div>
  );
}
