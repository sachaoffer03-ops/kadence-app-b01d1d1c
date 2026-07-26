import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

// Détecte, côté serveur (SSR), si la requête vient du site vitrine kadence.be
export const getHostContext = createServerFn({ method: "GET" }).handler(async () => {
  let host = "";
  try {
    const req = getRequest();
    host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  } catch {
    host = "";
  }
  const clean = host.split(":")[0];
  const isMarketing = clean === "kadence.be" || clean === "www.kadence.be";
  return { host: clean, isMarketing };
});

const DemoRequestInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  teamSize: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(1500).optional().or(z.literal("")),
});

export const submitDemoRequest = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => DemoRequestInput.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.toLowerCase();

    // Anti-spam simple : 3 demandes max par email sur 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("demo_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since);

    if ((count ?? 0) >= 3) {
      return { ok: false as const, reason: "rate_limited" };
    }

    const { error } = await supabaseAdmin.from("demo_requests").insert({
      name: data.name,
      email,
      company: data.company || null,
      team_size: data.teamSize || null,
      message: data.message || null,
      source: "kadence.be",
    });

    if (error) {
      console.error("demo_request insert failed", error.message);
      return { ok: false as const, reason: "insert_failed" };
    }

    return { ok: true as const };
  });
