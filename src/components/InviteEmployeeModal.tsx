import { useState, useEffect } from "react";
import { X, Copy, Check, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Studio { id: string; name: string }
const BUSINESS_ROLES = ["Barista", "Accueil", "Host", "Cuisine"] as const;
const CONTRACTS = ["Étudiant", "Flexi", "CDI"] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function InviteEmployeeModal({ open, onClose, onCreated }: Props) {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [studioId, setStudioId] = useState("");
  const [contract, setContract] = useState<typeof CONTRACTS[number]>("Étudiant");
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [appRole, setAppRole] = useState<"employee" | "manager">("employee");
  const [hireDate, setHireDate] = useState("");

  useEffect(() => {
    if (open) {
      supabase.from("studios").select("id, name").then(({ data }) => {
        if (data) {
          setStudios(data);
          if (data.length && !studioId) setStudioId(data[0].id);
        }
      });
    }
  }, [open]);

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail(""); setPhone("");
    setContract("Étudiant"); setRoles(new Set()); setAppRole("employee"); setHireDate("");
    setActivationUrl(null); setEmailSent(false); setCopied(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const toggleRole = (r: string) => {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email) return toast.error("Prénom, nom et email requis");
    if (roles.size === 0) return toast.error("Sélectionnez au moins un rôle métier");

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("send-invitation", {
      body: {
        email, first_name: firstName, last_name: lastName,
        phone: phone || null,
        studio_id: studioId || null,
        contract,
        business_roles: Array.from(roles),
        app_role: appRole,
        hire_date: hireDate || null,
      },
    });
    setSubmitting(false);

    if (error || data?.error) {
      return toast.error(data?.error || error?.message || "Erreur");
    }
    setActivationUrl(data.activation_url);
    setEmailSent(data.email_sent);
    toast.success(data.email_sent ? "Invitation envoyée" : "Invitation créée");
    onCreated?.();
  };

  const copyLink = async () => {
    if (!activationUrl) return;
    await navigator.clipboard.writeText(activationUrl);
    setCopied(true);
    toast.success("Lien copié");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  const labelStyle = { fontSize: 12, fontWeight: 500 as const, color: "var(--muted-foreground)" };
  const inputCls = "mt-1 w-full rounded-md border px-3 py-2 outline-none";
  const inputStyle = { fontSize: 14, borderColor: "var(--border)", backgroundColor: "var(--background)" };

  const chip = (active: boolean) => ({
    fontSize: 12,
    fontWeight: active ? 500 as const : 400 as const,
    backgroundColor: active ? "var(--foreground)" : "transparent",
    color: active ? "var(--card)" : "var(--muted-foreground)",
    border: active ? "none" : "0.5px solid var(--border)",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={handleClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 500 }}>Inviter un employé</h2>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
              Un email d'invitation lui sera envoyé pour activer son compte
            </p>
          </div>
          <button onClick={handleClose} className="p-1 rounded hover:bg-[var(--muted)]"><X size={18} /></button>
        </div>

        {!activationUrl ? (
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label style={labelStyle}>Prénom *</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} style={inputStyle} required /></div>
              <div><label style={labelStyle}>Nom *</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} style={inputStyle} required /></div>
              <div><label style={labelStyle}>Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} style={inputStyle} required /></div>
              <div><label style={labelStyle}>Téléphone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} style={inputStyle} /></div>
              <div><label style={labelStyle}>Studio</label>
                <select value={studioId} onChange={(e) => setStudioId(e.target.value)} className={inputCls} style={inputStyle}>
                  {studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              <div><label style={labelStyle}>Type de contrat</label>
                <select value={contract} onChange={(e) => setContract(e.target.value as typeof CONTRACTS[number])} className={inputCls} style={inputStyle}>
                  {CONTRACTS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label style={labelStyle}>Date d'embauche</label>
                <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={inputCls} style={inputStyle} /></div>
              <div><label style={labelStyle}>Permission</label>
                <select value={appRole} onChange={(e) => setAppRole(e.target.value as "employee" | "manager")} className={inputCls} style={inputStyle}>
                  <option value="employee">Employé</option>
                  <option value="manager">Manager</option>
                </select></div>
            </div>

            <div>
              <label style={labelStyle}>Rôles métier *</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {BUSINESS_ROLES.map((r) => {
                  const active = roles.has(r);
                  return (
                    <button key={r} type="button" onClick={() => toggleRole(r)}
                      className="px-3 py-1.5 rounded-md border"
                      style={{
                        fontSize: 13, fontWeight: 500,
                        backgroundColor: active ? "var(--foreground)" : "var(--card)",
                        color: active ? "var(--card)" : "var(--foreground)",
                        borderColor: active ? "var(--foreground)" : "var(--border)",
                      }}>
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={handleClose} className="rounded-md border px-4 py-2"
                style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)" }}>Annuler</button>
              <button type="submit" disabled={submitting} className="rounded-md px-4 py-2 disabled:opacity-50"
                style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                {submitting ? "Envoi..." : "Envoyer l'invitation"}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <div className="rounded-md p-4" style={{ backgroundColor: "var(--muted)" }}>
              <div className="flex items-center gap-2 mb-2">
                {emailSent ? <Mail size={16} style={{ color: "var(--primary)" }} /> : null}
                <p style={{ fontSize: 14, fontWeight: 500 }}>
                  {emailSent ? `Email envoyé à ${email}` : "Invitation créée"}
                </p>
              </div>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                {emailSent
                  ? "L'employé recevra un lien pour activer son compte. Vous pouvez aussi copier le lien ci-dessous pour le partager autrement (WhatsApp, SMS...)."
                  : "Copiez ce lien et envoyez-le à l'employé par le moyen de votre choix."}
              </p>
            </div>
            <div>
              <label style={labelStyle}>Lien d'activation</label>
              <div className="flex gap-2 mt-1">
                <input readOnly value={activationUrl} className="flex-1 rounded-md border px-3 py-2"
                  style={{ fontSize: 12, borderColor: "var(--border)", backgroundColor: "var(--background)" }} />
                <button onClick={copyLink} className="rounded-md border px-3 inline-flex items-center gap-1.5"
                  style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)" }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copié" : "Copier"}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { reset(); }} className="rounded-md border px-4 py-2"
                style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)" }}>Inviter un autre</button>
              <button onClick={handleClose} className="rounded-md px-4 py-2"
                style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>Terminé</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
