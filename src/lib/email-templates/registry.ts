import type { ComponentType } from 'react'
import { EMAIL_REGISTRY } from '@/emails'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Bridge entre EMAIL_REGISTRY (source de vérité Kadence) et le format
 * attendu par l'infrastructure Lovable Emails (send-transactional-email).
 */
export const TEMPLATES: Record<string, TemplateEntry> = Object.fromEntries(
  EMAIL_REGISTRY.map((t) => [
    t.id,
    {
      component: t.component,
      subject: t.subject,
      displayName: t.name,
      previewData: t.mockData,
    } satisfies TemplateEntry,
  ]),
)
