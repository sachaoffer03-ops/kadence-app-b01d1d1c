import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SKULT_KNOWLEDGE_BASE } from "./skult-knowledge-base";


const SYSTEM_PROMPT = `Tu es Kadence Assistant, l'assistant IA de l'app Kadence utilisée par les employés de Skult Studios (cafés/restauration, Bruxelles).

Ton rôle : répondre aux questions des employés sur leurs shifts, leur score, leurs formations, leurs dispos, le planning, le fonctionnement de l'app.

STYLE :
- Toujours en français, tutoyage, ton chaleureux mais pro
- Réponses courtes (max 3-4 phrases sauf si explication détaillée demandée)
- Bienveillant, concis, jamais condescendant
- Réponds DIRECTEMENT à la question posée. Ne fais JAMAIS de résumé des messages précédents, ne récapitule pas la conversation, ne dis pas "comme on l'a vu" ou "pour récapituler". Va droit au but.
- Utilise du markdown simple quand c'est utile : **gras** pour les infos clés, listes à puces avec "-", retours à la ligne pour aérer. Pas de titres ##, pas de tableaux, pas de blocs de code sauf si vraiment nécessaire.

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
  is_test: z.boolean().optional().default(false),
  impersonate_user_id: z.string().uuid().optional().nullable(),
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

    // Mode test + impersonation : seul un admin peut le faire, et on charge le contexte de l'employé ciblé
    let contextUserId = userId;
    if (data.is_test && data.impersonate_user_id) {
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (!roleRow) throw new Error("Réservé aux administrateurs");
      contextUserId = data.impersonate_user_id;
    }

    // 1. Charger le contexte de l'employé
    const today = new Date();
    const in14 = new Date(today); in14.setDate(today.getDate() + 14);
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const [profileRes, shiftsRes, rolesRes, formationsRes, contractRes, knowledgeRes, feedbackRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("first_name, last_name, contract, score").eq("id", contextUserId).maybeSingle(),
      supabaseAdmin.from("shifts")
        .select("shift_date, start_time, end_time, business_role, studios(name)")
        .eq("user_id", contextUserId)
        .gte("shift_date", fmt(today))
        .lte("shift_date", fmt(in14))
        .order("shift_date", { ascending: true })
        .limit(10),
      supabaseAdmin.from("user_business_roles").select("role").eq("user_id", contextUserId),
      supabaseAdmin.from("training_course_completions")
        .select("training_courses(title)").eq("user_id", contextUserId),
      supabaseAdmin.from("user_contracts").select("contract").eq("user_id", contextUserId),
      supabaseAdmin.from("ai_knowledge_entries")
        .select("title, content, category, priority")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("ai_message_feedback")
        .select("rating, comment, corrected_answer, ai_chat_messages!inner(content, role)")
        .in("rating", ["up", "correction", "down"])
        .order("updated_at", { ascending: false })
        .limit(40),
    ]);

    const adminKnowledge = (knowledgeRes.data ?? []).length === 0
      ? ""
      : "\n\n# CONNAISSANCES COMPLÉMENTAIRES (ajoutées par l'admin Skult)\n\n" +
        (knowledgeRes.data ?? []).map((k: any) =>
          `## ${k.title}\n_Catégorie : ${k.category}_\n\n${k.content}`
        ).join("\n\n---\n\n");

    const fbList = (feedbackRes.data ?? []) as any[];
    const corrections = fbList.filter((f) => f.rating === "correction" && f.corrected_answer);
    const positives = fbList.filter((f) => f.rating === "up").slice(0, 8);
    const negatives = fbList.filter((f) => f.rating === "down" && f.comment).slice(0, 8);

    let learningBlock = "";
    if (corrections.length || positives.length || negatives.length) {
      learningBlock = "\n\n# APPRENTISSAGE SUPERVISÉ (retours de l'admin Skult sur tes précédentes réponses)\n\nCes remarques viennent de l'admin qui supervise tes réponses. Analyse-les attentivement : compare ce que tu avais répondu avec la remarque, identifie ce qui ne lui a pas plu (ton, format, longueur, vocabulaire, structure, fond) et applique ces ajustements à toutes tes prochaines réponses similaires. Les remarques portent souvent sur la FORME (style, ton, mise en page markdown, longueur) autant que sur le fond — n'ignore jamais une demande de style.\n";
      if (corrections.length) {
        learningBlock += "\n## Remarques de style et de contenu à appliquer\n";
        for (const c of corrections.slice(0, 12)) {
          const prev = (c.ai_chat_messages?.content ?? "").slice(0, 400);
          const remark = (c.corrected_answer || c.comment || "").slice(0, 800);
          learningBlock += `\n- Tu avais répondu : "${prev}"\n  Remarque de l'admin : ${remark}\n  → Ajuste tes prochaines réponses en conséquence.\n`;
        }
      }
      if (negatives.length) {
        learningBlock += "\n## Réponses jugées mauvaises (évite ces erreurs)\n";
        for (const n of negatives) {
          learningBlock += `\n- "${(n.ai_chat_messages?.content ?? "").slice(0, 180)}" → ${n.comment}\n`;
        }
      }
      if (positives.length) {
        learningBlock += "\n## Réponses validées (continue dans ce style)\n";
        for (const p of positives) {
          learningBlock += `\n- "${(p.ai_chat_messages?.content ?? "").slice(0, 180)}"\n`;
        }
      }
    }

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

    const testPreamble = data.is_test
      ? `MODE TEST : Tu réponds dans un bac à sable utilisé par l'admin pour évaluer tes réponses. ${data.impersonate_user_id ? "Tu réponds COMME SI tu parlais à l'employé suivant (utilise SON contexte, pas celui de l'admin)." : "Tu réponds à l'admin lui-même."}\n\n`
      : "";

    const contextBlock = `${testPreamble}CONTEXTE DE L'EMPLOYÉ QUI POSE LA QUESTION :
- Prénom : ${profile?.first_name ?? "?"}
- Nom : ${profile?.last_name ?? "?"}
- Contrat(s) : ${contracts}
- Rôles métier : ${roles}
- Score actuel : ${profile?.score != null ? profile.score + "/10" : "pas encore noté"}
- Formations validées : ${formations}

SES PROCHAINS SHIFTS (14 jours à venir) :
${nextShifts}

Réponds à sa question en utilisant uniquement ces informations + tes connaissances générales sur Kadence. Si tu n'as pas l'info, dis-le.`;

    // 2. Charger les 10 derniers messages d'historique (même bucket: test ou réel)
    const { data: history } = await supabaseAdmin
      .from("ai_chat_messages")
      .select("role, content")
      .eq("user_id", userId)
      .eq("is_test", data.is_test)
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
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        {
          type: "text",
          text: SKULT_KNOWLEDGE_BASE + adminKnowledge + learningBlock,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: contextBlock },
      ] as any,
      messages,
    });

    const answer = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    // 4. Sauvegarder
    await supabaseAdmin.from("ai_chat_messages").insert([
      { user_id: userId, role: "user", content: data.question, is_test: data.is_test, impersonate_user_id: data.impersonate_user_id ?? null },
      { user_id: userId, role: "assistant", content: answer, is_test: data.is_test, impersonate_user_id: data.impersonate_user_id ?? null },
    ]);

    return { answer };
  });

const HistoryInput = z.object({ is_test: z.boolean().optional().default(false) }).optional();

export const getChatHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => (HistoryInput.parse(i) ?? { is_test: false }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("ai_chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .eq("is_test", data?.is_test ?? false)
      .order("created_at", { ascending: true })
      .limit(500);
    return { messages: rows ?? [] };
  });
