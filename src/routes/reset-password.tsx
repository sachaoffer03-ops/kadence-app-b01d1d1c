import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Nouveau mot de passe — Kadence" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const url = new URL(window.location.href);

        // Erreurs renvoyées par Supabase dans le hash (lien expiré, etc.)
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const hashError = hash.get("error_description") || hash.get("error");
        if (hashError) {
          setErrorMsg(decodeURIComponent(hashError).replace(/\+/g, " "));
          return;
        }

        // PKCE flow : ?code=xxx
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setErrorMsg("Le lien a expiré ou a déjà été utilisé. Demandez un nouvel email.");
            return;
          }
          // Nettoyer l'URL
          window.history.replaceState({}, "", "/reset-password");
        }

        // Hash flow : #access_token=...&type=recovery
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setErrorMsg("Le lien a expiré ou a déjà été utilisé. Demandez un nouvel email.");
            return;
          }
          window.history.replaceState({}, "", "/reset-password");
        }

        // Vérifier qu'on a bien une session
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setErrorMsg("Lien invalide ou expiré. Demandez un nouvel email de réinitialisation.");
          return;
        }
        setReady(true);
      } catch {
        setErrorMsg("Une erreur est survenue. Demandez un nouvel email.");
      }
    };
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 1) return toast.error("Choisissez un mot de passe");
    if (password !== confirm) return toast.error("Les mots de passe ne correspondent pas");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Mot de passe mis à jour");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-md">
        <h1 className="text-center mb-6" style={{ fontSize: 24, fontWeight: 500 }}>Nouveau mot de passe</h1>

        {errorMsg ? (
          <div className="rounded-lg border p-6 text-center space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>{errorMsg}</p>
            <button onClick={() => navigate({ to: "/login" })} className="w-full rounded-md py-2.5"
              style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              Retour à la connexion
            </button>
          </div>
        ) : !ready ? (
          <p className="text-center" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Vérification du lien…</p>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Nouveau mot de passe</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2"
                style={{ fontSize: 14, borderColor: "var(--border)", backgroundColor: "var(--background)" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Confirmer</label>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2"
                style={{ fontSize: 14, borderColor: "var(--border)", backgroundColor: "var(--background)" }} />
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-md py-2.5"
              style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              {loading ? "..." : "Mettre à jour"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
