import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import logo from "@/assets/kadence-logo.png";
import { SECTORS } from "@/components/marketing/sectors";

const APP_URL = "https://app.kadence.be";
const ADMIN_URL = "https://admin.kadence.be";

const NAV = [
  { to: "/fonctionnalites", label: "Fonctionnalités" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/contact", label: "Contact" },
] as const;


export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [sectors, setSectors] = useState(false);


  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--background)" }}>
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "color-mix(in oklab, var(--background) 88%, transparent)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          className="mx-auto flex items-center justify-between gap-3 px-5 md:px-8 h-[68px] md:h-24"
          style={{ maxWidth: 1180 }}
        >
          <Link to="/" className="flex items-center min-w-0" onClick={() => setOpen(false)} aria-label="Kadence — accueil">
            <img
              src={logo}
              alt="Kadence"
              className="h-11 md:h-[68px]"
              style={{ width: "auto", objectFit: "contain" }}
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <div className="relative" onMouseEnter={() => setSectors(true)} onMouseLeave={() => setSectors(false)}>
              <Link
                to="/secteurs"
                className="flex items-center gap-1.5 transition-colors hover:opacity-70"
                style={{ fontSize: 14.5, color: "var(--muted-foreground)" }}
                activeProps={{ style: { fontSize: 14.5, color: "var(--foreground)", fontWeight: 500 } }}
              >
                Secteurs
                <ChevronDown size={14} />
              </Link>
              {sectors && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-full pt-4"
                  style={{ width: 460 }}
                >
                  <div
                    className="rounded-2xl p-3 grid grid-cols-2 gap-1"
                    style={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      boxShadow: "0 18px 50px -20px rgba(26,26,26,0.28)",
                    }}
                  >
                    {SECTORS.map((s) => (
                      <Link
                        key={s.slug}
                        to={s.slug}
                        onClick={() => setSectors(false)}
                        className="rounded-xl px-3.5 py-3 transition-colors"
                        style={{ display: "block" }}
                      >
                        <span
                          className="block"
                          style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}
                        >
                          {s.kicker}
                        </span>
                        <span
                          className="block"
                          style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 2 }}
                        >
                          {s.teaser.split(".")[0]}.
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                style={{ fontSize: 14.5, color: "var(--muted-foreground)" }}
                activeProps={{ style: { fontSize: 14.5, color: "var(--foreground)", fontWeight: 500 } }}
                className="transition-colors hover:opacity-70"
              >
                {n.label}
              </Link>
            ))}
          </nav>


          <div className="hidden md:flex items-center gap-4">
            <a href={APP_URL} style={{ fontSize: 14.5, color: "var(--foreground)" }} className="hover:opacity-70">
              Connexion
            </a>
            <Link
              to="/contact"
              className="rounded-full px-5 py-2.5 transition-opacity hover:opacity-90"
              style={{ fontSize: 14.5, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
            >
              Demander une démo
            </Link>
          </div>

          <button
            className="md:hidden rounded-md p-2"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            style={{ color: "var(--foreground)" }}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {open && (
          <div
            className="md:hidden border-t px-5 py-5 overflow-y-auto"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              maxHeight: "calc(100dvh - 68px)",
            }}
          >
            <div className="flex flex-col gap-1">
              <Link
                to="/secteurs"
                onClick={() => setOpen(false)}
                className="py-3"
                style={{ fontSize: 16.5, fontWeight: 500 }}
              >
                Secteurs
              </Link>
              <div className="flex flex-col mb-1 pl-4" style={{ borderLeft: "1px solid var(--border)" }}>
                {SECTORS.map((s) => (
                  <Link
                    key={s.slug}
                    to={s.slug}
                    onClick={() => setOpen(false)}
                    className="py-2.5"
                    style={{ fontSize: 15, color: "var(--muted-foreground)" }}
                  >
                    {s.kicker}
                  </Link>
                ))}
              </div>
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="py-3"
                  style={{ fontSize: 16.5, fontWeight: 500 }}
                >
                  {n.label}
                </Link>
              ))}

              <a href={APP_URL} className="py-3" style={{ fontSize: 16.5, color: "var(--muted-foreground)" }}>
                Connexion
              </a>

              <Link
                to="/contact"
                onClick={() => setOpen(false)}
                className="rounded-full px-6 py-3.5 text-center mt-3"
                style={{ fontSize: 15.5, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
              >
                Demander une démo
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer style={{ backgroundColor: "#1A1A1A" }}>
        <div className="mx-auto px-5 md:px-8 py-12 md:py-16" style={{ maxWidth: 1180 }}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10 md:gap-12">
            <div style={{ maxWidth: 320 }}>
              <img
                src={logo}
                alt="Kadence"
                className="h-14 md:h-[76px]"
                style={{ width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }}
              />
              <p style={{ fontSize: 13.5, color: "rgba(250,250,248,0.6)", marginTop: 16, lineHeight: 1.8 }}>
                La gestion d'équipe pensée pour les cafés, restaurants et commerces à plusieurs établissements. Conçu à
                Bruxelles.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:flex sm:flex-wrap sm:gap-12 md:gap-16">

              <FooterCol title="Produit">
                <Link to="/fonctionnalites">Fonctionnalités</Link>
                <Link to="/tarifs">Tarifs</Link>
                <Link to="/contact">Demander une démo</Link>
              </FooterCol>
              <FooterCol title="Société">
                <Link to="/secteurs">Secteurs</Link>
                <Link to="/contact">Contact</Link>
                <Link to="/mentions-legales">Mentions légales</Link>
                <Link to="/confidentialite">Confidentialité</Link>
              </FooterCol>
              <FooterCol title="Accès">
                <a href={APP_URL}>Espace employé</a>
                <a href={ADMIN_URL}>Console admin</a>
              </FooterCol>
            </div>
          </div>

          <div
            className="mt-14 pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            style={{ borderTop: "1px solid rgba(250,250,248,0.12)" }}
          >
            <p style={{ fontSize: 12, color: "rgba(250,250,248,0.45)" }}>
              © {new Date().getFullYear()} Kadence — Bruxelles, Belgique
            </p>
            <p style={{ fontSize: 12, color: "rgba(250,250,248,0.45)" }}>kadence.be</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.06em", color: "#FAFAF8" }}>{title}</div>
      <div
        className="flex flex-col gap-3 [&_a]:transition-opacity hover:[&_a]:opacity-100"
        style={{ fontSize: 13.5, color: "rgba(250,250,248,0.6)" }}
      >
        {children}
      </div>
    </div>
  );
}

