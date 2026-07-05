import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import logo from "@/assets/kadence-logo.png";
import { getAppMode, getOtherSpaceUrl, setPreviewMode, type AppMode } from "@/lib/app-mode";
import { requestPasswordReset } from "@/lib/auth-email.functions";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s.mode === "employee" || s.mode === "app" || s.mode === "admin" ? s.mode : undefined,
    email: typeof s.email === "string" ? s.email : undefined,
  }),
  head: () => ({ meta: [{ title: "Connexion — Kadence" }] }),
});

function LoginPage() {
  const { mode: searchMode, email: searchEmail } = Route.useSearch();
  const navigate = useNavigate();
  const { session, appRole, loading: authLoading } = useAuth();
  const [email, setEmail] = useState(searchEmail ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [appMode, setAppMode] = useState<AppMode>(searchMode === "employee" || searchMode === "app" ? "employee" : "admin");
  const [showPreviewSwitch, setShowPreviewSwitch] = useState(false);

  useEffect(() => {
    setAppMode(getAppMode());
    setShowPreviewSwitch(!window.location.hostname.includes("kadence.be"));
  }, []);

  useEffect(() => {
    if (authLoading || !session) return;

    const checkAccess = async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const roles = (data ?? []).map((r) => r.role as "admin" | "manager" | "employee");
      const hasEmployee = roles.includes("employee");
      const hasAdminOrManager = roles.includes("admin") || roles.includes("manager");
      const currentMode = getAppMode();
      const isEmployeeSpace = currentMode === "employee";

      if (isEmployeeSpace && !hasEmployee && !hasAdminOrManager) {
        toast.error("Compte sans accès. Contactez un administrateur.");
        await supabase.auth.signOut();
        return;
      }
      // Manager/admin pur sur l'espace employé → on bascule vers admin au lieu de bloquer
      if (isEmployeeSpace && !hasEmployee && hasAdminOrManager) {
        toast.info("Compte manager — redirection vers la console admin…");
        window.location.replace("https://admin.kadence.be/login");
        return;
      }
      if (!isEmployeeSpace && !hasAdminOrManager) {
        toast.error("Ce compte est employé. Connectez-vous sur app.kadence.be");
        await supabase.auth.signOut();
        window.location.replace("https://app.kadence.be/login");
        return;
      }
      // Multi-rôles : on signale clairement que l'autre espace est dispo
      if (hasEmployee && hasAdminOrManager) {
        const otherUrl = isEmployeeSpace
          ? "https://admin.kadence.be"
          : "https://app.kadence.be";
        const otherLabel = isEmployeeSpace ? "Console admin" : "Espace employé";
        toast(`${otherLabel} disponible aussi`, {
          description: "Tu as plusieurs accès — tu peux basculer à tout moment.",
          action: { label: "Ouvrir", onClick: () => window.open(otherUrl, "_blank") },
          duration: 7000,
        });
      }
      // Navigation SPA : en navigation privée / stockage bloqué, la session peut
      // être gardée uniquement en mémoire. Un reload plein écran la perdrait.
      navigate({ to: isEmployeeSpace ? "/staff-app" : "/dashboard", replace: true });
    };
    checkAccess();
  }, [authLoading, session, appMode, navigate]);

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
    try {
      await requestPasswordReset({
        data: {
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      toast.success("Si un compte existe, un email de réinitialisation a été envoyé");
      setMode("login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
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
          <img src={logo} alt="Kadence" style={{ height: 130, width: "auto", objectFit: "contain" }} />
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

        <div className="mt-5 text-center">
          <a
            href="https://app.kadence.be/login"
            style={{ fontSize: 12, color: "var(--muted-foreground)" }}
            className="hover:underline"
          >
            Vous êtes employé ? Espace employé →
          </a>
        </div>

      </div>
    </div>
  );
}

function EmployeeLogin(p: FormProps) {
  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ backgroundColor: "var(--background)" }}
    >
      {/* halo coral décoratif en haut */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: -160,
          right: -120,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(240,153,123,0.28) 0%, rgba(240,153,123,0) 70%)",
          filter: "blur(10px)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: -180,
          left: -140,
          width: 380,
          height: 380,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(240,153,123,0.18) 0%, rgba(240,153,123,0) 70%)",
          filter: "blur(10px)",
        }}
      />

      <div className="relative flex-1 flex flex-col justify-center px-6">
        <div className="max-w-[400px] w-full mx-auto">
          <div className="flex flex-col items-center text-center mb-10">
            <img
              src={logo}
              alt="Kadence"
              style={{ height: 88, width: "auto", objectFit: "contain" }}
            />
            <h1
              style={{
                fontSize: 26,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                marginTop: 28,
                lineHeight: 1.2,
              }}
            >
              Bonjour
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--muted-foreground)",
                marginTop: 6,
              }}
            >
              {p.mode === "login"
                ? "Connectez-vous à votre espace"
                : "Réinitialisez votre mot de passe"}
            </p>
          </div>

          <form onSubmit={p.onSubmit} className="space-y-3.5">
            <Field label="Email" type="email" value={p.email} onChange={p.setEmail} large />
            {p.mode === "login" && (
              <Field
                label="Mot de passe"
                type="password"
                value={p.password}
                onChange={p.setPassword}
                large
              />
            )}

            <button
              type="submit"
              disabled={p.loading}
              className="w-full rounded-2xl mt-2 disabled:opacity-50 transition-all active:scale-[0.98]"
              style={{
                fontSize: 15,
                fontWeight: 500,
                padding: "16px 0",
                backgroundColor: "#F0997B",
                color: "#fff",
                boxShadow: "0 12px 28px -14px rgba(240, 153, 123, 0.7)",
              }}
            >
              {p.loading ? "..." : p.mode === "login" ? "Se connecter" : "Envoyer le lien"}
            </button>

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => p.setMode(p.mode === "login" ? "forgot" : "login")}
                style={{ fontSize: 13, color: "var(--muted-foreground)" }}
                className="hover:underline"
              >
                {p.mode === "login" ? "Mot de passe oublié ?" : "Retour à la connexion"}
              </button>
            </div>
          </form>

        </div>
      </div>

      <p
        className="relative text-center pb-6"
        style={{
          fontSize: 11,
          color: "var(--muted-foreground)",
          letterSpacing: "0.08em",
        }}
      >
        Skult Studios · Brussels
      </p>
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
