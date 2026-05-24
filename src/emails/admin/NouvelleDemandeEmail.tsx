import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { cardBlock, ctaButton, ctaSection, h1, paragraph } from "../_styles";

export interface NouvelleDemandeProps {
  adminFirstName: string;
  employeeName: string;
  requestType: string;
  shiftDate: string;
  employeeMessage?: string;
  requestUrl: string;
}

export const subject = (d: NouvelleDemandeProps) =>
  `📥 ${d.employeeName} a fait une demande de ${d.requestType}`;

export default function NouvelleDemandeEmail({
  adminFirstName,
  employeeName,
  requestType,
  shiftDate,
  employeeMessage,
  requestUrl,
}: NouvelleDemandeProps) {
  return (
    <EmailLayout preview={`${employeeName} a fait une nouvelle demande`}>
      <Heading style={h1}>Nouvelle demande à traiter 📥</Heading>
      <Text style={paragraph}>Salut {adminFirstName},</Text>
      <Text style={paragraph}>
        <strong>{employeeName}</strong> vient de faire une demande de{" "}
        <strong>{requestType}</strong> pour le <strong>{shiftDate}</strong>.
      </Text>
      {employeeMessage ? (
        <Section style={cardBlock}>« {employeeMessage} »</Section>
      ) : null}
      <Section style={ctaSection}>
        <Button href={requestUrl} style={ctaButton}>
          Traiter la demande
        </Button>
      </Section>
    </EmailLayout>
  );
}
