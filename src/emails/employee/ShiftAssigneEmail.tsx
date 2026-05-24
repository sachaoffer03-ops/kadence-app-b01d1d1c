import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import {
  bigDate,
  card,
  cardLine,
  ctaButton,
  ctaSection,
  h1,
  paragraph,
} from "../_styles";

export interface ShiftAssigneProps {
  firstName: string;
  studioName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
  planningUrl: string;
}

export const subject = (d: ShiftAssigneProps) =>
  `Nouveau shift le ${d.shiftDate} chez ${d.studioName}`;

export default function ShiftAssigneEmail({
  firstName,
  studioName,
  shiftDate,
  startTime,
  endTime,
  role,
  planningUrl,
}: ShiftAssigneProps) {
  return (
    <EmailLayout
      studioName={studioName}
      preview={`Nouveau shift le ${shiftDate}`}
    >
      <Heading style={h1}>Tu as un nouveau shift 📅</Heading>
      <Text style={paragraph}>Salut {firstName},</Text>
      <Text style={paragraph}>
        Ton manager t'a assigné un nouveau shift :
      </Text>
      <Section style={card}>
        <Text style={bigDate}>{shiftDate}</Text>
        <Text style={cardLine}>
          {startTime} - {endTime}
        </Text>
        <Text style={cardLine}>
          {role} · {studioName}
        </Text>
      </Section>
      <Section style={ctaSection}>
        <Button href={planningUrl} style={ctaButton}>
          Voir mon planning
        </Button>
      </Section>
    </EmailLayout>
  );
}
