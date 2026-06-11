import * as React from "react";
import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { ctaButton, ctaSection, h1, hr, muted, paragraph } from "../_styles";

export interface AvailabilityWindowReminderProps {
  firstName: string;
  title: string;
  periodLabel: string;
  deadlineShort: string;
  threshold: "3d" | "2d" | "1d" | "5h" | "1h";
  appUrl: string;
}

const URGENCY_LABEL: Record<AvailabilityWindowReminderProps["threshold"], string> = {
  "3d": "Plus que 3 jours",
  "2d": "Plus que 2 jours",
  "1d": "Plus que 24h",
  "5h": "Plus que 5h",
  "1h": "Dernière heure",
};

export const subject = (d: AvailabilityWindowReminderProps) =>
  `⏰ ${URGENCY_LABEL[d.threshold]} pour saisir tes dispos`;

export default function AvailabilityWindowReminderEmail({
  firstName,
  title,
  periodLabel,
  deadlineShort,
  threshold,
  appUrl,
}: AvailabilityWindowReminderProps) {
  return (
    <EmailLayout studioName="Skult Studios" preview={URGENCY_LABEL[threshold]}>
      <Heading style={h1}>{URGENCY_LABEL[threshold]} ⏰</Heading>
      <Text style={paragraph}>
        Hey {firstName || ""}, tu n'as pas encore (totalement) rempli tes dispos
        pour <strong>{title}</strong>.
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
        Sans dispos transmises avant la deadline, tu risques de ne pas être planifié·e.
      </Text>
    </EmailLayout>
  );
}
