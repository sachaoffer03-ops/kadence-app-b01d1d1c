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

export interface PropositionShiftProps {
  firstName: string;
  studioName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
  acceptUrl: string;
}

export const subject = (d: PropositionShiftProps) =>
  `📨 Un shift est dispo : ${d.shiftDate} à ${d.startTime}`;

export default function PropositionShiftEmail({
  firstName,
  studioName,
  shiftDate,
  startTime,
  endTime,
  role,
  acceptUrl,
}: PropositionShiftProps) {
  return (
    <EmailLayout
      studioName={studioName}
      preview={`Un shift est dispo : ${shiftDate} à ${startTime}`}
    >
      <Heading style={h1}>Un shift est disponible 📨</Heading>
      <Text style={paragraph}>Salut {firstName},</Text>
      <Text style={paragraph}>
        Un shift vient de se libérer et tu fais partie des candidats
        sélectionnés. ⚠️ Le premier qui accepte récupère le shift.
      </Text>
      <Section style={cardCoral}>
        <Text style={bigDate}>{shiftDate}</Text>
        <Text style={cardLine}>
          {startTime} - {endTime}
        </Text>
        <Text style={cardLine}>
          {role} · {studioName}
        </Text>
      </Section>
      <Section style={ctaSection}>
        <Button href={acceptUrl} style={ctaButton}>
          Accepter le shift
        </Button>
      </Section>
      <Text style={mutedCenter}>
        Plus tu acceptes vite, plus tu as de chances de l'avoir.
      </Text>
    </EmailLayout>
  );
}
