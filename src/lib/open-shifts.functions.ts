import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adminLink } from "@/lib/notif-links";

const APP_URL = "https://app.kadence.be/staff-app";

function dateLabelFr(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function hhmm(t: string) {
  return String(t).slice(0, 5);
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

async function assertAdminOrManager(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Action réservée aux admins/managers");
}

// =============================================================================
// ADMIN — Ouvrir des trous à tous les employés concernés
// =============================================================================
export const openShiftsToAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        shiftIds: z.array(z.string().uuid()).min(1).max(300),
        message: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);

    const { data: shifts, error: e1 } = await supabaseAdmin
      .from("shifts")
      .select("id, user_id, shift_date, start_time, end_time, business_role, studio_id")
      .in("id", data.shiftIds)
      .is("user_id", null);
    if (e1) throw new Error(e1.message);
    const openable = shifts ?? [];
    if (openable.length === 0) {
      return { ok: false, reason: "no_shift", opened: 0, recipients: 0, emailsSent: 0 };
    }

    const now = new Date().toISOString();
    const { error: e2 } = await supabaseAdmin
      .from("shifts")
      .update({
        open_to_all: true,
        opened_at: now,
        open_message: data.message ?? null,
        updated_at: now,
      })
      .in(
        "id",
        openable.map((s: any) => s.id),
      );
    if (e2) throw new Error(e2.message);

    // Destinataires = employés actifs/invités rattachés aux studios concernés
    const studioIds = Array.from(
      new Set(openable.map((s: any) => s.studio_id).filter(Boolean)),
    ) as string[];

    const [{ data: links }, { data: profiles }] = await Promise.all([
      studioIds.length
        ? supabaseAdmin
            .from("user_studios")
            .select("user_id, studio_id")
            .in("studio_id", studioIds)
        : Promise.resolve({ data: [] as any[] }),
      supabaseAdmin
        .from("profiles")
        .select("id, first_name, email, studio_id, status")
        .in("status", ["active", "invited"]),
    ]);

    const linked = new Set((links ?? []).map((l: any) => l.user_id));
    const recipients = (profiles ?? []).filter(
      (p: any) =>
        p.id !== userId &&
        (linked.has(p.id) || (p.studio_id && studioIds.includes(p.studio_id))),
    );

    // Notifications in-app
    if (recipients.length > 0) {
      const body =
        data.message?.trim() ||
        `${openable.length} shift${openable.length > 1 ? "s" : ""} à prendre. Premier arrivé, premier servi.`;
      await supabaseAdmin.from("notifications").insert(
        recipients.map((p: any) => ({
          user_id: p.id,
          type: "open_shifts",
          title: "Des shifts sont disponibles",
          body,
          link: "/staff-app?tab=accueil",
          priority: "high",
          category: "shift",
        })),
      );
    }

    // Emails
    let emailsSent = 0;
    try {
      const { data: studios } = studioIds.length
        ? await supabaseAdmin
            .from("studios")
            .select("id, name, short_name")
            .in("id", studioIds)
        : { data: [] as any[] };
      const studioName = (id: string | null) => {
        const s = (studios ?? []).find((x: any) => x.id === id);
        return s?.short_name ?? s?.name ?? "";
      };

      const sorted = [...openable].sort((a: any, b: any) =>
        a.shift_date === b.shift_date
          ? String(a.start_time).localeCompare(String(b.start_time))
          : a.shift_date.localeCompare(b.shift_date),
      );
      const slots = sorted.slice(0, 25).map((s: any) => ({
        dateLabel: dateLabelFr(s.shift_date),
        timeLabel: `${hhmm(s.start_time)} – ${hhmm(s.end_time)}`,
        role: s.business_role,
        studioName: studioName(s.studio_id),
      }));

      const { enqueueTemplateEmail } = await import("@/lib/email-send.server");
      const results = await Promise.allSettled(
        recipients
          .filter((p: any) => p.email)
          .map((p: any) =>
            enqueueTemplateEmail({
              templateId: "shifts-disponibles",
              recipient: p.email,
              idempotencyKey: `open-shifts-${p.id}-${Date.now()}`,
              data: {
                firstName: p.first_name ?? "",
                totalCount: openable.length,
                slots,
                message: data.message ?? null,
                appUrl: APP_URL,
              },
            }),
          ),
      );
      emailsSent = results.filter(
        (r) => r.status === "fulfilled" && (r.value as any)?.ok,
      ).length;
    } catch (e) {
      console.error("[openShiftsToAll] email error", e);
    }

    return {
      ok: true,
      opened: openable.length,
      recipients: recipients.length,
      emailsSent,
    };
  });

