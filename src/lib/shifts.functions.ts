import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { employeeLink } from "@/lib/notif-links";
import { validateRoleSegments, getRequiredRoles, isHybridShift, type RoleSegment } from "@/lib/role-segments";

async function assertEmployeeHasRequiredRoles(
  supabase: any,
  userId: string,
  shiftBusinessRole: string,
  segments: RoleSegment[] | null,
) {
  if (!isHybridShift(segments)) return;
  const required = getRequiredRoles(segments, shiftBusinessRole);
  const { data, error } = await supabase
    .from("user_business_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const userRoles = new Set((data ?? []).map((r: any) => r.role));
  const missing = required.filter((r) => !userRoles.has(r));
  if (missing.length > 0) {
    throw new Error(`Shift hybride : l'employé n'a pas le(s) rôle(s) ${missing.join(", ")}`);
  }
}

const TIME = /^\d{2}:\d{2}(:\d{2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Rôles métier : valeur libre (la table business_roles est la source de vérité, validée côté UI).
const businessRoleSchema = z.string().min(1).max(64);

const roleSegmentSchema = z.object({
  role: z.string().min(1).max(64),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
});
const roleSegmentsSchema = z.array(roleSegmentSchema).min(2).max(20).nullable().optional();

async function assertKnownRoles(supabase: any, segments: RoleSegment[]) {
  const names = Array.from(new Set(segments.map((s) => s.role)));
  const { data, error } = await supabase.from("business_roles").select("name").in("name", names);
  if (error) throw new Error(error.message);
  const known = new Set((data ?? []).map((r: any) => r.name));
  const missing = names.filter((n) => !known.has(n));
  if (missing.length) throw new Error(`Rôles inconnus : ${missing.join(", ")}`);
}


async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Action réservée aux admins/managers");
}

// Vérifie qu'un user n'a pas déjà un shift qui chevauche [start,end] le même jour (hors le shift en cours d'édition).
async function assertNoOverlap(
  supabase: any,
  userId: string | null | undefined,
  shiftDate: string,
  startTime: string,
  endTime: string,
  excludeShiftId?: string,
) {
  if (!userId) return;
  const { data, error } = await supabase
    .from("shifts")
    .select("id, start_time, end_time")
    .eq("user_id", userId)
    .eq("shift_date", shiftDate);
  if (error) throw new Error(error.message);
  const s = startTime.slice(0, 8);
  const e = endTime.slice(0, 8);
  for (const row of data ?? []) {
    if (excludeShiftId && row.id === excludeShiftId) continue;
    const rs = String(row.start_time).slice(0, 8);
    const re = String(row.end_time).slice(0, 8);
    // Chevauchement si rs < e ET re > s
    if (rs < e && re > s) {
      throw new Error(`Conflit : cet employé a déjà un shift ${rs.slice(0,5)}–${re.slice(0,5)} ce jour-là`);
    }
  }
}

// ---------- UPDATE ----------
export const updateShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        shiftId: z.string().uuid(),
        userId: z.string().uuid().nullable().optional(),
        studioId: z.string().uuid().optional(),
        businessRole: businessRoleSchema.optional(),
        shiftDate: z.string().regex(DATE).optional(),
        startTime: z.string().regex(TIME).optional(),
        endTime: z.string().regex(TIME).optional(),
        notes: z.string().max(500).nullable().optional(),
        // Si true → on ne reverrouille pas (permet à l'IA de réassigner)
        unlock: z.boolean().optional(),
        // Si false → ne marque pas le shift comme manuel (utile pour le drag & drop pur)
        markManual: z.boolean().optional(),
        // null pour repasser en mono-rôle, array pour hybride, undefined = inchangé
        roleSegments: roleSegmentsSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: current, error: eCur } = await supabase
      .from("shifts")
      .select("user_id, shift_date, start_time, end_time, published_at, business_role, role_segments")
      .eq("id", data.shiftId)
      .single();
    if (eCur) throw new Error(eCur.message);

    const nextUserId = data.userId !== undefined ? data.userId : current.user_id;
    const nextDate = data.shiftDate ?? current.shift_date;
    const nextStart = data.startTime ?? current.start_time;
    const nextEnd = data.endTime ?? current.end_time;
    await assertNoOverlap(supabase, nextUserId, nextDate, nextStart, nextEnd, data.shiftId);

    // Validation des segments (si fournis)
    if (data.roleSegments !== undefined && data.roleSegments !== null) {
      const v = validateRoleSegments(
        data.roleSegments,
        String(nextStart).slice(0, 5),
        String(nextEnd).slice(0, 5),
      );
      if (!v.ok) throw new Error(`role_segments invalide : ${v.errors.join(" · ")}`);
      await assertKnownRoles(supabase, data.roleSegments);
    }

    const wasPublished = !!current.published_at;
    const userChanged = data.userId !== undefined && data.userId !== current.user_id;
    const timeChanged =
      (data.shiftDate && data.shiftDate !== current.shift_date) ||
      (data.startTime && data.startTime !== String(current.start_time).slice(0, 8)) ||
      (data.endTime && data.endTime !== String(current.end_time).slice(0, 8));
    const prevSegs = (current.role_segments as RoleSegment[] | null) ?? null;
    const segmentsChanged =
      data.roleSegments !== undefined &&
      JSON.stringify(data.roleSegments ?? null) !== JSON.stringify(prevSegs);
    const roleChanged =
      data.businessRole !== undefined && data.businessRole !== current.business_role;
    const wasHybrid = !!prevSegs && prevSegs.length >= 2;
    const willBeHybrid = data.roleSegments === undefined
      ? wasHybrid
      : !!data.roleSegments && data.roleSegments.length >= 2;

    const patch: any = { updated_at: new Date().toISOString() };
    if (data.markManual !== false) patch.is_manual = true;
    if (data.unlock) {
      patch.is_locked = false;
    } else if (data.markManual !== false) {
      patch.is_locked = true;
    }
    if (data.userId !== undefined) patch.user_id = data.userId;
    if (data.studioId) patch.studio_id = data.studioId;
    if (data.businessRole) patch.business_role = data.businessRole;
    if (data.shiftDate) patch.shift_date = data.shiftDate;
    if (data.startTime) patch.start_time = data.startTime;
    if (data.endTime) patch.end_time = data.endTime;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.roleSegments !== undefined) {
      patch.role_segments = data.roleSegments;
      // En mode hybride, force business_role = rôle du 1er segment
      if (data.roleSegments && data.roleSegments.length > 0) {
        patch.business_role = data.roleSegments[0].role;
      }
    }


    const { error } = await supabase.from("shifts").update(patch).eq("id", data.shiftId);
    if (error) throw new Error(error.message);

    // Si on assigne un employé à un shift hybride, vérifier qu'il a tous les rôles requis
    if (nextUserId && willBeHybrid) {
      const finalSegs = data.roleSegments !== undefined ? data.roleSegments : prevSegs;
      const finalRole = patch.business_role ?? current.business_role;
      await assertEmployeeHasRequiredRoles(supabase, nextUserId, finalRole, finalSegs as RoleSegment[] | null);
    }

    // Notifications quand on modifie un shift déjà publié
    if (wasPublished) {
      const fmtRange = `${nextDate} ${String(nextStart).slice(0,5)}–${String(nextEnd).slice(0,5)}`;
      const notifs: any[] = [];
      if (userChanged) {
        if (current.user_id) {
          notifs.push({
            user_id: current.user_id,
            type: "shift_removed",
            title: "Shift retiré",
            body: `Le shift du ${current.shift_date} ${String(current.start_time).slice(0,5)} a été réassigné.`,
            link: employeeLink({ kind: "shift", shiftId: data.shiftId }),
            priority: "info",
            category: "shift",
          });
        }
        if (nextUserId) {
          notifs.push({
            user_id: nextUserId,
            type: "shift_added",
            title: "Nouveau shift",
            body: fmtRange + (willBeHybrid ? " · multi-rôles" : ""),
            link: employeeLink({ kind: "shift", shiftId: data.shiftId }),
            priority: "normal",
            category: "shift",
          });
        }
      } else if (nextUserId && (timeChanged || roleChanged || segmentsChanged)) {
        let body = fmtRange;
        const changes: string[] = [];
        if (timeChanged) changes.push("horaires");
        if (segmentsChanged && wasHybrid !== willBeHybrid) {
          changes.push(willBeHybrid ? "passage en multi-rôles" : "retour en mono-rôle");
        } else if (segmentsChanged) {
          changes.push("segments de rôles");
        } else if (roleChanged) {
          changes.push(`rôle → ${patch.business_role}`);
        }
        if (changes.length) body = `${fmtRange} · ${changes.join(", ")}`;
        notifs.push({
          user_id: nextUserId,
          type: "shift_updated",
          title: "Shift modifié",
          body,
          link: employeeLink({ kind: "shift", shiftId: data.shiftId }),
          priority: "info",
          category: "shift",
        });
      }
      if (notifs.length > 0) await supabase.from("notifications").insert(notifs);
    }

    return { ok: true };
  });

