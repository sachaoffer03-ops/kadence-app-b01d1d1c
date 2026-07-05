import * as React from "react";
import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { ctaButton, ctaSection, h1, hr, muted, paragraph } from "../_styles";

export interface ChangeEmailProps {
  confirmationUrl: string;
  oldEmail?: string;
  newEmail?: string;
}

export default function ChangeEmailEmail({
  confirmationUrl,
  oldEmail,
  newEmail,
}: ChangeEmailProps) {
  return (
    <EmailLayout preview="Confirme ta nouvelle adresse email Kadence">
      <Heading style={h1}>Confirme ton changement d'email</Heading>
      <Text style={paragraph}>
        Une demande de changement d'adresse email a été faite sur ton compte
        Kadence
        {oldEmail ? ` (${oldEmail})` : ""}
        {newEmail ? ` vers ${newEmail}` : ""}.
      </Text>
      <Text style={paragraph}>
        Clique sur le bouton ci-dessous pour confirmer cette nouvelle adresse.
      </Text>
      <Section style={ctaSection}>
        <Button href={confirmationUrl} style={ctaButton}>
          Confirmer cette adresse
        </Button>
      </Section>
      <Hr style={hr} />
      <Text style={muted}>
        Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :{" "}
        {confirmationUrl}
      </Text>
      <Text style={muted}>
        Si tu n'es pas à l'origine de cette demande, ignore cet email — ton
        adresse actuelle restera inchangée.
      </Text>
    </EmailLayout>
  );
}
