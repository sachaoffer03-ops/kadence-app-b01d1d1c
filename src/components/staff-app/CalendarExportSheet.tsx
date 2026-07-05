import { useEffect, useState } from "react";
import { Calendar, Copy, Check, X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CalendarExportSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"https" | "webcal" | null>(null);

  useEffect(() => {
    if (!open || token) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("calendar_token")
        .eq("id", userId)
        .maybeSingle();
      if (error || !data?.calendar_token) {
        toast.error("Impossible de récupérer ton lien calendrier");
      } else {
        setToken(data.calendar_token as string);
      }
      setLoading(false);
    })();
  }, [open, userId, token]);

  if (!open) return null;

  // Toujours utiliser l'URL publiée stable : Apple/Google ne peuvent pas
  // s'abonner à l'URL de preview (protégée par auth Lovable).
  const PUBLIC_BASE = "https://app.kadence.be";
  const httpsUrl = token ? `${PUBLIC_BASE}/api/public/calendar/${token}.ics` : "";
  const webcalUrl = token ? httpsUrl.replace(/^https?:/, "webcal:") : "";

  const copy = async (text: string, which: "https" | "webcal") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      toast.success("Lien copié");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        backgroundColor: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full"
        style={{
          maxWidth: 520,
          backgroundColor: "#FAFAF8",
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          padding: "20px 20px 32px",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, backgroundColor: "var(--coral-bg, #FCE9DF)", color: "var(--coral, #F0997B)" }}>
              <Calendar size={16} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Ajouter à mon calendrier</div>
          </div>
          <button onClick={onClose} className="rounded-full flex items-center justify-center" style={{ width: 30, height: 30, backgroundColor: "rgba(0,0,0,0.04)" }}>
            <X size={14} />
          </button>
        </div>

        <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6, marginBottom: 18, lineHeight: 1.5 }}>
          Tes shifts se mettront à jour automatiquement dans ton calendrier. Aucun mot de passe requis.
        </p>

        {loading && (
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", padding: "20px 0", textAlign: "center" }}>
            Préparation du lien…
          </div>
        )}

        {!loading && token && (
          <>
            {/* Apple */}
            <div className="rounded-xl border mb-3" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)", padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Apple Calendar (iPhone, Mac)</div>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.5 }}>
                Touche le bouton ci-dessous, puis confirme « S'abonner ».
              </p>
              <a
                href={webcalUrl}
                className="w-full rounded-lg flex items-center justify-center gap-2"
                style={{ height: 40, backgroundColor: "var(--coral, #F0997B)", color: "var(--coral-text, #fff)", fontSize: 13, fontWeight: 500, textDecoration: "none" }}
              >
                <ExternalLink size={14} /> S'abonner sur Apple
              </a>
            </div>

            {/* Google */}
            <div className="rounded-xl border mb-3" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)", padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Google Calendar</div>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.5 }}>
                Sur ordinateur, ouvre Google Agenda → « Autres agendas » → « + » → « À partir d'une URL », puis colle ce lien :
              </p>
              <div className="rounded-lg" style={{ backgroundColor: "var(--muted, #F2F1ED)", padding: "8px 10px", fontSize: 11, wordBreak: "break-all", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "var(--foreground)" }}>
                {httpsUrl}
              </div>
              <button
                onClick={() => copy(httpsUrl, "https")}
                className="w-full rounded-lg flex items-center justify-center gap-2 mt-2"
                style={{ height: 38, backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.12)", fontSize: 12, fontWeight: 500 }}
              >
                {copied === "https" ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier le lien</>}
              </button>
            </div>

            <p style={{ fontSize: 10, color: "var(--muted-foreground)", lineHeight: 1.5, marginTop: 8 }}>
              Garde ce lien privé : il contient ton agenda personnel. La synchronisation peut prendre quelques heures côté Google.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