// ---------- CREATE ----------
export const createShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid().nullable(),
        studioId: z.string().uuid(),
        businessRole: businessRoleSchema,
        shiftDate: z.string().regex(DATE),
        startTime: z.string().regex(TIME),
        endTime: z.string().regex(TIME),
        notes: z.string().max(500).optional(),
        publishImmediately: z.boolean().default(false),
        roleSegments: roleSegmentsSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    await assertNoOverlap(supabase, data.userId, data.shiftDate, data.startTime, data.endTime);

    // Validation segments
    let segments: RoleSegment[] | null = null;
    let primaryRole = data.businessRole;
    if (data.roleSegments && data.roleSegments.length > 0) {
      const v = validateRoleSegments(
        data.roleSegments,
        data.startTime.slice(0, 5),
        data.endTime.slice(0, 5),
      );
      if (!v.ok) throw new Error(`role_segments invalide : ${v.errors.join(" · ")}`);
      await assertKnownRoles(supabase, data.roleSegments);
      segments = data.roleSegments;
      primaryRole = data.roleSegments[0].role;
    }

    const status = data.publishImmediately ? "scheduled" : "draft";
    const published_at = data.publishImmediately ? new Date().toISOString() : null;

    const { data: row, error } = await supabase
      .from("shifts")
      .insert({
        user_id: data.userId,
        studio_id: data.studioId,
        business_role: primaryRole,
        shift_date: data.shiftDate,
        start_time: data.startTime,
        end_time: data.endTime,
        notes: data.notes ?? null,
        status,
        published_at,
        is_manual: true,
        is_locked: true,
        role_segments: segments,

      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.publishImmediately && data.userId) {
      await supabase.from("notifications").insert({
        user_id: data.userId,
        type: "shift_added",
        title: "Nouveau shift ajouté",
        body: `${data.shiftDate} ${data.startTime.slice(0, 5)}-${data.endTime.slice(0, 5)}`,
        link: row?.id ? employeeLink({ kind: "shift", shiftId: row.id }) : "/staff-app?tab=planning",
        priority: "normal",
        category: "shift",
      });
    }
    return { ok: true, id: row?.id };
  });

