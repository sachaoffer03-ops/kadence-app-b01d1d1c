import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Mail,
  Monitor,
  Save,
  ShieldAlert,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Trash2,
  Upload,
} from "lucide-react";
import {
  getBounces30d,
  getComplaints30d,
  getEmailConfig,
  getEmailStats30d,
  reactivateEmail,
  removeOrganizationLogo,
  updateEmailConfig,
  uploadOrganizationLogo,
} from "@/lib/email-admin.functions";
import { previewEmailTemplate } from "@/lib/email-preview.functions";
import { EMAIL_REGISTRY } from "@/emails";

interface Stats {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  delivery_rate: number;
  bounce_rate: number;
  complaint_rate: number;
}

interface SuppressionItem {
  email: string;
  reason: string;
  metadata: any;
  created_at: string;
  template_name: string | null;
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const days = Math.floor(diff / (24 * 3600 * 1000));
  if (days >= 1) return `Il y a ${days} j`;
  const hours = Math.floor(diff / (3600 * 1000));
  if (hours >= 1) return `Il y a ${hours} h`;
  const mins = Math.max(1, Math.floor(diff / 60000));
  return `Il y a ${mins} min`;
}

function cardStyle(): React.CSSProperties {
  return {
    backgroundColor: "var(--card)",
    border: "0.5px solid var(--border)",
    borderRadius: 12,
  };
}

export function EmailsTab() {
  return (
    <div className="flex flex-col gap-5">
      <StatsSection />
      <BrandingSection />
      <SuppressionSection kind="bounce" />
      <SuppressionSection kind="complaint" />
    </div>
  );
}

function StatsSection() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmailStats30d()
      .then((s) => setStats(s as Stats))
      .catch((e: any) => toast.error(e?.message || "Erreur chargement stats"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={cardStyle()} className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <Mail size={15} strokeWidth={1.8} style={{ color: "var(--muted-foreground)" }} />
        <div style={{ fontSize: 15, fontWeight: 500 }}>Statistiques (30 derniers jours)</div>
      </div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 16 }}>
        Vue d'ensemble de la délivrabilité des emails Kadence.
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : !stats || stats.sent === 0 ? (
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Aucune donnée pour les 30 derniers jours.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Envoyés" value={stats.sent.toString()} />
          <Kpi
            label="Délivrés"
            value={stats.delivered.toString()}
            subValue={`${stats.delivery_rate}%`}
            subColor={stats.delivery_rate >= 95 ? "green" : stats.delivery_rate >= 90 ? "orange" : "red"}
            icon={<TrendingUp size={13} />}
          />
          <Kpi
            label="Rebonds"
            value={stats.bounced.toString()}
            subValue={`${stats.bounce_rate}%`}
            subColor={stats.bounce_rate > 5 ? "red" : "neutral"}
            icon={<TrendingDown size={13} />}
          />
          <Kpi
            label="Plaintes spam"
            value={stats.complained.toString()}
            subValue={`${stats.complaint_rate}%`}
            subColor={stats.complaint_rate > 0.1 ? "red" : "neutral"}
            icon={<ShieldAlert size={13} />}
          />
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  subValue,
  subColor = "neutral",
  icon,
}: {
  label: string;
  value: string;
  subValue?: string;
  subColor?: "green" | "orange" | "red" | "neutral";
  icon?: React.ReactNode;
}) {
  const color =
    subColor === "green" ? "#16a34a" :
    subColor === "orange" ? "#d97706" :
    subColor === "red" ? "#dc2626" :
    "var(--muted-foreground)";
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--muted)" }}>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.1 }}>{value}</div>
      {subValue && (
        <div className="flex items-center gap-1 mt-1" style={{ fontSize: 11, color }}>
          {icon}
          <span>{subValue}</span>
        </div>
      )}
    </div>
  );
}

