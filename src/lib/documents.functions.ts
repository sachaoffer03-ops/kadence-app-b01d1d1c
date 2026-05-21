import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminOrManager(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Réservé aux admins et managers");
}

const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const DOC_TYPES = ["fiche_paie", "contrat", "attestation", "autre"] as const;

const sanitizeText = (s: string, max = 200) =>
  s.replace(/[\u0000-\u001F\u007F<>]/g, "").trim().slice(0, max);

function extFor(mime: string) {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "bin";
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────

export const listEmployeeDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { data: docs, error } = await supabase
      .from("employee_documents")
      .select("*")
      .eq("user_id", data.userId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const uploaderIds = Array.from(new Set((docs ?? []).map((d: any) => d.uploaded_by).filter(Boolean)));
    let uploaders: Record<string, { first_name: string; last_name: string }> = {};
    if (uploaderIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", uploaderIds);
      uploaders = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }
    return { documents: docs ?? [], uploaders };
  });

export const uploadEmployeeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      type: z.enum(DOC_TYPES),
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional().nullable(),
      periodStart: z.string().optional().nullable(),
      periodEnd: z.string().optional().nullable(),
      fileBase64: z.string().min(1),
      fileName: z.string().min(1).max(255),
      fileMimeType: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);

    if (!ALLOWED_MIME.includes(data.fileMimeType)) {
      throw new Error("Type de fichier non autorisé (PDF, PNG, JPG, WEBP).");
    }

    // Vérifier que le profil existe
    const { data: prof } = await supabase.from("profiles").select("id").eq("id", data.userId).maybeSingle();
    if (!prof) throw new Error("Employé introuvable.");

    const b64 = data.fileBase64.includes(",") ? data.fileBase64.split(",").pop()! : data.fileBase64;
    const bytes = Buffer.from(b64, "base64");
    if (bytes.byteLength > MAX_BYTES) throw new Error("Fichier trop volumineux (max 10 Mo).");
    if (bytes.byteLength === 0) throw new Error("Fichier vide.");

    const docId = crypto.randomUUID();
    const ext = extFor(data.fileMimeType);
    const filePath = `documents/${data.userId}/${docId}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("employee-documents")
      .upload(filePath, bytes, { contentType: data.fileMimeType, upsert: false });
    if (upErr) throw new Error("Upload échoué : " + upErr.message);

    const title = sanitizeText(data.title);
    const description = data.description ? sanitizeText(data.description, 2000) : null;

    const { data: inserted, error: insErr } = await supabase
      .from("employee_documents")
      .insert({
        id: docId,
        user_id: data.userId,
        uploaded_by: userId,
        type: data.type,
        title,
        description,
        file_path: filePath,
        file_size_bytes: bytes.byteLength,
        file_mime_type: data.fileMimeType,
        period_start: data.periodStart || null,
        period_end: data.periodEnd || null,
      })
      .select()
      .single();
    if (insErr) {
      await supabase.storage.from("employee-documents").remove([filePath]);
      throw new Error(insErr.message);
    }

    // Notif employé
    await supabase.from("notifications").insert({
      user_id: data.userId,
      type: "document_uploaded",
      title: "Nouveau document",
      body: `${title} a été ajouté à tes documents`,
      link: "/staff-app?openDocs=1",
    });

    return { document: inserted };
  });

export const updateEmployeeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      documentId: z.string().uuid(),
      patch: z.object({
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
        type: z.enum(DOC_TYPES).optional(),
        period_start: z.string().nullable().optional(),
        period_end: z.string().nullable().optional(),
      }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const patch: any = { ...data.patch };
    if (patch.title) patch.title = sanitizeText(patch.title);
    if (patch.description) patch.description = sanitizeText(patch.description, 2000);
    const { error } = await supabase.from("employee_documents").update(patch).eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEmployeeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { data: doc } = await supabase
      .from("employee_documents")
      .select("file_path")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!doc) throw new Error("Document introuvable.");
    await supabase.storage.from("employee-documents").remove([doc.file_path]);
    const { error } = await supabase.from("employee_documents").delete().eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDocumentDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc } = await supabase
      .from("employee_documents")
      .select("file_path, user_id")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!doc) throw new Error("Document introuvable.");
    if (doc.user_id !== userId) {
      await assertAdminOrManager(supabase, userId);
    }
    const { data: signed, error } = await supabase.storage
      .from("employee-documents")
      .createSignedUrl(doc.file_path, 60);
    if (error || !signed) throw new Error("Lien indisponible.");
    return { url: signed.signedUrl };
  });

// ─── EMPLOYEE ────────────────────────────────────────────────────────────────

export const listMyDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ type: z.enum(DOC_TYPES).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("employee_documents")
      .select("id, type, title, description, file_size_bytes, file_mime_type, period_start, period_end, first_viewed_at, created_at, uploaded_by")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    if (data?.type) q = q.eq("type", data.type);
    const { data: docs, error } = await q;
    if (error) throw new Error(error.message);
    return { documents: docs ?? [] };
  });

export const markDocumentViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc } = await supabase
      .from("employee_documents")
      .select("id, first_viewed_at")
      .eq("id", data.documentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!doc) return { ok: false };
    if (doc.first_viewed_at) return { ok: true };
    await supabase
      .from("employee_documents")
      .update({ first_viewed_at: new Date().toISOString() })
      .eq("id", data.documentId)
      .eq("user_id", userId);
    return { ok: true };
  });

export const getMyDocumentDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc } = await supabase
      .from("employee_documents")
      .select("file_path, user_id")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!doc || doc.user_id !== userId) throw new Error("Document introuvable.");
    const { data: signed, error } = await supabase.storage
      .from("employee-documents")
      .createSignedUrl(doc.file_path, 60);
    if (error || !signed) throw new Error("Lien indisponible.");
    return { url: signed.signedUrl };
  });

export const countUnviewedDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data?.userId ?? userId;
    if (target !== userId) await assertAdminOrManager(supabase, userId);
    const { count } = await supabase
      .from("employee_documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", target)
      .eq("is_archived", false)
      .is("first_viewed_at", null);
    return { count: count ?? 0 };
  });
