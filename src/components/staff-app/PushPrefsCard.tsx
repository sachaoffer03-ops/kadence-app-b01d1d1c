import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { isMedianApp } from "@/lib/is-median-app";
import { requestPushPermission } from "@/lib/push-notifications";
import {
  PUSH_CATEGORIES,
  PUSH_CATEGORY_LABELS,
  type PushCategory,
} from "@/lib/push-categories";
import { getMyPushSettings, updateMyPushPrefs } from "@/lib/push.functions";

export function PushPrefsCard() {
  const load = useServerFn(getMyPushSettings);
  const save = useServerFn(updateMyPushPrefs);

  const [prefs, setPrefs] = useState<Record<PushCategory, boolean> | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((r: any) => {
        if (cancelled) return;
        setPrefs(r.prefs);
        setDevices(r.devices ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [load]);

  const toggle = async (cat: PushCategory) => {
    if (!prefs || saving) return;
    const next = { ...prefs, [cat]: !prefs[cat] };
    setPrefs(next);
    setSaving(true);
    try {
      await save({ data: { prefs: next } });
    } catch {
      setPrefs(prefs);
      toast.error("Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) return null;

  const linked = devices.length > 0;

  return (
    <div
      className="rounded-xl border overflow-hidden mt-4"
      style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
        <Bell size={16} style={{ color: "var(--muted-foreground)" }} />
        <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>Notifications push</span>
        {linked && (
          <span
            className="rounded-full px-2 py-0.5 flex items-center gap-1"
            style={{ fontSize: 10, backgroundColor: "var(--coral-light, #FCE9DF)", color: "var(--coral-dark, #C86A4E)" }}
          >
            <Smartphone size={10} /> {devices.length} appareil{devices.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {!linked && (
        <div className="px-4 py-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <p style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
            {isMedianApp()
              ? "Autorise les notifications pour être prévenu dès la publication du planning."
              : "Installe l'application Kadence sur ton téléphone pour recevoir les notifications push."}
          </p>
          {isMedianApp() && (
            <button
              onClick={() => {
                requestPushPermission();
                toast.success("Autorisation demandée");
              }}
              className="mt-2 rounded-lg px-3 py-2"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral, #F0997B)", color: "#fff" }}
            >
              Activer les notifications
            </button>
          )}
        </div>
      )}

      {PUSH_CATEGORIES.map((cat, i, arr) => (
        <button
          key={cat}
          onClick={() => toggle(cat)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
          style={{ borderBottom: i < arr.length - 1 ? "0.5px solid rgba(0,0,0,0.06)" : "none" }}
        >
          <span style={{ fontSize: 12.5, flex: 1, lineHeight: 1.4 }}>{PUSH_CATEGORY_LABELS[cat]}</span>
          <span
            aria-hidden
            style={{
              width: 40,
              height: 23,
              borderRadius: 999,
              backgroundColor: prefs[cat] ? "var(--coral, #F0997B)" : "rgba(0,0,0,0.14)",
              position: "relative",
              transition: "background-color 150ms",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2.5,
                left: prefs[cat] ? 20 : 2.5,
                width: 18,
                height: 18,
                borderRadius: "50%",
                backgroundColor: "#fff",
                transition: "left 150ms",
              }}
            />
          </span>
        </button>
      ))}
    </div>
  );
}
