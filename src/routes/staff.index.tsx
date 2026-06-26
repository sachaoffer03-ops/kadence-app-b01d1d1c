import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Mail, UserPlus, Users, UserX, MoreHorizontal, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { roleColors, type Role } from "@/lib/role-colors";
import { InviteEmployeeModal } from "@/components/InviteEmployeeModal";
import { InvitationsList } from "@/components/InvitationsList";
import { useBusinessRoles } from "@/hooks/use-business-roles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/staff/")({
  component: StaffPage,
  head: () => ({ meta: [{ title: "Staff — Kadence" }] }),
});

interface ProfileRow {
  id: string; first_name: string; last_name: string; email: string; phone: string | null;
  contract: string | null; studio_id: string | null; status: string;
  score: number | null; quota_used: number | null; quota_max: number | null;
  avatar_url: string | null;
}
interface StudioRow { id: string; name: string; }

const initials = (f: string, l: string) => `${(f?.[0] || "").toUpperCase()}${(l?.[0] || "").toUpperCase()}`;

type AppRole = "admin" | "manager" | "employee";

function StaffPage() {
  const [tab, setTab] = useState<"employees" | "suspended" | "invitations">("employees");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, Role[]>>({});
  const [appRoleByUser, setAppRoleByUser] = useState<Record<string, AppRole>>({});
  const [shiftCountByUser, setShiftCountByUser] = useState<Record<string, number>>({});
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [search, setSearch] = useState("");
  const [contractFilters, setContractFilters] = useState<Set<string>>(new Set());
  const [studioFilters, setStudioFilters] = useState<Set<string>>(new Set());
  const [roleFilters, setRoleFilters] = useState<Set<string>>(new Set());
  const [appRoleFilters, setAppRoleFilters] = useState<Set<AppRole>>(new Set());
  const [sortScore, setSortScore] = useState<"none" | "desc" | "asc">("none");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ p: ProfileRow; action: "deactivate" | "reactivate" } | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: ps }, { data: br }, { data: sts }, { data: shifts }, { data: ar }] = await Promise.all([
        supabase.from("profiles").select("id,first_name,last_name,email,phone,contract,studio_id,status,score,quota_used,quota_max,avatar_url"),
        supabase.from("user_business_roles").select("user_id,role"),
        supabase.from("studios").select("id,name").order("name"),
        supabase.from("shifts").select("user_id,shift_date").gte("shift_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      setProfiles(ps || []);
      const map: Record<string, Role[]> = {};
      (br || []).forEach(r => { (map[r.user_id] ||= []).push(r.role as Role); });
      setRolesByUser(map);
      const arMap: Record<string, AppRole> = {};
      const rank: Record<string, number> = { admin: 3, manager: 2, employee: 1 };
      (ar || []).forEach((r: { user_id: string; role: string }) => {
        const cur = arMap[r.user_id];
        if (!cur || (rank[r.role] || 0) > (rank[cur] || 0)) arMap[r.user_id] = r.role as AppRole;
      });
      setAppRoleByUser(arMap);
      setStudios(sts || []);
      const counts: Record<string, number> = {};
      (shifts || []).forEach(s => { if (s.user_id) counts[s.user_id] = (counts[s.user_id] || 0) + 1; });
      setShiftCountByUser(counts);
    };
    load();
    const channel = supabase.channel("staff-list-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const studioName = (id: string | null) => studios.find(s => s.id === id)?.name || "—";

  const activeCount = useMemo(() => profiles.filter(p => p.status !== "suspended").length, [profiles]);
  const inactiveCount = useMemo(() => profiles.filter(p => p.status === "suspended").length, [profiles]);

  const filtered = useMemo(() => {
    const byStatus = profiles.filter(p =>
      tab === "suspended" ? p.status === "suspended" : p.status !== "suspended"
    );
    const list = byStatus.filter(p => {
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
    } else {
      list.sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`,
          "fr",
          { sensitivity: "base" },
        ),
      );
    }
    return list;
  }, [profiles, tab, search, contractFilters, studioFilters, roleFilters, sortScore, rolesByUser]);

  const toggle = (set: Set<string>, fn: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    fn(next);
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    const { p, action } = confirmTarget;
    const newStatus = action === "deactivate" ? "suspended" : "active";
    const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("id", p.id);
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      toast.success(
        action === "deactivate"
          ? `${p.first_name} ${p.last_name} désactivé·e`
          : `${p.first_name} ${p.last_name} réactivé·e`
      );
      setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, status: newStatus } : x));
    }
    setConfirmTarget(null);
  };

  const contracts = ["etudiant", "flexi", "cdi", "cdd"];
  const contractLabels: Record<string, string> = { etudiant: "Étudiants", flexi: "Flexis", cdi: "CDI", cdd: "CDD" };
  const { names: businessRoleOptionsRaw } = useBusinessRoles({ onlyActive: true });
  const businessRoleOptions = businessRoleOptionsRaw as Role[];

  const isInactiveTab = tab === "suspended";

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-1 mb-5 border-b" style={{ borderColor: "var(--border)" }}>
        {[
          { key: "employees" as const, label: `Employés · ${activeCount}`, Icon: Users },
          { key: "suspended" as const, label: `Désactivés · ${inactiveCount}`, Icon: UserX },
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
            <div className="flex items-center gap-2 rounded-md border px-3 w-full md:w-auto" style={{ height: 32, borderColor: "var(--border)", backgroundColor: "var(--card)", maxWidth: 240 }}>
              <Search size={14} style={{ color: "var(--muted-foreground)" }} />
              <input type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
                className="border-0 bg-transparent outline-none flex-1" style={{ fontSize: 12 }} />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {(() => {
                const noFilter = contractFilters.size === 0 && studioFilters.size === 0 && roleFilters.size === 0;
                return (
                  <button
                    onClick={() => { setContractFilters(new Set()); setStudioFilters(new Set()); setRoleFilters(new Set()); }}
                    className="rounded-full px-2.5 py-1"
                    style={{ fontSize: 12, fontWeight: noFilter ? 500 : 400,
                      backgroundColor: noFilter ? "var(--foreground)" : "transparent",
                      color: noFilter ? "var(--card)" : "var(--muted-foreground)",
                      border: noFilter ? "none" : "0.5px solid var(--border)" }}>
                    Tous · {isInactiveTab ? inactiveCount : activeCount}
                  </button>
                );
              })()}
              <span className="mx-2" style={{ width: 1, height: 16, backgroundColor: "var(--border)", display: "inline-block" }} />
              {contracts.map(c => {
                const a = contractFilters.has(c);
                const count = profiles.filter(p => p.contract === c && (isInactiveTab ? p.status === "suspended" : p.status !== "suspended")).length;
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
              {studios.map(s => {
                const a = studioFilters.has(s.id);
                const count = profiles.filter(p => p.studio_id === s.id && (isInactiveTab ? p.status === "suspended" : p.status !== "suspended")).length;
                return (
                  <button key={s.id} onClick={() => toggle(studioFilters, setStudioFilters, s.id)}
                    className="rounded-full px-2.5 py-1"
                    style={{ fontSize: 12, fontWeight: a ? 500 : 400,
                      backgroundColor: a ? "var(--foreground)" : "transparent",
                      color: a ? "var(--card)" : "var(--muted-foreground)",
                      border: a ? "none" : "0.5px solid var(--border)" }}>
                    {s.name.replace("Skult ", "")} · {count}
                  </button>
                );
              })}
              <span className="mx-2" style={{ width: 1, height: 16, backgroundColor: "var(--border)", display: "inline-block" }} />
              {businessRoleOptions.map(r => {
                const a = roleFilters.has(r);
                const count = profiles.filter(p => (rolesByUser[p.id] || []).includes(r) && (isInactiveTab ? p.status === "suspended" : p.status !== "suspended")).length;
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
              {!isInactiveTab && (
                <button onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5"
                  style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                  <UserPlus size={13} /> Inviter
                </button>
              )}
            </div>
          </div>


          <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            <table className="w-full" style={{ fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
                  {[
                    { h: "Nom", cls: "" },
                    { h: "Contrat", cls: "hidden sm:table-cell" },
                    { h: "Postes", cls: "" },
                    { h: "Score", cls: "hidden md:table-cell" },
                    
                    { h: "Shifts 30j", cls: "hidden md:table-cell" },
                    { h: "", cls: "" },
                  ].map(({ h, cls }, i) => (
                    <th key={h || `c${i}`} className={`text-left px-4 py-2.5 ${cls}`} style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>{h}</th>
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
                  const isInactive = p.status === "suspended";
                  return (
                    <tr key={p.id} style={{ borderBottom: "0.5px solid var(--border)", cursor: "pointer", opacity: isInactive ? 0.65 : 1 }}
                      onClick={() => window.location.assign(`/staff/${p.id}`)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center rounded-full shrink-0 overflow-hidden" style={{ width: 30, height: 30, backgroundColor: rc.bg, color: rc.text, fontSize: 10, fontWeight: 500 }}>
                            {p.avatar_url
                              ? <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : initials(p.first_name, p.last_name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{p.first_name} {p.last_name}</div>
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{studioName(p.studio_id).replace("Skult ", "")}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
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
                      <td className="px-4 py-3 hidden md:table-cell" style={{ fontWeight: 500, color: scoreColor }}>{score || "—"}</td>
                      <td className="px-4 py-3 hidden md:table-cell" style={{ fontWeight: 500 }}>{shiftCountByUser[p.id] || 0}</td>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()} style={{ width: 40 }}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="inline-flex items-center justify-center rounded-md hover:bg-[var(--muted)]"
                              style={{ width: 28, height: 28, color: "var(--muted-foreground)" }}
                              aria-label="Actions"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isInactive ? (
                              <DropdownMenuItem onClick={() => setConfirmTarget({ p, action: "reactivate" })}>
                                <UserCheck size={13} className="mr-2" /> Réactiver
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setConfirmTarget({ p, action: "deactivate" })}
                                style={{ color: "var(--danger-text)" }}
                              >
                                <UserX size={13} className="mr-2" /> Désactiver
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                    {isInactiveTab ? "Aucun employé désactivé." : "Aucun employé."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget?.action === "deactivate" ? "Désactiver cet employé ?" : "Réactiver cet employé ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.action === "deactivate"
                ? `${confirmTarget?.p.first_name} ${confirmTarget?.p.last_name} n'apparaîtra plus dans le planning ni dans la liste active. Tu pourras le réactiver à tout moment depuis l'onglet "Désactivés".`
                : `${confirmTarget?.p.first_name} ${confirmTarget?.p.last_name} reviendra dans la liste active et pourra être assigné à des shifts.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {confirmTarget?.action === "deactivate" ? "Désactiver" : "Réactiver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
