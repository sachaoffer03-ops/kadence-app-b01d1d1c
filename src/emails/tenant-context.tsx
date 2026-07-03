import * as React from "react";

// Config tenant utilisée par EmailLayout. Valeurs par défaut = ligne "default"
// de organization_email_config (Skult Studios). Tant que le vrai multi-tenant
// n'est pas activé, tous les emails utilisent ces valeurs.
export interface EmailTenantConfig {
  displayName: string;
  fromName: string;
  brandColor: string;
  logoUrl: string | null;
  replyToEmail: string | null;
  footerNote: string | null;
  privacyUrl: string;
}

export const DEFAULT_EMAIL_TENANT: EmailTenantConfig = {
  displayName: "Skult Studios",
  fromName: "Skult Studios",
  brandColor: "#C44A28",
  logoUrl: null,
  replyToEmail: null,
  footerNote: null,
  privacyUrl: "https://kadence.io/privacy",
};

const Ctx = React.createContext<EmailTenantConfig>(DEFAULT_EMAIL_TENANT);

export function EmailTenantProvider({
  value,
  children,
}: {
  value?: Partial<EmailTenantConfig>;
  children: React.ReactNode;
}) {
  const merged = React.useMemo<EmailTenantConfig>(
    () => ({ ...DEFAULT_EMAIL_TENANT, ...(value ?? {}) }),
    [value],
  );
  return <Ctx.Provider value={merged}>{children}</Ctx.Provider>;
}

export function useEmailTenant(): EmailTenantConfig {
  return React.useContext(Ctx);
}
