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

export interface BienvenueProps {
  firstName: string;
  studioName?: string;
  appUrl: string;
}

export const subject = (_d: BienvenueProps) =>
  `🎉 Bienvenue chez Skult Studios — Ton compte est activé`;

export default function BienvenueEmail({
  firstName,
  studioName,
  appUrl,
}: BienvenueProps) {
  return (
    <EmailLayout
      studioName={studioName ?? "Skult Studios"}
      preview="Ton compte Kadence est activé"
    >
      <Heading style={h1}>Bienvenue {firstName} 🎉</Heading>
      <Text style={paragraph}>
        Ton compte Kadence est désormais activé. Tu peux te connecter dès
        maintenant pour consulter ton planning, accepter des shifts et suivre
        tes formations.
      </Text>
      <Section style={ctaSection}>
        <Button href={appUrl} style={ctaButton}>
          Accéder à mon espace
        </Button>
      </Section>
      <Hr style={hr} />
      <Text style={muted}>
        Si tu as la moindre question, contacte ton manager directement via
        l'app. À très vite !
      </Text>
    </EmailLayout>
  );
}
