import * as React from "react";
import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import EmailLayout from "../layout/EmailLayout";
import { ctaButton, ctaSection, h1, hr, muted, paragraph } from "../_styles";

export interface MagicLinkProps {
  confirmationUrl: string;
}

export default function MagicLinkEmail({ confirmationUrl }: MagicLinkProps) {
  return (
    <EmailLayout preview="Ton lien de connexion Kadence">
      <Heading style={h1}>Connexion à Kadence</Heading>
      <Text style={paragraph}>
        Clique sur le bouton ci-dessous pour te connecter à Kadence. Ce lien
        est valide pendant 1 heure et ne peut être utilisé qu'une seule fois.
      </Text>
      <Section style={ctaSection}>
        <Button href={confirmationUrl} style={ctaButton}>
          Me connecter
        </Button>
      </Section>
      <Hr style={hr} />
      <Text style={muted}>
        Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :{" "}
        {confirmationUrl}
      </Text>
      <Text style={muted}>
        Si tu n'es pas à l'origine de cette demande, ignore cet email.
      </Text>
    </EmailLayout>
  );
}
