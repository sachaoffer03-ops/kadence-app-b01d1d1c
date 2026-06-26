import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Réservé aux administrateurs");
}

export const listKnowledgeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_knowledge_entries")
      .select("id, title, content, category, tags, priority, is_active, entry_type, data, author_id, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { entries: data ?? [] };
  });

const EntryTypeEnum = z.enum(["text", "faq", "link", "file", "table"]);

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(100000),
  category: z.string().min(1).max(60),
  tags: z.array(z.string().min(1).max(60)).max(20).default([]),
  priority: z.number().int().min(0).max(100).default(0),
  is_active: z.boolean().default(true),
  entry_type: EntryTypeEnum.default("text"),
  data: z.record(z.string(), z.any()).default({}),
});

export const upsertKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      title: data.title,
      content: data.content,
      category: data.category,
      tags: data.tags,
      priority: data.priority,
      is_active: data.is_active,
      entry_type: data.entry_type,
      data: data.data,
    };

    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("ai_knowledge_entries")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { entry: row };
    }

    const { data: row, error } = await supabaseAdmin
      .from("ai_knowledge_entries")
      .insert({ ...payload, author_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { entry: row };
  });

export const toggleKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_knowledge_entries")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_knowledge_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Génère une URL signée (1h) pour un fichier du bucket ai-knowledge. */
export const getKnowledgeFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ path: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("ai-knowledge")
      .createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

const StoredFileExtractSchema = z.object({
  path: z.string().min(1),
  fileName: z.string().min(1).max(240),
  mimeType: z.string().max(120).optional().nullable(),
});

function guessMimeType(fileName: string, mimeType?: string | null) {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const n = fileName.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (/\.(txt|md|csv|tsv|json|log|html|xml|yaml|yml)$/.test(n)) return "text/plain";
  return mimeType || "application/octet-stream";
}

function isPlainTextKnowledgeFile(fileName: string, mimeType: string) {
  return mimeType.startsWith("text/") || /\.(txt|md|csv|tsv|json|log|html|xml|yaml|yml)$/.test(fileName.toLowerCase());
}

async function extractKnowledgeTextWithAI(args: { fileName: string; mimeType: string; base64: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Extraction IA indisponible : clé IA manquante");

  const client = new Anthropic({ apiKey });
  const source = { type: "base64", media_type: args.mimeType, data: args.base64 };
  const fileBlock = args.mimeType.startsWith("image/")
    ? { type: "image", source }
    : { type: "document", source };

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [{
      role: "user",
      content: [
        fileBlock,
        {
          type: "text",
          text: `Extrais le contenu utile de ce fichier pour la base de connaissances du chatbot Kadence.

Fichier : ${args.fileName}

Règles :
- Réponds uniquement avec le contenu exploitable par le chatbot, en français si le document est en français.
- Conserve les recettes, procédures, quantités, étapes, FAQ, titres et détails importants.
- Si c'est un scan ou une image, fais l'OCR au mieux.
- Ne dis pas que tu es une IA et n'ajoute pas de commentaire extérieur au document.`,
        },
      ],
    }],
  } as any);

  return response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 90000);
}

/** Ré-extrait le texte d'un fichier déjà uploadé dans ai-knowledge, utile pour les PDF/scans. */
export const extractKnowledgeStoredFileText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => StoredFileExtractSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: blob, error } = await supabaseAdmin.storage.from("ai-knowledge").download(data.path);
    if (error) throw new Error(error.message);
    if (!blob) throw new Error("Fichier introuvable");

    const mimeType = guessMimeType(data.fileName, data.mimeType || blob.type);
    const arrayBuffer = await blob.arrayBuffer();
    if (arrayBuffer.byteLength > 18 * 1024 * 1024) {
      throw new Error("Fichier trop lourd pour l'extraction automatique (max 18 MB)");
    }

    if (isPlainTextKnowledgeFile(data.fileName, mimeType)) {
      const text = new TextDecoder("utf-8").decode(arrayBuffer).trim().slice(0, 90000);
      return { text, source: "text" as const };
    }

    if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
      return { text: "", source: "unsupported" as const };
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const text = await extractKnowledgeTextWithAI({ fileName: data.fileName, mimeType, base64 });
    return { text, source: "ai" as const };
  });

export const KNOWLEDGE_CATEGORIES = [
  { value: "planning", label: "Planning & shifts" },
  { value: "dispos", label: "Disponibilités" },
  { value: "pointage", label: "Pointage & checklists" },
  { value: "scoring", label: "Scoring & évaluations" },
  { value: "formations", label: "Formations" },
  { value: "contrats", label: "Contrats & paie" },
  { value: "procedures", label: "Procédures studio" },
  { value: "produits", label: "Produits & menu" },
  { value: "clients", label: "Relation client" },
  { value: "faq", label: "FAQ employés" },
  { value: "general", label: "Général" },
] as const;

export const KNOWLEDGE_TYPES = [
  { value: "text", label: "Texte enrichi", icon: "Type" },
  { value: "faq", label: "FAQ", icon: "HelpCircle" },
  { value: "link", label: "Lien", icon: "Link2" },
  { value: "file", label: "Fichier", icon: "FileUp" },
  { value: "table", label: "Tableau", icon: "Table2" },
] as const;
