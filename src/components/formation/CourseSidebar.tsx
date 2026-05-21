import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { getFormationIndex, createCourse } from "@/lib/formation.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useBusinessRoles } from "@/hooks/use-business-roles";
import { toast } from "sonner";
import { TYPE_COLOR } from "./types";

type IndexData = Awaited<ReturnType<typeof getFormationIndex>>;
const EMOJI_PICK = ["📚", "☕", "🍳", "🛎️", "🎓", "🌟", "🔧", "❤️", "🎯", "💡"];

export function CourseSidebar({ activeCourseId, refreshKey }: { activeCourseId: string; refreshKey: number }) {
  const navigate = useNavigate();
  const [data, setData] = useState<IndexData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const fetchIndex = useServerFn(getFormationIndex);

  const load = () => fetchIndex().then(setData).catch(() => {});

  useEffect(() => { load(); }, [refreshKey]);

  return (
    <div className="rounded-xl border p-3 flex flex-col" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 6px 8px" }}>
        Parcours
      </div>
      <div className="flex flex-col gap-1">
        {(data?.courses ?? []).map((c) => {
          const active = c.id === activeCourseId;
          return (
            <Link
              key={c.id}
              to="/formation/$courseId"
              params={{ courseId: c.id }}
              preload="intent"
              className="rounded-lg px-2.5 py-2 text-left flex items-center gap-2 transition-colors"
              style={{
                backgroundColor: active ? "var(--foreground)" : "transparent",
                color: active ? "var(--card)" : "var(--foreground)",
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 16 }}>{c.icon ?? "📚"}</span>
              <span className="flex-1 truncate" style={{ fontWeight: 500 }}>{c.title}</span>
              <span style={{ fontSize: 11, opacity: active ? 0.7 : 0.6 }}>
                {c.moduleCount}
              </span>
            </Link>
          );
        })}
      </div>

      <button
        onClick={() => setShowModal(true)}
        className="mt-3 rounded-lg px-2.5 py-2 flex items-center gap-1.5"
        style={{ fontSize: 12, fontWeight: 500, border: "0.5px dashed var(--border)", color: "var(--muted-foreground)" }}
      >
        <Plus size={13} /> Nouveau parcours
      </button>

      <div className="mt-4 pt-3" style={{ borderTop: "0.5px solid var(--border)" }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 6px 8px" }}>
          Légende
        </div>
        <div className="flex flex-col gap-1.5" style={{ padding: "0 6px" }}>
          {(["video","pdf","image","text"] as const).map((t) => (
            <div key={t} className="flex items-center gap-2" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TYPE_COLOR[t] }} />
              {t === "video" ? "Vidéo" : t === "pdf" ? "PDF" : t === "image" ? "Image" : "Texte"}
            </div>
          ))}
          <div className="flex items-center gap-2" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#8B5CF6" }} />
            Quiz
          </div>
        </div>
      </div>

      <NewCourseModal open={showModal} onOpenChange={setShowModal} onCreated={async (id) => { await load(); navigate({ to: "/formation/$courseId", params: { courseId: id } }); }} />
    </div>
  );
}

function NewCourseModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const { roles } = useBusinessRoles({ onlyActive: true });
  const [type, setType] = useState<"all" | "role">("all");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📚");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const create = useServerFn(createCourse);

  useEffect(() => { if (open) { setTitle(""); setIcon("📚"); setType("all"); setRoleId(null); } }, [open]);

  const save = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (type === "role" && !roleId) { toast.error("Sélectionne un poste"); return; }
    setSaving(true);
    try {
      const res = await create({ data: { title: title.trim(), icon, isRequiredForAll: type === "all", businessRoleId: type === "role" ? roleId : null } });
      toast.success("Parcours créé"); onOpenChange(false); onCreated(res.id);
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle style={{ fontSize: 16, fontWeight: 500 }}>Nouveau parcours</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => setType("all")} className="rounded-lg px-3 py-2 text-left"
              style={{ fontSize: 12, border: `0.5px solid ${type === "all" ? "var(--foreground)" : "var(--border)"}` }}>
              <div style={{ fontWeight: 500 }}>Onboarding général</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Obligatoire pour tous</div>
            </button>
            <button type="button" onClick={() => setType("role")} className="rounded-lg px-3 py-2 text-left"
              style={{ fontSize: 12, border: `0.5px solid ${type === "role" ? "var(--foreground)" : "var(--border)"}` }}>
              <div style={{ fontWeight: 500 }}>Par poste</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Spécifique à un rôle</div>
            </button>
          </div>
          {type === "role" && (
            <select value={roleId ?? ""} onChange={(e) => setRoleId(e.target.value || null)}
              className="w-full rounded-md"
              style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}>
              <option value="">— Choisir un poste —</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du parcours"
            className="w-full rounded-md"
            style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_PICK.map(e => (
              <button key={e} type="button" onClick={() => setIcon(e)}
                className="rounded-md flex items-center justify-center"
                style={{ width: 36, height: 36, fontSize: 20, border: `0.5px solid ${icon === e ? "var(--foreground)" : "var(--border)"}` }}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} disabled={saving} className="rounded-md px-3 py-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Annuler</button>
          <button onClick={save} disabled={saving} className="rounded-md px-3 py-2" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            {saving ? "..." : "Créer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
