import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import logo from "@/assets/kadence-logo.png";
import { getAppMode, getOtherSpaceUrl, setPreviewMode, type AppMode } from "@/lib/app-mode";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s.mode === "employee" || s.mode === "app" || s.mode === "admin" ? s.mode : undefined,
  }),
  head: () => ({ meta: [{ title: "Connexion — Kadence" }] }),
});

function LoginPage() {
  const { mode: searchMode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, appRole, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [appMode, setAppMode] = useState<AppMode>(searchMode === "employee" || searchMode === "app" ? "employee" : "admin");
  const [showPreviewSwitch, setShowPreviewSwitch] = useState(false);

  useEffect(() => {
    setAppMode(getAppMode());
    setShowPreviewSwitch(!window.location.hostname.includes("shyft.flashsite.fr"));
  }, []);

  useEffect(() => {
    if (!authLoading && session && appRole) {
      // Vérifier la cohérence rôle / espace
      const isEmployeeSpace = appMode === "employee";
      const userIsEmployee = appRole === "employee";

      if (isEmployeeSpace && !userIsEmployee) {
        toast.error("Cet espace est réservé aux employés. Connectez-vous sur admin.shyft.flashsite.fr");
        supabase.auth.signOut();
        return;
      }
      if (!isEmployeeSpace && userIsEmployee) {
        toast.error("Cet espace est réservé aux administrateurs. Connectez-vous sur app.shyft.flashsite.fr");
        supabase.auth.signOut();
        return;
      }
      navigate({ to: userIsEmployee ? "/staff-app" : "/dashboard" });
    }
  }, [authLoading, session, appRole, appMode, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Email ou mot de passe incorrect" : error.message);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Email de réinitialisation envoyé");
      setMode("login");
    }
  };

  const onSubmit = mode === "login" ? handleLogin : handleForgot;

  if (appMode === "employee") {
    return (
      <EmployeeLogin
        email={email} setEmail={setEmail}
        password={password} setPassword={setPassword}
        loading={loading} mode={mode} setMode={setMode}
        onSubmit={onSubmit}
      />
    );
  }

  return (
    <AdminLogin
      email={email} setEmail={setEmail}
      password={password} setPassword={setPassword}
      loading={loading} mode={mode} setMode={setMode}
      onSubmit={onSubmit}
      isLovablePreview={showPreviewSwitch}
      onSwitchPreview={() => { setPreviewMode("employee"); window.location.search = "?mode=employee"; }}
    />
  );
}

interface FormProps {
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  loading: boolean;
  mode: "login" | "forgot";
  setMode: (m: "login" | "forgot") => void;
  onSubmit: (e: React.FormEvent) => void;
}

interface AdminFormProps extends FormProps {
  isLovablePreview: boolean;
  onSwitchPreview: () => void;
}

function AdminLogin(p: AdminFormProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-[400px]">
        <div className="mb-10 flex flex-col items-center">
          <img src={logo} alt="Kadence" style={{ height: 80, width: "auto", objectFit: "contain" }} />
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 10, letterSpacing: "0.02em" }}>
            Espace administrateur · Skult Studios
          </p>
        </div>

        <div className="rounded-2xl border p-7" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <h2 style={{ fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em" }}>
            {p.mode === "login" ? "Connexion" : "Mot de passe oublié"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4, marginBottom: 22 }}>
            {p.mode === "login" ? "Accédez à votre espace de gestion" : "Entrez votre email pour recevoir un lien"}
          </p>

          <form onSubmit={p.onSubmit} className="space-y-4">
            <Field label="Email" type="email" value={p.email} onChange={p.setEmail} />
            {p.mode === "login" && (
              <Field label="Mot de passe" type="password" value={p.password} onChange={p.setPassword} />
            )}

            <button type="submit" disabled={p.loading}
              className="w-full rounded-md py-2.5 mt-2 disabled:opacity-50 transition-opacity"
              style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              {p.loading ? "..." : p.mode === "login" ? "Se connecter" : "Envoyer le lien"}
            </button>

            <div className="flex justify-center pt-1">
              <button type="button" onClick={() => p.setMode(p.mode === "login" ? "forgot" : "login")}
                style={{ fontSize: 12, color: "var(--muted-foreground)" }} className="hover:underline">
                {p.mode === "login" ? "Mot de passe oublié ?" : "Retour à la connexion"}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}

function EmployeeLogin(p: FormProps) {
  return (
    <div className="min-h-screen flex flex-col px-5 py-8"
      style={{ backgroundColor: "var(--background)" }}>
      <div className="flex-1 flex flex-col justify-center max-w-[440px] w-full mx-auto">
        <div className="mb-8">
          <img src={logo} alt="Kadence" style={{ height: 72, width: "auto", objectFit: "contain" }} />
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 28, lineHeight: 1.2 }}>
            Bonjour 👋
          </h1>
          <p style={{ fontSize: 15, color: "var(--muted-foreground)", marginTop: 6 }}>
            {p.mode === "login" ? "Connectez-vous à votre espace équipe" : "On vous envoie un lien pour réinitialiser"}
          </p>
        </div>

        <form onSubmit={p.onSubmit} className="space-y-4">
          <Field label="Email" type="email" value={p.email} onChange={p.setEmail} large />
          {p.mode === "login" && (
            <Field label="Mot de passe" type="password" value={p.password} onChange={p.setPassword} large />
          )}

          <button type="submit" disabled={p.loading}
            className="w-full rounded-xl mt-3 disabled:opacity-50 transition-all active:scale-[0.98]"
            style={{ fontSize: 16, fontWeight: 500, padding: "16px 0", backgroundColor: "#F0997B", color: "#fff" }}>
            {p.loading ? "..." : p.mode === "login" ? "Se connecter" : "Envoyer le lien"}
          </button>

          <div className="flex justify-center pt-2">
            <button type="button" onClick={() => p.setMode(p.mode === "login" ? "forgot" : "login")}
              style={{ fontSize: 13, color: "var(--muted-foreground)" }} className="hover:underline">
              {p.mode === "login" ? "Mot de passe oublié ?" : "Retour à la connexion"}
            </button>
          </div>
        </form>
      </div>

      <div className="pb-2" />
    </div>
  );
}

function Field({ label, type, value, onChange, large }: {
  label: string; type: string; value: string; onChange: (v: string) => void; large?: boolean;
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border outline-none transition-colors focus:border-[var(--foreground)]"
        style={{
          fontSize: large ? 16 : 14,
          padding: large ? "14px 14px" : "10px 12px",
          borderColor: "var(--border)",
          backgroundColor: "var(--background)",
        }}
      />
    </div>
  );
}
