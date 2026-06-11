import * as React from "react";
import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { ctaButton, ctaSection, h1, hr, muted, paragraph } from "../_styles";

export interface AvailabilityWindowOpenedProps {
  firstName: string;
  title: string;
  periodLabel: string;
  deadlineShort: string;
  appUrl: string;
}

export const subject = (_d: AvailabilityWindowOpenedProps) =>
  `📅 Saisie de tes dispos ouverte`;

export default function AvailabilityWindowOpenedEmail({
  firstName,
  title,
  periodLabel,
  deadlineShort,
  appUrl,
}: AvailabilityWindowOpenedProps) {
  return (
    <EmailLayout studioName="Skult Studios" preview={`Saisis tes dispos pour ${periodLabel}`}>
      <Heading style={h1}>Hey {firstName || ""} 👋</Heading>
      <Text style={paragraph}>
        La saisie des dispos est ouverte : <strong>{title}</strong>.
      </Text>
      <Text style={paragraph}>
        Période : <strong>{periodLabel}</strong><br />
        Clôture le <strong>{deadlineShort}</strong>.
      </Text>
      <Section style={ctaSection}>
        <Button href={appUrl} style={ctaButton}>Saisir mes dispos</Button>
      </Section>
      <Hr style={hr} />
      <Text style={muted}>
        Plus tu remplis tôt, plus on peut t'assigner les shifts qui te conviennent.
      </Text>
    </EmailLayout>
  );
}
