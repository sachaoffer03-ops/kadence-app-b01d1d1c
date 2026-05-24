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

interface InviteEmailProps {
  siteName?: string
  siteUrl?: string
  confirmationUrl?: string
  email?: string
}

export const InviteEmail = ({
  confirmationUrl = '#',
  email,
}: InviteEmailProps) => (
  <EmailLayout
    studioName="Skult Studios"
    preview="Bienvenue chez Skult – Active ton compte Kadence"
  >
    <Heading style={h1}>Bienvenue chez Skult 👋</Heading>
    <Text style={paragraph}>Salut,</Text>
    <Text style={paragraph}>
      Ton manager t'a invité à rejoindre Kadence, l'app qui gère tes
      plannings, propositions de shifts et formations chez Skult Studios.
    </Text>
    <Text style={paragraph}>
      Active ton compte en 30 secondes en cliquant sur le bouton ci-dessous :
    </Text>
    <Section style={ctaSection}>
      <Button href={confirmationUrl} style={ctaButton}>
        Activer mon compte
      </Button>
    </Section>
    <Hr style={hr} />
    <Text style={muted}>
      Cette invitation a été envoyée à {email ?? 'ton adresse email'} et
      expire dans 7 jours. Si tu n'attendais pas cette invitation, tu peux
      ignorer cet email.
    </Text>
  </EmailLayout>
)

export default InviteEmail