// ---------- ASSIGN DIRECT (admin) ----------
// Assigne directement un employé à un shift libre (hole), sans passer par les propositions.
// - Vérifie qu'il n'y a pas de conflit horaire pour l'employé
// - Annule les propositions pending pour ce shift
// - Marque le shift publié (si pas déjà) + assigné + verrouillé
// - Notifie l'employé qu'il a un nouveau shift
export const assignShiftDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      shiftId: z.string().uuid(),
      userId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: cur, error: eCur } = await supabase
      .from("shifts")
      .select("id, user_id, shift_date, start_time, end_time, business_role, studio_id, published_at, role_segments")
      .eq("id", data.shiftId)
      .single();
    if (eCur) throw new Error(eCur.message);
    if (cur.user_id && cur.user_id !== data.userId) {
      throw new Error("Ce shift est déjà attribué à quelqu'un d'autre");
    }

    await assertNoOverlap(supabase, data.userId, cur.shift_date, cur.start_time, cur.end_time, data.shiftId);
    await assertEmployeeHasRequiredRoles(supabase, data.userId, cur.business_role, (cur.role_segments as RoleSegment[] | null) ?? null);

    // Attribution atomique : ne réussit que si encore libre
    const nowIso = new Date().toISOString();
    const { data: updated, error: eUp } = await supabase
      .from("shifts")
      .update({
        user_id: data.userId,
        is_manual: true,
        is_locked: true,
        published_at: cur.published_at ?? nowIso,
        status: "scheduled",
        updated_at: nowIso,
      })
      .eq("id", data.shiftId)
      .is("user_id", null)
      .select("id")
      .maybeSingle();
    if (eUp) throw new Error(eUp.message);
    if (!updated) throw new Error("Ce shift vient d'être attribué par quelqu'un d'autre");

    // Annule toutes les propositions pending pour ce shift
    await supabase
      .from("shift_proposals")
      .update({ status: "cancelled", responded_at: nowIso })
      .eq("shift_id", data.shiftId)
      .eq("status", "pending");

    // Notifie l'employé
    const dateLabel = new Date(cur.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    await supabase.from("notifications").insert({
      user_id: data.userId,
      type: "shift_assigned",
      title: "Nouveau shift assigné",
      body: `${cur.business_role} · ${dateLabel} · ${String(cur.start_time).slice(0,5)}–${String(cur.end_time).slice(0,5)}`,
      link: employeeLink({ kind: "shift", shiftId: data.shiftId }),
      priority: "normal",
      category: "shift",
    });

    return { ok: true };
  });