const PREVIEW_TEMPLATE_IDS = [
  "bienvenue-employe",
  "invitation-employe",
  "dispo-deadline-reminder",
] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function BrandingSection() {
  const [initial, setInitial] = useState({
    display_name: "",
    reply_to_email: "",
    logo_url: null as string | null,
  });
  const [displayName, setDisplayName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getEmailConfig()
      .then((c: any) => {
        const next = {
          display_name: c.display_name ?? "",
          reply_to_email: c.reply_to_email ?? "",
          logo_url: c.logo_url ?? null,
        };
        setInitial(next);
        setDisplayName(next.display_name);
        setReplyTo(next.reply_to_email);
        setLogoUrl(next.logo_url);
      })
      .catch((e: any) => toast.error(e?.message || "Erreur chargement config"))
      .finally(() => setLoading(false));
  }, []);

  const dirty =
    displayName.trim() !== initial.display_name ||
    replyTo.trim() !== initial.reply_to_email;

  const save = async () => {
    if (!displayName.trim()) return toast.error("Le nom affiché est requis");
    setSaving(true);
    try {
      await updateEmailConfig({
        data: { display_name: displayName.trim(), reply_to_email: replyTo.trim() },
      });
      setInitial((prev) => ({
        ...prev,
        display_name: displayName.trim(),
        reply_to_email: replyTo.trim(),
      }));
      toast.success(
        "Configuration enregistrée. Les prochains emails utiliseront ce branding.",
      );
    } catch (e: any) {
      toast.error(e?.message || "Erreur enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Fichier trop lourd (max 2 MB)");
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type))
      return toast.error("Format non supporté (PNG, JPEG, WEBP ou SVG)");
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const res: any = await uploadOrganizationLogo({
        data: { mime: file.type, base64 },
      });
      setLogoUrl(res.logo_url);
      setInitial((prev) => ({ ...prev, logo_url: res.logo_url }));
      toast.success("Logo mis à jour");
    } catch (err: any) {
      toast.error(err?.message || "Erreur upload logo");
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    setUploading(true);
    try {
      await removeOrganizationLogo();
      setLogoUrl(null);
      setInitial((prev) => ({ ...prev, logo_url: null }));
      toast.success("Logo retiré — le logo Kadence par défaut sera utilisé");
    } catch (err: any) {
      toast.error(err?.message || "Erreur suppression logo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={cardStyle()} className="p-5">
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
        Configuration branding
      </div>
      <div
        style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 16 }}
      >
        Ce qui apparaît dans les emails envoyés à tes employés. La preview à droite
        se met à jour en temps réel.
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          Chargement…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* --- Colonne gauche : form --- */}
          <div className="flex flex-col gap-4">
            {/* Logo */}
            <div className="flex flex-col gap-2">
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Logo
              </span>
              <div
                className="flex items-center gap-3 p-3 rounded-md"
                style={{ border: "0.5px solid var(--border)" }}
              >
                <div
                  className="flex items-center justify-center rounded-md overflow-hidden shrink-0"
                  style={{
                    width: 64,
                    height: 64,
                    backgroundColor: "var(--muted)",
                    border: "0.5px solid var(--border)",
                  }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt="Logo"
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <ImageIcon size={22} style={{ color: "var(--muted-foreground)" }} />
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="rounded-md px-3 py-1.5 flex items-center gap-1.5"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        border: "0.5px solid var(--border)",
                        opacity: uploading ? 0.5 : 1,
                      }}
                    >
                      {uploading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Upload size={12} />
                      )}
                      {logoUrl ? "Changer le logo" : "Uploader un logo"}
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={removeLogo}
                        disabled={uploading}
                        className="rounded-md px-3 py-1.5 flex items-center gap-1.5"
                        style={{
                          fontSize: 12,
                          color: "var(--muted-foreground)",
                        }}
                      >
                        <Trash2 size={12} />
                        Retirer
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    Carré 1:1, 500×500 px min., PNG / SVG transparent, max 2 MB.
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={onFileChange}
                  style={{ display: "none" }}
                />
              </div>
            </div>

            <label className="flex flex-col gap-1">
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Nom affiché
              </span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex : Skult Studios"
                className="rounded-md px-2 py-1.5 outline-none"
                style={{
                  fontSize: 13,
                  border: "0.5px solid var(--border)",
                  backgroundColor: "var(--background)",
                }}
              />
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Ce nom apparaît comme expéditeur dans la boîte de tes employés.
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Email de réponse
              </span>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="contact@skult-studios.com"
                className="rounded-md px-2 py-1.5 outline-none"
                style={{
                  fontSize: 13,
                  border: "0.5px solid var(--border)",
                  backgroundColor: "var(--background)",
                }}
              />
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Quand un employé répond à un email Kadence, la réponse va à cette
                adresse.
              </span>
            </label>

            <div>
              <button
                onClick={save}
                disabled={!dirty || saving}
                className="rounded-md px-4 py-2 flex items-center gap-2"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  backgroundColor: "var(--foreground)",
                  color: "var(--card)",
                  opacity: !dirty || saving ? 0.5 : 1,
                  cursor: !dirty || saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                Enregistrer
              </button>
            </div>
          </div>

          {/* --- Colonne droite : preview live --- */}
          <LivePreview
            displayName={displayName}
            replyTo={replyTo}
            logoUrl={logoUrl}
          />
        </div>
      )}
    </div>
  );
}

