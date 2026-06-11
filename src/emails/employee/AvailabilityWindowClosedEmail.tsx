import * as React from "react";
import { Heading, Hr, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { h1, hr, muted, paragraph } from "../_styles";

export interface AvailabilityWindowClosedProps {
  firstName: string;
  title: string;
  periodLabel: string;
  appUrl: string;
}

export const subject = (_d: AvailabilityWindowClosedProps) =>
  `Saisie des dispos clôturée — merci !`;

export default function AvailabilityWindowClosedEmail({
  firstName,
  title,
  periodLabel,
}: AvailabilityWindowClosedProps) {
  return (
    <EmailLayout studioName="Skult Studios" preview="Saisie des dispos clôturée">
      <Heading style={h1}>Merci {firstName || ""} 🙌</Heading>
      <Text style={paragraph}>
        La fenêtre <strong>{title}</strong> ({periodLabel}) vient d'être clôturée.
      </Text>
      <Text style={paragraph}>
        Le planning sera publié dès que possible, tu recevras une notif quand il sera prêt.
      </Text>
      <Hr style={hr} />
      <Text style={muted}>
        Si tu as un imprévu de dernière minute, fais une demande de modification
        depuis l'app — on regardera ça au cas par cas.
      </Text>
    </EmailLayout>
  );
}
