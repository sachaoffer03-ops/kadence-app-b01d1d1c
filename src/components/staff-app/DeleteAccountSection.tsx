import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { deleteMyAccount } from "@/lib/account-deletion.functions";
import { supabase } from "@/integrations/supabase/client";

const DANGER = "#B4231B";

export function DeleteAccountSection({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const runDelete = useServerFn(deleteMyAccount);

  const target = (email ?? "").trim().toLowerCase();
  const matches = target.length > 0 && typed.trim().toLowerCase() === target;

  const confirm = async () => {
    if (!matches || busy) return;
    setBusy(true);
    try {
      await runDelete({ data: { emailConfirmation: typed.trim() } });
      await supabase.auth.signOut();
      if (typeof window !== "undefined") window.location.replace("/compte-supprime");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "La suppression a échoué");
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className="rounded-xl border p-4 mt-6"
        style={{ backgroundColor: "#FDF3F2", borderColor: "rgba(180,35,27,0.18)" }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} style={{ color: DANGER }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: DANGER }}>Zone de danger</span>
        </div>
        <div style={{ fontSize: 11.5, color: "rgba(180,35,27,0.75)", marginTop: 4 }}>
          Actions irréversibles
        </div>
        <button
          onClick={() => { setTyped(""); setOpen(true); }}
          className="w-full rounded-lg border px-4 py-2.5 mt-3"
          style={{ fontSize: 13, color: DANGER, borderColor: DANGER, backgroundColor: "transparent" }}
        >
          Supprimer mon compte
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 flex items-end sm:items-center justify-center"
          style={{ zIndex: 80, backgroundColor: "rgba(0,0,0,0.45)", padding: 12 }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-2xl overflow-y-auto"
            style={{
              maxWidth: 420,
              maxHeight: "85dvh",
              backgroundColor: "#fff",
              padding: 20,
              paddingBottom: `calc(20px + env(safe-area-inset-bottom))`,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 500, color: DANGER }}>
              Supprimer votre compte Kadence ?
            </div>

            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--muted-foreground)", marginTop: 12 }}>
              <p>Cette action est définitive et prendra effet sous 30 jours.</p>
              <p style={{ marginTop: 10 }}>
                <strong style={{ fontWeight: 500, color: "var(--foreground)" }}>
                  Seront supprimés immédiatement
                </strong>{" "}
                : votre profil (nom, photo, email, téléphone, adresse, IBAN, documents personnels) et votre
                accès à l'application.
              </p>
              <p style={{ marginTop: 10 }}>
                <strong style={{ fontWeight: 500, color: "var(--foreground)" }}>
                  Seront conservés anonymisés pendant 7 ans
                </strong>{" "}
                (obligation légale belge) : votre historique de shifts, pointages et clôtures — sans aucun lien
                avec votre identité.
              </p>
              <p style={{ marginTop: 10 }}>
                Pour confirmer, retapez votre adresse email :{" "}
                <strong style={{ fontWeight: 500, color: "var(--foreground)" }}>{email ?? "—"}</strong>
              </p>
            </div>

            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="votre@email.be"
              className="w-full rounded-lg border px-3 py-2.5 mt-3"
              style={{ fontSize: 16, borderColor: "rgba(0,0,0,0.14)", backgroundColor: "#fff" }}
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex-1 rounded-lg border px-4 py-2.5"
                style={{ fontSize: 13, borderColor: "rgba(0,0,0,0.12)", backgroundColor: "#fff" }}
              >
                Annuler
              </button>
              <button
                onClick={confirm}
                disabled={!matches || busy}
                className="flex-1 rounded-lg px-4 py-2.5"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#fff",
                  backgroundColor: matches && !busy ? DANGER : "rgba(180,35,27,0.35)",
                  cursor: matches && !busy ? "pointer" : "not-allowed",
                }}
              >
                {busy ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