export function Section({
  children,
  tone = "default",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "default" | "surface" | "ink";
  className?: string;
}) {
  const bg = tone === "surface" ? "#F3F1EC" : tone === "ink" ? "#1A1A1A" : undefined;
  return (
    <section
      className={`px-5 md:px-8 py-20 md:py-28 ${className}`}
      style={bg ? { backgroundColor: bg, color: tone === "ink" ? "#FAFAF8" : undefined } : undefined}
    >
      <div className="mx-auto" style={{ maxWidth: 1180 }}>
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({ children, tone = "coral" }: { children: React.ReactNode; tone?: "coral" | "light" }) {
  return (
    <div
      className="inline-flex rounded-full px-3.5 py-1.5 mb-6"
      style={{
        fontSize: 11.5,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        backgroundColor: tone === "coral" ? "var(--coral-light)" : "rgba(250,250,248,0.1)",
        color: tone === "coral" ? "var(--coral-dark)" : "rgba(250,250,248,0.8)",
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.12 }}>
      {children}
    </h2>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 17, color: "var(--muted-foreground)", lineHeight: 1.8, marginTop: 18, maxWidth: 640 }}>
      {children}
    </p>
  );
}

export function CtaBand() {
  return (
    <Section>
      <div
        className="rounded-[28px] px-7 py-16 md:px-20 md:py-24"
        style={{ backgroundColor: "#1A1A1A" }}
      >
        <div style={{ maxWidth: 640 }}>
          <Eyebrow tone="light">Démo · 20 minutes</Eyebrow>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 500,
              color: "#FAFAF8",
              letterSpacing: "-0.03em",
              lineHeight: 1.12,
            }}
          >
            Voyez Kadence tourner sur votre propre planning
          </h2>
          <p style={{ fontSize: 16, color: "rgba(250,250,248,0.65)", marginTop: 16, lineHeight: 1.8 }}>
            On reprend vos horaires d'ouverture, vos postes et vos contrats, et on vous montre le planning du mois
            généré en direct.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              to="/contact"
              className="rounded-full px-7 py-3.5 text-center transition-opacity hover:opacity-90"
              style={{ fontSize: 15, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
            >
              Demander une démo
            </Link>
            <a
              href={APP_URL}
              className="rounded-full px-7 py-3.5 text-center border transition-opacity hover:opacity-80"
              style={{ fontSize: 15, fontWeight: 500, borderColor: "rgba(250,250,248,0.25)", color: "#FAFAF8" }}
            >
              Se connecter
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}

export { APP_URL, ADMIN_URL };
