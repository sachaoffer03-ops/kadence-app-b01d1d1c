import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Simple draft/saved state pattern.
 * - draft = current edits in memory
 * - saved = last value persisted to DB
 * - isDirty = draft !== saved (deep compared via JSON.stringify)
 *
 * The caller calls `confirmSaved(newValue)` after a successful DB write to sync
 * both saved and draft to the persisted value. `revert()` rolls back to saved.
 */
export function useDraftState<T>(initial: T) {
  const [saved, setSaved] = useState<T>(initial);
  const [draft, setDraft] = useState<T>(initial);

  const isDirty = useMemo(
    () => JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft],
  );

  const confirmSaved = useCallback((next: T) => {
    setSaved(next);
    setDraft(next);
  }, []);

  const revert = useCallback(() => setDraft(saved), [saved]);

  const reset = useCallback((next: T) => {
    setSaved(next);
    setDraft(next);
  }, []);

  return { draft, setDraft, saved, isDirty, confirmSaved, revert, reset };
}

// ────────────────────────────────────────────────────────────
// Global dirty registry — lets the page header show a unified
// "modifications non enregistrées" badge and lets us block
// accidental tab close.
// ────────────────────────────────────────────────────────────

type Listener = (count: number) => void;
const dirtyKeys = new Set<string>();
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(dirtyKeys.size);
}

export function setDirty(key: string, dirty: boolean) {
  if (dirty) dirtyKeys.add(key);
  else dirtyKeys.delete(key);
  emit();
}

export function useDirtySection(key: string, dirty: boolean) {
  useEffect(() => {
    setDirty(key, dirty);
    return () => setDirty(key, false);
  }, [key, dirty]);
}

export function useDirtyCount() {
  const [count, setCount] = useState(dirtyKeys.size);
  useEffect(() => {
    const l: Listener = (c) => setCount(c);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return count;
}

export function useBeforeUnloadIfDirty() {
  const count = useDirtyCount();
  useEffect(() => {
    if (count === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [count]);
  return count;
}
