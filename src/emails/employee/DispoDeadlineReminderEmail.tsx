import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import {
  bigDate,
  cardAmber,
  cardCoral,
  cardLine,
  cardRed,
  ctaButton,
  ctaSection,
  h1,
  mutedCenter,
  paragraph,
} from "../_styles";

export type DispoUrgency = "soft" | "urgent" | "ultimate";

export interface DispoDeadlineReminderProps {
  firstName: string;
  monthLabel: string;
  deadlineLabel: string;
  urgency: DispoUrgency;
  studioName?: string;
  statsAppUrl: string;
}

export const subject = (d: DispoDeadlineReminderProps) => {
  switch (d.urgency) {
    case "ultimate":
      return `🔥 Dernière heure ! Tes dispos pour ${d.monthLabel}`;
    case "urgent":
      return `⚠️ Plus que 24h pour tes dispos de ${d.monthLabel}`;
    default:
      return `📅 Plus que 3 jours pour tes dispos de ${d.monthLabel}`;
  }
};

const URGENT_BTN: React.CSSProperties = {
  ...ctaButton,
  backgroundColor: "#DC2626",
};

const ULTIMATE_BTN: React.CSSProperties = {
  ...ctaButton,
  backgroundColor: "#DC2626",
  padding: "18px 32px",
  fontSize: "17px",
};

export default function DispoDeadlineReminderEmail({
  firstName,
  monthLabel,
  deadlineLabel,
  urgency,
  studioName,
  statsAppUrl,
}: DispoDeadlineReminderProps) {
  const isUrgent = urgency === "urgent";
  const isUltimate = urgency === "ultimate";

  const headline =
    isUltimate
      ? "🔥 Dernière heure !"
      : isUrgent
        ? "⚠️ Plus que 24h !"
        : "Plus que 3 jours pour tes dispos 📅";

  const cardStyle = isUltimate ? cardRed : isUrgent ? cardAmber : cardCoral;
  const btnStyle = isUltimate
    ? ULTIMATE_BTN
    : isUrgent
      ? URGENT_BTN
      : ctaButton;
  const btnLabel = isUltimate
    ? "Je file saisir maintenant"
    : isUrgent
      ? "Saisir avant qu'il soit trop tard"
      : "Saisir mes dispos";

  const cardTitle = isUltimate ? "⏰ Plus que 1 heure" : monthLabel;
  const cardSub = isUltimate ? `Deadline : ${deadlineLabel}` : `Deadline : ${deadlineLabel}`;

  return (
    <EmailLayout
      studioName={studioName}
      preview={
        isUltimate
          ? `Dernière heure pour tes dispos de ${monthLabel}`
          : isUrgent
            ? `Plus que 24h pour tes dispos de ${monthLabel}`
            : `Plus que 3 jours pour tes dispos de ${monthLabel}`
      }
    >
      <Heading style={h1}>{headline}</Heading>

      {isUltimate ? (
        <>
          <Text style={paragraph}>{firstName}, c'est ta dernière chance.</Text>
          <Text style={{ ...paragraph, fontWeight: 600 }}>
            Dans 1h, le planning de <strong>{monthLabel}</strong> sera gelé. Tu
            seras out si tu n'as rien saisi.
          </Text>
        </>
      ) : isUrgent ? (
        <>
          <Text style={paragraph}>Salut {firstName},</Text>
          <Text style={{ ...paragraph, fontWeight: 600 }}>
            ATTENTION : ton manager finalise le planning de{" "}
            <strong>{monthLabel}</strong> demain.
          </Text>
          <Text style={paragraph}>
            Sans tes dispos, on ne pourra pas te planifier sur le mois et tu
            vas rater des shifts.
          </Text>
        </>
      ) : (
        <>
          <Text style={paragraph}>Salut {firstName},</Text>
          <Text style={paragraph}>
            Il te reste 3 jours pour remplir tes dispos pour{" "}
            <strong>{monthLabel}</strong>. Pense à le faire avant de
            l'oublier 😉
          </Text>
        </>
      )}

      <Section style={cardStyle}>
        <Text style={bigDate}>{cardTitle}</Text>
        {!isUltimate && <Text style={cardLine}>{cardSub}</Text>}
        {isUltimate && (
          <Text style={cardLine}>Avant : {deadlineLabel}</Text>
        )}
      </Section>

      <Section style={ctaSection}>
        <Button href={statsAppUrl} style={btnStyle}>
          {btnLabel}
        </Button>
      </Section>

      <Text style={mutedCenter}>
        Tu peux remplir tes dispos en moins de 2 minutes depuis ton téléphone.
      </Text>
    </EmailLayout>
  );
}
