import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import {
  bigDate,
  cardLine,
  cardRed,
  ctaButton,
  ctaSection,
  h1,
  paragraph,
} from "../_styles";

export interface TrouCritiqueProps {
  adminFirstName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
  studioName: string;
  trousUrl: string;
}

export const subject = (d: TrouCritiqueProps) =>
  `🚨 Shift non couvert : ${d.shiftDate} à ${d.startTime}`;

export default function TrouCritiqueEmail({
  adminFirstName,
  shiftDate,
  startTime,
  endTime,
  role,
  studioName,
  trousUrl,
}: TrouCritiqueProps) {
  return (
    <EmailLayout
      studioName={studioName}
      preview={`Shift non couvert : ${shiftDate}`}
    >
      <Heading style={h1}>Shift non couvert dans moins de 24h 🚨</Heading>
      <Text style={paragraph}>Salut {adminFirstName},</Text>
      <Text style={paragraph}>
        Attention, ce shift n'a personne et démarre dans moins de 24h :
      </Text>
      <Section style={cardRed}>
        <Text style={bigDate}>{shiftDate}</Text>
        <Text style={cardLine}>
          {startTime} - {endTime}
        </Text>
        <Text style={cardLine}>
          {role} · {studioName}
        </Text>
      </Section>
      <Text style={paragraph}>
        Tu peux l'assigner directement ou envoyer des propositions aux
        employés éligibles.
      </Text>
      <Section style={ctaSection}>
        <Button href={trousUrl} style={ctaButton}>
          Combler le trou
        </Button>
      </Section>
    </EmailLayout>
  );
}