export const assignShiftsDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      shiftIds: z.array(z.string().uuid()).min(1).max(200),
      userId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const shiftIds = Array.from(new Set(data.shiftIds));
    const { data: shifts, error: eCur } = await supabase
      .from("shifts")
      .select("id, user_id, shift_date, start_time, end_time, business_role, studio_id, published_at, role_segments")
      .in("id", shiftIds)
      .order("shift_date", { ascending: true });
    if (eCur) throw new Error(eCur.message);
    if (!shifts || shifts.length !== shiftIds.length) throw new Error("Certains shifts sont introuvables");
    if (shifts.some((shift: any) => shift.user_id && shift.user_id !== data.userId)) {
      throw new Error("Un des shifts est déjà attribué à quelqu'un d'autre");
    }

    for (const shift of shifts) {
      await assertNoOverlap(supabase, data.userId, shift.shift_date, shift.start_time, shift.end_time, shift.id);
      await assertEmployeeHasRequiredRoles(supabase, data.userId, shift.business_role, (shift.role_segments as RoleSegment[] | null) ?? null);
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: eUp } = await supabase
      .from("shifts")
      .update({
        user_id: data.userId,
        is_manual: true,
        is_locked: true,
        published_at: nowIso,
        status: "scheduled",
        updated_at: nowIso,
      })
      .in("id", shiftIds)
      .is("user_id", null)
      .select("id");
    if (eUp) throw new Error(eUp.message);
    if (!updated || updated.length !== shiftIds.length) throw new Error("Un shift vient d'être attribué par quelqu'un d'autre");

    await supabase
      .from("shift_proposals")
      .update({ status: "cancelled", responded_at: nowIso })
      .in("shift_id", shiftIds)
      .eq("status", "pending");

    const notifs = shifts.map((shift: any) => {
      const dateLabel = new Date(shift.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
      return {
        user_id: data.userId,
        type: "shift_assigned",
        title: "Nouveau shift assigné",
        body: `${shift.business_role} · ${dateLabel} · ${String(shift.start_time).slice(0,5)}–${String(shift.end_time).slice(0,5)}`,
        link: employeeLink({ kind: "shift", shiftId: shift.id }),
        priority: "normal",
        category: "shift",
      };
    });
    if (notifs.length > 0) await supabase.from("notifications").insert(notifs);

    return { ok: true, count: shifts.length };
  });


