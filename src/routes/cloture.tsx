import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  DoorClosed, Clock, Camera, QrCode, MessageSquare, Plus, Trash2, GripVertical,
  Pencil, Check, X, Sparkles, Lock, RefreshCw, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { notifyOverdueClockOutsFn } from "@/lib/closure-flow.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useStudios } from "@/hooks/use-studios";
import { useBusinessRoles } from "@/hooks/use-business-roles";
import { getRoleStyle } from "@/lib/staff-helpers";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/cloture")({
  beforeLoad: () => {
    // Client-side role guard happens inside the component; this stays open for SSR.
  },
  component: ClotureePage,
  head: () => ({ meta: [{ title: "Clôture — Kadence" }] }),
});

// ============================================================
// HELPERS
// ============================================================

function randomCode(len = 5): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const ref = useRef<number | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback((...args: Parameters<T>) => {
    if (ref.current) window.clearTimeout(ref.current);
    ref.current = window.setTimeout(() => fnRef.current(...args), delay);
  }, [delay]);
}

function addMinutes(time: string, delta: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + (m || 0) + delta;
  const wrap = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(wrap / 60);
  const mm = wrap % 60;
  return `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}`;
}

// ============================================================
// SAVED INDICATOR
// ============================================================

const SAVED_EVENT = "kadence-cloture-saved";
function flashSaved() {
  window.dispatchEvent(new CustomEvent(SAVED_EVENT));
}
function useSavedFlash() {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const onSaved = () => {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 1000);
      return () => window.clearTimeout(t);
    };
    window.addEventListener(SAVED_EVENT, onSaved);
    return () => window.removeEventListener(SAVED_EVENT, onSaved);
  }, []);
  return flash;
}

// ============================================================
// MAIN PAGE
// ============================================================

function ClotureePage() {
  const { appRole, loading } = useAuth();
  const { studios, loading: studiosLoading } = useStudios();
  const [studioId, setStudioId] = useState<string | null>(null);

  useEffect(() => {
    if (!studioId && studios.length > 0) setStudioId(studios[0].id);
  }, [studios, studioId]);

  // Guard: redirect employees
  useEffect(() => {
    if (!loading && appRole && appRole !== "admin" && appRole !== "manager") {
      window.location.replace("/staff-app");
    }
  }, [loading, appRole]);

  const flash = useSavedFlash();

  // Notify admin of overdue clock-outs on page load (silent fire-and-forget)
  const notifyOverdue = useServerFn(notifyOverdueClockOutsFn);
  useEffect(() => {
    if (loading || !appRole || (appRole !== "admin" && appRole !== "manager")) return;
    notifyOverdue().catch((e) => console.warn("[cloture] notifyOverdue failed", e));
  }, [loading, appRole, notifyOverdue]);

  if (loading || studiosLoading) {
    return <div className="p-6" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</div>;
  }
  if (appRole && appRole !== "admin" && appRole !== "manager") {
    return null;
  }

  const studio = studios.find((s) => s.id === studioId) ?? null;

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>Clôture · Configuration & parcours</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Tout ce qu'un employé doit faire pour clôturer son shift correctement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            style={{
              fontSize: 12,
              color: "var(--success-text)",
              opacity: flash ? 1 : 0,
              transition: "opacity .25s",
            }}
          >
            ✓ Enregistré
          </span>
          <Select value={studioId ?? ""} onValueChange={(v) => setStudioId(v)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Studio" /></SelectTrigger>
            <SelectContent>
              {studios.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!studio ? (
        <EmptyCard text="Sélectionne un studio pour configurer la clôture." />
      ) : (
        <div className="flex flex-col gap-5">
          <ClockOutSection studio={studio} />
          <ChecklistsSection studioId={studio.id} />
          <PhotosSection studioId={studio.id} />
          <QrSection studio={studio} />
          <QuestionsSection studioId={studio.id} />
        </div>
      )}
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border p-6 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", fontSize: 13, color: "var(--muted-foreground)" }}>
      {text}
    </div>
  );
}

function SectionCard({ icon: Icon, title, subtitle, right, children }: {
  icon: any; title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="px-5 py-4 border-b flex items-start justify-between gap-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-start gap-3">
          <div className="rounded-md p-2" style={{ backgroundColor: "var(--muted)" }}>
            <Icon size={16} strokeWidth={1.8} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, maxWidth: 700 }}>{subtitle}</div>}
          </div>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
      <label style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, suffix, min = 0, max = 999 }: {
  value: number; onChange: (n: number) => void; suffix?: string; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Math.max(min, Math.min(max, parseInt(e.target.value || "0", 10) || 0));
          onChange(n);
        }}
        className="rounded-md border px-2.5 py-1.5 w-[90px]"
        style={{ fontSize: 13, backgroundColor: "var(--background)", borderColor: "var(--border)" }}
      />
      {suffix && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{suffix}</span>}
    </div>
  );
}

