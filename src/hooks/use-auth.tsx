import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AppRole = "admin" | "manager" | "employee";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  appRole: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadingTimeout = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        // Defer role fetch to avoid deadlocks
        setTimeout(() => fetchRole(newSession.user.id), 0);
      } else {
        setAppRole(null);
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
    if (data && data.length > 0) {
      // Priority: admin > manager > employee
      const roles = data.map((r) => r.role as AppRole);
      if (roles.includes("admin")) setAppRole("admin");
      else if (roles.includes("manager")) setAppRole("manager");
      else setAppRole("employee");
    } else {
      setAppRole("employee");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAppRole(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, appRole, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
