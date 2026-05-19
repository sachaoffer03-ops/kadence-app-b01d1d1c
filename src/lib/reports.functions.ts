import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as srv from "./reports.server";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const filtersSchema = z.object({
  from: isoDate,
  to: isoDate,
  studioIds: z.array(z.string().uuid()).max(50).optional(),
  roleIds: z.array(z.string().uuid()).max(50).optional(),
});

async function guard(userId: string) { await srv.assertAdminOrManager(userId); }

export const getOverviewKpisFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => filtersSchema.parse(i))
  .handler(async ({ data, context }) => { await guard(context.userId); return srv.getOverviewKpis(data); });

export const getTopAndBottomPerformersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => filtersSchema.parse(i))
  .handler(async ({ data, context }) => { await guard(context.userId); return srv.getTopAndBottomPerformers(data); });

export const getRecentActivityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => filtersSchema.extend({ limit: z.number().int().min(1).max(100).optional() }).parse(i))
  .handler(async ({ data, context }) => { await guard(context.userId); return srv.getRecentActivity(data, data.limit ?? 20); });

export const getEmployeesReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => filtersSchema.parse(i))
  .handler(async ({ data, context }) => { await guard(context.userId); return srv.getEmployeesReport(data); });

export const getEmployeeDetailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid(), from: isoDate, to: isoDate }).parse(i))
  .handler(async ({ data, context }) => { await guard(context.userId); return srv.getEmployeeDetail(data); });

export const getShiftsReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => filtersSchema.parse(i))
  .handler(async ({ data, context }) => { await guard(context.userId); return srv.getShiftsReport(data); });

export const getShiftDetailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ shiftId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => { await guard(context.userId); return srv.getShiftDetail(data); });