// ---------- DELETE ----------
export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: cur } = await supabase
      .from("shifts")
      .select("user_id, shift_date, start_time, published_at, business_role")
      .eq("id", data.shiftId)
      .single();

    // Cancel pending proposals for this shift and notify those employees
    const { data: pendingProps } = await supabase
      .from("shift_proposals")
      .select("id, user_id")
      .eq("shift_id", data.shiftId)
      .eq("status", "pending");
    if (pendingProps && pendingProps.length > 0) {
      await supabase
        .from("shift_proposals")
        .update({ status: "cancelled", responded_at: new Date().toISOString() })
        .in("id", pendingProps.map((p: any) => p.id));
      const notifs = pendingProps.map((p: any) => ({
        user_id: p.user_id,
        type: "proposal_cancelled",
        title: "Proposition annulée",
        body: `Le shift du ${cur?.shift_date ?? ""} ${cur ? String(cur.start_time).slice(0,5) : ""} (${cur?.business_role ?? ""}) a été supprimé`,
        link: "/staff-app?tab=planning",
        priority: "normal",
        category: "shift",
      }));
      if (notifs.length > 0) await supabase.from("notifications").insert(notifs);
    }

    const { error } = await supabase.from("shifts").delete().eq("id", data.shiftId);
    if (error) throw new Error(error.message);
    if (cur?.published_at && cur.user_id) {
      await supabase.from("notifications").insert({
        user_id: cur.user_id,
        type: "shift_removed",
        title: "Shift annulé",
        body: `${cur.shift_date} ${String(cur.start_time).slice(0,5)}`,
        link: "/staff-app?tab=planning",
        priority: "normal",
        category: "shift",
      });
    }
    return { ok: true };
  });


// ---------- PUBLISH ----------
export const publishPlanning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        startDate: z.string().regex(DATE),
        endDate: z.string().regex(DATE),
        studioId: z.string().uuid().optional(), // legacy single studio
        studioIds: z.array(z.string().uuid()).optional(), // multi-studio publish
        // Si false (défaut) → bloque si une publication existe déjà sur la période.
        // Le client doit confirmer (true) pour republier.
        confirmRepublish: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const studioIds = (data.studioIds && data.studioIds.length > 0)
      ? data.studioIds
      : (data.studioId ? [data.studioId] : []);

    // 0. Garde-fou anti-double-publication : signale si une publication existe
    // déjà qui chevauche la période. L'admin doit confirmer pour republier.
    if (!data.confirmRepublish) {
      const { data: prev } = await supabase
        .from("planning_publications")
        .select("id, period_start, period_end, published_at")
        .lte("period_start", data.endDate)
        .gte("period_end", data.startDate)
        .order("published_at", { ascending: false })
        .limit(1);
      if (prev && prev.length > 0) {
        const last = prev[0] as any;
        return {
          ok: false,
          alreadyPublished: true,
          previousPublishedAt: last.published_at,
          previousRange: { start: last.period_start, end: last.period_end },
          published: 0,
          notified: 0,
        };
      }
    }

    // 1. Récupère les shifts à publier (assignés mais jamais publiés)
    let q = supabase
      .from("shifts")
      .select("id, user_id, shift_date, start_time, end_time, studio_id")
      .is("published_at", null)
      .not("user_id", "is", null)
      .gte("shift_date", data.startDate)
      .lte("shift_date", data.endDate);
    if (studioIds.length > 0) q = q.in("studio_id", studioIds);
    const { data: drafts, error: e1 } = await q;
    if (e1) throw new Error(e1.message);

    const list = drafts ?? [];
    if (list.length === 0) {
      return { ok: true, published: 0, notified: 0 };
    }

    const now = new Date().toISOString();
    const ids = list.map((s: any) => s.id);
    const { error: e2 } = await supabase
      .from("shifts")
      .update({ status: "scheduled", published_at: now })
      .in("id", ids);
    if (e2) throw new Error(e2.message);

    // 2. Audit
    await supabase.from("planning_publications").insert({
      published_by: userId,
      period_start: data.startDate,
      period_end: data.endDate,
      shifts_count: list.length,
    });

    // 3. Notifs (1 par employé concerné)
    const userMap = new Map<string, number>();
    for (const s of list as any[]) {
      if (!s.user_id) continue;
      userMap.set(s.user_id, (userMap.get(s.user_id) ?? 0) + 1);
    }
    if (userMap.size > 0) {
      const notifs = Array.from(userMap.entries()).map(([uid, count]) => ({
        user_id: uid,
        type: "planning_published",
        title: "Nouveau planning publié",
        body: `${count} shift${count > 1 ? "s" : ""} entre le ${data.startDate} et le ${data.endDate}`,
        link: "/staff-app?tab=planning",
        priority: "info",
        category: "planning",
      }));
      await supabase.from("notifications").insert(notifs);
    }

    return { ok: true, published: list.length, notified: userMap.size };
  });
