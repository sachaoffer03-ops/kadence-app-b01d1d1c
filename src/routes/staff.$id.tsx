import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, MapPin, Star, Download, UserX, MessageSquare, AlertCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { roleColors, type Role } from "@/lib/mock-data";

export const Route = createFileRoute("/staff/$id")({
  component: EmployeeDetailPage,
  head: () => ({ meta: [{ title: "Profil employé — Kadence" }] }),
});

interface Profile {
  id: string; first_name: string; last_name: string; email: string; phone: string | null;
  birth_date: string | null; nationality: string | null; city: string | null; address: string | null;
  contract: string | null; studio_id: string | null; status: string; hire_date: string | null;
  score: number | null; quota_used: number | null; quota_max: number | null;
  iban: string | null; niss: string | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  student_card_valid: boolean | null;
}
interface ShiftRow { id: string; shift_date: string; start_time: string; end_time: string; business_role: string; studio_id: string | null; status: string; }
interface FB { id: string; rating: number; message: string | null; created_at: string; }
interface Sig { id: string; category: string; message: string; created_at: string; resolved: boolean; }

const fmtTime = (t: string) => t.slice(0, 5).replace(":", "h");
const initials = (f: string, l: string) => `${(f?.[0] || "").toUpperCase()}${(l?.[0] || "").toUpperCase()}`;

