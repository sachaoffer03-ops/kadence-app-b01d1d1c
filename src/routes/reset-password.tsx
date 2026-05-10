import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Minimum 8 caractères");
    if (password !== confirm) return toast.error("Les mots de passe ne correspondent pas");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Mot de passe mis à jour");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-md">
        <h1 className="text-center mb-6" style={{ fontSize: 24, fontWeight: 500 }}>Nouveau mot de passe</h1>
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
      </div>
    </div>
  );
}
