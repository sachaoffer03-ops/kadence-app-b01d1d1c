import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Connexion — Kadence" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, appRole, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");

  useEffect(() => {
    if (!authLoading && session && appRole) {
      const target = appRole === "employee" ? "/staff-app" : "/dashboard";
      navigate({ to: target });
    }
  }, [authLoading, session, appRole, navigate]);

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

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.01em" }}>Kadence</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>Skult Studios</p>
        </div>

        <div className="rounded-lg border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
            {mode === "login" ? "Connexion" : "Mot de passe oublié"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 20 }}>
            {mode === "login" ? "Connectez-vous à votre compte" : "Entrez votre email pour recevoir un lien"}
          </p>

          <form onSubmit={mode === "login" ? handleLogin : handleForgot} className="space-y-4">
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 outline-none"
                style={{ fontSize: 14, borderColor: "var(--border)", backgroundColor: "var(--background)" }}
              />
            </div>

            {mode === "login" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>Mot de passe</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border px-3 py-2 outline-none"
                  style={{ fontSize: 14, borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md py-2.5 disabled:opacity-50"
              style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
            >
              {loading ? "..." : mode === "login" ? "Se connecter" : "Envoyer le lien"}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "forgot" : "login")}
                style={{ fontSize: 12, color: "var(--muted-foreground)", textDecoration: "underline" }}
              >
                {mode === "login" ? "Mot de passe oublié ?" : "Retour à la connexion"}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center mt-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          Pas encore de compte ? Demandez une invitation à votre administrateur.
        </p>
      </div>
    </div>
  );
}
