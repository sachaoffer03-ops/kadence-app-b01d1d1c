import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateClockOut, finalizeClosure } from "./closure-flow.server";

const validateSchema = z.object({
  shiftId: z.string().uuid(),
  qrCode: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

export const validateClockOutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => validateSchema.parse(input))
  .handler(async ({ data, context }) => {
    return validateClockOut({ ...data, actorId: context.userId });
  });

const finalizeSchema = z.object({
  shiftId: z.string().uuid(),
  submissionId: z.string().uuid().nullable().optional(),
  responses: z.array(z.object({
    questionId: z.string().uuid(),
    stars: z.number().int().min(0).max(5).nullable().optional(),
    yesno: z.boolean().nullable().optional(),
    text: z.string().max(2000).nullable().optional(),
  })).max(50),
});

export const finalizeClosureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => finalizeSchema.parse(input))
  .handler(async ({ data, context }) => {
    return finalizeClosure({
      shiftId: data.shiftId,
      actorId: context.userId,
      submissionId: data.submissionId ?? null,
      responses: data.responses,
    });
  });
