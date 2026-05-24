import * as React from "react";
import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import {
  ctaButton,
  ctaSection,
  h1,
  hr,
  muted,
  paragraph,
} from "../_styles";

export interface InvitationEmployeProps {
  firstName: string;
  studioName: string;
  inviteUrl: string;
}

export const subject = (d: InvitationEmployeProps) =>
  `Bienvenue chez ${d.studioName} – Active ton compte Kadence`;

export default function InvitationEmployeEmail({
  firstName,
  studioName,
  inviteUrl,
}: InvitationEmployeProps) {
  return (
    <EmailLayout
      studioName={studioName}
      preview={`Bienvenue chez ${studioName}, active ton compte Kadence`}
    >
      <Heading style={h1}>Bienvenue chez {studioName} 👋</Heading>
      <Text style={paragraph}>Salut {firstName},</Text>
      <Text style={paragraph}>
        Tu viens d'être invité par ton manager à rejoindre Kadence, l'app qui
        gère tes plannings, propositions de shifts et formations.
      </Text>
      <Text style={paragraph}>Active ton compte en 30 secondes :</Text>
      <Section style={ctaSection}>
        <Button href={inviteUrl} style={ctaButton}>
          Activer mon compte
        </Button>
      </Section>
      <Hr style={hr} />
      <Text style={muted}>Cette invitation expire dans 7 jours.</Text>
    </EmailLayout>
  );
}
