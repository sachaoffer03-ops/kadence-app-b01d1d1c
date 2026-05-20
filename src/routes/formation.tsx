import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GraduationCap, Plus, BookOpen, Award, Users, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getFormationIndex, createCourse } from "@/lib/formation.functions";
import { useBusinessRoles } from "@/hooks/use-business-roles";

export const Route = createFileRoute("/formation")({
  component: FormationIndexPage,
  head: () => ({ meta: [{ title: "Formation — Kadence" }] }),
});

type IndexData = Awaited<ReturnType<typeof getFormationIndex>>;

const EMOJI_PICK = ["📚", "☕", "🍳", "🛎️", "🎓", "🌟", "🔧", "❤️", "🎯", "💡"];

function FormationIndexPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<IndexData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const fetchIndex = useServerFn(getFormationIndex);

  const load = async () => {
    try {
      setLoading(true);
      const d = await fetchIndex();
      setData(d);
    } catch (e: any) {
      toast.error(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fmtDuration = (min: number) => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m > 0 ? `${h}h ${String(m).padStart(2, "0")}` : `${h}h`;
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-2">
        <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>Espace formation</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4, maxWidth: 640 }}>
          Crée un parcours pour chaque poste de ton équipe. L'employé doit terminer son parcours pour
          accéder au planning et choisir ses shifts.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : data ? (
          <>
            <Kpi icon={BookOpen} label="Parcours actifs" value={String(data.kpis.publishedCourses)} sub={`${data.kpis.totalModules} modules au total`} />
            <Kpi icon={Users} label="Employés en formation" value={`${data.kpis.inTrainingCount}/${data.kpis.totalEmployees}`} sub={`${data.kpis.pctInTraining}% de l'équipe`} />
            <Kpi icon={TrendingUp} label="Complétion moyenne" value={`${data.kpis.avgCompletionRate}%`} sub="sur les parcours actifs" />
            <Kpi icon={Award} label="Quiz réussis 1er coup" value={`${data.kpis.firstTryRate}%`}
              sub={data.kpis.firstTryRate >= 70 ? "Bon niveau d'attention" : data.kpis.firstTryRate < 50 ? "À surveiller" : "Niveau correct"} />
          </>
        ) : null}
      </div>

      {/* Courses list */}
      <div className="flex items-center justify-between mt-10 mb-4">
        <h2 style={{ fontSize: 15, fontWeight: 500 }}>Parcours par poste</h2>
        <button onClick={() => setShowModal(true)} className="rounded-md px-3 py-2 flex items-center gap-1.5"
          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          <Plus size={13} /> Nouveau parcours
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : data && data.courses.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <GraduationCap size={32} style={{ color: "var(--muted-foreground)", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucun parcours pour l'instant</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Crée ton premier parcours pour démarrer la formation.</div>
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {data.courses.map((c) => {
            const accent = c.color ?? "#F0997B";
            return (
              <button key={c.id} onClick={() => navigate({ to: "/formation/$courseId", params: { courseId: c.id } })}
                className="rounded-xl border text-left transition-all hover:shadow-sm overflow-hidden flex flex-col"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <div style={{ height: 4, backgroundColor: accent }} />
                <div className="p-4 flex-1 flex flex-col">
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon ?? "📚"}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    {c.moduleCount} module{c.moduleCount !== 1 ? "s" : ""} · {fmtDuration(c.totalMinutes)}
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.is_required_for_all && (
                      <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
                        Obligatoire pour tous
                      </span>
                    )}
                    {!c.is_published && (
                      <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
                        Brouillon
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-3">
                    <div className="flex items-center justify-between mb-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      <span>{c.completedCount}/{c.targetCount} validés</span>
                      <span style={{ fontWeight: 500, color: c.pct === 100 ? "var(--success-text)" : "var(--foreground)" }}>{c.pct}%</span>
                    </div>
                    <div style={{ width: "100%", height: 4, borderRadius: 2, backgroundColor: "var(--muted)" }}>
                      <div style={{ width: `${c.pct}%`, height: "100%", borderRadius: 2, backgroundColor: c.pct === 100 ? "var(--success-text)" : accent }} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      <NewCourseModal open={showModal} onOpenChange={setShowModal} onCreated={async (id) => { await load(); navigate({ to: "/formation/$courseId", params: { courseId: id } }); }} />
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} style={{ color: "var(--muted-foreground)" }} />
        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>{sub}</div>
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

  useEffect(() => {
    if (open) { setTitle(""); setIcon("📚"); setType("all"); setRoleId(null); }
  }, [open]);

  const save = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (type === "role" && !roleId) { toast.error("Sélectionne un poste"); return; }
    setSaving(true);
    try {
      const res = await create({ data: { title: title.trim(), icon, isRequiredForAll: type === "all", businessRoleId: type === "role" ? roleId : null } });
      toast.success("Parcours créé");
      onOpenChange(false);
      onCreated(res.id);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle style={{ fontSize: 16, fontWeight: 500 }}>Nouveau parcours</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Type</label>
            <div className="flex flex-col gap-1.5 mt-2">
              <button type="button" onClick={() => setType("all")} className="rounded-lg px-3 py-2.5 text-left"
                style={{ fontSize: 12, border: `0.5px solid ${type === "all" ? "var(--foreground)" : "var(--border)"}`, backgroundColor: type === "all" ? "var(--background)" : "transparent" }}>
                <div style={{ fontWeight: 500 }}>Onboarding général</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Obligatoire pour tous les employés</div>
              </button>
              <button type="button" onClick={() => setType("role")} className="rounded-lg px-3 py-2.5 text-left"
                style={{ fontSize: 12, border: `0.5px solid ${type === "role" ? "var(--foreground)" : "var(--border)"}`, backgroundColor: type === "role" ? "var(--background)" : "transparent" }}>
                <div style={{ fontWeight: 500 }}>Par poste</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Spécifique à un rôle métier</div>
              </button>
            </div>
          </div>

          {type === "role" && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Poste</label>
              <select value={roleId ?? ""} onChange={(e) => setRoleId(e.target.value || null)}
                className="w-full mt-1.5 rounded-md"
                style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}>
                <option value="">— Choisir —</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Titre</label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Parcours Barista"
              className="w-full mt-1.5 rounded-md"
              style={{ fontSize: 13, padding: "8px 12px", border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Icône</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {EMOJI_PICK.map(e => (
                <button key={e} type="button" onClick={() => setIcon(e)}
                  className="rounded-md flex items-center justify-center"
                  style={{ width: 36, height: 36, fontSize: 20, border: `0.5px solid ${icon === e ? "var(--foreground)" : "var(--border)"}`, backgroundColor: icon === e ? "var(--background)" : "transparent" }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} disabled={saving} className="rounded-md px-3 py-2" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Annuler</button>
          <button onClick={save} disabled={saving} className="rounded-md px-3 py-2" style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            {saving ? "..." : "Créer le parcours"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