function LivePreview({
  displayName,
  replyTo,
  logoUrl,
}: {
  displayName: string;
  replyTo: string;
  logoUrl: string | null;
}) {
  const [templateId, setTemplateId] = useState<string>(PREVIEW_TEMPLATE_IDS[0]);
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const templates = useMemo(
    () =>
      PREVIEW_TEMPLATE_IDS.map((id) => {
        const t = EMAIL_REGISTRY.find((x) => x.id === id);
        return { id, name: t?.name ?? id };
      }),
    [],
  );

  // Debounce 300 ms sur les changements pour ne pas spammer le serveur
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res: any = await previewEmailTemplate({
          data: {
            templateId,
            overrides: {
              display_name: displayName.trim() || undefined,
              reply_to_email: replyTo.trim(),
              logo_url: logoUrl,
            },
          },
        });
        setHtml(res.html);
      } catch (e: any) {
        // silencieux : on garde le HTML précédent
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [templateId, displayName, replyTo, logoUrl]);

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="rounded-md px-2 py-1.5 outline-none"
          style={{
            fontSize: 12,
            border: "0.5px solid var(--border)",
            backgroundColor: "var(--background)",
          }}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div
          className="flex rounded-md overflow-hidden"
          style={{ border: "0.5px solid var(--border)" }}
        >
          <button
            type="button"
            onClick={() => setMode("desktop")}
            className="px-2 py-1.5 flex items-center gap-1"
            style={{
              fontSize: 11,
              backgroundColor:
                mode === "desktop" ? "var(--muted)" : "transparent",
            }}
          >
            <Monitor size={12} />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setMode("mobile")}
            className="px-2 py-1.5 flex items-center gap-1"
            style={{
              fontSize: 11,
              backgroundColor:
                mode === "mobile" ? "var(--muted)" : "transparent",
              borderLeft: "0.5px solid var(--border)",
            }}
          >
            <Smartphone size={12} />
            Mobile
          </button>
        </div>
      </div>

      <div
        className="rounded-md overflow-hidden flex justify-center relative"
        style={{
          backgroundColor: "var(--muted)",
          border: "0.5px solid var(--border)",
          minHeight: 500,
          padding: mode === "mobile" ? 16 : 0,
        }}
      >
        {loading && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md"
            style={{
              fontSize: 10,
              backgroundColor: "var(--background)",
              border: "0.5px solid var(--border)",
              color: "var(--muted-foreground)",
              zIndex: 2,
            }}
          >
            <Loader2 size={10} className="animate-spin" /> maj…
          </div>
        )}
        <iframe
          title="Preview email"
          srcDoc={html}
          sandbox=""
          style={{
            width: mode === "mobile" ? 375 : "100%",
            height: 640,
            border:
              mode === "mobile" ? "8px solid var(--foreground)" : "none",
            borderRadius: mode === "mobile" ? 24 : 0,
            backgroundColor: "#ffffff",
            display: "block",
          }}
        />
      </div>
    </div>
  );
}


