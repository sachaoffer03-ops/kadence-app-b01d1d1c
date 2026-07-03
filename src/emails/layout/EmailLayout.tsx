import * as React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export const KADENCE_LOGO_URL =
  "https://vqejayodpprbfgwaejmb.supabase.co/storage/v1/object/public/avatars/_brand%2Fkadence-logo.png";

export const SKULT_LOGO_URL =
  "https://vqejayodpprbfgwaejmb.supabase.co/storage/v1/object/public/avatars/_brand%2Fskult-logo.jpg";

import { useEmailTenant } from "@/emails/tenant-context";

interface EmailLayoutProps {
  children: React.ReactNode;
  studioName?: string;
  preview?: string;
}

export default function EmailLayout({
  children,
  studioName,
  preview,
}: EmailLayoutProps) {
  const tenant = useEmailTenant();
  // Compat ascendante : si un template passe explicitement `studioName`, on
  // le respecte ; sinon on prend le displayName du tenant (default = Skult).
  const displayName = studioName ?? tenant.displayName;
  const logoSrc = tenant.logoUrl ?? KADENCE_LOGO_URL;
  return (
    <Html lang="fr">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {preview ? <Preview>{preview}</Preview> : null}
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src={KADENCE_LOGO_URL}
              alt="Kadence"
              width="360"
              height="100"
              style={logoImg}
            />
          </Section>

          <Section style={content}>{children}</Section>

          <Section style={footer}>
            <Img
              src={SKULT_LOGO_URL}
              alt={studioName ?? "Skult Studios"}
              width="72"
              height="28"
              style={skultLogoImg}
            />
            <Text style={footerText}>
              Cet email t'a été envoyé via Kadence pour{" "}
              {studioName ?? "Skult Studios"}.
            </Text>
            <Text style={footerText}>
              Si tu n'es plus concerné, contacte ton manager.
            </Text>
            <Hr style={footerHr} />
            <Text style={footerText}>
              <Link href="https://kadence.io/privacy" style={footerLink}>
                Politique de confidentialité
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#FAFAF8",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: "24px 0",
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  overflow: "hidden",
  border: "1px solid #EAEAE5",
};

const header: React.CSSProperties = {
  backgroundColor: "#FAFAF8",
  padding: "28px 24px",
  textAlign: "center",
  borderBottom: "1px solid #EAEAE5",
};

const logoImg: React.CSSProperties = {
  display: "block",
  margin: "0 auto",
  height: "100px",
  width: "auto",
};

const content: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "32px",
};

const footer: React.CSSProperties = {
  backgroundColor: "#FAFAFA",
  padding: "24px",
  textAlign: "center",
};

const skultLogoImg: React.CSSProperties = {
  display: "block",
  margin: "0 auto 12px",
  height: "28px",
  width: "auto",
  opacity: 0.85,
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#A1A1AA",
  margin: "4px 0",
  lineHeight: 1.5,
};

const footerHr: React.CSSProperties = {
  borderColor: "#E4E4E7",
  margin: "12px 0",
};

const footerLink: React.CSSProperties = {
  color: "#71717A",
  textDecoration: "underline",
};