// 3 niveaux d'exigence pour la validation IA des photos
const THRESHOLD_OPTIONS = [
  { v: 50, label: "Souple", desc: "Accepte même si la photo n'est pas parfaite" },
  { v: 75, label: "Standard", desc: "Recommandé — bon équilibre" },
  { v: 90, label: "Strict", desc: "Refuse au moindre doute" },
];
function ThresholdButtons({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  // Snap to the nearest preset if a legacy custom value is stored
  const active = THRESHOLD_OPTIONS.reduce((best, o) =>
    Math.abs(o.v - value) < Math.abs(best.v - value) ? o : best, THRESHOLD_OPTIONS[1]);
  return (
    <div className="flex gap-1.5">
      {THRESHOLD_OPTIONS.map((o) => {
        const isActive = o.v === active.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            title={o.desc}
            className="rounded-md px-3 py-1.5 border transition-colors"
            style={{
              fontSize: 12, fontWeight: 500,
              backgroundColor: isActive ? "var(--foreground)" : "var(--background)",
              color: isActive ? "var(--background)" : "var(--foreground)",
              borderColor: isActive ? "var(--foreground)" : "var(--border)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// SECTION A — CLOCK OUT
// ============================================================

const OVERDUE_LABELS: Record<string, string> = {
  notify_manager: "Notif au manager + correction manuelle",
  auto_clock_out: "Pointage automatique",
  block: "Bloquer la clôture",
};

function ClockOutSection({ studio }: { studio: any }) {
  const [local, setLocal] = useState({
    before: studio.clock_out_button_appears_before_min ?? 15,
    grace: studio.clock_out_grace_period_min ?? 20,
    action: studio.clock_out_overdue_action ?? "notify_manager",
  });
  useEffect(() => {
    setLocal({
      before: studio.clock_out_button_appears_before_min ?? 15,
      grace: studio.clock_out_grace_period_min ?? 20,
      action: studio.clock_out_overdue_action ?? "notify_manager",
    });
  }, [studio.id, studio.clock_out_button_appears_before_min, studio.clock_out_grace_period_min, studio.clock_out_overdue_action]);

  const save = async (patch: Partial<typeof local>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    const dbPatch: any = {};
    if (patch.before !== undefined) dbPatch.clock_out_button_appears_before_min = patch.before;
    if (patch.grace !== undefined) dbPatch.clock_out_grace_period_min = patch.grace;
    if (patch.action !== undefined) dbPatch.clock_out_overdue_action = patch.action;
    const { error } = await supabase.from("studios").update(dbPatch).eq("id", studio.id);
    if (error) toast.error(error.message); else flashSaved();
  };
  const saveDebounced = useDebouncedCallback((patch: Partial<typeof local>) => save(patch), 500);

  return (
    <SectionCard
      icon={Clock}
      title="Configuration du pointage de fin de shift"
      subtitle="Définis quand le bouton 'Terminer mon shift' s'active, ce que l'employé doit faire avant la clôture, et ce qu'on lui demande après."
    >
      <div className="flex flex-wrap gap-5">
        <Field label="Le bouton apparaît">
          <NumInput
            value={local.before}
            onChange={(n) => { setLocal({ ...local, before: n }); saveDebounced({ before: n }); }}
            suffix="min avant la fin du shift"
          />
        </Field>
        <Field label="Pointage de sortie attendu au plus tard">
          <NumInput
            value={local.grace}
            onChange={(n) => { setLocal({ ...local, grace: n }); saveDebounced({ grace: n }); }}
            suffix="min après la fin prévue"
          />
        </Field>
        <Field label="Au-delà">
          <Select value={local.action} onValueChange={(v) => save({ action: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(OVERDUE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div
        className="mt-5 rounded-md px-4 py-3"
        style={{ backgroundColor: "color-mix(in oklab, #60a5fa 10%, white)", borderLeft: "3px solid #60a5fa", fontSize: 12, lineHeight: 1.6 }}
      >
        <span style={{ fontWeight: 500 }}>Exemple : </span>
        un shift se termine à <b>22h00</b>. L'employé voit le bouton « Terminer mon shift » dès <b>{addMinutes("22:00", -local.before)}</b>.
        S'il n'a pas scanné le QR à <b>{addMinutes("22:00", local.grace)}</b>, <b>{OVERDUE_LABELS[local.action].toLowerCase()}</b>.
      </div>
    </SectionCard>
  );
}

// ============================================================
// SECTION B — CHECKLISTS PER ROLE
// ============================================================

function ChecklistsSection({ studioId }: { studioId: string }) {
  const { roles } = useBusinessRoles({ onlyActive: true });
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeRoleId && roles.length > 0) setActiveRoleId(roles[0].id);
  }, [roles, activeRoleId]);

  const activeRole = roles.find((r) => r.id === activeRoleId) ?? null;

  return (
    <SectionCard icon={DoorClosed} title="Checklist de fin par poste">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {roles.map((r) => {
          const isActive = r.id === activeRoleId;
          const st = getRoleStyle(r.name);
          return (
            <button
              key={r.id}
              onClick={() => setActiveRoleId(r.id)}
              className="rounded-md px-3 py-1.5 flex items-center gap-2 transition-all"
              style={{
                fontSize: 12, fontWeight: 500,
                backgroundColor: isActive ? st.bg : "transparent",
                color: isActive ? st.text : "var(--muted-foreground)",
                border: `1px solid ${isActive ? st.dot : "var(--border)"}`,
                boxShadow: isActive ? `inset 0 0 0 1px ${st.dot}` : "none",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: st.dot }} />
              {r.name}
            </button>
          );
        })}
      </div>

      {activeRole && (
        <ChecklistEditor studioId={studioId} roleId={activeRole.id} roleName={activeRole.name} />
      )}
    </SectionCard>
  );
}

function useTemplate(studioId: string, roleId: string) {
  const [template, setTemplate] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const ensure = useCallback(async () => {
    setLoading(true);
    const { data: existing } = await supabase
      .from("checklist_templates")
      .select("*")
      .eq("studio_id", studioId)
      .eq("business_role_id", roleId)
      .maybeSingle();
    if (existing) {
      setTemplate(existing);
      setLoading(false);
      return existing;
    }
    const { data: created, error } = await supabase
      .from("checklist_templates")
      .insert({
        studio_id: studioId,
        business_role_id: roleId,
        name: "Clôture",
        is_active: true,
        is_blocking: true,
      } as any)
      .select("*")
      .single();
    if (error) toast.error(error.message);
    setTemplate(created ?? null);
    setLoading(false);
    return created;
  }, [studioId, roleId]);

  useEffect(() => { ensure(); }, [ensure]);

  useEffect(() => {
    if (!template?.id) return;
    const ch = supabase
      .channel(`tpl-${template.id}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_templates", filter: `id=eq.${template.id}` }, async () => {
        const { data } = await supabase.from("checklist_templates").select("*").eq("id", template.id).maybeSingle();
        if (data) setTemplate(data);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [template?.id]);

  return { template, loading, reload: ensure, setTemplate };
}

function ChecklistEditor({ studioId, roleId, roleName }: { studioId: string; roleId: string; roleName: string }) {
  const { template, loading } = useTemplate(studioId, roleId);
  const [items, setItems] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);

  const reload = useCallback(async () => {
    if (!template?.id) return;
    const [{ data: it }, { data: ph }] = await Promise.all([
      supabase.from("checklist_template_items").select("*").eq("template_id", template.id).order("order_index"),
      supabase.from("checklist_template_photos").select("*").eq("template_id", template.id).order("order_index"),
    ]);
    setItems((it as any) ?? []);
    setPhotos((ph as any) ?? []);
  }, [template?.id]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!template?.id) return;
    const ch = supabase.channel(`tpl-content-${template.id}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_template_items", filter: `template_id=eq.${template.id}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_template_photos", filter: `template_id=eq.${template.id}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [template?.id, reload]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (loading || !template) return <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>;

  const addItem = async () => {
    const nextIdx = (items[items.length - 1]?.order_index ?? -1) + 1;
    const { data, error } = await supabase.from("checklist_template_items").insert({
      template_id: template.id, label: "Nouveau point", order_index: nextIdx, is_required: true,
    } as any).select("*").single();
    if (error) { toast.error(error.message); return; }
    setItems((prev) => [...prev, data as any]);
    flashSaved();
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);
    await Promise.all(reordered.map((it, idx) =>
      supabase.from("checklist_template_items").update({ order_index: idx } as any).eq("id", it.id)
    ));
    flashSaved();
  };

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {items.map((it) => (
              <SortableItem key={it.id} item={it} photos={photos} onDeleted={() => setItems((prev) => prev.filter((x) => x.id !== it.id))} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {items.length === 0 && (
        <div className="rounded-md border-dashed border px-4 py-6 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
          Aucun point pour {roleName}. Ajoute le premier ci-dessous.
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={addItem}
          className="rounded-md px-3 py-1.5 flex items-center gap-1.5"
          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
        >
          <Plus size={13} /> Ajouter un point
        </button>
        <DuplicateButton items={items} currentRoleId={roleId} studioId={studioId} />
      </div>
    </div>
  );
}

function SortableItem({ item, photos, onDeleted }: { item: any; photos: any[]; onDeleted?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const [label, setLabel] = useState(item.label);
  useEffect(() => setLabel(item.label), [item.label]);

  const saveLabel = useDebouncedCallback(async (v: string) => {
    const { error } = await supabase.from("checklist_template_items").update({ label: v } as any).eq("id", item.id);
    if (error) toast.error(error.message); else flashSaved();
  }, 500);

  const setPhoto = async (v: string) => {
    const photo_zone_id = v === "__none__" ? null : v;
    const { error } = await supabase.from("checklist_template_items").update({ photo_zone_id } as any).eq("id", item.id);
    if (error) toast.error(error.message); else flashSaved();
  };

  const remove = async () => {
    onDeleted?.();
    const { error } = await supabase.from("checklist_template_items").delete().eq("id", item.id);
    if (error) toast.error(error.message); else flashSaved();
  };

  return (
    <div ref={setNodeRef} className="flex items-center gap-2 rounded-md border px-2 py-1.5"
      style={{ ...style, backgroundColor: "var(--background)", borderColor: "var(--border)" }}
    >
      <button {...attributes} {...listeners} className="cursor-grab touch-none" style={{ color: "var(--muted-foreground)" }}>
        <GripVertical size={14} />
      </button>
      <input
        value={label}
        onChange={(e) => { setLabel(e.target.value); saveLabel(e.target.value); }}
        className="flex-1 px-2 py-1 rounded"
        style={{ fontSize: 13, backgroundColor: "transparent", border: "none", outline: "none" }}
      />
      {photos.length > 0 && (
        <Select value={item.photo_zone_id ?? "__none__"} onValueChange={setPhoto}>
          <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Lier une photo…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Aucune photo liée</SelectItem>
            {photos.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <button onClick={remove} className="rounded p-1 hover:bg-muted" style={{ color: "var(--muted-foreground)" }}>
        <X size={14} />
      </button>
    </div>
  );
}

function DuplicateButton({ items, currentRoleId, studioId }: { items: any[]; currentRoleId: string; studioId: string }) {
  const { roles } = useBusinessRoles({ onlyActive: true });
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const dup = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      let { data: tpl } = await supabase
        .from("checklist_templates")
        .select("id")
        .eq("studio_id", studioId)
        .eq("business_role_id", target)
        .maybeSingle();
      if (!tpl) {
        const { data: created, error: cErr } = await supabase.from("checklist_templates").insert({
          studio_id: studioId, business_role_id: target, name: "Clôture", is_active: true, is_blocking: true,
        } as any).select("id").single();
        if (cErr) { toast.error(cErr.message); return; }
        tpl = created as any;
      }
      if (!tpl) return;
      const rows = items.map((it, idx) => ({
        template_id: (tpl as any).id, label: it.label, description: it.description, is_required: it.is_required, order_index: idx,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from("checklist_template_items").insert(rows as any);
        if (error) { toast.error(error.message); return; }
      }
      toast.success("Checklist dupliquée");
      setOpen(false);
      setTarget("");
      flashSaved();
    } finally {
      setBusy(false);
    }
  };

  const targets = roles.filter((r) => r.id !== currentRoleId);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTarget(""); }}>
      <PopoverTrigger asChild>
        <button
          className="rounded-md px-3 py-1.5 border"
          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--background)", borderColor: "var(--border)" }}
        >
          Dupliquer vers un autre poste
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px]" align="start">
        <div className="flex flex-col gap-2">
          <div style={{ fontSize: 13, fontWeight: 500 }}>Dupliquer la checklist</div>
          <label style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Poste de destination</label>
          {targets.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun autre poste actif disponible.</p>
          ) : (
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder="Choisir un poste" /></SelectTrigger>
              <SelectContent>
                {targets.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Les items sont ajoutés à la fin de la checklist existante.</p>
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-md border" style={{ fontSize: 12, borderColor: "var(--border)" }}>Annuler</button>
            <button onClick={dup} disabled={!target || busy} className="px-3 py-1.5 rounded-md disabled:opacity-50" style={{ fontSize: 12, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
              {busy ? "…" : "Dupliquer"}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// SECTION C — PHOTOS & AI
// ============================================================

function PhotosSection({ studioId }: { studioId: string }) {
  const { roles } = useBusinessRoles({ onlyActive: true });
  const [roleId, setRoleId] = useState<string | null>(null);
  useEffect(() => { if (!roleId && roles.length > 0) setRoleId(roles[0].id); }, [roles, roleId]);

  return (
    <SectionCard icon={Camera} title="Photos de clôture & analyse IA">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {roles.map((r) => {
          const active = r.id === roleId;
          const st = getRoleStyle(r.name);
          return (
            <button key={r.id} onClick={() => setRoleId(r.id)}
              className="rounded-md px-3 py-1.5 flex items-center gap-2 transition-all"
              style={{
                fontSize: 12, fontWeight: 500,
                backgroundColor: active ? st.bg : "transparent",
                color: active ? st.text : "var(--muted-foreground)",
                border: `1px solid ${active ? st.dot : "var(--border)"}`,
                boxShadow: active ? `inset 0 0 0 1px ${st.dot}` : "none",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: st.dot }} />
              {r.name}
            </button>
          );
        })}
      </div>
      {roleId && <PhotosEditor studioId={studioId} roleId={roleId} roleName={roles.find((r) => r.id === roleId)?.name ?? ""} />}
    </SectionCard>
  );
}

function PhotosEditor({ studioId, roleId, roleName }: { studioId: string; roleId: string; roleName: string }) {
  const { template, loading, setTemplate } = useTemplate(studioId, roleId);
  const [photos, setPhotos] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [editingIsNew, setEditingIsNew] = useState(false);

  const reload = useCallback(async () => {
    if (!template?.id) return;
    const { data } = await supabase.from("checklist_template_photos").select("*").eq("template_id", template.id).order("order_index");
    setPhotos((data as any) ?? []);
  }, [template?.id]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!template?.id) return;
    const ch = supabase.channel(`tpl-photos-${template.id}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_template_photos", filter: `template_id=eq.${template.id}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [template?.id, reload]);

  const update = useCallback(async (patch: any) => {
    if (!template?.id) return;
    // Optimistic local update — sinon les boutons (Souple/Standard/Strict, switch IA) ne réagissent pas instantanément
    setTemplate((prev: any) => prev ? { ...prev, ...patch } : prev);
    const { error } = await supabase.from("checklist_templates").update(patch).eq("id", template.id);
    if (error) toast.error(error.message); else flashSaved();
  }, [template?.id, setTemplate]);

  if (loading || !template) return <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>;

  // Mode "brouillon" : pas d'insert DB tant que l'utilisateur n'a pas cliqué Enregistrer
  const addZone = () => {
    const next = (photos[photos.length - 1]?.order_index ?? -1) + 1;
    setEditing({
      template_id: template.id,
      label: "Nouvelle zone",
      description: "",
      is_required: false,
      order_index: next,
      reference_photo_url: null,
    });
    setEditingIsNew(true);
  };

  const closeEditor = () => { setEditing(null); setEditingIsNew(false); };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Field label="Exigence de l'analyse IA">
          <ThresholdButtons
            value={template.ai_validation_threshold ?? 75}
            onChange={(n) => update({ ai_validation_threshold: n })}
          />
        </Field>
        <label className="flex items-center gap-2">
          <Switch checked={!!template.analyze_with_ai} onCheckedChange={(v) => update({ analyze_with_ai: v })} />
          <span style={{ fontSize: 12, fontWeight: 500 }}>Analyse IA activée</span>
        </label>
      </div>

      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>
        Zones à photographier (pour <b style={{ color: "var(--foreground)" }}>{roleName}</b>)
      </div>

      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        {photos.map((p) => (
          <PhotoCard key={p.id} photo={p} onEdit={() => { setEditing(p); setEditingIsNew(false); }} />
        ))}
        <button
          onClick={addZone}
          className="rounded-lg border border-dashed p-4 flex flex-col items-center justify-center gap-1"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", minHeight: 110 }}
        >
          <Plus size={16} />
          <span style={{ fontSize: 12 }}>Ajouter une zone</span>
        </button>
      </div>

      <AiHintCard template={template} />

      {editing && (
        <PhotoEditModal
          photo={editing}
          isNew={editingIsNew}
          onClose={closeEditor}
          onSaved={(saved) => {
            if (editingIsNew) setPhotos((prev) => [...prev, saved]);
            else setPhotos((prev) => prev.map((p) => p.id === saved.id ? { ...p, ...saved } : p));
          }}
          onDeleted={(id) => setPhotos((prev) => prev.filter((p) => p.id !== id))}
        />
      )}
    </div>
  );
}

function PhotoCard({ photo, onEdit }: { photo: any; onEdit: () => void }) {
  const toggle = async () => {
    const { error } = await supabase.from("checklist_template_photos").update({ is_required: !photo.is_required } as any).eq("id", photo.id);
    if (error) toast.error(error.message); else flashSaved();
  };
  return (
    <div className="rounded-lg border p-3" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div style={{ fontSize: 13, fontWeight: 500 }}>{photo.label}</div>
        <button onClick={onEdit} style={{ color: "var(--muted-foreground)" }}><Pencil size={13} /></button>
      </div>
      {photo.description && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8, lineHeight: 1.4 }}>{photo.description}</div>
      )}
      <button
        onClick={toggle}
        className="rounded-full px-2 py-0.5"
        style={{
          fontSize: 10, fontWeight: 500,
          backgroundColor: photo.is_required ? "var(--coral-light)" : "var(--muted)",
          color: photo.is_required ? "var(--coral-text)" : "var(--muted-foreground)",
        }}
      >
        {photo.is_required ? "Obligatoire" : "Optionnelle"}
      </button>
    </div>
  );
}

function PhotoEditModal({ photo, isNew, onClose, onSaved, onDeleted }: {
  photo: any; isNew: boolean; onClose: () => void;
  onSaved: (saved: any) => void; onDeleted: (id: string) => void;
}) {
  const [label, setLabel] = useState(photo.label);
  const [desc, setDesc] = useState(photo.description ?? "");
  const [required, setRequired] = useState(!!photo.is_required);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadReference = async (photoId: string, file: File) => {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `references/${photo.template_id}/${photoId}.${ext}`;
    const { error: upErr } = await supabase.storage.from("checklist-photos")
      .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
    if (upErr) throw upErr;
    const { error } = await supabase.from("checklist_template_photos")
      .update({ reference_photo_url: path } as any).eq("id", photoId);
    if (error) throw error;
    return path;
  };

  const save = async () => {
    setSaving(true);
    try {
      if (isNew) {
        const { data, error } = await supabase.from("checklist_template_photos").insert({
          template_id: photo.template_id,
          label, description: desc || null, is_required: required, order_index: photo.order_index,
        } as any).select("*").single();
        if (error) throw error;
        let final = data as any;
        if (pendingFile) {
          const path = await uploadReference(final.id, pendingFile);
          final = { ...final, reference_photo_url: path };
        }
        onSaved(final);
      } else {
        const { error } = await supabase.from("checklist_template_photos")
          .update({ label, description: desc || null, is_required: required } as any)
          .eq("id", photo.id);
        if (error) throw error;
        let final = { ...photo, label, description: desc || null, is_required: required };
        if (pendingFile) {
          const path = await uploadReference(photo.id, pendingFile);
          final = { ...final, reference_photo_url: path };
        }
        onSaved(final);
      }
      flashSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (isNew) { onClose(); return; }
    if (!confirm("Supprimer cette zone ?")) return;
    const { error } = await supabase.from("checklist_template_photos").delete().eq("id", photo.id);
    if (error) { toast.error(error.message); return; }
    onDeleted(photo.id);
    flashSaved();
    onClose();
  };

  const chooseFile = async (file: File) => {
    setPendingFile(file);
    if (isNew) return; // upload différé jusqu'au save (besoin de l'id)
    setUploading(true);
    try {
      await uploadReference(photo.id, file);
      onSaved({ ...photo, label, description: desc || null, is_required: required, reference_photo_url: `references/${photo.template_id}/${photo.id}.${(file.name.split(".").pop() || "jpg").toLowerCase()}` });
      toast.success("Photo de référence mise à jour");
      flashSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Échec upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isNew ? "Nouvelle zone photo" : "Modifier la zone"}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Nom</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-md border px-2.5 py-1.5 mt-1"
              style={{ fontSize: 13, backgroundColor: "var(--background)", borderColor: "var(--border)" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Description</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
              className="w-full rounded-md border px-2.5 py-1.5 mt-1" rows={3}
              style={{ fontSize: 13, backgroundColor: "var(--background)", borderColor: "var(--border)" }} />
          </div>
          <label className="flex items-center gap-2">
            <Switch checked={required} onCheckedChange={setRequired} />
            <span style={{ fontSize: 12 }}>Photo obligatoire</span>
          </label>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Photo de référence</label>
            <div className="mt-1 flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-md border px-3 py-1.5 flex items-center gap-1.5"
                style={{ fontSize: 12, borderColor: "var(--border)" }}
              >
                <Upload size={13} /> {uploading ? "Upload…" : "Choisir une image"}
              </button>
              {(photo.reference_photo_url || pendingFile) && (
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  ✓ {pendingFile ? pendingFile.name : "déjà uploadée"}
                </span>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
              const f = e.target.files?.[0]; if (f) chooseFile(f);
            }} />
          </div>
        </div>
        <DialogFooter className="flex justify-between !flex-row">
          <button onClick={remove} className="px-3 py-1.5 rounded-md" style={{ fontSize: 12, color: "var(--danger-text)" }}>
            <Trash2 size={13} className="inline mr-1" /> Supprimer
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-md border" style={{ fontSize: 12, borderColor: "var(--border)" }}>Annuler</button>
            <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-md" style={{ fontSize: 12, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
              {saving ? "…" : "Enregistrer"}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DEFAULT_HINT = "présence de saleté visible, ustensiles non rangés, déchets au sol, écrans non éteints";

function AiHintCard({ template }: { template: any }) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(template.ai_detection_hint ?? "");
  useEffect(() => setHint(template.ai_detection_hint ?? ""), [template.id, template.ai_detection_hint]);

  const save = async () => {
    const { error } = await supabase.from("checklist_templates")
      .update({ ai_detection_hint: hint || null } as any).eq("id", template.id);
    if (error) toast.error(error.message); else { flashSaved(); setOpen(false); }
  };

  const display = template.ai_detection_hint || DEFAULT_HINT;

  return (
    <div
      className="mt-4 rounded-md px-4 py-3 flex items-start gap-3"
      style={{ backgroundColor: "color-mix(in oklab, #d4a574 12%, white)", fontSize: 12, lineHeight: 1.6 }}
    >
      <Sparkles size={14} style={{ color: "var(--coral-dark)", marginTop: 2 }} />
      <div className="flex-1">
        <b>L'IA compare</b> chaque photo à la photo de référence et à l'indice ci-dessous (« {display} »).
        Selon l'exigence choisie (Souple / Standard / Strict), elle valide ou refuse la photo et explique pourquoi à l'employé.
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button style={{ color: "var(--muted-foreground)" }}><Pencil size={13} /></button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px]">
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Indice de détection IA</label>
            <textarea value={hint} onChange={(e) => setHint(e.target.value)} rows={4} placeholder={DEFAULT_HINT}
              className="rounded-md border px-2.5 py-1.5"
              style={{ fontSize: 12, backgroundColor: "var(--background)", borderColor: "var(--border)" }} />
            <button onClick={save} className="rounded-md px-3 py-1.5 self-end"
              style={{ fontSize: 12, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>Enregistrer</button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ============================================================
// SECTION D — QR
// ============================================================

const QR_RENEWAL_OPTIONS = [
  { v: 30, l: "Toutes les 30 secondes" },
  { v: 60, l: "Toutes les 60 secondes" },
  { v: 120, l: "Toutes les 2 minutes" },
  { v: 300, l: "Toutes les 5 minutes" },
];

function QrSection({ studio }: { studio: any }) {
  const update = async (patch: any) => {
    const { error } = await supabase.from("studios").update(patch).eq("id", studio.id);
    if (error) toast.error(error.message); else flashSaved();
  };

  const regenerate = async () => {
    await update({ current_qr_code: randomCode(5) });
    toast.success("Code régénéré");
  };

  return (
    <SectionCard
      icon={QrCode}
      title="QR code de clôture"
      subtitle="Un QR code unique s'affiche sur la tablette posée à l'accueil du studio. Il change automatiquement à l'intervalle ci-dessous pour empêcher qu'un employé pointe à distance."
    >
      <div className="flex flex-wrap gap-5">
        <Field label="Renouvellement du code">
          <Select value={String(studio.qr_renewal_seconds ?? 60)} onValueChange={(v) => update({ qr_renewal_seconds: parseInt(v, 10) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {QR_RENEWAL_OPTIONS.map((o) => <SelectItem key={o.v} value={String(o.v)}>{o.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Support d'affichage">
          <div
            className="rounded-md border px-3 py-2 flex items-center"
            style={{ fontSize: 13, borderColor: "var(--border)", backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            Tablette à l'accueil du studio
          </div>
        </Field>
      </div>

      <div
        className="mt-5 rounded-md px-4 py-3 flex items-start justify-between gap-4 flex-wrap"
        style={{ backgroundColor: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 500, marginBottom: 2 }}>Code actuellement affiché sur la tablette de <b>{studio.name}</b></div>
          <div style={{ color: "var(--muted-foreground)" }}>
            C'est le code que l'employé scanne (ou tape) à la fin de son shift. Il se renouvelle automatiquement toutes les {studio.qr_renewal_seconds ?? 60} secondes.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1.5 rounded" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 14, backgroundColor: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
            {studio.current_qr_code ?? "—"}
          </span>
          <button onClick={regenerate}
            className="rounded-md border px-3 py-1.5 flex items-center gap-1.5"
            style={{ fontSize: 12, borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
            <RefreshCw size={13} /> Régénérer maintenant
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ============================================================
// SECTION E — CLOSURE QUESTIONS
// ============================================================

const RESPONSE_TYPES: Record<string, string> = {
  stars_1_5: "⭐ Étoiles 1-5",
  yes_no: "✓/✗ Oui-Non",
  free_text: "📝 Texte libre",
};

function QuestionsSection({ studioId }: { studioId: string }) {
  const [questions, setQuestions] = useState<any[]>([]);

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("closure_questions" as any)
      .select("*")
      .eq("studio_id", studioId)
      .order("order_index");
    setQuestions((data as any) ?? []);
  }, [studioId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const ch = supabase.channel(`closure-q-${studioId}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "closure_questions", filter: `studio_id=eq.${studioId}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [studioId, reload]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const add = async () => {
    const nextIdx = (questions[questions.length - 1]?.order_index ?? -1) + 1;
    const { data, error } = await supabase.from("closure_questions" as any).insert({
      studio_id: studioId, question_text: "Nouvelle question", response_type: "stars_1_5", order_index: nextIdx,
    } as any).select("*").single();
    if (error) { toast.error(error.message); return; }
    // Optimistic refresh (don't rely on realtime publication)
    setQuestions((prev) => [...prev, data]);
    flashSaved();
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = questions.findIndex((q) => q.id === active.id);
    const newIdx = questions.findIndex((q) => q.id === over.id);
    const next = arrayMove(questions, oldIdx, newIdx);
    setQuestions(next);
    await Promise.all(next.map((q, i) =>
      supabase.from("closure_questions" as any).update({ order_index: i } as any).eq("id", q.id)
    ));
    flashSaved();
  };

  return (
    <SectionCard
      icon={MessageSquare}
      title="Questions post-shift"
      subtitle="Les réponses alimentent le cerveau du SaaS : elles peuvent ajuster la note de l'employé et nourrissent tes rapports. Visible uniquement par toi et tes managers."
      right={
        <span className="rounded-full px-2.5 py-1 flex items-center gap-1.5"
          style={{ fontSize: 11, fontWeight: 500, backgroundColor: "color-mix(in oklab, #a78bfa 18%, white)", color: "#4c1d95" }}>
          <Lock size={11} /> Admin & managers
        </span>
      }
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {questions.map((q) => (
              <SortableQuestion
                key={q.id}
                q={q}
                onDeleted={() => setQuestions((prev) => prev.filter((x) => x.id !== q.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {questions.length === 0 && (
        <div className="rounded-md border border-dashed px-4 py-6 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
          Aucune question pour ce studio. Ajoute-en une ci-dessous.
        </div>
      )}

      <div className="mt-3">
        <button onClick={add} className="rounded-md px-3 py-1.5 flex items-center gap-1.5"
          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
          <Plus size={13} /> Ajouter une question
        </button>
      </div>
    </SectionCard>
  );
}

function SortableQuestion({ q }: { q: any }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  const [text, setText] = useState(q.question_text);
  useEffect(() => setText(q.question_text), [q.question_text]);

  const saveText = useDebouncedCallback(async (v: string) => {
    const { error } = await supabase.from("closure_questions" as any).update({ question_text: v } as any).eq("id", q.id);
    if (error) toast.error(error.message); else flashSaved();
  }, 500);

  const setType = async (v: string) => {
    const { error } = await supabase.from("closure_questions" as any).update({ response_type: v } as any).eq("id", q.id);
    if (error) toast.error(error.message); else flashSaved();
  };
  const remove = async () => {
    const { error } = await supabase.from("closure_questions" as any).delete().eq("id", q.id);
    if (error) toast.error(error.message); else flashSaved();
  };

  return (
    <div ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: "var(--background)",
        borderColor: "var(--border)",
      }}
      className="flex items-center gap-2 rounded-md border px-2 py-1.5"
    >
      <button {...attributes} {...listeners} className="cursor-grab touch-none" style={{ color: "var(--muted-foreground)" }}>
        <GripVertical size={14} />
      </button>
      <input value={text} onChange={(e) => { setText(e.target.value); saveText(e.target.value); }}
        className="flex-1 px-2 py-1 rounded"
        style={{ fontSize: 13, backgroundColor: "transparent", border: "none", outline: "none" }} />
      <Select value={q.response_type} onValueChange={setType}>
        <SelectTrigger className="w-[170px] h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.entries(RESPONSE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
      <button onClick={remove} className="rounded p-1" style={{ color: "var(--muted-foreground)" }}>
        <X size={14} />
      </button>
    </div>
  );
}
