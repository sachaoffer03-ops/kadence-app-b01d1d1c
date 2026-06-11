// =============================================================================
// AVAILABILITY WINDOWS — logique serveur partagée (cron tick + RPC admin).
// Utilise supabaseAdmin (service role). Ne pas importer depuis le client.
// =============================================================================
import * as React from "react";
import { render } from "@react-email/components";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "Skult Studios";
const SENDER_DOMAIN = "notify.app.shyft.flashsite.fr";
const FROM_DOMAIN = "app.shyft.flashsite.fr";
const APP_URL = "https://app.shyft.flashsite.fr";

const FULL_THRESHOLD = 10; // ≥ 10 dispos = considéré rempli

export interface WindowRow {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  deadline_at: string;
  target_user_ids: string[] | null;
  status: "draft" | "open" | "closed";
  notifications_sent: Record<string, boolean>;
  created_by: string | null;
  created_at: string;
  closed_at: string | null;
  closed_by: string | null;
}

export const REMINDER_THRESHOLDS = [
  { key: "3d", ms: 3 * 24 * 3600 * 1000 },
  { key: "2d", ms: 2 * 24 * 3600 * 1000 },
  { key: "1d", ms: 1 * 24 * 3600 * 1000 },
  { key: "5h", ms: 5 * 3600 * 1000 },
  { key: "1h", ms: 1 * 3600 * 1000 },
] as const;

