import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  TrainingFolder, TrainingStep, TrainingResource, TrainingProgress,
  FolderWithContent, FolderInput, StepInput, ResourceInput,
} from "@/types/training";

const FOLDERS = "training_folders";
const STEPS = "training_steps";
const RESOURCES = "training_resources";
const PROGRESS = "training_progress";

// =========================================
// READ
// =========================================

export function useTrainingFolders() {
  const [folders, setFolders] = useState<TrainingFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from(FOLDERS as any)
      .select("*")
      .is("deleted_at", null)
      .order("order_index", { ascending: true });
    setFolders((data as any) ?? []);
    setLoading(false);
  }, []);

  const cid = useRef(`tf-${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    reload();
    const ch = supabase
      .channel(cid.current)
      .on("postgres_changes", { event: "*", schema: "public", table: FOLDERS }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  return { folders, loading, reload };
}

export function useFolderWithContent(folderId: string | null) {
  const [data, setData] = useState<FolderWithContent | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!folderId) { setData(null); return; }
    setLoading(true);
    const [{ data: folder }, { data: steps }, { data: resources }] = await Promise.all([
      supabase.from(FOLDERS as any).select("*").eq("id", folderId).maybeSingle(),
      supabase.from(STEPS as any).select("*").eq("folder_id", folderId).order("order_index"),
      supabase.from(RESOURCES as any).select("*, training_steps!inner(folder_id)").eq("training_steps.folder_id", folderId).order("order_index"),
    ]);
    if (!folder) { setData(null); setLoading(false); return; }
    const stepsWithRes = ((steps as any[]) ?? []).map((s) => ({
      ...s,
      resources: ((resources as any[]) ?? []).filter((r) => r.step_id === s.id),
    }));
    setData({ ...(folder as any), steps: stepsWithRes });
    setLoading(false);
  }, [folderId]);

  useEffect(() => {
    reload();
    if (!folderId) return;
    const cid = `tfc-${folderId}-${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel(cid)
      .on("postgres_changes", { event: "*", schema: "public", table: STEPS }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: RESOURCES }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [folderId, reload]);

  return { data, loading, reload };
}

export function useMyTrainingProgress() {
  const [progress, setProgress] = useState<TrainingProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setProgress([]); setLoading(false); return; }
    const { data } = await supabase
      .from(PROGRESS as any)
      .select("*")
      .eq("user_id", u.user.id);
    setProgress((data as any) ?? []);
    setLoading(false);
  }, []);

  const cid = useRef(`tpm-${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    reload();
    const ch = supabase
      .channel(cid.current)
      .on("postgres_changes", { event: "*", schema: "public", table: PROGRESS }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  return { progress, loading, reload };
}

export function useAllTrainingProgress() {
  const [progress, setProgress] = useState<TrainingProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase.from(PROGRESS as any).select("*");
    setProgress((data as any) ?? []);
    setLoading(false);
  }, []);

  const cid = useRef(`tpa-${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    reload();
    const ch = supabase
      .channel(cid.current)
      .on("postgres_changes", { event: "*", schema: "public", table: PROGRESS }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  return { progress, loading, reload };
}

// =========================================
// FOLDERS — admin write
// =========================================

export async function createFolder(input: FolderInput): Promise<TrainingFolder> {
  const { data: existing } = await supabase
    .from(FOLDERS as any).select("order_index").is("deleted_at", null)
    .order("order_index", { ascending: false }).limit(1);
  const nextOrder = ((existing as any)?.[0]?.order_index ?? -1) + 1;
  const { data, error } = await supabase.from(FOLDERS as any).insert({
    name: input.name.trim(),
    description: input.description ?? null,
    icon: input.icon ?? null,
    color: input.color ?? null,
    required_for_roles: input.required_for_roles ?? [],
    order_index: nextOrder,
  } as any).select("*").single();
  if (error) throw error;
  return data as any;
}

export async function updateFolder(id: string, patch: Partial<FolderInput>): Promise<void> {
  const { error } = await supabase.from(FOLDERS as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function softDeleteFolder(id: string): Promise<void> {
  const { error } = await supabase.from(FOLDERS as any)
    .update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
  if (error) throw error;
}

export async function reorderFolders(orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, idx) =>
    supabase.from(FOLDERS as any).update({ order_index: idx } as any).eq("id", id)
  ));
}

// =========================================
// STEPS
// =========================================

export async function createStep(folderId: string, input: StepInput): Promise<TrainingStep> {
  const { data: existing } = await supabase.from(STEPS as any)
    .select("order_index").eq("folder_id", folderId)
    .order("order_index", { ascending: false }).limit(1);
  const nextOrder = ((existing as any)?.[0]?.order_index ?? -1) + 1;
  const { data, error } = await supabase.from(STEPS as any).insert({
    folder_id: folderId,
    title: input.title.trim(),
    description: input.description ?? null,
    order_index: nextOrder,
  } as any).select("*").single();
  if (error) throw error;
  return data as any;
}

export async function updateStep(id: string, patch: Partial<StepInput>): Promise<void> {
  const { error } = await supabase.from(STEPS as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteStep(id: string): Promise<void> {
  const { error } = await supabase.from(STEPS as any).delete().eq("id", id);
  if (error) throw error;
}

export async function reorderSteps(orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, idx) =>
    supabase.from(STEPS as any).update({ order_index: idx } as any).eq("id", id)
  ));
}

