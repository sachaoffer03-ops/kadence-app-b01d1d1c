import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import {
  cardCoral,
  cardLine,
  ctaButton,
  ctaSection,
  h1,
  mutedCenter,
  paragraph,
} from "../_styles";

export interface OpenShiftSlot {
  dateLabel: string;
  timeLabel: string;
  role: string;
  studioName?: string;
}

export interface ShiftsDisponiblesProps {
  firstName: string;
  totalCount: number;
  slots: OpenShiftSlot[];
  message?: string | null;
  studioName?: string;
  appUrl: string;
}

export const subject = (d: ShiftsDisponiblesProps) =>
  `${d.totalCount} shift${d.totalCount > 1 ? "s" : ""} à prendre — premier arrivé, premier servi`;

const slotRow: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 6px",
  color: "#2B2B2B",
};

export default function ShiftsDisponiblesEmail({
  firstName,
  totalCount,
  slots,
  message,
  studioName,
  appUrl,
}: ShiftsDisponiblesProps) {
  const list = slots ?? [];
  const rest = Math.max(0, (totalCount ?? list.length) - list.length);

  return (
    <EmailLayout
      studioName={studioName}
      preview={`${totalCount} shift${totalCount > 1 ? "s" : ""} disponible${totalCount > 1 ? "s" : ""} — à prendre dans l'app`}
    >
      <Heading style={h1}>Des shifts sont à prendre</Heading>
      <Text style={paragraph}>Salut {firstName},</Text>
      <Text style={paragraph}>
        {totalCount > 1
          ? `${totalCount} shifts sont ouverts à tout le monde.`
          : "Un shift est ouvert à tout le monde."}{" "}
        Ouvre l'app, coche ceux qui t'intéressent et valide :{" "}
        <strong>le premier qui prend le shift l'obtient</strong>.
      </Text>

      {message ? <Text style={paragraph}>{message}</Text> : null}

      <Section style={cardCoral}>
        {list.map((s, i) => (
          <Text key={i} style={slotRow}>
            <strong>{s.dateLabel}</strong> · {s.timeLabel} · {s.role}
            {s.studioName ? ` · ${s.studioName}` : ""}
          </Text>
        ))}
        {rest > 0 && (
          <Text style={cardLine}>
            + {rest} autre{rest > 1 ? "s" : ""} shift{rest > 1 ? "s" : ""} dans l'app
          </Text>
        )}
      </Section>

      <Section style={ctaSection}>
        <Button href={appUrl} style={ctaButton}>
          Voir les shifts disponibles
        </Button>
      </Section>

      <Text style={mutedCenter}>
        Dès qu'un shift est pris, il disparaît de la liste des autres.
      </Text>
    </EmailLayout>
  );
}
