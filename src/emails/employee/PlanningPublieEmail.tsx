import * as React from "react";
import {
  Button,
  Column,
  Heading,
  Row,
  Section,
  Text,
} from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { card, ctaButton, ctaSection, h1, paragraph } from "../_styles";

export interface PlanningPublieProps {
  firstName: string;
  month: string;
  shiftCount: number;
  totalHours: number;
  planningUrl: string;
}

export const subject = (d: PlanningPublieProps) =>
  `📅 Le planning de ${d.month} est dispo`;

export default function PlanningPublieEmail({
  firstName,
  month,
  shiftCount,
  totalHours,
  planningUrl,
}: PlanningPublieProps) {
  return (
    <EmailLayout preview={`Le planning de ${month} est dispo`}>
      <Heading style={h1}>Le planning de {month} est dispo 📅</Heading>
      <Text style={paragraph}>Salut {firstName},</Text>
      <Text style={paragraph}>
        Le planning du mois vient d'être publié. Voici ton aperçu :
      </Text>
      <Section style={card}>
        <Row>
          <Column align="center" style={{ padding: "8px" }}>
            <Text style={statBig}>{shiftCount} shifts</Text>
            <Text style={statLabel}>ce mois</Text>
          </Column>
          <Column align="center" style={{ padding: "8px" }}>
            <Text style={statBig}>{totalHours}h</Text>
            <Text style={statLabel}>au total</Text>
          </Column>
        </Row>
      </Section>
      <Section style={ctaSection}>
        <Button href={planningUrl} style={ctaButton}>
          Voir mon planning
        </Button>
      </Section>
    </EmailLayout>
  );
}

const statBig: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 600,
  color: "#18181B",
  margin: 0,
};

const statLabel: React.CSSProperties = {
  fontSize: "13px",
  color: "#71717A",
  margin: "2px 0 0",
};
