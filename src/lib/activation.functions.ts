import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  token: z.string().min(1).max(200),
  phone: z.string().max(40).nullable().optional(),
  birth_date: z.string().max(20).nullable().optional(),
  nationality: z.string().max(80).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  niss: z.string().max(40).nullable().optional(),
  iban: z.string().max(50).nullable().optional(),
  emergency_contact_name: z.string().max(120).nullable().optional(),
  emergency_contact_phone: z.string().max(40).nullable().optional(),
  emergency_contact_relation: z.string().max(80).nullable().optional(),
  student_card_valid: z.boolean().optional(),
  avatar_url: z.string().url().max(1000).nullable().optional(),
});

export const completeActivationProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const normalized = data.token.replace(/[^a-fA-F0-9]/gi, "").toLowerCase();

    // Vérifier que l'invitation correspond bien à l'utilisateur authentifié (via email)
    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("id, email")
      .eq("token", normalized)
      .maybeSingle();
    if (!inv) throw new Error("Invitation introuvable");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Profil introuvable");
    if ((profile.email || "").toLowerCase() !== (inv.email || "").toLowerCase()) {
      throw new Error("Invitation ne correspond pas au compte");
    }

    const patch: Record<string, unknown> = {
      status: "active",
    };
    const assign = (k: string, v: unknown) => {
      if (v !== undefined && v !== null && v !== "") patch[k] = v;
    };
    assign("phone", data.phone);
    assign("birth_date", data.birth_date);
    assign("nationality", data.nationality);
    assign("city", data.city);
    assign("address", data.address);
    assign("niss", data.niss);
    assign("iban", data.iban);
    assign("emergency_contact_name", data.emergency_contact_name);
    assign("emergency_contact_phone", data.emergency_contact_phone);
    assign("emergency_contact_relation", data.emergency_contact_relation);
    if (typeof data.student_card_valid === "boolean") patch.student_card_valid = data.student_card_valid;
    if (data.avatar_url) patch.avatar_url = data.avatar_url;

    const { error } = await supabaseAdmin.from("profiles").update(patch as any).eq("id", userId);
    if (error) throw new Error(error.message);

    // Inscription terminée jusqu'au bout : on marque enfin l'invitation
    // comme « accepted », ce qui rend le lien inactif.
    await supabaseAdmin
      .from("invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", inv.id);

    return { ok: true };
  });

