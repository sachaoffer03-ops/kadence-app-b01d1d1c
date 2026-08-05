import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { completeShiftClockOut, validateClockIn } from "./shift-clock.server";
import { getShiftClockPolicy } from "./clock-policy.functions.server";

const clockOutSchema = z.object({
  shiftId: z.string().uuid(),
  submissionId: z.string().uuid().nullable().optional(),
  rating: z.number().int().min(0).max(5).nullable().optional(),
  feedbackMsg: z.string().max(1000).nullable().optional(),
  reportMsg: z.string().max(2000).nullable().optional(),
  handoffMsg: z.string().max(2000).nullable().optional(),
  outReason: z.string().max(500).nullable().optional(),
});

export const completeShiftClockOutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => clockOutSchema.parse(input))
  .handler(async ({ data, context }) => {
    return completeShiftClockOut({ ...data, actorId: context.userId });
  });

const clockInSchema = z.object({
  shiftId: z.string().uuid(),
  qrCode: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  lateReason: z.string().max(500).nullable().optional(),
});

export const validateClockInFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => clockInSchema.parse(input))
  .handler(async ({ data, context }) => {
    return validateClockIn({ ...data, actorId: context.userId });
  });

const policySchema = z.object({ shiftId: z.string().uuid() });

/** Politique de pointage en direct pour un shift (tolérances studio + écarts actuels). */
export const getShiftClockPolicyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => policySchema.parse(input))
  .handler(async ({ data }) => getShiftClockPolicy(data.shiftId));