function EmployeeDetailPage() {
  const { id } = Route.useParams();
  const [emp, setEmp] = useState<Profile | null>(null);
  const [businessRoles, setBusinessRoles] = useState<Role[]>([]);
  const [studios, setStudios] = useState<Record<string, string>>({});
  const [userStudioIds, setUserStudioIds] = useState<string[]>([]);
  const [userContracts, setUserContracts] = useState<string[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [fbs, setFbs] = useState<FB[]>([]);
  const [sigs, setSigs] = useState<Sig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: p }, { data: br }, { data: sts }, { data: us }, { data: uc }, { data: sh }, { data: fb }, { data: sg }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("user_business_roles").select("role").eq("user_id", id),
        supabase.from("studios").select("id,name"),
        supabase.from("user_studios").select("studio_id").eq("user_id", id),
        supabase.from("user_contracts").select("contract").eq("user_id", id),
        supabase.from("shifts").select("id,shift_date,start_time,end_time,business_role,studio_id,status").eq("user_id", id).order("shift_date", { ascending: false }).limit(20),
        supabase.from("feedbacks").select("id,rating,message,created_at").eq("author_id", id).order("created_at", { ascending: false }).limit(10),
        supabase.from("signalements").select("id,category,message,created_at,resolved").eq("author_id", id).order("created_at", { ascending: false }).limit(10),
      ]);
      setEmp(p as Profile | null);
      setBusinessRoles((br || []).map(r => r.role as Role));
      setStudios(Object.fromEntries((sts || []).map(s => [s.id, s.name])));
      setUserStudioIds((us || []).map(r => r.studio_id as string));
      setUserContracts((uc || []).map(r => r.contract as string));
      setShifts(sh || []);
      setFbs(fb || []);
      setSigs(sg || []);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleExport = () => {
    if (!emp) return;
    const blob = new Blob([JSON.stringify({ profile: emp, shifts, feedbacks: fbs, signalements: sigs }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${emp.first_name}_${emp.last_name}.json`; a.click();
    URL.revokeObjectURL(url); toast.success("Données exportées");
  };

  const handleDeactivate = async () => {
    if (!emp) return;
    const next = emp.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("profiles").update({ status: next }).eq("id", emp.id);
    if (error) { toast.error("Erreur"); return; }
    setEmp({ ...emp, status: next });
    toast.success(next === "active" ? "Compte réactivé" : "Compte suspendu");
  };

  if (loading) return <div className="p-6" style={{ fontSize: 13 }}>Chargement…</div>;
  if (!emp) return (
    <div className="p-6">
      <Link to="/staff" className="flex items-center gap-1 mb-4" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={14} /> Retour au staff
      </Link>
      <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Employé non trouvé</div>
      </div>
    </div>
  );

  const score = emp.score ?? 0;
  const scoreColor = score >= 9 ? "var(--success-text)" : score >= 8 ? "var(--foreground)" : score >= 7 ? "var(--warning-text)" : "var(--danger-text)";
  const used = emp.quota_used; const max = emp.quota_max;
  const quotaPct = used !== null && max !== null && max > 0 ? Math.round((used / max) * 100) : 0;
  const quotaColor = quotaPct >= 90 ? "var(--danger-text)" : quotaPct >= 75 ? "var(--warning-text)" : "var(--success-text)";
  const firstRole = businessRoles[0];
  const rc = firstRole ? roleColors[firstRole] : { bg: "var(--muted)", text: "var(--foreground)", dot: "" };

  return (
    <div className="p-6">
      <Link to="/staff" className="flex items-center gap-1 mb-4" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={14} /> Retour au staff
      </Link>

      {emp.status !== "active" && (
        <div className="rounded-lg border px-3 py-2 mb-4 flex items-center justify-between" style={{ backgroundColor: "var(--warning-bg)", borderColor: "var(--border)", color: "var(--warning-text)", fontSize: 12 }}>
          <span>Compte suspendu — n'apparaît plus dans les plannings.</span>
          <button onClick={handleDeactivate} className="rounded-md px-2 py-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--card)" }}>Réactiver</button>
        </div>
      )}

      <div className="grid grid-cols-5 gap-5">
        {/* LEFT */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center justify-center rounded-full" style={{ width: 56, height: 56, backgroundColor: rc.bg, color: rc.text, fontSize: 18, fontWeight: 500 }}>
                {initials(emp.first_name, emp.last_name)}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{emp.first_name} {emp.last_name}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {emp.contract && <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>{emp.contract}</span>}
                  {businessRoles.map(r => (
                    <span key={r} className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColors[r].bg, color: roleColors[r].text }}>{r}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2" style={{ fontSize: 12 }}>
              <Info icon={Mail} value={emp.email} />
              <Info icon={Phone} value={emp.phone || "—"} />
              <Info icon={MapPin} value={`${emp.city || "—"}${emp.studio_id && studios[emp.studio_id] ? ` · ${studios[emp.studio_id]}` : ""}`} />
            </div>
          </div>

          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Performance</div>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 13 }}>Score global</span>
              <span style={{ fontSize: 18, fontWeight: 500, color: scoreColor }}>{score || "—"}{score ? "/10" : ""}</span>
            </div>
            {used !== null && max !== null && max > 0 && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 13 }}>Contingent</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: quotaColor }}>{used}/{max}h</span>
                </div>
                <div style={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "var(--muted)" }}>
                  <div style={{ width: `${Math.min(quotaPct, 100)}%`, height: "100%", borderRadius: 3, backgroundColor: quotaColor }} />
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Administratif</div>
            <Row label="Date d'embauche" value={emp.hire_date || "—"} />
            <Row label="Date de naissance" value={emp.birth_date || "—"} />
            <Row label="Nationalité" value={emp.nationality || "—"} />
            <Row label="NISS" value={emp.niss || "—"} />
            <Row label="IBAN" value={emp.iban || "—"} />
            {emp.contract === "etudiant" && <Row label="Carte étudiant" value={emp.student_card_valid ? "Valide" : "Manquante"} />}
          </div>

          <div className="flex gap-2">
            <button onClick={handleExport} className="flex-1 rounded-md px-3 py-2 flex items-center justify-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>
              <Download size={13} /> Exporter
            </button>
            <button onClick={handleDeactivate} className="flex-1 rounded-md px-3 py-2 flex items-center justify-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 500, color: "var(--danger-text)", border: "0.5px solid var(--border)" }}>
              <UserX size={13} /> {emp.status === "active" ? "Désactiver" : "Réactiver"}
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col-span-3 flex flex-col gap-4">
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              Shifts récents ({shifts.length})
            </div>
            {shifts.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun shift</div> : (
              <div className="flex flex-col gap-1.5">
                {shifts.slice(0, 8).map(s => {
                  const sname = s.studio_id ? studios[s.studio_id] : "—";
                  return (
                    <div key={s.id} className="rounded-lg flex items-center gap-3 px-3 py-2" style={{ backgroundColor: "var(--background)" }}>
                      <Clock size={13} style={{ color: "var(--muted-foreground)" }} />
                      <div className="flex-1">
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{new Date(s.shift_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{fmtTime(s.start_time)} — {fmtTime(s.end_time)} · {s.business_role} · {sname?.replace?.("Skult ", "")}</div>
                      </div>
                      <span className="rounded-full px-2 py-0.5" style={{
                        fontSize: 10, fontWeight: 500,
                        backgroundColor: s.status === "completed" ? "var(--success-bg)" : s.status === "cancelled" ? "var(--danger-bg)" : "var(--muted)",
                        color: s.status === "completed" ? "var(--success-text)" : s.status === "cancelled" ? "var(--danger-text)" : "var(--muted-foreground)",
                      }}>{s.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              <MessageSquare size={11} className="inline mr-1.5" /> Feedbacks récents ({fbs.length})
            </div>
            {fbs.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun feedback</div> : (
              <div className="flex flex-col gap-2">
                {fbs.map(f => (
                  <div key={f.id} className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--background)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} size={11} fill={n <= f.rating ? "var(--coral)" : "transparent"} color={n <= f.rating ? "var(--coral)" : "rgba(0,0,0,0.2)"} strokeWidth={1.4} />
                      ))}
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{new Date(f.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    {f.message && <div style={{ fontSize: 12 }}>{f.message}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              <AlertCircle size={11} className="inline mr-1.5" /> Signalements ({sigs.length})
            </div>
            {sigs.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun signalement</div> : (
              <div className="flex flex-col gap-2">
                {sigs.map(s => (
                  <div key={s.id} className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--background)" }}>
                    <div className="flex items-center gap-2 mb-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{s.category}</span>
                      <span>·</span>
                      <span>{new Date(s.created_at).toLocaleDateString("fr-FR")}</span>
                      {s.resolved && <span className="rounded-full px-1.5 py-0.5 ml-auto" style={{ fontSize: 9, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>résolu</span>}
                    </div>
                    <div style={{ fontSize: 12 }}>{s.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, value }: { icon: typeof Mail; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={12} style={{ color: "var(--muted-foreground)" }} />
      <span>{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1" style={{ fontSize: 12 }}>
      <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
