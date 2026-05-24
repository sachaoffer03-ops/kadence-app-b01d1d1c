import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `Tu es Kadence Assistant, l'assistant IA de l'app Kadence utilisée par les employés de Skult Studios (cafés/restauration, Bruxelles).

Ton rôle : répondre aux questions des employés sur leurs shifts, leur score, leurs formations, leurs dispos, le planning, le fonctionnement de l'app.

STYLE :
- Toujours en français, tutoyage, ton chaleureux mais pro
- Réponses courtes (max 3-4 phrases sauf si explication détaillée demandée)
- Bienveillant, concis, jamais condescendant

RÈGLES IMPORTANTES :
- Si tu ne sais pas, dis-le honnêtement et suggère de contacter le manager
- Ne JAMAIS inventer des données (shifts, scores, etc.) — base-toi UNIQUEMENT sur le contexte fourni
- Si l'employé pose une question hors scope (RH, conflits personnels, paie, démission), redirige-le poliment vers son manager
- Ne révèle jamais d'infos d'autres employés
- N'invente jamais une politique d'entreprise qui n'est pas dans tes connaissances

CONNAISSANCES MÉTIER KADENCE :

Planning :
- L'admin génère un planning mensuel via un algo qui matche les besoins des studios avec les dispos déclarées par les employés
- Le planning est publié pour la semaine suivante généralement le jeudi

Dispos :
- Chaque employé déclare ses créneaux dispos via l'onglet "Dispos" sur l'app
- Deadline généralement mercredi 23h59 pour la semaine d'après
- Au-delà de la deadline, les dispos comptent pour la semaine suivante

Propositions :
- Si un trou apparaît (shift sans personne), l'admin envoie une proposition à plusieurs employés éligibles
- Le PREMIER qui accepte récupère le shift, les autres reçoivent un message "trop tard"

Pointage :
- À l'arrivée au studio, l'employé scanne un QR code pour clock-in
- Une checklist d'ouverture/transition/clôture s'affiche selon le moment de la journée
- À la fin du shift, clock-out + checklist de clôture

Scoring :
- Score sur 10, calculé à partir de 3 critères équivalents (1/3 chacun) :
  * Ponctualité (respect des horaires, retards)
  * Checklists complétées (ouverture/clôture)
  * Évaluations manager (notes données par le manager)
- Reset partiel hebdomadaire (les vieux faits comptent moins)

Formations :
- Certaines formations sont obligatoires pour pouvoir être planifié (HACCP, etc.)
- À valider dans l'onglet Formation de l'app

Contrats légaux Belgique :
- CDI : max 38h/sem (cible 35h ±2h)
- Étudiant : max 15h/sem, quota 650h/an
- Flexi : max 20h/sem
- Repos obligatoire 11h entre 2 shifts`;

const AskInput = z.object({
  question: z.string().min(1).max(2000),
});

export const askKadenceAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AskInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Configure ANTHROPIC_API_KEY dans Lovable Cloud");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Charger le contexte de l'employé
    const today = new Date();
    const in14 = new Date(today); in14.setDate(today.getDate() + 14);
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const [profileRes, shiftsRes, rolesRes, formationsRes, contractRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("first_name, last_name, contract, score").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("shifts")
        .select("shift_date, start_time, end_time, business_role, studios(name)")
        .eq("user_id", userId)
        .gte("shift_date", fmt(today))
        .lte("shift_date", fmt(in14))
        .order("shift_date", { ascending: true })
        .limit(10),
      supabaseAdmin.from("user_business_roles").select("role").eq("user_id", userId),
      supabaseAdmin.from("training_course_completions")
        .select("training_courses(title)").eq("user_id", userId),
      supabaseAdmin.from("user_contracts").select("contract").eq("user_id", userId),
    ]);

    const profile = profileRes.data as any;
    const contracts = (contractRes.data ?? []).map((c: any) => c.contract).filter(Boolean).join(", ")
      || profile?.contract || "non précisé";
    const roles = (rolesRes.data ?? []).map((r: any) => r.role).join(", ") || "aucun";
    const formations = (formationsRes.data ?? [])
      .map((f: any) => f.training_courses?.title)
      .filter(Boolean)
      .join(", ") || "aucune validée pour le moment";

    const nextShifts = (shiftsRes.data ?? []).length === 0
      ? "Aucun shift planifié dans les 14 prochains jours."
      : (shiftsRes.data ?? []).map((s: any) => {
          const dateStr = new Date(s.shift_date).toLocaleDateString("fr-FR", {
            weekday: "long", day: "numeric", month: "long"
          });
          return `- ${dateStr} : ${String(s.start_time).slice(0, 5)}–${String(s.end_time).slice(0, 5)}, ${s.business_role} à ${s.studios?.name ?? "studio non précisé"}`;
        }).join("\n");

    const contextBlock = `
CONTEXTE DE L'EMPLOYÉ QUI POSE LA QUESTION :
- Prénom : ${profile?.first_name ?? "?"}
- Nom : ${profile?.last_name ?? "?"}
- Contrat(s) : ${contracts}
- Rôles métier : ${roles}
- Score actuel : ${profile?.score != null ? profile.score + "/10" : "pas encore noté"}
- Formations validées : ${formations}

SES PROCHAINS SHIFTS (14 jours à venir) :
${nextShifts}

Réponds à sa question en utilisant uniquement ces informations + tes connaissances générales sur Kadence. Si tu n'as pas l'info, dis-le.`;

    // 2. Charger les 10 derniers messages d'historique
    const { data: history } = await supabaseAdmin
      .from("ai_chat_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    const messages = [
      ...(history ?? []).reverse().map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content as string,
      })),
      { role: "user" as const, content: data.question },
    ];

    // 3. Appel Anthropic Claude Haiku
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT + "\n\n" + contextBlock,
      messages,
    });

    const answer = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    // 4. Sauvegarder
    await supabaseAdmin.from("ai_chat_messages").insert([
      { user_id: userId, role: "user", content: data.question },
      { user_id: userId, role: "assistant", content: answer },
    ]);

    return { answer };
  });

export const getChatHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(100);
    return { messages: data ?? [] };
  });
