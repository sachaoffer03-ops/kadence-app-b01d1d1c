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
  "https://vqejayodpprbfgwaejmb.supabase.co/storage/v1/object/public/avatars/_brand/kadence-logo.png";

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
              width="120"
              height="32"
              style={logoImg}
            />
          </Section>

          <Section style={content}>{children}</Section>

          <Section style={footer}>
            <Text style={footerText}>
              Cet email t'a été envoyé par Kadence pour{" "}
              {studioName ?? "ton équipe"}.
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
  backgroundColor: "#18181B",
  padding: "28px 24px",
  textAlign: "center",
};

const logoImg: React.CSSProperties = {
  display: "block",
  margin: "0 auto",
  height: "32px",
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
