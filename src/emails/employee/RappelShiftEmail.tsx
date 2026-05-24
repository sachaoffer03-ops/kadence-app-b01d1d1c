import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { ctaButton, ctaSection, h1, paragraph } from "../_styles";

export interface RappelShiftProps {
  firstName: string;
  studioName: string;
  startTime: string;
  role: string;
  shiftUrl: string;
}

export const subject = (_d: RappelShiftProps) =>
  "⏰ Ton shift commence dans 1h";

export default function RappelShiftEmail({
  firstName,
  studioName,
  startTime,
  role,
  shiftUrl,
}: RappelShiftProps) {
  return (
    <EmailLayout
      studioName={studioName}
      preview="Ton shift commence dans 1h"
    >
      <Heading style={h1}>Ton shift commence bientôt ⏰</Heading>
      <Text style={paragraph}>N'oublie pas {firstName},</Text>
      <Text style={paragraph}>
        Ton shift de <strong>{role}</strong> commence dans{" "}
        <strong>1 heure</strong> à <strong>{studioName}</strong> ({startTime}).
      </Text>
      <Text style={paragraph}>
        Pense à arriver <strong>10 minutes en avance</strong> pour préparer.
      </Text>
      <Section style={ctaSection}>
        <Button href={shiftUrl} style={ctaButton}>
          Voir le shift
        </Button>
      </Section>
    </EmailLayout>
  );
}
