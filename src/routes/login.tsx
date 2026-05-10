import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import logo from "@/assets/kadence-logo.png";

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

  const onSubmit = mode === "login" ? handleLogin : handleForgot;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="w-full max-w-[400px]">
        <div className="mb-10 flex flex-col items-center">
          <img
            src={logo}
            alt="Kadence"
            style={{ height: 36, width: "auto", objectFit: "contain" }}
          />
          <p
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginTop: 10,
              letterSpacing: "0.02em",
            }}
          >
            Skult Studios
          </p>
        </div>

        <div
          className="rounded-2xl border p-7"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <h2 style={{ fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em" }}>
            {mode === "login" ? "Connexion" : "Mot de passe oublié"}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--muted-foreground)",
              marginTop: 4,
              marginBottom: 22,
            }}
          >
            {mode === "login"
              ? "Connectez-vous à votre compte"
              : "Entrez votre email pour recevoir un lien"}
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                }}
              >
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-md border px-3 py-2.5 outline-none transition-colors focus:border-[var(--foreground)]"
                style={{
                  fontSize: 14,
                  borderColor: "var(--border)",
                  backgroundColor: "var(--background)",
                }}
              />
            </div>

            {mode === "login" && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--muted-foreground)",
                  }}
                >
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-md border px-3 py-2.5 outline-none transition-colors focus:border-[var(--foreground)]"
                  style={{
                    fontSize: 14,
                    borderColor: "var(--border)",
                    backgroundColor: "var(--background)",
                  }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md py-2.5 mt-2 disabled:opacity-50 transition-opacity"
              style={{
                fontSize: 14,
                fontWeight: 500,
                backgroundColor: "var(--foreground)",
                color: "var(--card)",
              }}
            >
              {loading
                ? "..."
                : mode === "login"
                ? "Se connecter"
                : "Envoyer le lien"}
            </button>

            <div className="flex justify-center pt-1">
              {mode === "login" ? (
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  style={{
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                  }}
                  className="hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  style={{
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                  }}
                  className="hover:underline"
                >
                  Retour à la connexion
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