export type ThresholdKey = (typeof REMINDER_THRESHOLDS)[number]["key"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fmtPeriod(p_start: string, p_end: string): string {
  const s = new Date(p_start + "T00:00:00");
  const e = new Date(p_end + "T00:00:00");
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return s.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }
  return `${s.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${e.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
}

function fmtDeadlineShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) +
    " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Résoudre les destinataires d'une window (incluant statut de remplissage)
// ---------------------------------------------------------------------------
export interface Participant {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avail_count: number;
  status: "rempli" | "partial" | "vide";
}

export async function listParticipants(window: WindowRow): Promise<Participant[]> {
  // 1) Résoudre la liste d'IDs ciblés
  let userIds: string[];
  if (window.target_user_ids && window.target_user_ids.length > 0) {
    userIds = window.target_user_ids;
  } else {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("status", "active");
    userIds = (data ?? []).map((r: any) => r.id);
  }
  if (!userIds.length) return [];

  // 2) Récupérer profils
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, email, first_name, last_name")
    .in("id", userIds);

  // 3) Compter dispos dans la période
  const { data: avails } = await supabaseAdmin
    .from("availabilities")
    .select("user_id")
    .in("user_id", userIds)
    .gte("avail_date", window.period_start)
    .lte("avail_date", window.period_end);
  const counts = new Map<string, number>();
  for (const a of (avails ?? []) as any[]) {
    counts.set(a.user_id, (counts.get(a.user_id) ?? 0) + 1);
  }

  return (profiles ?? []).map((p: any): Participant => {
    const c = counts.get(p.id) ?? 0;
    const status: Participant["status"] = c === 0 ? "vide" : c >= FULL_THRESHOLD ? "rempli" : "partial";
    return {
      user_id: p.id,
      email: p.email,
      first_name: p.first_name,
      last_name: p.last_name,
      avail_count: c,
      status,
    };
  });
}

// ---------------------------------------------------------------------------
// Email système (suppression + token + render + enqueue via supabaseAdmin)
// ---------------------------------------------------------------------------
export async function sendSystemEmail(opts: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData: Record<string, any>;
}): Promise<{ ok: boolean; reason?: string }> {
  const { templateName, recipientEmail, idempotencyKey, templateData } = opts;
  const template = (TEMPLATES as any)[templateName];
  if (!template) return { ok: false, reason: "template_not_found" };

  const recipient = recipientEmail.toLowerCase();
  const messageId = crypto.randomUUID();

  // 1) Suppression
  const { data: sup } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", recipient)
    .maybeSingle();
  if (sup) return { ok: false, reason: "suppressed" };

  // 2) Token unsubscribe
  let token: string;
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", recipient)
    .maybeSingle();
  if (existing && !existing.used_at) {
    token = existing.token;
  } else if (!existing) {
    token = generateToken();
    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .upsert({ token, email: recipient }, { onConflict: "email", ignoreDuplicates: true });
    const { data: re } = await supabaseAdmin
      .from("email_unsubscribe_tokens").select("token").eq("email", recipient).maybeSingle();
    token = re?.token ?? token;
  } else {
    return { ok: false, reason: "already_unsubscribed" };
  }

  // 3) Render
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = typeof template.subject === "function"
    ? template.subject(templateData)
    : template.subject;

  // 4) Log pending + enqueue
  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: recipient,
    status: "pending",
  });

  const { error: enqErr } = await supabaseAdmin.rpc("enqueue_email" as any, {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: token,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqErr) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: recipient,
      status: "failed",
      error_message: enqErr.message,
    });
    return { ok: false, reason: "enqueue_failed" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Notifier ouverture d'une fenêtre
// ---------------------------------------------------------------------------
export async function notifyWindowOpened(window: WindowRow): Promise<{ sent: number }> {
  const parts = await listParticipants(window);
  if (!parts.length) return { sent: 0 };
  const periodLabel = fmtPeriod(window.period_start, window.period_end);
  const deadlineShort = fmtDeadlineShort(window.deadline_at);

  // 1) Notifs in-app
  const notifs = parts.map((p) => ({
    user_id: p.user_id,
    type: "availability_window_opened",
    title: `📅 Saisie de dispos ouverte — ${periodLabel}`,
    body: `${window.title} · clôture le ${deadlineShort}`,
    link: "/staff-app?openDispos=1",
    priority: "normal" as const,
    category: "planning" as const,
  }));
  await supabaseAdmin.from("notifications").insert(notifs);

  // 2) Emails (best-effort, en parallèle)
  await Promise.all(parts.map(async (p) => {
    if (!p.email) return;
    await sendSystemEmail({
      templateName: "availability-window-opened",
      recipientEmail: p.email,
      idempotencyKey: `avw-open-${window.id}-${p.user_id}`,
      templateData: {
        firstName: p.first_name ?? "",
        title: window.title,
        periodLabel,
        deadlineShort,
        appUrl: `${APP_URL}/staff-app?openDispos=1`,
      },
    }).catch(() => {});
  }));

  return { sent: parts.length };
}

// ---------------------------------------------------------------------------
// Notifier rappel à un seuil (n'envoie qu'aux non-remplis / partiels)
// ---------------------------------------------------------------------------
const THRESHOLD_TITLES: Record<ThresholdKey, string> = {
  "3d": "📅 Plus que 3 jours pour tes dispos",
  "2d": "⏰ Plus que 2 jours pour tes dispos",
  "1d": "⚠️ Plus que 24h pour tes dispos !",
  "5h": "⏱ 5h restantes pour tes dispos",
  "1h": "🔥 Dernière heure pour tes dispos !",
};

const THRESHOLD_PRIORITY: Record<ThresholdKey, "normal" | "urgent"> = {
  "3d": "normal",
  "2d": "normal",
  "1d": "urgent",
  "5h": "urgent",
  "1h": "urgent",
};

export async function notifyReminder(window: WindowRow, threshold: ThresholdKey): Promise<number> {
  const parts = await listParticipants(window);
  const targets = parts.filter((p) => p.status !== "rempli");
  if (!targets.length) return 0;
  const periodLabel = fmtPeriod(window.period_start, window.period_end);
  const deadlineShort = fmtDeadlineShort(window.deadline_at);
  const title = THRESHOLD_TITLES[threshold];

  const notifs = targets.map((p) => ({
    user_id: p.user_id,
    type: `availability_window_reminder_${threshold}`,
    title,
    body: `${window.title} · clôture le ${deadlineShort}`,
    link: "/staff-app?openDispos=1",
    priority: THRESHOLD_PRIORITY[threshold],
    category: "planning" as const,
  }));
  await supabaseAdmin.from("notifications").insert(notifs);

  await Promise.all(targets.map(async (p) => {
    if (!p.email) return;
    await sendSystemEmail({
      templateName: "availability-window-reminder",
      recipientEmail: p.email,
      idempotencyKey: `avw-rem-${window.id}-${threshold}-${p.user_id}`,
      templateData: {
        firstName: p.first_name ?? "",
        title: window.title,
        periodLabel,
        deadlineShort,
        threshold,
        appUrl: `${APP_URL}/staff-app?openDispos=1`,
      },
    }).catch(() => {});
  }));

  return targets.length;
}

// ---------------------------------------------------------------------------
// Notifier clôture d'une fenêtre
// ---------------------------------------------------------------------------
export async function notifyWindowClosed(window: WindowRow): Promise<void> {
  const parts = await listParticipants(window);
  const rempli = parts.filter((p) => p.status === "rempli").length;
  const partial = parts.filter((p) => p.status === "partial").length;
  const vide = parts.filter((p) => p.status === "vide").length;
  const periodLabel = fmtPeriod(window.period_start, window.period_end);

  // 1) Notif aux employés (récap léger + thanks)
  const empNotifs = parts.map((p) => ({
    user_id: p.user_id,
    type: "availability_window_closed",
    title: "Saisie des dispos clôturée",
    body: `${window.title} — merci ! Le planning sera publié bientôt.`,
    link: "/staff-app?tab=planning",
    priority: "info" as const,
    category: "planning" as const,
  }));
  if (empNotifs.length) await supabaseAdmin.from("notifications").insert(empNotifs);

  await Promise.all(parts.map(async (p) => {
    if (!p.email) return;
    await sendSystemEmail({
      templateName: "availability-window-closed",
      recipientEmail: p.email,
      idempotencyKey: `avw-close-${window.id}-${p.user_id}`,
      templateData: {
        firstName: p.first_name ?? "",
        title: window.title,
        periodLabel,
        appUrl: `${APP_URL}/staff-app?tab=planning`,
      },
    }).catch(() => {});
  }));

  // 2) Notif aux admins
  const { data: admins } = await supabaseAdmin
    .from("user_roles").select("user_id").eq("role", "admin");
  if (admins?.length) {
    const adminNotifs = admins.map((a: any) => ({
      user_id: a.user_id,
      type: "availability_window_closed_admin",
      title: `Fenêtre « ${window.title} » fermée`,
      body: `${rempli} rendu · ${partial} partiel · ${vide} non répondu`,
      link: "/saisie-dispos",
      priority: "normal" as const,
      category: "planning" as const,
    }));
    await supabaseAdmin.from("notifications").insert(adminNotifs);
  }
}

// ---------------------------------------------------------------------------
// Fermer une fenêtre (interne — utilisé par cron et admin)
// ---------------------------------------------------------------------------
export async function closeWindowInternal(window: WindowRow, closedBy: string | null): Promise<void> {
  if (window.status === "closed") return;
  const { error } = await supabaseAdmin
    .from("availability_windows")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: closedBy,
    })
    .eq("id", window.id)
    .eq("status", "open"); // idempotence : seulement si encore open
  if (error) return;
  await notifyWindowClosed(window);
}

// ---------------------------------------------------------------------------
// Tick principal — appelé par cron toutes les 15min
// ---------------------------------------------------------------------------
export async function processWindowsTick(): Promise<{
  processed: number;
  reminders: number;
  closed: number;
}> {
  const now = Date.now();
  const { data: windows } = await supabaseAdmin
    .from("availability_windows")
    .select("*")
    .eq("status", "open");

  let reminders = 0;
  let closed = 0;
  for (const w of (windows ?? []) as WindowRow[]) {
    const deadlineMs = new Date(w.deadline_at).getTime();
    const msLeft = deadlineMs - now;

    // 1) Deadline dépassée → fermeture automatique
    if (msLeft <= 0) {
      await closeWindowInternal(w, null);
      closed++;
      continue;
    }

    // 2) Rappels par seuil (idempotent via notifications_sent)
    const sent = { ...(w.notifications_sent || {}) } as Record<string, boolean>;
    let changed = false;
    for (const t of REMINDER_THRESHOLDS) {
      if (msLeft <= t.ms && !sent[t.key]) {
        const n = await notifyReminder(w, t.key);
        reminders += n;
        sent[t.key] = true;
        changed = true;
      }
    }
    if (changed) {
      await supabaseAdmin
        .from("availability_windows")
        .update({ notifications_sent: sent })
        .eq("id", w.id);
    }
  }

  return { processed: windows?.length ?? 0, reminders, closed };
}
