import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, MapPin, Star, Download, UserX, MessageSquare, AlertCircle, Clock, Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { roleColors, type Role } from "@/lib/role-colors";
import { useAuth } from "@/hooks/use-auth";
import { computePunctuality, punctualityColor } from "@/lib/staff-helpers";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { useServerFn } from "@tanstack/react-start";
import { getScoreBreakdown } from "@/lib/scoring.functions";
import { editClockTimesFn } from "@/lib/pointage.functions";
import { WorkedHoursAdminCard, ClockedShiftsTable } from "@/components/WorkedHoursCard";
import { EmployeeStatsCard } from "@/components/EmployeeStatsCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmployeeFormationTab } from "@/components/staff/EmployeeFormationTab";
import { EmployeeDocumentsTab } from "@/components/staff/EmployeeDocumentsTab";
import { EmployeeProposalsCard } from "@/components/staff/EmployeeProposalsCard";
import { AdminEditEmployeeSheet } from "@/components/staff/AdminEditEmployeeSheet";
import { countUnviewedDocuments } from "@/lib/documents.functions";
import { formatBrusselsTime } from "@/lib/brussels-time";
import { RatingInput, RatingBadge } from "@/components/RatingInput";
import { ExtendedHoursCard } from "@/components/staff/ExtendedHoursCard";
import { EmployeeShiftsHistoryTab } from "@/components/staff/EmployeeShiftsHistoryTab";
import { setUserAppRole, setUserAppRoles } from "@/lib/admins.functions";
import { ManagerPermissionsModal } from "@/components/ManagerPermissionsModal";
import { TimePicker24 } from "@/components/ui/time-picker-24";

export const Route = createFileRoute("/staff/$id")({
  component: EmployeeDetailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    edit: search.edit === 1 || search.edit === "1" ? 1 : undefined,
  }),
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
  avatar_url: string | null;
  hourly_rate: number | null;
  allow_extended_hours: boolean | null;
  weekly_hours_cap: number | null;
}
interface ShiftRow { id: string; shift_date: string; start_time: string; end_time: string; business_role: string; studio_id: string | null; status: string; clocked_in_at: string | null; clocked_out_at: string | null; }
interface FB { id: string; rating: number; message: string | null; created_at: string; shift_id: string | null; author_id: string; }
interface Sig { id: string; category: string; message: string; created_at: string; resolved: boolean; }
interface AuthorMini { id: string; first_name: string; last_name: string; }

const fmtTime = (t: string) => t.slice(0, 5).replace(":", "h");
const initials = (f: string, l: string) => `${(f?.[0] || "").toUpperCase()}${(l?.[0] || "").toUpperCase()}`;

