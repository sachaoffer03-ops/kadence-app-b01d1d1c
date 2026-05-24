import * as React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

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
            <Text style={logo}>Kadence</Text>
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
  backgroundColor: "#F4F4F5",
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
};

const header: React.CSSProperties = {
  backgroundColor: "#000000",
  padding: "24px",
  textAlign: "center",
};

const logo: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  fontFamily: "Georgia, 'Times New Roman', serif",
  margin: 0,
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
