import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  ChecklistTemplate, ChecklistTemplateItem, ChecklistTemplatePhoto,
  ChecklistSubmission, ChecklistSubmissionItem, ChecklistSubmissionPhoto,
  TemplateWithContent,
} from "@/types/checklists";

const T = "checklist_templates";
const TI = "checklist_template_items";
const TP = "checklist_template_photos";
const S = "checklist_submissions";
const SI = "checklist_submission_items";
const SP = "checklist_submission_photos";
const BUCKET = "checklist-photos";

// =================== TEMPLATES ===================

export function useChecklistTemplates() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase.from(T as any).select("*").order("created_at", { ascending: true });
    setTemplates((data as any) ?? []);
    setLoading(false);
  }, []);

  const cid = useRef(`ct-${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    reload();
    const ch = supabase.channel(cid.current)
      .on("postgres_changes", { event: "*", schema: "public", table: T }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  return { templates, loading, reload };
}

export function useTemplateWithContent(templateId: string | null) {
  const [data, setData] = useState<TemplateWithContent | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!templateId) { setData(null); return; }
    setLoading(true);
    const [{ data: tpl }, { data: items }, { data: photos }] = await Promise.all([
      supabase.from(T as any).select("*").eq("id", templateId).maybeSingle(),
      supabase.from(TI as any).select("*").eq("template_id", templateId).order("order_index"),
      supabase.from(TP as any).select("*").eq("template_id", templateId).order("order_index"),
    ]);
    if (!tpl) { setData(null); setLoading(false); return; }
    setData({ ...(tpl as any), items: (items as any) ?? [], photos: (photos as any) ?? [] });
    setLoading(false);
  }, [templateId]);

  useEffect(() => {
    reload();
    if (!templateId) return;
    const cid = `ctpl-${templateId}-${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(cid)
      .on("postgres_changes", { event: "*", schema: "public", table: TI }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: TP }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: T, filter: `id=eq.${templateId}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [templateId, reload]);

  return { data, loading, reload };
}

export interface TemplateInput {
  name: string;
  description?: string | null;
  business_role_id?: string | null;
  studio_id?: string | null;
  is_blocking?: boolean;
  is_active?: boolean;
}

export async function createTemplate(input: TemplateInput): Promise<ChecklistTemplate> {
  const { data, error } = await supabase.from(T as any).insert({
    name: input.name.trim(),
    description: input.description ?? null,
    business_role_id: input.business_role_id ?? null,
    studio_id: input.studio_id ?? null,
    is_blocking: input.is_blocking ?? true,
    is_active: input.is_active ?? true,
  } as any).select("*").single();
  if (error) throw error;
  return data as any;
}

export async function updateTemplate(id: string, patch: Partial<TemplateInput>): Promise<void> {
  const { error } = await supabase.from(T as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from(T as any).delete().eq("id", id);
  if (error) throw error;
}

// =================== ITEMS ===================

export async function createItem(templateId: string, input: { label: string; description?: string | null; is_required?: boolean }): Promise<ChecklistTemplateItem> {
  const { data: existing } = await supabase.from(TI as any)
    .select("order_index").eq("template_id", templateId)
    .order("order_index", { ascending: false }).limit(1);
  const nextOrder = ((existing as any)?.[0]?.order_index ?? -1) + 1;
  const { data, error } = await supabase.from(TI as any).insert({
    template_id: templateId,
    label: input.label.trim(),
    description: input.description ?? null,
    is_required: input.is_required ?? true,
    order_index: nextOrder,
  } as any).select("*").single();
  if (error) throw error;
  return data as any;
}

export async function updateItem(id: string, patch: Partial<{ label: string; description: string | null; is_required: boolean }>): Promise<void> {
  const { error } = await supabase.from(TI as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from(TI as any).delete().eq("id", id);
  if (error) throw error;
}

export async function reorderItems(orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, idx) =>
    supabase.from(TI as any).update({ order_index: idx } as any).eq("id", id)
  ));
}

// =================== PHOTOS (template references) ===================

export async function createPhoto(templateId: string, input: { label: string; description?: string | null; is_required?: boolean }): Promise<ChecklistTemplatePhoto> {
  const { data: existing } = await supabase.from(TP as any)
    .select("order_index").eq("template_id", templateId)
    .order("order_index", { ascending: false }).limit(1);
  const nextOrder = ((existing as any)?.[0]?.order_index ?? -1) + 1;
  const { data, error } = await supabase.from(TP as any).insert({
    template_id: templateId,
    label: input.label.trim(),
    description: input.description ?? null,
    is_required: input.is_required ?? true,
    order_index: nextOrder,
  } as any).select("*").single();
  if (error) throw error;
  return data as any;
}

export async function updatePhoto(id: string, patch: Partial<{ label: string; description: string | null; is_required: boolean; reference_photo_url: string | null }>): Promise<void> {
  const { error } = await supabase.from(TP as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deletePhoto(id: string): Promise<void> {
  const { error } = await supabase.from(TP as any).delete().eq("id", id);
  if (error) throw error;
}

export async function uploadReferencePhoto(file: File, templateId: string, photoId: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `references/${templateId}/${photoId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
  if (error) throw error;
  await updatePhoto(photoId, { reference_photo_url: path });
  return path;
}

export async function getChecklistPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// =================== SUBMISSIONS (admin view) ===================

export interface SubmissionWithRelated extends ChecklistSubmission {
  items: ChecklistSubmissionItem[];
  photos: ChecklistSubmissionPhoto[];
  user_first_name?: string | null;
  user_last_name?: string | null;
  shift_date?: string | null;
  template_name?: string | null;
}

export function useChecklistSubmissions() {
  const [submissions, setSubmissions] = useState<SubmissionWithRelated[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase.from(S as any).select("*").order("created_at", { ascending: false }).limit(500);
    const subs = (data as any[]) ?? [];
    if (subs.length === 0) { setSubmissions([]); setLoading(false); return; }
    const userIds = [...new Set(subs.map((s) => s.user_id))];
    const shiftIds = [...new Set(subs.map((s) => s.shift_id))];
    const tplIds = [...new Set(subs.map((s) => s.template_id))];
    const [{ data: profiles }, { data: shifts }, { data: tpls }] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name").in("id", userIds),
      supabase.from("shifts").select("id, shift_date").in("id", shiftIds),
      supabase.from(T as any).select("id, name").in("id", tplIds),
    ]);
    const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const sMap = new Map((shifts ?? []).map((s: any) => [s.id, s]));
    const tMap = new Map(((tpls as any[]) ?? []).map((t: any) => [t.id, t]));
    setSubmissions(subs.map((s) => ({
      ...s,
      items: [],
      photos: [],
      user_first_name: pMap.get(s.user_id)?.first_name ?? null,
      user_last_name: pMap.get(s.user_id)?.last_name ?? null,
      shift_date: sMap.get(s.shift_id)?.shift_date ?? null,
      template_name: tMap.get(s.template_id)?.name ?? null,
    })));
    setLoading(false);
  }, []);

  const cid = useRef(`csub-${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    reload();
    const ch = supabase.channel(cid.current)
      .on("postgres_changes", { event: "*", schema: "public", table: S }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  return { submissions, loading, reload };
}

export async function loadSubmissionDetail(submissionId: string): Promise<{ items: ChecklistSubmissionItem[]; photos: ChecklistSubmissionPhoto[] }> {
  const [{ data: items }, { data: photos }] = await Promise.all([
    supabase.from(SI as any).select("*").eq("submission_id", submissionId),
    supabase.from(SP as any).select("*").eq("submission_id", submissionId),
  ]);
  return { items: (items as any) ?? [], photos: (photos as any) ?? [] };
}

export async function reviewSubmission(submissionId: string, feedback: string | null): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from(S as any).update({
    status: "reviewed",
    admin_feedback: feedback,
    reviewed_by_admin_at: new Date().toISOString(),
    reviewed_by_admin_id: u.user?.id ?? null,
  } as any).eq("id", submissionId);
  if (error) throw error;

  // Notifier l'employé que sa checklist a été révisée
  const { data: sub } = await supabase
    .from(S as any)
    .select("user_id, shift_id")
    .eq("id", submissionId)
    .single();

  const subUserId = (sub as any)?.user_id;
  if (subUserId && feedback) {
    await supabase.from("notifications").insert({
      user_id: subUserId,
      type: "checklist_reviewed",
      title: "Checklist révisée par l'admin",
      body: feedback.length > 100 ? feedback.slice(0, 100) + "…" : feedback,
      link: "/staff-app",
    } as any);
  }
}