// =============================================================================
// ADMIN — Refermer la bourse
// =============================================================================
export const closeOpenShifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ shiftIds: z.array(z.string().uuid()).max(300).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);

    let q = supabaseAdmin
      .from("shifts")
      .update({ open_to_all: false, updated_at: new Date().toISOString() })
      .eq("open_to_all", true);
    if (data.shiftIds && data.shiftIds.length > 0) q = q.in("id", data.shiftIds);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============================================================================
// EMPLOYÉ — Liste des shifts ouverts que je peux prendre
// =============================================================================
export const getOpenShiftsForMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: links }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("user_studios").select("studio_id").eq("user_id", userId),
      supabaseAdmin
        .from("profiles")
        .select("studio_id")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    const myStudios = new Set<string>(
      [
        ...((links ?? []).map((l: any) => l.studio_id) as string[]),
        ...(profile?.studio_id ? [profile.studio_id as string] : []),
      ].filter(Boolean),
    );

    const { data: open, error } = await supabaseAdmin
      .from("shifts")
      .select(
        "id, shift_date, start_time, end_time, business_role, studio_id, open_message, role_segments",
      )
      .eq("open_to_all", true)
      .is("user_id", null)
      .gte("shift_date", today)
      .order("shift_date")
      .order("start_time");
    if (error) throw new Error(error.message);

    const scoped = (open ?? []).filter(
      (s: any) => !s.studio_id || myStudios.has(s.studio_id),
    );
    if (scoped.length === 0) return { shifts: [] as any[] };

    const dates = Array.from(new Set(scoped.map((s: any) => s.shift_date)));

    const [{ data: mine }, { data: unavail }, { data: studios }] = await Promise.all([
      supabaseAdmin
        .from("shifts")
        .select("shift_date, start_time, end_time")
        .eq("user_id", userId)
        .neq("status", "cancelled")
        .in("shift_date", dates),
      supabaseAdmin
        .from("unavailability_periods")
        .select("start_date, end_date")
        .eq("user_id", userId)
        .gte("end_date", today),
      supabaseAdmin.from("studios").select("id, name, short_name"),
    ]);

    const studioMap = new Map(
      (studios ?? []).map((s: any) => [s.id, s.short_name ?? s.name]),
    );

    const available = scoped.filter((s: any) => {
      const blocked = (unavail ?? []).some(
        (u: any) => s.shift_date >= u.start_date && s.shift_date <= u.end_date,
      );
      if (blocked) return false;
      const conflict = (mine ?? []).some(
        (m: any) =>
          m.shift_date === s.shift_date &&
          overlaps(s.start_time, s.end_time, m.start_time, m.end_time),
      );
      return !conflict;
    });

    return {
      shifts: available.map((s: any) => ({
        id: s.id,
        shiftDate: s.shift_date,
        startTime: hhmm(s.start_time),
        endTime: hhmm(s.end_time),
        businessRole: s.business_role,
        studioId: s.studio_id,
        studioName: s.studio_id ? studioMap.get(s.studio_id) ?? "—" : "—",
        message: s.open_message ?? null,
        roleSegments: s.role_segments ?? null,
      })),
    };
  });

