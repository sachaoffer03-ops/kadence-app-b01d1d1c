import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, ShieldCheck } from "lucide-react";
import { PERMISSION_SECTIONS, ALL_PERMISSION_KEYS } from "@/lib/permissions";
import { getManagerPermissions, setManagerPermissions } from "@/lib/admins.functions";

interface Props {
  open: boolean;
  userId: string;
  userName?: string;
  onClose: () => void;
  onSaved?: (permissions: string[]) => void;
}

export function ManagerPermissionsModal({ open, userId, userName, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const getFn = useServerFn(getManagerPermissions);
  const setFn = useServerFn(setManagerPermissions);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getFn({ data: { user_id: userId } })
      .then((res) => setSelected(new Set(res.permissions)))
      .catch(() => setSelected(new Set()))
      .finally(() => setLoading(false));
  }, [open, userId, getFn]);

  if (!open) return null;

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSection = (keys: string[], allChecked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const checkAll = () => setSelected(new Set(ALL_PERMISSION_KEYS));
  const uncheckAll = () => setSelected(new Set());

  const save = async () => {
    setSaving(true);
    try {
      const arr = Array.from(selected);
      await setFn({ data: { user_id: userId, permissions: arr } });
      toast.success("Accès enregistrés");
      onSaved?.(arr);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(20,20,20,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--card)", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 px-6 py-5 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex gap-3">
            <div
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{ width: 36, height: 36, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
            >
              <ShieldCheck size={18} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Accès Manager</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                {userName ? `Configure ce que ${userName} peut voir dans la console.` : "Configure les sections accessibles."}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-[var(--muted)]"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick actions */}
        <div
          className="flex items-center justify-between gap-2 px-6 py-3 border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
        >
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {selected.size} / {ALL_PERMISSION_KEYS.length} sections
          </div>
          <div className="flex gap-2">
            <button
              onClick={checkAll}
              className="rounded-md px-2.5 py-1"
              style={{ fontSize: 11, border: "0.5px solid var(--border)" }}
            >
              Tout cocher
            </button>
            <button
              onClick={uncheckAll}
              className="rounded-md px-2.5 py-1"
              style={{ fontSize: 11, border: "0.5px solid var(--border)" }}
            >
              Tout décocher
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="py-8 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Chargement…
            </div>
          ) : (
            PERMISSION_SECTIONS.map((section) => {
              const sectionKeys = section.items.map((i) => i.key);
              const allChecked = sectionKeys.every((k) => selected.has(k));
              const someChecked = sectionKeys.some((k) => selected.has(k));
              return (
                <div key={section.title} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: "var(--muted-foreground)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {section.title}
                    </div>
                    <button
                      onClick={() => toggleSection(sectionKeys, allChecked)}
                      style={{
                        fontSize: 11,
                        color: allChecked ? "var(--muted-foreground)" : "var(--coral)",
                        fontWeight: 500,
                      }}
                    >
                      {allChecked ? "Tout retirer" : someChecked ? "Tout cocher" : "Tout cocher"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    {section.items.map((item) => {
                      const checked = selected.has(item.key);
                      return (
                        <label
                          key={item.key}
                          className="flex items-start gap-3 rounded-md px-3 py-2 cursor-pointer transition"
                          style={{
                            backgroundColor: checked ? "var(--coral-soft, var(--background))" : "var(--background)",
                            border: "0.5px solid var(--border)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(item.key)}
                            style={{ marginTop: 3, accentColor: "var(--coral)" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                            {item.description && (
                              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
                                {item.description}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-4 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-md px-3 py-1.5"
            style={{ fontSize: 12, border: "0.5px solid var(--border)" }}
          >
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="rounded-md px-3 py-1.5"
            style={{
              fontSize: 12,
              fontWeight: 500,
              backgroundColor: "var(--foreground)",
              color: "var(--card)",
              opacity: saving || loading ? 0.6 : 1,
            }}
          >
            {saving ? "Enregistrement…" : "Enregistrer les accès"}
          </button>
        </div>
      </div>
    </div>
  );
}
