import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { cardAmber, ctaButton, ctaSection, h1, paragraph } from "../_styles";

export interface EmployeRetardProps {
  adminFirstName: string;
  employeeName: string;
  scheduledStart: string;
  studioName: string;
  role: string;
  lateMinutes: number;
  shiftUrl: string;
}

export const subject = (d: EmployeRetardProps) =>
  `⚠️ ${d.employeeName} n'a pas pointé`;

export default function EmployeRetardEmail({
  adminFirstName,
  employeeName,
  scheduledStart,
  studioName,
  role,
  lateMinutes,
  shiftUrl,
}: EmployeRetardProps) {
  return (
    <EmailLayout
      studioName={studioName}
      preview={`${employeeName} n'a pas pointé`}
    >
      <Heading style={h1}>Un employé est en retard ⚠️</Heading>
      <Text style={paragraph}>Salut {adminFirstName},</Text>
      <Text style={paragraph}>
        <strong>{employeeName}</strong> avait un shift à{" "}
        <strong>{scheduledStart}</strong> à <strong>{studioName}</strong>{" "}
        comme <strong>{role}</strong>.
      </Text>
      <Section style={cardAmber}>
        <Text
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#18181B",
            margin: "0 0 4px",
          }}
        >
          Retard de {lateMinutes} minutes
        </Text>
        <Text style={{ fontSize: "14px", color: "#52525B", margin: 0 }}>
          L'employé n'a toujours pas pointé.
        </Text>
      </Section>
      <Section style={ctaSection}>
        <Button href={shiftUrl} style={ctaButton}>
          Voir le shift
        </Button>
      </Section>
    </EmailLayout>
  );
}
