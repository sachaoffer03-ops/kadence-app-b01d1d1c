import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Send, UserPlus, ChevronDown, ChevronUp, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getRoleStyle, hhmm, fullName } from "@/lib/staff-helpers";

export const Route = createFileRoute("/trous")({
  component: TrousPage,
  head: () => ({ meta: [{ title: "Trous à combler — Kadence" }] }),
});

interface Hole {
  id: string; shift_date: string; start_time: string; end_time: string;
  business_role: string; studio_id: string | null;
}
interface ProfileRow { id: string; first_name: string; last_name: string; score: number | null }

function TrousPage() {
  const [holes, setHoles] = useState<Hole[]>([]);
  const [studios, setStudios] = useState<Map<string, string>>(new Map());
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profileRoles, setProfileRoles] = useState<Map<string, string[]>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actions, setActions] = useState<Record<string, string>>({});
  const [filterRole, setFilterRole] = useState<string>("tous");

  const load = async () => {
    const today = new Date().toISOString().split("T")[0];
    const [{ data: h }, { data: st }, { data: p }, { data: ubr }] = await Promise.all([
      supabase.from("shifts").select("id,shift_date,start_time,end_time,business_role,studio_id").is("user_id", null).gte("shift_date", today).order("shift_date").order("start_time"),
      supabase.from("studios").select("id,name"),
      supabase.from("profiles").select("id,first_name,last_name,score").eq("status", "active"),
      supabase.from("user_business_roles").select("user_id,role"),
    ]);
    setHoles((h || []) as Hole[]);
    setStudios(new Map((st || []).map((s) => [s.id, s.name])));
    setProfiles((p || []) as ProfileRow[]);
    const m = new Map<string, string[]>();
    (ubr || []).forEach((r) => { const arr = m.get(r.user_id) || []; arr.push(r.role); m.set(r.user_id, arr); });
    setProfileRoles(m);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("trous-rt").on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    return holes.filter((h) => filterRole === "tous" || h.business_role === filterRole);
  }, [holes, filterRole]);

  const assign = async (shiftId: string, userId: string, name: string) => {
    const { error } = await supabase.from("shifts").update({ user_id: userId }).eq("id", shiftId);
    if (error) toast.error(error.message);
    else { toast.success(`${name} assigné${name.endsWith("e") ? "e" : ""} au shift`); setActions((s) => ({ ...s, [`${shiftId}-${userId}`]: "Assigné" })); }
  };

  const allRoles = ["Barista", "Accueil", "Host", "Cuisine"];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} style={{ color: filtered.length > 0 ? "var(--danger-text)" : "var(--success-text)" }} />
            <h1 style={{ fontSize: 18, fontWeight: 500 }}>
              {filtered.length} trou{filtered.length > 1 ? "s" : ""} à combler
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Sélectionnez un trou et assignez un employé.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500, marginRight: 4 }}>Rôle</span>
        {[{ value: "tous", label: "Tous" }, ...allRoles.map((r) => ({ value: r, label: r }))].map((opt) => {
          const a = filterRole === opt.value;
          return (
            <button key={opt.value} onClick={() => setFilterRole(opt.value)} className="rounded-full px-2.5 py-1"
              style={{ fontSize: 11, fontWeight: a ? 500 : 400, backgroundColor: a ? "var(--foreground)" : "transparent", color: a ? "var(--card)" : "var(--muted-foreground)", border: a ? "none" : "0.5px solid var(--border)" }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border px-6 py-10 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Aucun trou à combler</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Tous les shifts sont attribués.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((hole) => {
            const isOpen = expanded === hole.id;
            const rc = getRoleStyle(hole.business_role);
            const studioName = hole.studio_id ? studios.get(hole.studio_id) || "—" : "—";
            const eligible = profiles.filter((p) => (profileRoles.get(p.id) || []).includes(hole.business_role));
            const others = profiles.filter((p) => !(profileRoles.get(p.id) || []).includes(hole.business_role));
            return (
              <div key={hole.id} className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: isOpen ? "var(--coral)" : "var(--border)", borderWidth: isOpen ? 1.5 : 1 }}>
                <button onClick={() => setExpanded(isOpen ? null : hole.id)} className="w-full flex items-center gap-4 px-5 py-4 text-left">
                  <span className="rounded-full shrink-0" style={{ width: 10, height: 10, backgroundColor: rc.dot }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{hole.business_role}</span>
                      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>·</span>
                      <span style={{ fontSize: 13 }}>{new Date(hole.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span>
                      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>·</span>
                      <span style={{ fontSize: 13 }}>{hhmm(hole.start_time)} — {hhmm(hole.end_time)}</span>
                      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>·</span>
                      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{studioName}</span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5" style={{ borderTop: "0.5px solid var(--border)" }}>
                    <div className="mt-4">
                      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                        Employés éligibles ({eligible.length})
                      </div>
                      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                        {eligible.length === 0 ? (
                          <div className="px-4 py-6 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun employé n'a ce rôle.</div>
                        ) : eligible.map((p, i) => (
                          <EmpRow key={p.id} profile={p} roles={profileRoles.get(p.id) || []} primary={hole.business_role}
                            isLast={i === eligible.length - 1}
                            status={actions[`${hole.id}-${p.id}`]}
                            onAssign={() => assign(hole.id, p.id, fullName(p))} />
                        ))}
                      </div>
                    </div>

                    {others.length > 0 && (
                      <div className="mt-5">
                        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          Autres employés ({others.length})
                        </div>
                        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                          {others.map((p, i) => (
                            <EmpRow key={p.id} profile={p} roles={profileRoles.get(p.id) || []}
                              isLast={i === others.length - 1}
                              status={actions[`${hole.id}-${p.id}`]}
                              onAssign={() => assign(hole.id, p.id, fullName(p))} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmpRow({ profile, roles, primary, isLast, status, onAssign }: { profile: ProfileRow; roles: string[]; primary?: string; isLast: boolean; status?: string; onAssign: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: isLast ? "none" : "0.5px solid var(--border)" }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/staff/$id" params={{ id: profile.id }} className="hover:underline" style={{ fontSize: 13, fontWeight: 500 }}>{fullName(profile)}</Link>
          {roles.map((r) => {
            const c = getRoleStyle(r);
            const m = primary === r;
            return <span key={r} className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 500, backgroundColor: c.bg, color: c.text, outline: m ? `1px solid ${c.dot}` : "none" }}>{r}</span>;
          })}
        </div>
        {profile.score != null && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>Score {Number(profile.score).toFixed(1)}/10</div>}
      </div>
      {status ? (
        <span className="rounded-full px-2.5 py-1 flex items-center gap-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}><Check size={12} /> {status}</span>
      ) : (
        <button onClick={onAssign} className="rounded-md px-2.5 py-1.5 flex items-center gap-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          <UserPlus size={11} /> Assigner
        </button>
      )}
    </div>
  );
}
