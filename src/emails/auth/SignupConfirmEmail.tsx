import * as React from "react";
import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { ctaButton, ctaSection, h1, hr, muted, paragraph } from "../_styles";

export interface SignupConfirmProps {
  firstName?: string;
  confirmationUrl: string;
}

export default function SignupConfirmEmail({
  firstName,
  confirmationUrl,
}: SignupConfirmProps) {
  return (
    <EmailLayout preview="Confirme ton compte Kadence">
      <Heading style={h1}>Confirme ton compte</Heading>
      <Text style={paragraph}>Salut {firstName || ""},</Text>
      <Text style={paragraph}>
        Merci de t'être inscrit sur Kadence. Clique sur le bouton ci-dessous
        pour confirmer ton adresse email et activer ton compte.
      </Text>
      <Section style={ctaSection}>
        <Button href={confirmationUrl} style={ctaButton}>
          Confirmer mon email
        </Button>
      </Section>
      <Hr style={hr} />
      <Text style={muted}>
        Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :{" "}
        {confirmationUrl}
      </Text>
      <Text style={muted}>
        Si tu n'es pas à l'origine de cette inscription, ignore cet email.
      </Text>
    </EmailLayout>
  );
}
