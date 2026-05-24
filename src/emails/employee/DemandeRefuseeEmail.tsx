import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { cardBlock, ctaButton, ctaSection, h1, paragraph } from "../_styles";

export interface DemandeRefuseeProps {
  firstName: string;
  requestType: string;
  shiftDate: string;
  adminResponse?: string;
  requestsUrl: string;
}

export const subject = (_d: DemandeRefuseeProps) =>
  "Ta demande n'a pas été acceptée";

export default function DemandeRefuseeEmail({
  firstName,
  requestType,
  shiftDate,
  adminResponse,
  requestsUrl,
}: DemandeRefuseeProps) {
  return (
    <EmailLayout preview="Ta demande n'a pas été acceptée">
      <Heading style={h1}>Ta demande n'a pas été acceptée</Heading>
      <Text style={paragraph}>Salut {firstName},</Text>
      <Text style={paragraph}>
        Ton manager n'a pas pu accepter ta demande de{" "}
        <strong>{requestType}</strong> pour le <strong>{shiftDate}</strong>.
      </Text>
      {adminResponse ? (
        <Section style={cardBlock}>« {adminResponse} »</Section>
      ) : null}
      <Text style={paragraph}>
        Si tu veux en discuter, contacte directement ton manager.
      </Text>
      <Section style={ctaSection}>
        <Button href={requestsUrl} style={ctaButton}>
          Voir mes demandes
        </Button>
      </Section>
    </EmailLayout>
  );
}
