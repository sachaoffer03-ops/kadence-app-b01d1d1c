// Webhook Resend (signé via Svix) — reçoit les événements delivered/bounced/complained
// et met à jour email_send_log + suppressed_emails.
// URL publique (bypass auth Lovable) : /api/public/webhooks/resend
// Sécurité : signature Svix OBLIGATOIRE avant tout write. Idempotence via event.id.

import { createFileRoute } from '@tanstack/react-router'
import { Webhook } from 'svix'
import { z } from 'zod'

const ResendEventSchema = z.object({
  type: z.string(),
  created_at: z.string().optional(),
  data: z
    .object({
      email_id: z.string().optional(),
      to: z.union([z.string(), z.array(z.string())]).optional(),
      bounce: z
        .object({
          type: z.string().optional(),
          subType: z.string().optional(),
          message: z.string().optional(),
        })
        .partial()
        .optional(),
      complaint: z.record(z.string(), z.any()).optional(),
      click: z.record(z.string(), z.any()).optional(),
    })
    .passthrough(),
})

function firstRecipient(to: string | string[] | undefined): string | null {
  if (!to) return null
  if (Array.isArray(to)) return to[0] ?? null
  return to
}

export const Route = createFileRoute('/api/public/webhooks/resend')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_WEBHOOK_SECRET
        if (!secret) {
          console.error('[resend-webhook] RESEND_WEBHOOK_SECRET missing')
          return new Response('Webhook not configured', { status: 500 })
        }

        // 1. Vérifier la signature Svix — REQUIS avant tout traitement
        const svixId = request.headers.get('svix-id')
        const svixTimestamp = request.headers.get('svix-timestamp')
        const svixSignature = request.headers.get('svix-signature')
        if (!svixId || !svixTimestamp || !svixSignature) {
          return new Response('Missing Svix headers', { status: 400 })
        }

        const rawBody = await request.text()
        let event: unknown
        try {
          const wh = new Webhook(secret)
          event = wh.verify(rawBody, {
            'svix-id': svixId,
            'svix-timestamp': svixTimestamp,
            'svix-signature': svixSignature,
          })
        } catch (err) {
          console.warn('[resend-webhook] Signature verification failed', err)
          return new Response('Invalid signature', { status: 401 })
        }

        const parsed = ResendEventSchema.safeParse(event)
        if (!parsed.success) {
          console.warn('[resend-webhook] Invalid payload shape', parsed.error.flatten())
          return new Response('OK', { status: 200 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        // 2. Idempotence — svix-id est unique par événement, ignoré si déjà traité
        const { error: dupErr } = await supabaseAdmin
          .from('email_webhook_events' as any)
          .insert({
            event_id: svixId,
            provider: 'resend',
            event_type: parsed.data.type,
            payload: parsed.data as any,
          })
        if (dupErr && dupErr.code === '23505') {
          // déjà reçu → 200 OK (Svix ne retente pas)
          return new Response('OK (dup)', { status: 200 })
        }

        // 3. Traitement métier
        const { type, data } = parsed.data
        const emailId = data.email_id
        const recipient = firstRecipient(data.to)?.toLowerCase().trim() ?? null

        try {
          if (type === 'email.delivered' && emailId) {
            await supabaseAdmin
              .from('email_send_log')
              .update({ status: 'delivered' } as any)
              .eq('resend_email_id', emailId)
          } else if (type === 'email.bounced' && emailId) {
            await supabaseAdmin
              .from('email_send_log')
              .update({
                status: 'bounced',
                error_message: (data.bounce?.message ?? '').slice(0, 1000),
              } as any)
              .eq('resend_email_id', emailId)
            // Hard bounce uniquement → suppression
            const isHard = (data.bounce?.type || '').toLowerCase() === 'hard'
            if (isHard && recipient) {
              await supabaseAdmin.from('suppressed_emails').upsert(
                {
                  email: recipient,
                  reason: 'bounce',
                  metadata: { source: 'resend_webhook', bounce: data.bounce } as any,
                },
                { onConflict: 'email' },
              )
            }
          } else if (type === 'email.complained' && emailId) {
            await supabaseAdmin
              .from('email_send_log')
              .update({ status: 'complained' } as any)
              .eq('resend_email_id', emailId)
            if (recipient) {
              await supabaseAdmin.from('suppressed_emails').upsert(
                {
                  email: recipient,
                  reason: 'complaint',
                  metadata: { source: 'resend_webhook' } as any,
                },
                { onConflict: 'email' },
              )
            }
          }
          // email.sent / email.opened / email.clicked : payload conservé dans email_webhook_events,
          // pas d'action supplémentaire pour l'instant.
        } catch (err) {
          console.error('[resend-webhook] processing error', err)
          // On renvoie tout de même 200 : l'événement est enregistré dans
          // email_webhook_events, on ne veut pas boucler sur Svix.
        }

        return new Response('OK', { status: 200 })
      },
    },
  },
})
