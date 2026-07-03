import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const Input = z.object({
  recipient: z.string().email(),
  templateId: z.string().min(1).max(100).default('bienvenue-employe'),
})

// Envoie un email de test via le provider actuellement configuré
// (EMAIL_PROVIDER + éventuel override dev). Réservé aux admins.
export const sendTestEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    })
    if (!isAdmin) throw new Error('Réservé aux admins')

    const { enqueueTemplateEmail } = await import('@/lib/email-send.server')
    const { getEmailProvider } = await import('@/lib/email/provider-config.server')

    const provider = getEmailProvider()
    const idempotencyKey = `test-${data.templateId}-${Date.now()}`
    const res = await enqueueTemplateEmail({
      templateId: data.templateId,
      recipient: data.recipient,
      idempotencyKey,
      data: {
        firstName: 'Test',
        studioName: 'Skult Studios',
        appUrl: 'https://app.kadence.be/staff-app',
        inviteUrl: 'https://app.kadence.be/activation?token=TEST',
      },
    })

    return {
      ok: res.ok,
      provider,
      reason: res.reason,
      messageId: res.messageId,
    }
  })
