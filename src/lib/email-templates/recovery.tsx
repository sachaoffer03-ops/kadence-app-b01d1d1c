import * as React from 'react'
import { Button, Heading, Hr, Section, Text } from '@react-email/components'
import EmailLayout from '@/emails/layout/EmailLayout'
import {
  ctaButton,
  ctaSection,
  h1,
  hr,
  muted,
  paragraph,
} from '@/emails/_styles'

interface RecoveryEmailProps {
  siteName?: string
  confirmationUrl?: string
}

export const RecoveryEmail = ({
  confirmationUrl = '#',
}: RecoveryEmailProps) => (
  <EmailLayout
    studioName="Skult Studios"
    preview="Réinitialise ton mot de passe Kadence"
  >
    <Heading style={h1}>Mot de passe oublié ?</Heading>
    <Text style={paragraph}>Salut,</Text>
    <Text style={paragraph}>
      Tu as demandé à réinitialiser ton mot de passe Kadence. Clique sur le
      bouton ci-dessous pour en choisir un nouveau.
    </Text>
    <Section style={ctaSection}>
      <Button href={confirmationUrl} style={ctaButton}>
        Réinitialiser mon mot de passe
      </Button>
    </Section>
    <Hr style={hr} />
    <Text style={muted}>
      Ce lien est valide pendant 1 heure. Si ce n'est pas toi qui as fait
      cette demande, ignore simplement cet email — ton mot de passe restera
      inchangé.
    </Text>
  </EmailLayout>
)

export default RecoveryEmail
