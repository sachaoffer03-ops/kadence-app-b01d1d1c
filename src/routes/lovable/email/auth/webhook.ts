import * as React from 'react'
import { render } from '@react-email/components'
import { parseEmailWebhookPayload } from '@lovable.dev/email-js'
import { WebhookError, verifyWebhookRequest } from '@lovable.dev/webhooks-js'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { InviteEmail } from '@/lib/email-templates/invite'
import { RecoveryEmail } from '@/lib/email-templates/recovery'

// Kadence utilise ces emails d'auth : confirmation d'inscription, invitation
// et réinitialisation du mot de passe. Les autres types sont ignorés.
const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirme ton compte Kadence',
  invite: 'Bienvenue chez Skult – Active ton compte Kadence',
  recovery: 'Réinitialise ton mot de passe Kadence',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: InviteEmail,
  invite: InviteEmail,
  recovery: RecoveryEmail,
}

const SITE_NAME = 'Kadence'
const SENDER_DOMAIN = 'notify.kadence.be'
const APP_URL = process.env.PUBLIC_APP_URL || 'https://app.kadence.be'
const FROM_DOMAIN = 'kadence.be'

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}

export const Route = createFileRoute('/lovable/email/auth/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Feature flag : quand Kadence gère les emails auth via Resend,
        // on court-circuite ce webhook pour éviter tout double envoi.
        if ((process.env.AUTH_EMAIL_PROVIDER || '').toLowerCase() === 'kadence') {
          return Response.json({ success: true, skipped: 'kadence_provider' })
        }

        const apiKey = process.env.LOVABLE_API_KEY

        if (!apiKey) {
          console.error('LOVABLE_API_KEY not configured')
          return Response.json(
            { error: 'Server configuration error' },
            { status: 500 },
          )
        }

        let payload: any
        let run_id = ''
        try {
          const verified = await verifyWebhookRequest({
            req: request,
            secret: apiKey,
            parser: parseEmailWebhookPayload,
          })
          payload = verified.payload
          run_id = payload.run_id
        } catch (error) {
          if (error instanceof WebhookError) {
            switch (error.code) {
              case 'invalid_signature':
              case 'missing_timestamp':
              case 'invalid_timestamp':
              case 'stale_timestamp':
                console.error('Invalid webhook signature', { error: error.message })
                return Response.json({ error: 'Invalid signature' }, { status: 401 })
              case 'invalid_payload':
              case 'invalid_json':
                console.error('Invalid webhook payload', { error: error.message })
                return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
            }
          }

          console.error('Webhook verification failed', { error })
          return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
        }

        if (!run_id) {
          return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
        }

        if (payload.version !== '1') {
          return Response.json(
            { error: `Unsupported payload version: ${payload.version}` },
            { status: 400 },
          )
        }

        const emailType = payload.data.action_type
        const EmailTemplate = EMAIL_TEMPLATES[emailType]

        // Type non géré (magiclink, email_change, reauthentication)
        // → on retourne 200 sans envoyer pour ne pas bloquer Supabase Auth.
        if (!EmailTemplate) {
          console.log('Auth email type skipped (not used by Kadence)', {
            emailType,
            email_redacted: redactEmail(payload.data.email),
            run_id,
          })
          return Response.json({ success: true, skipped: true })
        }

        // Pour le recovery, on construit notre propre URL avec token_hash
        // (verifyOtp côté client) — robuste cross-device, contrairement au
        // flux PKCE qui exige le code_verifier dans le navigateur d'origine.
        let confirmationUrl = payload.data.url
        if (emailType === 'recovery' && payload.data.token_hash) {
          confirmationUrl = `https://${ROOT_DOMAIN}/reset-password?token_hash=${encodeURIComponent(
            payload.data.token_hash,
          )}&type=recovery`
        }

        const templateProps = {
          siteName: SITE_NAME,
          siteUrl: `https://${ROOT_DOMAIN}`,
          recipient: payload.data.email,
          confirmationUrl,
          token: payload.data.token,
          email: payload.data.email,
          oldEmail: payload.data.old_email,
          newEmail: payload.data.new_email,
        }

        const element = React.createElement(EmailTemplate, templateProps)
        const html = await render(element)
        const text = await render(element, { plainText: true })

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error('Missing Supabase environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const messageId = crypto.randomUUID()

        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: emailType,
          recipient_email: payload.data.email,
          status: 'pending',
        })

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'auth_emails',
          payload: {
            run_id,
            message_id: messageId,
            to: payload.data.email,
            from: `${SITE_NAME} <notifications@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: EMAIL_SUBJECTS[emailType] || 'Notification Kadence',
            html,
            text,
            purpose: 'transactional',
            label: emailType,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          console.error('Failed to enqueue auth email', { error: enqueueError, run_id, emailType })
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: emailType,
            recipient_email: payload.data.email,
            status: 'failed',
            error_message: 'Failed to enqueue email',
          })
          return Response.json({ error: 'Failed to enqueue email' }, { status: 500 })
        }

        console.log('Auth email enqueued', {
          emailType,
          email_redacted: redactEmail(payload.data.email),
          run_id,
        })

        return Response.json({ success: true, queued: true })
      },
    },
  },
})
