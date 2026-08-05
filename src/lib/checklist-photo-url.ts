import { supabase } from "@/integrations/supabase/client";

/**
 * Le bucket `checklist-photos` est privé. Historiquement certaines photos ont été
 * enregistrées avec une URL publique (qui ne fonctionne pas). Cette fonction
 * ramène toujours un chemin de storage exploitable.
 */
export function toChecklistStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value;
  const m = value.match(/checklist-photos\/(.+?)(\?|$)/);
  return m ? decodeURIComponent(m[1]!) : null;
}

/** URL signée (1h) pour afficher une photo de checklist. */
export async function signChecklistPhoto(value: string | null | undefined): Promise<string | null> {
  const path = toChecklistStoragePath(value);
  if (!path) return null;
  const { data } = await supabase.storage.from("checklist-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