function EmployeeDetailPage() {
  const { id } = Route.useParams();
  const { edit } = Route.useSearch();
  const { user, appRole, managerPermissions } = useAuth();
  const canRate = appRole === "admin" || appRole === "manager";

  const [emp, setEmp] = useState<Profile | null>(null);
  const [businessRoles, setBusinessRoles] = useState<Role[]>([]);
  const [studios, setStudios] = useState<Record<string, string>>({});
  const [userStudioIds, setUserStudioIds] = useState<string[]>([]);
  const [userContracts, setUserContracts] = useState<string[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [fbs, setFbs] = useState<FB[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorMini>>({});
  const [sigs, setSigs] = useState<Sig[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateShiftId, setRateShiftId] = useState<string | null>(null);
  const [rateValue, setRateValue] = useState(7);
  const [rateMsg, setRateMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [editClockShiftId, setEditClockShiftId] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<Awaited<ReturnType<typeof getScoreBreakdown>> | null>(null);
  const [tab, setTab] = useState("profil");
  const [unviewedDocs, setUnviewedDocs] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const fetchBreakdown = useServerFn(getScoreBreakdown);
  const fetchUnviewed = useServerFn(countUnviewedDocuments);
  const editClockTimes = useServerFn(editClockTimesFn);
  const canEditProfile = appRole === "admin" || (appRole === "manager" && (managerPermissions ?? []).includes("/staff:write"));
  const canEditClock = appRole === "admin" || appRole === "manager";

  const load = async () => {
    try {
      const [{ data: p }, { data: br }, { data: sts }, { data: us }, { data: uc }, { data: sh }, { data: sg }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("user_business_roles").select("role").eq("user_id", id),
        supabase.from("studios").select("id,name"),
        supabase.from("user_studios").select("studio_id").eq("user_id", id),
        supabase.from("user_contracts").select("contract").eq("user_id", id),
        supabase.from("shifts").select("id,shift_date,start_time,end_time,business_role,studio_id,status,clocked_in_at,clocked_out_at").eq("user_id", id).lte("shift_date", new Date().toISOString().slice(0, 10)).order("shift_date", { ascending: false }).limit(20),
        supabase.from("signalements").select("id,category,message,created_at,resolved").eq("author_id", id).order("created_at", { ascending: false }).limit(10),
      ]);
      setEmp(p as Profile | null);
      setBusinessRoles((br || []).map(r => r.role as Role));
      setStudios(Object.fromEntries((sts || []).map(s => [s.id, s.name])));
      setUserStudioIds((us || []).map(r => r.studio_id as string));
      setUserContracts((uc || []).map(r => r.contract as string));
      setShifts(sh || []);
      setSigs(sg || []);

      // Feedbacks SUR ses shifts (notes admin/manager)
      const shiftIds = (sh || []).map(s => s.id);
      if (shiftIds.length > 0) {
        const { data: fb } = await supabase
          .from("feedbacks")
          .select("id,rating,message,created_at,shift_id,author_id")
          .in("shift_id", shiftIds)
          .order("created_at", { ascending: false });
        const list = (fb || []).filter(f => f.author_id !== id) as FB[];
        setFbs(list);
        const authorIds = Array.from(new Set(list.map(f => f.author_id)));
        if (authorIds.length > 0) {
          const { data: ap } = await supabase.from("profiles").select("id,first_name,last_name").in("id", authorIds);
          setAuthors(Object.fromEntries((ap || []).map(a => [a.id, a as AuthorMini])));
        }
      } else {
        setFbs([]);
      }
      setLoading(false);
    } catch (e: any) {
      console.error("[staff.$id load]", e);
      toast.error("Erreur lors du chargement", { description: e?.message });
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    fetchBreakdown({ data: { userId: id } }).then(setBreakdown).catch(() => setBreakdown(null));
  }, [id]);
  useEffect(() => {
    fetchUnviewed({ data: { userId: id } }).then(r => setUnviewedDocs(r.count)).catch(() => setUnviewedDocs(0));
  }, [id, tab]);
  useEffect(() => {
    if (edit === 1) {
      setTab("profil");
      toast.info("Mode édition — clique sur « Modifier » à côté du taux horaire", { duration: 4000 });
    }
  }, [edit]);

  const submitRating = async (shiftId: string) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("feedbacks").insert({
      author_id: user.id,
      shift_id: shiftId,
      rating: rateValue,
      message: rateMsg.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Erreur lors de l'enregistrement"); return; }
    if (id && id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: id,
        type: "feedback_received",
        title: "Nouveau feedback reçu",
        body: `Tu as reçu une note ${rateValue}/10 sur un de tes shifts.`,
        link: `/staff-app?tab=planning&shift=${shiftId}`,
        priority: "normal",
        category: "general",
      });
    }
    toast.success("Note enregistrée");
    setRateShiftId(null); setRateMsg(""); setRateValue(7);
    load();
  };

  const fbsByShift = useMemo(() => {
    const m: Record<string, FB[]> = {};
    fbs.forEach(f => { if (f.shift_id) (m[f.shift_id] ||= []).push(f); });
    return m;
  }, [fbs]);


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

  if (loading) return <div className="p-4 md:p-6" style={{ fontSize: 13 }}>Chargement…</div>;
  if (!emp) return (
    <div className="p-4 md:p-6">
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
    <div className="p-4 md:p-6">
      <Link to="/staff" className="flex items-center gap-1 mb-4" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={14} /> Retour au staff
      </Link>

      {emp.status === "suspended" && (
        <div className="rounded-lg border px-3 py-2 mb-4 flex items-center justify-between" style={{ backgroundColor: "var(--warning-bg)", borderColor: "var(--border)", color: "var(--warning-text)", fontSize: 12 }}>
          <span>Compte suspendu — n'apparaît plus dans les plannings.</span>
          <button onClick={handleDeactivate} className="rounded-md px-2 py-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--card)" }}>Réactiver</button>
        </div>
      )}
      {emp.status === "invited" && (
        <div className="rounded-lg border px-3 py-2 mb-4" style={{ backgroundColor: "var(--info-bg)", borderColor: "var(--border)", color: "var(--info-text)", fontSize: 12 }}>
          Invitation envoyée — l'employé n'a pas encore terminé son inscription. Tu peux renvoyer le mail depuis Employés → Invitations.
        </div>
      )}

      <EmployeeStatsCard userId={emp.id} onOpenFormation={() => setTab("formation")} />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {unviewedDocs > 0 && (
              <span className="ml-1.5 rounded-full px-1.5" style={{ fontSize: 10, backgroundColor: "var(--coral)", color: "var(--coral-text)" }}>
                {unviewedDocs}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="historique">Historique shifts</TabsTrigger>
          <TabsTrigger value="formation">Formation</TabsTrigger>
        </TabsList>
        <TabsContent value="profil">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

        {/* LEFT */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center justify-center rounded-full overflow-hidden" style={{ width: 56, height: 56, backgroundColor: rc.bg, color: rc.text, fontSize: 18, fontWeight: 500 }}>
                {emp.avatar_url
                  ? <img src={emp.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : initials(emp.first_name, emp.last_name)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div style={{ fontSize: 18, fontWeight: 500 }}>{emp.first_name} {emp.last_name}</div>
                  {canEditProfile && (
                    <button
                      onClick={() => setEditOpen(true)}
                      className="rounded-md inline-flex items-center gap-1 px-2 py-1"
                      style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)", color: "var(--foreground)" }}
                    >
                      <Pencil size={11} /> Modifier
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {(userContracts.length > 0 ? userContracts : emp.contract ? [emp.contract] : []).map(c => (
                    <span key={c} className="rounded-full px-2 py-0.5" style={{ fontSize: 10, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>{c}</span>
                  ))}
                  {businessRoles.map(r => (
                    <span key={r} className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColors[r].bg, color: roleColors[r].text }}>{r}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2" style={{ fontSize: 12 }}>
              <Info icon={Mail} value={emp.email} />
              <Info icon={Phone} value={emp.phone || "—"} />
              <Info icon={MapPin} value={emp.city || "—"} />
            </div>

            {(() => {
              const ids = userStudioIds.length > 0 ? userStudioIds : (emp.studio_id ? [emp.studio_id] : []);
              if (ids.length === 0) return null;
              return (
                <div className="mt-4 pt-4" style={{ borderTop: "0.5px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Studios rattachés
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {ids.map(sid => (
                      <div key={sid} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ backgroundColor: "var(--background)", fontSize: 12 }}>
                        <MapPin size={12} style={{ color: "var(--coral)" }} />
                        <span style={{ fontWeight: 500 }}>{studios[sid] || "Studio inconnu"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <WorkedHoursAdminCard userId={emp.id} hourlyRate={emp.hourly_rate} />
          {canEditProfile && (
            <ExtendedHoursCard
              userId={emp.id}
              firstName={emp.first_name}
              contracts={userContracts.length > 0 ? userContracts : emp.contract ? [emp.contract] : []}
              allowed={!!emp.allow_extended_hours}
              onSaved={load}

            />
          )}
          <ClockedShiftsTable userId={emp.id} />
          <EmployeeProposalsCard userId={emp.id} studios={studios} />


          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Performance</div>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 13 }}>Score global</span>
              <span style={{ fontSize: 22, fontWeight: 500, color: scoreColor }}>{score ? score.toFixed(1) : "—"}{score ? "/10" : ""}</span>
            </div>
            {breakdown && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "Manager", val: breakdown.manager, n: breakdown.counts.manager },
                  { label: "Ponctualité", val: breakdown.punctuality, n: breakdown.counts.punctuality },
                  { label: "Checklists", val: breakdown.checklist, n: breakdown.counts.checklist },
                ].map((c) => (
                  <div key={c.label} className="rounded-md p-2" style={{ backgroundColor: "var(--background)" }}>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{c.val.toFixed(1)}</div>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{c.n === 0 ? "défaut" : `${c.n} éval.`}</div>
                  </div>
                ))}
              </div>
            )}
            {breakdown && breakdown.evolution.length > 0 && (
              <div style={{ height: 80, marginTop: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={breakdown.evolution}>
                    <YAxis domain={[0, 10]} hide />
                    <XAxis dataKey="date" hide />
                    <Tooltip
                      contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 6 }}
                      labelFormatter={(d) => new Date(d as string).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      formatter={(v) => [`${(v as number).toFixed(1)}/10`, "Score"]}
                    />
                    <ReferenceLine y={7} stroke="var(--border)" strokeDasharray="2 2" />
                    <Line type="monotone" dataKey="score" stroke="var(--coral)" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 10, color: "var(--muted-foreground)", textAlign: "center", marginTop: 2 }}>Évolution sur 90 jours</div>
              </div>
            )}
            {used !== null && max !== null && max > 0 && (
              <div className="mt-4 pt-3" style={{ borderTop: "0.5px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 13 }}>Contingent</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: quotaColor }}>{used}/{max}h</span>
                </div>
                <div style={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "var(--muted)" }}>
                  <div style={{ width: `${Math.min(quotaPct, 100)}%`, height: "100%", borderRadius: 3, backgroundColor: quotaColor }} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Administratif</div>
            <HourlyRateRow profileId={emp.id} value={emp.hourly_rate} canEdit={appRole === "admin" || appRole === "manager"} onSaved={(v) => setEmp({ ...emp, hourly_rate: v })} />
            <Row label="Date d'embauche" value={emp.hire_date || "—"} />
            <Row label="Date de naissance" value={emp.birth_date || "—"} />
            <Row label="Nationalité" value={emp.nationality || "—"} />
            <Row label="NISS" value={emp.niss || "—"} />
            <Row label="IBAN" value={emp.iban || "—"} />
            {emp.contract === "etudiant" && <Row label="Carte étudiant" value={emp.student_card_valid ? "Valide" : "Manquante"} />}
          </div>

          {appRole === "admin" && <AppRoleCard userId={emp.id} selfId={user?.id} userName={`${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim()} />}

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
          <PunctualityCard shifts={shifts} />
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              Shifts récents ({shifts.length})
            </div>
            {shifts.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun shift</div> : (
              <div className="flex flex-col gap-1.5">
                {shifts.slice(0, 8).map(s => {
                  const sname = s.studio_id ? studios[s.studio_id] : "—";
                  const shiftFbs = fbsByShift[s.id] || [];
                  const isRating = rateShiftId === s.id;
                  const isEditingClock = editClockShiftId === s.id;
                  const inHHMM = s.clocked_in_at ? formatBrusselsTime(s.clocked_in_at) : "";
                  const outHHMM = s.clocked_out_at ? formatBrusselsTime(s.clocked_out_at) : "";
                  return (
                    <div key={s.id} className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--background)" }}>
                      <div className="flex items-center gap-3">
                        <Clock size={13} style={{ color: "var(--muted-foreground)" }} />
                        <div className="flex-1">
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{new Date(s.shift_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{fmtTime(s.start_time)} — {fmtTime(s.end_time)} · {s.business_role} · {sname?.replace?.("Skult ", "")}</div>
                          {(s.clocked_in_at || s.clocked_out_at) && (
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                              Pointé : {inHHMM || "—"} → {outHHMM || "—"}
                            </div>
                          )}
                        </div>
                        {shiftFbs.length > 0 && (
                          <RatingBadge value={shiftFbs[0].rating} />
                        )}
                        <span className="rounded-full px-2 py-0.5" style={{
                          fontSize: 10, fontWeight: 500,
                          backgroundColor: s.status === "completed" ? "var(--success-bg)" : s.status === "cancelled" ? "var(--danger-bg)" : "var(--muted)",
                          color: s.status === "completed" ? "var(--success-text)" : s.status === "cancelled" ? "var(--danger-text)" : "var(--muted-foreground)",
                        }}>{s.status}</span>
                        {canEditClock && !isEditingClock && (
                          <button onClick={() => setEditClockShiftId(s.id)}
                            className="rounded-md px-2 py-1 inline-flex items-center gap-1"
                            style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)" }}
                            title="Modifier les heures de pointage">
                            <Pencil size={11} /> Pointage
                          </button>
                        )}
                        {canRate && !isRating && (
                          <button onClick={() => { setRateShiftId(s.id); setRateValue(7); setRateMsg(""); }}
                            className="rounded-md px-2 py-1 inline-flex items-center gap-1"
                            style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)" }}>
                            <Plus size={11} /> Noter
                          </button>
                        )}
                      </div>
                      {isEditingClock && (
                        <EditClockInline
                          initialIn={inHHMM}
                          initialOut={outHHMM}
                          onCancel={() => setEditClockShiftId(null)}
                          onSubmit={async (inT, outT, recompute, reason) => {
                            try {
                              await editClockTimes({ data: { shiftId: s.id, clockedInTime: inT || null, clockedOutTime: outT || null, recomputeLate: recompute, reason } });
                              toast.success("Pointages mis à jour");
                              setEditClockShiftId(null);
                              await load();
                            } catch (e: any) {
                              toast.error(e?.message || "Échec");
                            }
                          }}
                        />
                      )}
                      {isRating && (
                        <div className="mt-2 pt-2 flex flex-col gap-2" style={{ borderTop: "0.5px solid var(--border)" }}>
                          <RatingInput value={rateValue} onChange={setRateValue} size="md" />
                          <textarea value={rateMsg} onChange={e => setRateMsg(e.target.value)} placeholder="Commentaire (optionnel)" rows={2}
                            className="rounded-md border px-2 py-1.5 outline-none"
                            style={{ fontSize: 12, borderColor: "var(--border)", backgroundColor: "var(--card)" }} />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setRateShiftId(null)} className="rounded-md px-2.5 py-1" style={{ fontSize: 11, border: "0.5px solid var(--border)" }}>Annuler</button>
                            <button onClick={() => submitRating(s.id)} disabled={saving} className="rounded-md px-2.5 py-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                              {saving ? "..." : "Enregistrer"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              <MessageSquare size={11} className="inline mr-1.5" /> Évaluations admin/manager ({fbs.length})
            </div>
            {fbs.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucune évaluation pour le moment</div> : (
              <div className="flex flex-col gap-2">
                {fbs.map(f => {
                  const a = authors[f.author_id];
                  const sh = f.shift_id ? shifts.find(x => x.id === f.shift_id) : null;
                  return (
                    <div key={f.id} className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--background)" }}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <RatingBadge value={f.rating} />
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                          {a ? `par ${a.first_name} ${a.last_name}` : "—"}
                          {sh && ` · shift du ${new Date(sh.shift_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
                          {" · "}{new Date(f.created_at).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      {f.message && <div style={{ fontSize: 12 }}>{f.message}</div>}
                    </div>
                  );
                })}
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
        </TabsContent>
        <TabsContent value="documents">
          <EmployeeDocumentsTab userId={emp.id} firstName={emp.first_name} />
        </TabsContent>
        <TabsContent value="historique">
          <EmployeeShiftsHistoryTab userId={emp.id} />
        </TabsContent>
        <TabsContent value="formation">
          <EmployeeFormationTab userId={emp.id} />
        </TabsContent>
      </Tabs>

      {canEditProfile && (
        <AdminEditEmployeeSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          userId={emp.id}
          initial={{
            first_name: emp.first_name,
            last_name: emp.last_name,
            email: emp.email,
            phone: emp.phone,
            birth_date: emp.birth_date,
            hire_date: emp.hire_date,
            nationality: emp.nationality,
            city: emp.city,
            address: emp.address,
            niss: emp.niss,
            iban: emp.iban,
            hourly_rate: emp.hourly_rate,
            quota_max: emp.quota_max,
            student_card_valid: emp.student_card_valid,
            status: emp.status,
            contracts: userContracts.length > 0 ? userContracts : (emp.contract ? [emp.contract] : []),
            studio_ids: userStudioIds.length > 0 ? userStudioIds : (emp.studio_id ? [emp.studio_id] : []),
            business_roles: businessRoles,
          }}
          onSaved={() => load()}
        />
      )}
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

function HourlyRateRow({ profileId, value, canEdit, onSaved }: { profileId: string; value: number | null; canEdit: boolean; onSaved: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value !== null ? String(value).replace(".", ",") : "");
  const [saving, setSaving] = useState(false);

  const display = value !== null ? `${value.toFixed(2).replace(".", ",")} €/h` : "—";

  const save = async () => {
    const normalized = raw.trim().replace(",", ".");
    const parsed = normalized === "" ? null : Number(normalized);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      toast.error("Montant invalide");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ hourly_rate: parsed }).eq("id", profileId);
    setSaving(false);
    if (error) { toast.error("Erreur"); return; }
    toast.success("Taux horaire mis à jour");
    onSaved(parsed);
    setEditing(false);
  };

  if (!canEdit || !editing) {
    const isEmpty = value === null;
    return (
      <div
        className="rounded-lg flex items-center justify-between mb-3"
        style={{
          padding: "12px 14px",
          backgroundColor: isEmpty ? "rgba(240, 153, 123, 0.08)" : "var(--background)",
          border: isEmpty ? "1px solid var(--coral)" : "0.5px solid var(--border)",
        }}
      >
        <div className="flex flex-col">
          <span style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Taux horaire
          </span>
          <span style={{ fontSize: 18, fontWeight: 500, marginTop: 2, color: isEmpty ? "var(--muted-foreground)" : "var(--foreground)" }}>
            {isEmpty ? "Non défini" : display}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={() => { setRaw(value !== null ? String(value).replace(".", ",") : ""); setEditing(true); }}
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "var(--coral)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {isEmpty ? "Définir" : "Modifier"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg flex items-center gap-2 mb-3"
      style={{ padding: "12px 14px", backgroundColor: "var(--background)", border: "1px solid var(--coral)" }}
    >
      <div className="flex flex-col flex-1">
        <span style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Taux horaire
        </span>
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Ex: 12,50"
            inputMode="decimal"
            style={{ fontSize: 16, fontWeight: 500, padding: "4px 8px", border: "0.5px solid var(--border)", borderRadius: 6, width: 100, textAlign: "right", backgroundColor: "#fff" }}
          />
          <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>€/h</span>
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={save}
          disabled={saving}
          style={{ fontSize: 12, fontWeight: 500, padding: "8px 14px", borderRadius: 8, border: "none", backgroundColor: "var(--coral)", color: "#fff", cursor: "pointer" }}
        >
          {saving ? "..." : "Enregistrer"}
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={saving}
          style={{ fontSize: 12, fontWeight: 500, padding: "8px 12px", borderRadius: 8, border: "0.5px solid var(--border)", backgroundColor: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function PunctualityCard({ shifts }: { shifts: ShiftRow[] }) {
  // Du plus ancien au plus récent, uniquement les shifts pointés (in + out)
  const data = shifts
    .slice()
    .reverse()
    .map((s) => {
      const pct = computePunctuality(s);
      if (pct === null) return null;
      return {
        date: new Date(s.shift_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
        pct,
      };
    })
    .filter((x): x is { date: string; pct: number } => x !== null);

  const avg = data.length > 0 ? Math.round(data.reduce((a, b) => a + b.pct, 0) / data.length) : null;
  const last = data.length > 0 ? data[data.length - 1].pct : null;
  const trend = data.length >= 2 ? data[data.length - 1].pct - data[data.length - 2].pct : 0;

  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Taux de pointage
        </div>
        <div className="flex items-baseline gap-3">
          {avg !== null && (
            <div>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginRight: 4 }}>Moyenne</span>
              <span style={{ fontSize: 18, fontWeight: 500, color: punctualityColor(avg) }}>{avg}%</span>
            </div>
          )}
          {last !== null && (
            <div>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginRight: 4 }}>Dernier</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: punctualityColor(last) }}>
                {last}%{data.length >= 2 && trend !== 0 && (
                  <span style={{ fontSize: 10, color: trend > 0 ? "var(--success-text)" : "var(--danger-text)", marginLeft: 4 }}>
                    {trend > 0 ? "+" : ""}{trend}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
      {data.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun shift pointé pour le moment.</div>
      ) : (
        <div style={{ width: "100%", height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} ticks={[0, 50, 100]} />
              <Tooltip
                contentStyle={{ fontSize: 11, padding: "4px 8px", border: "0.5px solid var(--border)", borderRadius: 6, backgroundColor: "var(--card)" }}
                labelStyle={{ fontSize: 10, color: "var(--muted-foreground)" }}
                formatter={(v: number) => [`${v}%`, "Pointage"]}
              />
              <ReferenceLine y={100} stroke="var(--border)" strokeDasharray="2 2" />
              <Line type="monotone" dataKey="pct" stroke="var(--coral)" strokeWidth={2} dot={{ r: 3, fill: "var(--coral)" }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function EditClockInline({
  initialIn,
  initialOut,
  onCancel,
  onSubmit,
}: {
  initialIn: string;
  initialOut: string;
  onCancel: () => void;
  onSubmit: (inT: string, outT: string, recompute: boolean, reason: string) => Promise<void>;
}) {
  const [inT, setInT] = useState(initialIn);
  const [outT, setOutT] = useState(initialOut);
  const [recompute, setRecompute] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 5) { toast.error("Raison obligatoire (min 5 caractères)"); return; }
    if (outT && !inT) { toast.error("Renseigne d'abord l'heure d'arrivée"); return; }
    if (inT && outT && outT < inT) { toast.error("La sortie doit être après l'arrivée"); return; }
    setBusy(true);
    try { await onSubmit(inT, outT, recompute, reason.trim()); }
    finally { setBusy(false); }
  };

  const inputStyle: React.CSSProperties = { fontSize: 12, borderColor: "var(--border)", backgroundColor: "var(--card)" };
  return (
    <div className="mt-2 pt-2 flex flex-col gap-2" style={{ borderTop: "0.5px solid var(--border)" }}>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          Arrivée
          <TimePicker24 value={inT} onChange={(v) => { setInT(v); if (!v) setOutT(""); }} step={5} />
        </div>
        <div className="flex flex-col gap-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          Sortie
          <TimePicker24 value={outT} onChange={setOutT} step={5} />
        </div>
      </div>
      <label className="flex items-center gap-2" style={{ fontSize: 11 }}>
        <input type="checkbox" checked={recompute} onChange={e => setRecompute(e.target.checked)} />
        Recalculer le retard automatiquement
      </label>
      <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Raison de la modification (obligatoire, min 5 caractères)" rows={2} maxLength={500}
        className="rounded-md border px-2 py-1.5 outline-none" style={inputStyle} />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="rounded-md px-2.5 py-1" style={{ fontSize: 11, border: "0.5px solid var(--border)" }}>Annuler</button>
        <button onClick={submit} disabled={busy} className="rounded-md px-2.5 py-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          {busy ? "..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function AppRoleCard({ userId, selfId, userName }: { userId: string; selfId?: string; userName?: string }) {
  type R = "employee" | "manager" | "admin";
  const [roles, setRoles] = useState<R[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permsOpen, setPermsOpen] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState(false);
  const [pendingRoles, setPendingRoles] = useState<R[] | null>(null);
  const setRolesFn = useServerFn(setUserAppRoles);
  void setUserAppRole;

  const refresh = async () => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const rs = ((data ?? []).map((r: any) => r.role as R));
    setRoles(rs.length ? rs : ["employee"]);
    setLoaded(true);
  };

  useEffect(() => { refresh(); }, [userId]);

  const isSelf = selfId === userId;
  const has = (r: R) => roles.includes(r);

  const persistRoles = async (next: R[]) => {
    if (next.length === 0) {
      toast.error("Sélectionne au moins un rôle");
      return false;
    }
    if (isSelf && !next.includes("admin")) {
      toast.error("Tu ne peux pas retirer ton propre statut admin");
      return false;
    }
    setSaving(true);
    try {
      await setRolesFn({ data: { user_id: userId, roles: next } });
      setRoles(next);
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Échec");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggle = (r: R) => {
    if (saving || !loaded) return;
    const becameManager = r === "manager" && !has("manager");
    const next = has(r) ? roles.filter((x) => x !== r) : [...roles, r];

    if (becameManager) {
      // D'abord configurer les permissions, puis seulement promouvoir si l'admin confirme
      setPendingRoles(next);
      setPendingPromotion(true);
      setPermsOpen(true);
      return;
    }

    persistRoles(next).then((ok) => { if (ok) toast.success("Accès mis à jour"); });
  };

  const opts: Array<{ v: R; label: string; desc: string }> = [
    { v: "employee", label: "Employé", desc: "Accès à l'app staff (planning, pointage, formations)" },
    { v: "manager", label: "Manager", desc: "Accès à la console admin (sections configurables)" },
    { v: "admin", label: "Administrateur", desc: "Accès total : gestion des comptes admin, finances, paramètres" },
  ];

  const multi = roles.length > 1;

  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        Accès & titres
      </div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12, lineHeight: 1.4 }}>
        Coche un ou plusieurs titres. Si plusieurs sont cochés, l'espace affiché dépend du lien de connexion (app employé vs console admin) — mêmes identifiants.
      </div>

      <div className="flex flex-col gap-1.5">
        {opts.map((o) => {
          const active = has(o.v);
          const disabled = saving || !loaded || (isSelf && o.v === "admin" && active);
          return (
            <button
              key={o.v}
              onClick={() => toggle(o.v)}
              disabled={disabled}
              className="text-left rounded-md px-3 py-2.5 transition flex items-start gap-2.5"
              style={{
                backgroundColor: active ? "var(--coral)" : "var(--background)",
                color: active ? "var(--coral-text)" : "var(--foreground)",
                border: active ? "none" : "0.5px solid var(--border)",
                opacity: disabled && !active ? 0.5 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 16, height: 16, marginTop: 1, borderRadius: 4, flexShrink: 0,
                  border: active ? "none" : "1.5px solid var(--border)",
                  backgroundColor: active ? "var(--coral-text)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {active && <span style={{ color: "var(--coral)", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{o.label}</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{o.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {multi && (
        <div className="mt-3 rounded-md px-3 py-2" style={{ backgroundColor: "var(--background)", border: "0.5px solid var(--border)", fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
          <strong style={{ color: "var(--foreground)", fontWeight: 500 }}>Comptes multiples :</strong>{" "}
          {roles.map((r) => r === "admin" ? "Administrateur" : r === "manager" ? "Manager" : "Employé").join(" + ")}.
          La personne se connecte avec les mêmes identifiants sur l'app employé ou la console admin selon ce qu'elle veut faire.
        </div>
      )}

      {has("manager") && (
        <button
          onClick={() => { setPendingPromotion(false); setPendingRoles(null); setPermsOpen(true); }}
          className="mt-3 w-full rounded-md px-3 py-2 transition"
          style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}
        >
          Configurer les accès du Manager…
        </button>
      )}

      {isSelf && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 10 }}>
          Tu ne peux pas retirer ton propre statut admin.
        </div>
      )}

      <ManagerPermissionsModal
        open={permsOpen}
        userId={userId}
        userName={userName}
        pendingPromotion={pendingPromotion}
        beforeSave={pendingPromotion && pendingRoles ? async () => {
          const ok = await persistRoles(pendingRoles);
          if (!ok) throw new Error("Promotion annulée");
        } : undefined}
        onCancel={() => {
          if (pendingPromotion) {
            toast.message("Promotion annulée");
          }
          setPendingPromotion(false);
          setPendingRoles(null);
        }}
        onClose={() => {
          setPermsOpen(false);
          setPendingPromotion(false);
          setPendingRoles(null);
        }}
      />
    </div>
  );
}


