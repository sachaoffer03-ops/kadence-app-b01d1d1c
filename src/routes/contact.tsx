import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { MarketingLayout, Section, Eyebrow, Lead, APP_URL } from "@/components/marketing/MarketingLayout";
import { submitDemoRequest } from "@/lib/marketing.functions";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Demander une démo — Kadence" },
      {
        name: "description",
        content:
          "Parlez-nous de votre équipe et de vos établissements : on vous montre Kadence en 20 minutes et on vous envoie un tarif adapté.",
      },
      { property: "og:title", content: "Demander une démo — Kadence" },
      { property: "og:description", content: "Une démo de 20 minutes, puis un tarif adapté à votre organisation." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadence.be/contact" },
    ],
    links: [{ rel: "canonical", href: "https://kadence.be/contact" }],
  }),
});

const TEAM_SIZES = ["1 – 5", "6 – 15", "16 – 40", "40 +"];

function ContactPage() {
  const submit = useServerFn(submitDemoRequest);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await submit({ data: { name, email, company, teamSize, message } });
      if (res.ok) {
        setSent(true);
      } else if (res.reason === "rate_limited") {
        toast.error("Vous avez déjà envoyé plusieurs demandes. On vous répond très vite.");
      } else {
        toast.error("Envoi impossible pour le moment. Réessayez dans un instant.");
      }
    } catch {
      toast.error("Envoi impossible pour le moment. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MarketingLayout>
      <Section>
        <div className="grid gap-14 md:grid-cols-2">
          <div>
            <Eyebrow>Contact</Eyebrow>
            <h1
              style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.14 }}
            >
              Demander une démo
            </h1>
            <Lead>
              Dites-nous en deux lignes comment votre équipe fonctionne aujourd'hui. On vous montre Kadence sur votre
              propre cas, en 20 minutes, sans engagement.
            </Lead>

            <div className="mt-10 flex flex-col gap-3">
              {[
                "Démo personnalisée de 20 minutes",
                "Tarif adapté envoyé sous 48 h",
                "Aucune carte bancaire demandée",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2.5">
                  <Check size={15} style={{ color: "var(--coral-dark)" }} />
                  <span style={{ fontSize: 14, color: "var(--muted-foreground)" }}>{t}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 28, lineHeight: 1.7 }}>
              Vous êtes déjà client&nbsp;?{" "}
              <a href={APP_URL} style={{ color: "var(--coral-dark)" }}>
                Connectez-vous ici
              </a>
              .
            </p>
          </div>

          <div
            className="rounded-2xl border p-7"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            {sent ? (
              <div className="py-10 text-center flex flex-col items-center">
                <div
                  className="rounded-full flex items-center justify-center mb-5"
                  style={{ width: 48, height: 48, backgroundColor: "var(--coral-light)" }}
                >
                  <Check size={20} style={{ color: "var(--coral-dark)" }} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 500 }}>Demande envoyée</div>
                <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 10, lineHeight: 1.7, maxWidth: 320 }}>
                  Merci. Nous revenons vers vous par email sous 48 heures pour convenir d'un créneau.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <Field label="Nom et prénom" value={name} onChange={setName} required maxLength={120} />
                <Field label="Email professionnel" type="email" value={email} onChange={setEmail} required maxLength={255} />
                <Field label="Entreprise" value={company} onChange={setCompany} maxLength={160} />

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>
                    Taille de l'équipe
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TEAM_SIZES.map((s) => {
                      const active = teamSize === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setTeamSize(active ? "" : s)}
                          className="rounded-full px-4 py-2 border transition-colors"
                          style={{
                            fontSize: 13,
                            borderColor: active ? "var(--coral)" : "var(--border)",
                            backgroundColor: active ? "var(--coral-light)" : "transparent",
                            color: active ? "var(--coral-dark)" : "var(--foreground)",
                            fontWeight: active ? 500 : 400,
                          }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>Message</label>
                  <textarea
                    value={message}
                    maxLength={1500}
                    rows={4}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Combien d'établissements, comment vous faites le planning aujourd'hui…"
                    className="mt-1.5 w-full rounded-md border outline-none transition-colors focus:border-[var(--foreground)] resize-y"
                    style={{
                      fontSize: 16,
                      padding: "12px 14px",
                      borderColor: "var(--border)",
                      backgroundColor: "var(--background)",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-full py-3 mt-1 transition-opacity disabled:opacity-50"
                  style={{ fontSize: 15, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
                >
                  {loading ? "Envoi..." : "Envoyer la demande"}
                </button>

                <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                  Vos coordonnées servent uniquement à répondre à cette demande.
                </p>
              </form>
            )}
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border outline-none transition-colors focus:border-[var(--foreground)]"
        style={{
          fontSize: 16,
          padding: "12px 14px",
          borderColor: "var(--border)",
          backgroundColor: "var(--background)",
        }}
      />
    </div>
  );
}
