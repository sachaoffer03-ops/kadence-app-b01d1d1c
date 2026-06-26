import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, ShieldCheck, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import {
  PERMISSION_SECTIONS,
  ALL_PAGE_KEYS,
  ALL_ACTION_KEYS,
  PRESET_MANAGER_SKULT,
} from "@/lib/permissions";
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  const togglePage = (pageKey: string, actionKeys: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageKey)) {
        // Décocher page → décocher toutes les sous-actions
        next.delete(pageKey);
        actionKeys.forEach((k) => next.delete(k));
      } else {
        next.add(pageKey);
      }
      return next;
    });
  };

  const toggleAction = (pageKey: string, fullActionKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fullActionKey)) {
        next.delete(fullActionKey);
      } else {
        next.add(fullActionKey);
        next.add(pageKey); // cocher sous-action → cocher page parente
      }
      return next;
    });
  };

  const toggleExpanded = (pageKey: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pageKey)) next.delete(pageKey);
      else next.add(pageKey);
      return next;
    });
  };

  const toggleSection = (section: typeof PERMISSION_SECTIONS[number], allChecked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      section.items.forEach((item) => {
        const actionKeys = (item.actions ?? []).map((a) => `${item.key}:${a.key}`);
        if (allChecked) {
          next.delete(item.key);
          actionKeys.forEach((k) => next.delete(k));
        } else {
          next.add(item.key);
        }
      });
      return next;
    });
  };

  const checkAll = () => setSelected(new Set([...ALL_PAGE_KEYS, ...ALL_ACTION_KEYS]));
  const uncheckAll = () => setSelected(new Set());
  const applyPreset = () => {
    setSelected(new Set(PRESET_MANAGER_SKULT));
    toast.success("Preset Manager Skult appliqué");
  };

  const counts = useMemo(() => {
    let pages = 0, actions = 0;
    selected.forEach((k) => (k.includes(":") ? actions++ : pages++));
    return { pages, actions };
  }, [selected]);

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(20,20,20,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--card)", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b" style={{ borderColor: "var(--border)" }}>
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
                {userName ? `Configure ce que ${userName} peut voir et faire.` : "Configure les pages et actions accessibles."}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-[var(--muted)]" style={{ color: "var(--muted-foreground)" }}>
            <X size={18} />
          </button>
        </div>

        {/* Quick actions */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
        >
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {counts.pages} page{counts.pages > 1 ? "s" : ""} · {counts.actions} action{counts.actions > 1 ? "s" : ""}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={applyPreset}
              className="rounded-md px-2.5 py-1 inline-flex items-center gap-1"
              style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)", border: "none" }}
            >
              <Sparkles size={11} /> Preset Manager Skult
            </button>
            <button onClick={checkAll} className="rounded-md px-2.5 py-1" style={{ fontSize: 11, border: "0.5px solid var(--border)" }}>
              Tout cocher
            </button>
            <button onClick={uncheckAll} className="rounded-md px-2.5 py-1" style={{ fontSize: 11, border: "0.5px solid var(--border)" }}>
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
              const sectionPageKeys = section.items.map((i) => i.key);
              const allChecked = sectionPageKeys.every((k) => selected.has(k));
              return (
                <div key={section.title} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <div
                      style={{
                        fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)",
                        textTransform: "uppercase", letterSpacing: "0.08em",
                      }}
                    >
                      {section.title}
                    </div>
                    <button
                      onClick={() => toggleSection(section, allChecked)}
                      style={{ fontSize: 11, color: allChecked ? "var(--muted-foreground)" : "var(--coral)", fontWeight: 500 }}
                    >
                      {allChecked ? "Tout retirer" : "Tout cocher"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    {section.items.map((item) => {
                      const pageChecked = selected.has(item.key);
                      const actions = item.actions ?? [];
                      const hasActions = actions.length > 0;
                      const isOpen = expanded.has(item.key);
                      return (
                        <div
                          key={item.key}
                          className="rounded-md"
                          style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}
                        >
                          <div className="flex items-start gap-2 px-3 py-2">
                            {hasActions ? (
                              <button onClick={() => toggleExpanded(item.key)} className="mt-1 shrink-0" style={{ color: "var(--muted-foreground)" }}>
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : (
                              <span style={{ width: 14, display: "inline-block" }} />
                            )}
                            <input
                              type="checkbox"
                              checked={pageChecked}
                              onChange={() => togglePage(item.key, actions.map((a) => `${item.key}:${a.key}`))}
                              style={{ marginTop: 4, accentColor: "var(--coral)" }}
                            />
                            <label
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => togglePage(item.key, actions.map((a) => `${item.key}:${a.key}`))}
                            >
                              <div style={{ fontSize: 13, fontWeight: 500 }}>
                                {item.label}
                                {hasActions && (
                                  <span style={{ marginLeft: 6, fontSize: 10, color: "var(--muted-foreground)", fontWeight: 400 }}>
                                    · {actions.filter((a) => selected.has(`${item.key}:${a.key}`)).length}/{actions.length} actions
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{item.description}</div>
                              )}
                            </label>
                          </div>
                          {hasActions && isOpen && (
                            <div
                              className="flex flex-col gap-0.5 pl-10 pr-3 pb-2"
                              style={{ opacity: pageChecked ? 1 : 0.45, pointerEvents: pageChecked ? "auto" : "none" }}
                            >
                              {actions.map((a) => {
                                const full = `${item.key}:${a.key}`;
                                const aChecked = selected.has(full);
                                return (
                                  <label key={full} className="flex items-start gap-2 py-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={aChecked}
                                      onChange={() => toggleAction(item.key, full)}
                                      style={{ marginTop: 3, accentColor: "var(--coral)" }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div style={{ fontSize: 12 }}>{a.label}</div>
                                      {a.description && (
                                        <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>{a.description}</div>
                                      )}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
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
          className="flex items-center justify-between gap-2 px-6 py-4 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Ce manager pourra accéder à {counts.pages} page{counts.pages > 1 ? "s" : ""} et effectuer {counts.actions} action{counts.actions > 1 ? "s" : ""}.
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="rounded-md px-3 py-1.5" style={{ fontSize: 12, border: "0.5px solid var(--border)" }}>
              Annuler
            </button>
            <button
              onClick={save}
              disabled={saving || loading}
              className="rounded-md px-3 py-1.5"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)", opacity: saving || loading ? 0.6 : 1 }}
            >
              {saving ? "Enregistrement…" : "Enregistrer les accès"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
