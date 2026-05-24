import * as React from "react";
import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { ctaButton, ctaSection, h1, hr, muted, paragraph } from "../_styles";

export interface ResetPasswordProps {
  firstName: string;
  resetUrl: string;
}

export const subject = (_d: ResetPasswordProps) =>
  "Réinitialise ton mot de passe Kadence";

export default function ResetPasswordEmail({
  firstName,
  resetUrl,
}: ResetPasswordProps) {
  return (
    <EmailLayout preview="Réinitialise ton mot de passe Kadence">
      <Heading style={h1}>Mot de passe oublié ?</Heading>
      <Text style={paragraph}>Salut {firstName},</Text>
      <Text style={paragraph}>
        Tu as demandé à réinitialiser ton mot de passe Kadence. Clique sur le
        bouton ci-dessous pour en choisir un nouveau.
      </Text>
      <Section style={ctaSection}>
        <Button href={resetUrl} style={ctaButton}>
          Réinitialiser mon mot de passe
        </Button>
      </Section>
      <Hr style={hr} />
      <Text style={muted}>
        Ce lien est valide pendant 1 heure. Si ce n'est pas toi qui as fait
        cette demande, ignore cet email.
      </Text>
    </EmailLayout>
  );
}
