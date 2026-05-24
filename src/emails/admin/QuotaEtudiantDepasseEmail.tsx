import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { ctaButton, ctaSection, h1, paragraph } from "../_styles";

export interface QuotaEtudiantProps {
  adminFirstName: string;
  employeeName: string;
  currentHours: number;
  quotaMax: number;
  profileUrl: string;
}

export const subject = (d: QuotaEtudiantProps) =>
  `📊 ${d.employeeName} approche de son quota mensuel`;

export default function QuotaEtudiantDepasseEmail({
  adminFirstName,
  employeeName,
  currentHours,
  quotaMax,
  profileUrl,
}: QuotaEtudiantProps) {
  return (
    <EmailLayout preview={`${employeeName} approche de son quota`}>
      <Heading style={h1}>Quota étudiant à surveiller 📊</Heading>
      <Text style={paragraph}>Salut {adminFirstName},</Text>
      <Text style={paragraph}>
        <strong>{employeeName}</strong> (Étudiant) est actuellement à :
      </Text>
      <Section style={{ textAlign: "center", padding: "20px 0" }}>
        <Text
          style={{
            fontSize: "32px",
            fontWeight: 600,
            color: "#18181B",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {currentHours}h / {quotaMax}h
        </Text>
        <Text style={{ fontSize: "13px", color: "#71717A", margin: "8px 0 0" }}>
          ce mois-ci
        </Text>
      </Section>
      <Text style={paragraph}>
        Au-delà de ce quota, il y a un risque légal et de cotisations sociales
        supplémentaires.
      </Text>
      <Section style={ctaSection}>
        <Button href={profileUrl} style={ctaButton}>
          Voir le profil
        </Button>
      </Section>
    </EmailLayout>
  );
}