// =============================================================================
// EMPLOYÉ — Prendre des shifts (premier arrivé, premier servi)
// =============================================================================
export const claimOpenShifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ shiftIds: z.array(z.string().uuid()).min(1).max(30) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const claimed: any[] = [];
    const taken: string[] = [];

    for (const shiftId of data.shiftIds) {
      // Attribution atomique : seulement si toujours libre et ouvert
      const { data: updated, error } = await supabaseAdmin
        .from("shifts")
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq("id", shiftId)
        .eq("open_to_all", true)
        .is("user_id", null)
        .select("id, shift_date, start_time, end_time, business_role, studio_id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) {
        taken.push(shiftId);
        continue;
      }
      claimed.push(updated);

      // Les propositions éventuelles sur ce shift ne sont plus valables
      await supabaseAdmin
        .from("shift_proposals")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("shift_id", shiftId)
        .eq("status", "pending");
    }

    // Notifie les admins/managers
    if (claimed.length > 0) {
      const [{ data: roles }, { data: me }] = await Promise.all([
        supabaseAdmin
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["admin", "manager"]),
        supabaseAdmin
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", userId)
          .maybeSingle(),
      ]);
      const name = `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim() || "Un employé";
      const adminIds = Array.from(
        new Set((roles ?? []).map((r: any) => r.user_id)),
      );
      const rows = adminIds.flatMap((aid) =>
        claimed.map((s: any) => ({
          user_id: aid,
          type: "open_shift_claimed",
          title: "Trou comblé",
          body: `${name} a pris ${s.business_role} · ${dateLabelFr(s.shift_date)} · ${hhmm(s.start_time)}–${hhmm(s.end_time)}`,
          link: adminLink({ kind: "shiftPointage", shiftId: s.id }),
          priority: "info",
          category: "shift",
        })),
      );
      if (rows.length > 0) await supabaseAdmin.from("notifications").insert(rows);
    }

    return { ok: true, claimed: claimed.length, taken: taken.length, takenIds: taken };
  });

// =============================================================================
// ADMIN — Aperçu avant envoi : destinataires + emails manquants
// =============================================================================
export const previewOpenShiftsBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ shiftIds: z.array(z.string().uuid()).min(1).max(300) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);

    const { data: shifts } = await supabaseAdmin
      .from("shifts")
      .select("id, shift_date, start_time, end_time, business_role, studio_id, open_to_all")
      .in("id", data.shiftIds)
      .is("user_id", null);
    const openable = shifts ?? [];

    const studioIds = Array.from(
      new Set(openable.map((s: any) => s.studio_id).filter(Boolean)),
    ) as string[];

    const [{ data: links }, { data: profiles }, { data: studios }] = await Promise.all([
      studioIds.length
        ? supabaseAdmin.from("user_studios").select("user_id, studio_id").in("studio_id", studioIds)
        : Promise.resolve({ data: [] as any[] }),
      supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, email, studio_id, status")
        .in("status", ["active", "invited"]),
      studioIds.length
        ? supabaseAdmin.from("studios").select("id, name, short_name").in("id", studioIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const studioName = (id: string | null) => {
      const s = (studios ?? []).find((x: any) => x.id === id);
      return s?.short_name ?? s?.name ?? "—";
    };

    const linked = new Set((links ?? []).map((l: any) => l.user_id));
    const recipients = (profiles ?? [])
      .filter(
        (p: any) =>
          p.id !== userId &&
          (linked.has(p.id) || (p.studio_id && studioIds.includes(p.studio_id))),
      )
      .map((p: any) => ({
        id: p.id,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—",
        email: p.email ?? null,
        status: p.status,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Adresses déjà bloquées (bounce / plainte) → l'email n'arrivera pas
    const emails = recipients.map((r) => r.email).filter(Boolean) as string[];
    let suppressed = new Set<string>();
    if (emails.length > 0) {
      const { data: sup } = await supabaseAdmin
        .from("suppressed_emails")
        .select("email")
        .in("email", emails);
      suppressed = new Set((sup ?? []).map((s: any) => String(s.email).toLowerCase()));
    }

    return {
      shifts: openable.map((s: any) => ({
        id: s.id,
        dateLabel: dateLabelFr(s.shift_date),
        timeLabel: `${hhmm(s.start_time)} – ${hhmm(s.end_time)}`,
        role: s.business_role,
        studioName: studioName(s.studio_id),
        alreadyOpen: !!s.open_to_all,
      })),
      studioNames: studioIds.map((id) => studioName(id)),
      recipients: recipients.map((r) => ({
        ...r,
        deliverable: !!r.email && !suppressed.has(String(r.email).toLowerCase()),
        reason: !r.email
          ? "pas d'adresse email"
          : suppressed.has(String(r.email).toLowerCase())
            ? "adresse bloquée (bounce/plainte)"
            : null,
      })),
    };
  });

// =============================================================================
// ADMIN — Suivi : qui a pris quoi
// =============================================================================
export const getOpenShiftsBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const today = new Date().toISOString().slice(0, 10);

    const { data: rows } = await supabaseAdmin
      .from("shifts")
      .select(
        "id, user_id, shift_date, start_time, end_time, business_role, studio_id, opened_at, updated_at",
      )
      .eq("open_to_all", true)
      .gte("shift_date", today)
      .order("shift_date")
      .order("start_time");

    const list = rows ?? [];
    const userIds = Array.from(new Set(list.map((s: any) => s.user_id).filter(Boolean)));
    const [{ data: profiles }, { data: studios }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, first_name, last_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      supabaseAdmin.from("studios").select("id, name, short_name"),
    ]);
    const pName = new Map(
      (profiles ?? []).map((p: any) => [
        p.id,
        `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      ]),
    );
    const sName = new Map((studios ?? []).map((s: any) => [s.id, s.short_name ?? s.name]));

    const mapped = list.map((s: any) => ({
      id: s.id,
      shiftDate: s.shift_date,
      dateLabel: dateLabelFr(s.shift_date),
      timeLabel: `${hhmm(s.start_time)} – ${hhmm(s.end_time)}`,
      role: s.business_role,
      studioName: s.studio_id ? (sName.get(s.studio_id) ?? "—") : "—",
      openedAt: s.opened_at,
      claimedBy: s.user_id ? (pName.get(s.user_id) || "—") : null,
      claimedAt: s.user_id ? s.updated_at : null,
    }));

    return {
      free: mapped.filter((s) => !s.claimedBy),
      claimed: mapped
        .filter((s) => s.claimedBy)
        .sort((a, b) => String(b.claimedAt).localeCompare(String(a.claimedAt))),
    };
  });
