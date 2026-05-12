import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Mail, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { roleColors, type Role } from "@/lib/mock-data";
import { InviteEmployeeModal } from "@/components/InviteEmployeeModal";
import { InvitationsList } from "@/components/InvitationsList";

export const Route = createFileRoute("/staff/")({
  component: StaffPage,
  head: () => ({ meta: [{ title: "Staff — Kadence" }] }),
});

interface ProfileRow {
  id: string; first_name: string; last_name: string; email: string; phone: string | null;
  contract: string | null; studio_id: string | null; status: string;
  score: number | null; quota_used: number | null; quota_max: number | null;
}
interface StudioRow { id: string; name: string; }

const initials = (f: string, l: string) => `${(f?.[0] || "").toUpperCase()}${(l?.[0] || "").toUpperCase()}`;

function StaffPage() {
  const [tab, setTab] = useState<"employees" | "invitations">("employees");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, Role[]>>({});
  const [shiftCountByUser, setShiftCountByUser] = useState<Record<string, number>>({});
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [search, setSearch] = useState("");
  const [contractFilters, setContractFilters] = useState<Set<string>>(new Set());
  const [studioFilters, setStudioFilters] = useState<Set<string>>(new Set());
  const [roleFilters, setRoleFilters] = useState<Set<string>>(new Set());
  const [sortScore, setSortScore] = useState<"none" | "desc" | "asc">("none");
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: ps }, { data: br }, { data: sts }, { data: shifts }] = await Promise.all([
        supabase.from("profiles").select("id,first_name,last_name,email,phone,contract,studio_id,status,score,quota_used,quota_max"),
        supabase.from("user_business_roles").select("user_id,role"),
        supabase.from("studios").select("id,name").order("name"),
        supabase.from("shifts").select("user_id,shift_date").gte("shift_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
      ]);
      setProfiles(ps || []);
      const map: Record<string, Role[]> = {};
      (br || []).forEach(r => { (map[r.user_id] ||= []).push(r.role as Role); });
      setRolesByUser(map);
      setStudios(sts || []);
      const counts: Record<string, number> = {};
      (shifts || []).forEach(s => { if (s.user_id) counts[s.user_id] = (counts[s.user_id] || 0) + 1; });
      setShiftCountByUser(counts);
    };
    load();
    const channel = supabase.channel("staff-list-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const studioName = (id: string | null) => studios.find(s => s.id === id)?.name || "—";

  const filtered = useMemo(() => {
    const list = profiles.filter(p => {
      if (search) {
        const q = search.toLowerCase();
        if (!`${p.first_name} ${p.last_name}`.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q)) return false;
      }
      if (contractFilters.size && (!p.contract || !contractFilters.has(p.contract))) return false;
      if (studioFilters.size && (!p.studio_id || !studioFilters.has(p.studio_id))) return false;
      if (roleFilters.size) {
        const roles = rolesByUser[p.id] || [];
        if (!roles.some(r => roleFilters.has(r))) return false;
      }
      return true;
    });
    if (sortScore !== "none") {
      list.sort((a, b) => {
        const sa = a.score ?? -1; const sb = b.score ?? -1;
        return sortScore === "desc" ? sb - sa : sa - sb;
      });
    }
    return list;
  }, [profiles, search, contractFilters, studioFilters, roleFilters, sortScore, rolesByUser]);

  const toggle = (set: Set<string>, fn: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    fn(next);
  };

  const contracts = ["etudiant", "flexi", "cdi", "cdd"];
  const contractLabels: Record<string, string> = { etudiant: "Étudiants", flexi: "Flexis", cdi: "CDI", cdd: "CDD" };
  const businessRoleOptions: Role[] = ["Barista", "Accueil", "Host", "Cuisine"];


  return (
    <div className="p-6">
      <div className="flex items-center gap-1 mb-5 border-b" style={{ borderColor: "var(--border)" }}>
        {[
          { key: "employees" as const, label: "Employés", Icon: Users },
          { key: "invitations" as const, label: "Invitations", Icon: Mail },
        ].map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} className="inline-flex items-center gap-1.5 px-3 py-2"
              style={{ fontSize: 13, fontWeight: 500,
                color: active ? "var(--foreground)" : "var(--muted-foreground)",
                borderBottom: active ? "2px solid var(--coral)" : "2px solid transparent", marginBottom: -1 }}>
              <Icon size={13} strokeWidth={1.8} /> {label}
            </button>
          );
        })}
      </div>

      <InviteEmployeeModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      {tab === "invitations" ? (
        <InvitationsList onInviteClick={() => setInviteOpen(true)} />
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 rounded-md border px-3" style={{ height: 32, borderColor: "var(--border)", backgroundColor: "var(--card)", width: 240 }}>
              <Search size={14} style={{ color: "var(--muted-foreground)" }} />
              <input type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
                className="border-0 bg-transparent outline-none flex-1" style={{ fontSize: 12 }} />
            </div>
            <div className="flex items-center gap-1">
              {contracts.map(c => {
                const a = contractFilters.has(c);
                const count = profiles.filter(p => p.contract === c).length;
                if (count === 0) return null;
                return (
                  <button key={c} onClick={() => toggle(contractFilters, setContractFilters, c)}
                    className="rounded-full px-2.5 py-1"
                    style={{ fontSize: 12, fontWeight: a ? 500 : 400,
                      backgroundColor: a ? "var(--foreground)" : "transparent",
                      color: a ? "var(--card)" : "var(--muted-foreground)",
                      border: a ? "none" : "0.5px solid var(--border)" }}>
                    {contractLabels[c] || c} · {count}
                  </button>
                );
              })}
              <span className="mx-2" style={{ width: 1, height: 16, backgroundColor: "var(--border)", display: "inline-block" }} />
              {businessRoleOptions.map(r => {
                const a = roleFilters.has(r);
                const count = profiles.filter(p => (rolesByUser[p.id] || []).includes(r)).length;
                if (count === 0) return null;
                const rc = roleColors[r];
                return (
                  <button key={r} onClick={() => toggle(roleFilters, setRoleFilters, r)}
                    className="rounded-full px-2.5 py-1 inline-flex items-center gap-1.5"
                    style={{ fontSize: 12, fontWeight: a ? 500 : 400,
                      backgroundColor: a ? rc.dot : "transparent",
                      color: a ? "#fff" : "var(--muted-foreground)",
                      border: a ? "none" : "0.5px solid var(--border)" }}>
                    <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: a ? "#fff" : rc.dot }} />
                    {r} · {count}
                  </button>
                );
              })}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button onClick={() => setSortScore(s => s === "desc" ? "asc" : s === "asc" ? "none" : "desc")}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5"
                style={{ fontSize: 12, fontWeight: 500,
                  backgroundColor: sortScore !== "none" ? "var(--foreground)" : "transparent",
                  color: sortScore !== "none" ? "var(--card)" : "var(--muted-foreground)",
                  border: sortScore !== "none" ? "none" : "0.5px solid var(--border)" }}>
                Score {sortScore === "desc" ? "↓" : sortScore === "asc" ? "↑" : ""}
              </button>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{filtered.length} employé{filtered.length > 1 ? "s" : ""}</span>
              <button onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5"
                style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                <UserPlus size={13} /> Inviter
              </button>
            </div>
          </div>


          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            <table className="w-full" style={{ fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
                  {["Nom", "Contrat", "Postes", "Score", "Contingent", "Shifts 30j"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const userRoles = rolesByUser[p.id] || [];
                  const firstRole = userRoles[0];
                  const rc = firstRole ? roleColors[firstRole] : { bg: "var(--muted)", text: "var(--foreground)", dot: "" };
                  const score = p.score ?? 0;
                  const scoreColor = score >= 9 ? "var(--success-text)" : score >= 7 ? "var(--foreground)" : "var(--warning-text)";
                  const used = p.quota_used ?? null;
                  const max = p.quota_max ?? null;
                  return (
                    <tr key={p.id} style={{ borderBottom: "0.5px solid var(--border)", cursor: "pointer" }}
                      onClick={() => window.location.assign(`/staff/${p.id}`)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 30, height: 30, backgroundColor: rc.bg, color: rc.text, fontSize: 10, fontWeight: 500 }}>
                            {initials(p.first_name, p.last_name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{p.first_name} {p.last_name}</div>
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{studioName(p.studio_id).replace("Skult ", "")}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.contract ? (
                          <span className="rounded-full px-2 py-0.5" style={{
                            fontSize: 11,
                            backgroundColor: p.contract === "cdi" ? "var(--info-bg)" : p.contract === "flexi" ? "var(--warning-bg)" : "var(--muted)",
                            color: p.contract === "cdi" ? "var(--info-text)" : p.contract === "flexi" ? "var(--warning-text)" : "var(--muted-foreground)",
                          }}>{p.contract}</span>
                        ) : <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {userRoles.map(r => (
                            <span key={r} className="rounded-full px-1.5 py-0.5 flex items-center gap-1" style={{ fontSize: 10, backgroundColor: roleColors[r].bg, color: roleColors[r].text }}>
                              <span className="rounded-full" style={{ width: 5, height: 5, backgroundColor: roleColors[r].dot }} />{r}
                            </span>
                          ))}
                          {userRoles.length === 0 && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ fontWeight: 500, color: scoreColor }}>{score || "—"}</td>
                      <td className="px-4 py-3">
                        {used !== null && max !== null && max > 0 ? (
                          <span style={{ fontSize: 12, fontWeight: 500 }}>{used}/{max}h</span>
                        ) : <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>}
                      </td>
                      <td className="px-4 py-3" style={{ fontWeight: 500 }}>{shiftCountByUser[p.id] || 0}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Aucun employé.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
