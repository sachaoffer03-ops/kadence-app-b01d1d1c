import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { getAppMode } from "@/lib/app-mode";

type AppRole = "admin" | "manager" | "employee";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  appRole: AppRole | null;
  /** Manager-only permissions (route prefixes). null = admin (all). [] = no access yet. */
  managerPermissions: string[] | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  const [managerPermissions, setManagerPermissions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadingTimeout = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 1500);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setTimeout(() => fetchRole(newSession.user.id), 0);
      } else {
        setAppRole(null);
        setManagerPermissions(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!active) return;
      setSession(s);
      if (s?.user) fetchRole(s.user.id);
      setLoading(false);
      window.clearTimeout(loadingTimeout);
    }).catch(() => {
      if (!active) return;
      setSession(null);
      setAppRole(null);
      setManagerPermissions(null);
      setLoading(false);
      window.clearTimeout(loadingTimeout);
    });

    return () => {
      active = false;
      window.clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (data ?? []).map((r) => r.role as AppRole);
    const hasAdmin = roles.includes("admin");
    const hasManager = roles.includes("manager");
    const hasEmployee = roles.includes("employee");

    // Role est contextuel à l'espace : un utilisateur ayant plusieurs rôles
    // (ex: manager + employee) doit utiliser le rôle qui correspond au domaine.
    const mode = typeof window !== "undefined" ? getAppMode() : "admin";
    let role: AppRole = "employee";
    if (mode === "employee") {
      if (hasEmployee) role = "employee";
      else if (hasAdmin) role = "admin";
      else if (hasManager) role = "manager";
    } else {
      if (hasAdmin) role = "admin";
      else if (hasManager) role = "manager";
      else role = "employee";
    }
    setAppRole(role);

    if (role === "admin") setManagerPermissions(null);
    else if (role === "manager") {
      const { data: perm } = await supabase
        .from("manager_permissions")
        .select("permissions")
        .eq("user_id", userId)
        .maybeSingle();
      setManagerPermissions((perm?.permissions as string[] | null) ?? []);
    } else {
      setManagerPermissions([]);
    }
  };

  // Live updates of manager permissions
  useEffect(() => {
    if (!session?.user || appRole !== "manager") return;
    const channel = supabase
      .channel(`my_manager_perms_${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "manager_permissions", filter: `user_id=eq.${session.user.id}` },
        async () => {
          const { data: perm } = await supabase
            .from("manager_permissions")
            .select("permissions")
            .eq("user_id", session.user.id)
            .maybeSingle();
          setManagerPermissions((perm?.permissions as string[] | null) ?? []);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, appRole]);

  // Live updates of role
  useEffect(() => {
    if (!session?.user) return;
    const channel = supabase
      .channel(`my_role_${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${session.user.id}` },
        () => fetchRole(session.user.id),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAppRole(null);
    setManagerPermissions(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, appRole, managerPermissions, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