function SuppressionSection({ kind }: { kind: "bounce" | "complaint" }) {
  const [items, setItems] = useState<SuppressionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [complaintChecked, setComplaintChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const fn = kind === "bounce" ? getBounces30d : getComplaints30d;
      const res: any = await fn();
      setItems(res.items ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Erreur chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const isBounce = kind === "bounce";
  const title = isBounce ? "Emails qui ont rebondi (30 derniers jours)" : "Plaintes de spam (30 derniers jours)";
  const subtitle = isBounce
    ? "Ces adresses email semblent invalides ou inexistantes. Aucun email automatique ne leur sera envoyé pour éviter de dégrader ta réputation d'expéditeur."
    : "Ces employés ont marqué un email Kadence comme spam. Vérifie avec eux avant de les réactiver — sinon tu risques de dégrader la réputation de tout le domaine.";
  const emptyLabel = isBounce ? "Aucun rebond récent. C'est bon signe !" : "Aucune plainte de spam. Excellent.";

  const doReactivate = async (email: string) => {
    setBusy(email);
    try {
      await reactivateEmail({ data: { email, reason: kind } });
      toast.success("Adresse réactivée");
      setConfirming(null);
      setItems((prev) => prev.filter((i) => i.email !== email));
    } catch (e: any) {
      toast.error(e?.message || "Erreur réactivation");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={cardStyle()} className="p-5">
      <div className="flex items-center gap-2 mb-1">
        {isBounce
          ? <AlertTriangle size={15} strokeWidth={1.8} style={{ color: "var(--muted-foreground)" }} />
          : <ShieldAlert size={15} strokeWidth={1.8} style={{ color: "#d97706" }} />}
        <div style={{ fontSize: 15, fontWeight: 500 }}>{title}</div>
      </div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 16 }}>{subtitle}</div>

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          <CheckCircle2 size={15} style={{ color: "#16a34a" }} />
          {emptyLabel}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--muted-foreground)", fontSize: 11, textAlign: "left" }}>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Raison</th>
                <th className="py-2 pr-3">Template</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const md = it.metadata ?? {};
                const reasonText = isBounce
                  ? `Bounce${md.bounce_type ? ` (${md.bounce_type})` : md.subtype ? ` (${md.subtype})` : ""}`
                  : "Marqué comme spam";
                const canReactivate = isBounce || complaintChecked[it.email];
                return (
                  <tr key={it.email + it.created_at} style={{ borderTop: "0.5px solid var(--border)" }}>
                    <td className="py-2 pr-3" style={{ fontWeight: 500 }}>
                      <div className="flex items-center gap-2">
                        {!isBounce && <ShieldAlert size={13} style={{ color: "#d97706" }} />}
                        {it.email}
                      </div>
                    </td>
                    <td className="py-2 pr-3" style={{ color: "var(--muted-foreground)" }}>{reasonText}</td>
                    <td className="py-2 pr-3" style={{ color: "var(--muted-foreground)" }}>{it.template_name ?? "—"}</td>
                    <td className="py-2 pr-3" style={{ color: "var(--muted-foreground)" }}>{timeAgo(it.created_at)}</td>
                    <td className="py-2 pr-3">
                      {confirming === it.email ? (
                        <div className="flex flex-col gap-1 items-end">
                          {!isBounce && (
                            <label className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                              <input
                                type="checkbox"
                                checked={!!complaintChecked[it.email]}
                                onChange={(e) => setComplaintChecked((p) => ({ ...p, [it.email]: e.target.checked }))}
                              />
                              J'ai vérifié avec cet employé
                            </label>
                          )}
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setConfirming(null); setComplaintChecked((p) => ({ ...p, [it.email]: false })); }}
                              className="rounded-md px-2 py-1"
                              style={{ fontSize: 12, border: "0.5px solid var(--border)" }}
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => doReactivate(it.email)}
                              disabled={!canReactivate || busy === it.email}
                              className="rounded-md px-2 py-1 flex items-center gap-1"
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                backgroundColor: "var(--foreground)",
                                color: "var(--card)",
                                opacity: !canReactivate || busy === it.email ? 0.5 : 1,
                              }}
                            >
                              {busy === it.email && <Loader2 size={11} className="animate-spin" />}
                              Confirmer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirming(it.email)}
                          className="rounded-md px-2 py-1"
                          style={{ fontSize: 12, border: "0.5px solid var(--border)", color: "var(--foreground)" }}
                        >
                          Réactiver
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
