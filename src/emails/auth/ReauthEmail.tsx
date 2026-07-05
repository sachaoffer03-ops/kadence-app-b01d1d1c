import * as React from "react";
import { Heading, Hr, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { h1, hr, muted, paragraph } from "../_styles";

export interface ReauthProps {
  token: string;
}

const codeStyle: React.CSSProperties = {
  display: "inline-block",
  fontFamily: "monospace",
  fontSize: "28px",
  letterSpacing: "6px",
  fontWeight: 500,
  padding: "16px 24px",
  background: "#F5F2EC",
  borderRadius: "8px",
  color: "#1a1a1a",
};

export default function ReauthEmail({ token }: ReauthProps) {
  return (
    <EmailLayout preview="Code de vérification Kadence">
      <Heading style={h1}>Confirme ton identité</Heading>
      <Text style={paragraph}>
        Pour continuer sur Kadence, saisis ce code de vérification dans l'app.
        Ce code est valide pendant quelques minutes.
      </Text>
      <Section style={{ textAlign: "center", padding: "24px 0" }}>
        <span style={codeStyle}>{token}</span>
      </Section>
      <Hr style={hr} />
      <Text style={muted}>
        Si tu n'es pas à l'origine de cette demande, ignore cet email et
        change ton mot de passe.
      </Text>
    </EmailLayout>
  );
}