// =========================================
// RESOURCES
// =========================================

export async function createResource(stepId: string, input: ResourceInput): Promise<TrainingResource> {
  const { data: existing } = await supabase.from(RESOURCES as any)
    .select("order_index").eq("step_id", stepId)
    .order("order_index", { ascending: false }).limit(1);
  const nextOrder = ((existing as any)?.[0]?.order_index ?? -1) + 1;
  const { data, error } = await supabase.from(RESOURCES as any).insert({
    step_id: stepId,
    type: input.type,
    title: input.title.trim(),
    content: input.content,
    duration_seconds: input.duration_seconds ?? null,
    is_uploaded_video: input.is_uploaded_video ?? false,
    order_index: nextOrder,
  } as any).select("*").single();
  if (error) throw error;
  return data as any;
}

export async function updateResource(id: string, patch: Partial<ResourceInput>): Promise<void> {
  const { error } = await supabase.from(RESOURCES as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase.from(RESOURCES as any).delete().eq("id", id);
  if (error) throw error;
}

export async function reorderResources(orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, idx) =>
    supabase.from(RESOURCES as any).update({ order_index: idx } as any).eq("id", id)
  ));
}

// =========================================
// PROGRESS — employee tracking
// =========================================

export async function markResourceStatus(
  resourceId: string,
  status: "in_progress" | "completed",
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  const payload: any = {
    user_id: u.user.id,
    resource_id: resourceId,
    status,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  };
  const { error } = await supabase.from(PROGRESS as any)
    .upsert(payload, { onConflict: "user_id,resource_id" } as any);
  if (error) throw error;
}

// =========================================
// STORAGE — PDF upload
// =========================================

export async function uploadTrainingPdf(file: File, folderId: string, stepId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${folderId}/${stepId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("training-resources")
    .upload(path, file, { contentType: file.type || "application/pdf" });
  if (error) throw error;
  return path;
}

export async function uploadTrainingVideo(
  file: File,
  folderId: string,
  stepId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const path = `${folderId}/${stepId}/${crypto.randomUUID()}.${ext}`;
  // Supabase JS v2 does not expose upload progress; emit start/end events for UX.
  onProgress?.(1);
  const { error } = await supabase.storage.from("training-resources")
    .upload(path, file, {
      contentType: file.type || "video/mp4",
      cacheControl: "3600",
      upsert: false,
    });
  if (error) throw error;
  onProgress?.(100);
  return path;
}

export async function getTrainingFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("training-resources")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
