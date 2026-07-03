// Feature flag lecture pour choisir le provider d'envoi email.
// Priorité :
//   1. Override dev (variable ci-dessous — modifier pour tester Resend sans changer l'env)
//   2. process.env.EMAIL_PROVIDER
//   3. Défaut "lovable" (comportement historique inchangé)

export type EmailProvider = "lovable" | "resend" | "both";

// ⚠️ OVERRIDE DEV : mets "resend" ou "both" ici pendant les tests sans toucher
// à l'env var. Repasser à null avant la bascule prod par env var.
const DEV_OVERRIDE: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (DEV_OVERRIDE) return DEV_OVERRIDE;
  const raw = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (raw === "resend" || raw === "both") return raw;
  return "lovable";
}

// Domaine visible dans le From des emails Resend.
// Sacha configure `mail.kadence.be` dans Resend + DNS.
export const RESEND_FROM_DOMAIN =
  process.env.RESEND_FROM_DOMAIN || "mail.kadence.be";
export const RESEND_FROM_ADDRESS = `notifications@${RESEND_FROM_DOMAIN}`;
