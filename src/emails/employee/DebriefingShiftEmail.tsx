import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import {
  card,
  cardBlock,
  cardCoral,
  ctaButton,
  ctaSection,
  h1,
  h3,
  paragraph,
} from "../_styles";

export interface DebriefingShiftProps {
  firstName: string;
  studioName: string;
  shiftDate: string;
  clockInTime: string;
  clockOutTime: string;
  durationHours: number;
  pointsTotal: number;
  pointsPonctualite: number;
  pointsChecklist: number;
  pointsNoteManager?: number;
  newScore: number;
  managerComment?: string;
  statsUrl: string;
}

export const subject = (d: DebriefingShiftProps) =>
  `✅ Shift terminé – Récap de ton ${d.shiftDate}`;

export default function DebriefingShiftEmail({
  firstName,
  studioName,
  shiftDate,
  clockInTime,
  clockOutTime,
  durationHours,
  pointsTotal,
  pointsPonctualite,
  pointsChecklist,
  pointsNoteManager,
  newScore,
  managerComment,
  statsUrl,
}: DebriefingShiftProps) {
  return (
    <EmailLayout
      studioName={studioName}
      preview={`Récap de ton shift du ${shiftDate}`}
    >
      <Heading style={h1}>Bien joué pour ton shift ✅</Heading>
      <Text style={paragraph}>Salut {firstName},</Text>
      <Text style={paragraph}>
        Bien joué pour ton shift du <strong>{shiftDate}</strong> à{" "}
        <strong>{studioName}</strong> !
      </Text>

      <Text style={h3}>Ton shift</Text>
      <Section style={card}>
        <Text style={{ ...paragraph, margin: 0 }}>
          Tu as travaillé <strong>{durationHours}h</strong>
        </Text>
        <Text
          style={{
            fontSize: "13px",
            color: "#71717A",
            margin: "4px 0 0",
          }}
        >
          De {clockInTime} à {clockOutTime}
        </Text>
      </Section>

      <Text style={h3}>Tes points</Text>
      <Section style={cardCoral}>
        <Text
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "#18181B",
            margin: "0 0 8px",
          }}
        >
          +{pointsTotal} points 🎯
        </Text>
        <Text style={bullet}>• Ponctualité : +{pointsPonctualite}</Text>
        <Text style={bullet}>
          • Checklist complétée : +{pointsChecklist}
        </Text>
        {pointsNoteManager !== undefined ? (
          <Text style={bullet}>• Note manager : +{pointsNoteManager}</Text>
        ) : (
          <Text style={bullet}>• Note manager : à venir</Text>
        )}
      </Section>

      <Text style={h3}>Score global</Text>
      <Text style={paragraph}>
        Ton score global est maintenant à <strong>{newScore}/10</strong>
      </Text>

      {managerComment ? (
        <>
          <Text style={h3}>Mot du manager</Text>
          <Section style={cardBlock}>« {managerComment} »</Section>
        </>
      ) : null}

      <Section style={ctaSection}>
        <Button href={statsUrl} style={ctaButton}>
          Voir mes stats
        </Button>
      </Section>
    </EmailLayout>
  );
}

const bullet: React.CSSProperties = {
  color: "#18181B",
  fontSize: "14px",
  margin: "4px 0",
  lineHeight: 1.5,
};
