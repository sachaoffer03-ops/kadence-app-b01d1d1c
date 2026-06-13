import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import {
  bigDate,
  cardCoral,
  cardLine,
  ctaButton,
  ctaSection,
  h1,
  mutedCenter,
  paragraph,
} from "../_styles";

export interface DispoReminderProps {
  firstName: string;
  monthLabel: string;
  deadlineLabel: string;
  studioName?: string;
  statsAppUrl: string;
}

export const subject = (d: DispoReminderProps) =>
  `📅 Rappel — tes dispos pour ${d.monthLabel} sont attendues`;

export default function DispoReminderEmail({
  firstName,
  monthLabel,
  deadlineLabel,
  studioName,
  statsAppUrl,
}: DispoReminderProps) {
  return (
    <EmailLayout
      studioName={studioName}
      preview={`Rappel : remplis tes dispos pour ${monthLabel}`}
    >
      <Heading style={h1}>Tes dispos sont attendues 📅</Heading>
      <Text style={paragraph}>Salut {firstName},</Text>
      <Text style={paragraph}>
        Ton manager te rappelle de remplir tes disponibilités pour{" "}
        <strong>{monthLabel}</strong>. Sans tes dispos, on ne peut pas te
        planifier.
      </Text>
      <Section style={cardCoral}>
        <Text style={bigDate}>{monthLabel}</Text>
        <Text style={cardLine}>Deadline : {deadlineLabel}</Text>
      </Section>
      <Text style={paragraph}>
        Ça te prend 2 minutes. Tu peux aussi remplir les mois suivants pendant
        que tu y es 😉
      </Text>
      <Section style={ctaSection}>
        <Button href={statsAppUrl} style={ctaButton}>
          Saisir mes dispos
        </Button>
      </Section>
      <Text style={mutedCenter}>
        Plus tu remplis tôt, plus tu as de chances d'avoir tes shifts préférés.
      </Text>
    </EmailLayout>
  );
}
