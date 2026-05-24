import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { ctaButton, ctaSection, h1, paragraph } from "../_styles";

export interface NouvelleInscriptionProps {
  adminFirstName: string;
  employeeName: string;
  employeeEmail: string;
  profileUrl: string;
}

export const subject = (d: NouvelleInscriptionProps) =>
  `🎉 ${d.employeeName} vient de rejoindre Kadence`;

export default function NouvelleInscriptionEmail({
  adminFirstName,
  employeeName,
  employeeEmail,
  profileUrl,
}: NouvelleInscriptionProps) {
  return (
    <EmailLayout preview={`${employeeName} vient de rejoindre Kadence`}>
      <Heading style={h1}>Bienvenue à {employeeName} 🎉</Heading>
      <Text style={paragraph}>Salut {adminFirstName},</Text>
      <Text style={paragraph}>
        <strong>{employeeName}</strong> a activé son compte avec l'email{" "}
        <strong>{employeeEmail}</strong>.
      </Text>
      <Text style={paragraph}>
        Tu peux maintenant lui assigner ses studios, rôles et premiers shifts.
      </Text>
      <Section style={ctaSection}>
        <Button href={profileUrl} style={ctaButton}>
          Voir le profil
        </Button>
      </Section>
    </EmailLayout>
  );
}
