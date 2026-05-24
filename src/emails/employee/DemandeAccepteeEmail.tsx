import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { cardBlock, ctaButton, ctaSection, h1, paragraph } from "../_styles";

export interface DemandeAccepteeProps {
  firstName: string;
  requestType: string;
  shiftDate: string;
  adminResponse?: string;
  planningUrl: string;
}

export const subject = (_d: DemandeAccepteeProps) =>
  "✅ Ta demande a été acceptée";

export default function DemandeAccepteeEmail({
  firstName,
  requestType,
  shiftDate,
  adminResponse,
  planningUrl,
}: DemandeAccepteeProps) {
  return (
    <EmailLayout preview="Ta demande a été acceptée">
      <Heading style={h1}>Bonne nouvelle 🎉</Heading>
      <Text style={paragraph}>Salut {firstName},</Text>
      <Text style={paragraph}>
        Ton manager a accepté ta demande de <strong>{requestType}</strong>{" "}
        pour le <strong>{shiftDate}</strong>.
      </Text>
      {adminResponse ? (
        <Section style={cardBlock}>« {adminResponse} »</Section>
      ) : null}
      <Section style={ctaSection}>
        <Button href={planningUrl} style={ctaButton}>
          Voir mon planning
        </Button>
      </Section>
    </EmailLayout>
  );
}
