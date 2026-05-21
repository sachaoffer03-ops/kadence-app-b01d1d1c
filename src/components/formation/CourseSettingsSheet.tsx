import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { updateCourse, deleteCourse } from "@/lib/formation.functions";
import { useBusinessRoles } from "@/hooks/use-business-roles";
import { COURSE_COLORS } from "./types";
import type { CourseFull } from "./types";

const EMOJI_PICK = ["📚", "☕", "🍳", "🛎️", "🎓", "🌟", "🔧", "❤️", "🎯", "💡"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  course: CourseFull["course"];
  onSaved: () => void;
}

export function CourseSettingsSheet({ open, onOpenChange, course, onSaved }: Props) {
  const { roles } = useBusinessRoles({ onlyActive: true });
  const navigate = useNavigate();
  const [title, setTitle] = useState(course.title);
  const [icon, setIcon] = useState(course.icon ?? "📚");
  const [color, setColor] = useState(course.color ?? COURSE_COLORS[0]);
  const [description, setDescription] = useState(course.description ?? "");
  const [type, setType] = useState<"all" | "role">(course.is_required_for_all ? "all" : "role");
  const [roleId, setRoleId] = useState<string | null>(course.business_role_id);
  const [requiredForPlanning, setRequiredForPlanning] = useState(course.required_for_planning);
  const [passingScore, setPassingScore] = useState(course.passing_quiz_score);
  const [saving, setSaving] = useState(false);

  const update = useServerFn(updateCourse);
  const del = useServerFn(deleteCourse);

  useEffect(() => {
    if (open) {
      setTitle(course.title);
      setIcon(course.icon ?? "📚");
      setColor(course.color ?? COURSE_COLORS[0]);
      setDescription(course.description ?? "");
      setType(course.is_required_for_all ? "all" : "role");
      setRoleId(course.business_role_id);
      setRequiredForPlanning(course.required_for_planning);
      setPassingScore(course.passing_quiz_score);
    }
  }, [open, course]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (type === "role" && !roleId) { toast.error("Sélectionne un poste"); return; }
    setSaving(true);
    try {
      await update({ data: { courseId: course.id, patch: {
        title: title.trim(),
        icon, color,
        description: description.trim() || null,
        business_role_id: type === "role" ? roleId : null,
        is_required_for_all: type === "all",
        required_for_planning: requiredForPlanning,
        passing_quiz_score: passingScore,
      } } });
      toast.success("Réglages enregistrés"); onOpenChange(false); onSaved();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer ce parcours et tout son contenu ? Cette action est irréversible.")) return;
    setSaving(true);
    try {
      await del({ data: { courseId: course.id } });
      toast.success("Parcours supprimé"); onOpenChange(false);
      navigate({ to: "/formation" });
    } catch (e: any) { toast.error(e.message || "Erreur"); setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader><SheetTitle style={{ fontSize: 16, fontWeight: 500 }}>Réglages du parcours</SheetTitle></SheetHeader>
        <div className="flex flex-col gap-4 py-4">
          <Field label="Titre">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md" style={inputStyle} />
          </Field>
          <Field label="Icône">
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_PICK.map(e => (
                <button key={e} type="button" onClick={() => setIcon(e)}
                  className="rounded-md flex items-center justify-center"
                  style={{ width: 34, height: 34, fontSize: 18, border: `0.5px solid ${icon === e ? "var(--foreground)" : "var(--border)"}` }}>
                  {e}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Couleur d'accent">
            <div className="flex flex-wrap gap-1.5">
              {COURSE_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="rounded-full" style={{ width: 28, height: 28, backgroundColor: c, border: color === c ? "2px solid var(--foreground)" : "0.5px solid var(--border)" }} />
              ))}
            </div>
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-md" style={inputStyle} />
          </Field>
          <Field label="Type">
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => setType("all")} className="rounded-lg px-3 py-2 text-left"
                style={{ fontSize: 12, border: `0.5px solid ${type === "all" ? "var(--foreground)" : "var(--border)"}` }}>
                <div style={{ fontWeight: 500 }}>Onboarding général</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Obligatoire pour tous</div>
              </button>
              <button type="button" onClick={() => setType("role")} className="rounded-lg px-3 py-2 text-left"
                style={{ fontSize: 12, border: `0.5px solid ${type === "role" ? "var(--foreground)" : "var(--border)"}` }}>
                <div style={{ fontWeight: 500 }}>Par poste</div>
              </button>
              {type === "role" && (
                <Select value={roleId ?? ""} onValueChange={(v) => setRoleId(v || null)}>
                  <SelectTrigger className="mt-1 h-9 rounded-md text-[13px]" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}>
                    <SelectValue placeholder="Choisir un poste" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(r => <SelectItem key={r.id} value={r.id} className="text-[13px]">{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </Field>
          <Field label="">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={requiredForPlanning} onChange={(e) => setRequiredForPlanning(e.target.checked)} />
              <span style={{ fontSize: 12 }}>Requis pour pouvoir être planifié</span>
            </label>
          </Field>
          <Field label="Note de réussite minimale du quiz (%)">
            <input type="number" min={0} max={100} value={passingScore}
              onChange={(e) => setPassingScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className="w-24 rounded-md" style={inputStyle} />
          </Field>

          <div className="flex flex-col gap-2 mt-4 pt-4" style={{ borderTop: "0.5px solid var(--border)" }}>
            <button onClick={handleSave} disabled={saving} className="rounded-md px-3 py-2"
              style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              {saving ? "..." : "Sauvegarder"}
            </button>
            <button onClick={handleDelete} disabled={saving} className="rounded-md px-3 py-2"
              style={{ fontSize: 12, color: "var(--danger-text)", border: "0.5px solid var(--border)" }}>
              Supprimer le parcours
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)",
  backgroundColor: "var(--background)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <label style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{label}</label>}
      {children}
    </div>
  );
}
