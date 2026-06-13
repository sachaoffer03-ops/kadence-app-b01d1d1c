import { useEffect, useState, useCallback } from "react";

/** Indicateur online/offline + dernière synchro */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

interface CacheEntry<T> { data: T; savedAt: number }

/** Cache localStorage générique avec horodatage. Retourne {cached, save, lastSync}. */
export function useLocalCache<T>(key: string) {
  const [cached, setCached] = useState<T | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw) as CacheEntry<T>;
      return entry.data;
    } catch { return null; }
  });
  const [lastSync, setLastSync] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      return (JSON.parse(raw) as CacheEntry<T>).savedAt;
    } catch { return null; }
  });

  const save = useCallback((data: T) => {
    try {
      const entry: CacheEntry<T> = { data, savedAt: Date.now() };
      window.localStorage.setItem(key, JSON.stringify(entry));
      setCached(data);
      setLastSync(entry.savedAt);
    } catch {}
  }, [key]);

  return { cached, save, lastSync };
}

export function fmtLastSync(ts: number | null): string {
  if (!ts) return "jamais";
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}
