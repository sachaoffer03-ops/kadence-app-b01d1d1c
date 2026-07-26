import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import logo from "@/assets/kadence-logo.png";

const APP_URL = "https://app.kadence.be";
const ADMIN_URL = "https://admin.kadence.be";

const NAV = [
  { to: "/fonctionnalites", label: "Fonctionnalités" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/a-propos", label: "À propos" },
  { to: "/contact", label: "Contact" },
] as const;

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--background)" }}>
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "color-mix(in oklab, var(--background) 88%, transparent)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="mx-auto flex items-center justify-between px-5 md:px-8" style={{ maxWidth: 1120, height: 68 }}>
          <Link to="/" className="flex items-center" onClick={() => setOpen(false)}>
            <img src={logo} alt="Kadence" style={{ height: 34, width: "auto", objectFit: "contain" }} />
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                style={{ fontSize: 14, color: "var(--muted-foreground)" }}
                activeProps={{ style: { fontSize: 14, color: "var(--foreground)", fontWeight: 500 } }}
                className="transition-colors hover:opacity-70"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a href={APP_URL} style={{ fontSize: 14, color: "var(--foreground)" }} className="hover:opacity-70">
              Connexion
            </a>
            <Link
              to="/contact"
              className="rounded-full px-4 py-2 transition-opacity hover:opacity-90"
              style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
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
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {open && (
          <div className="md:hidden border-t px-5 py-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
            <div className="flex flex-col gap-4">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to} onClick={() => setOpen(false)} style={{ fontSize: 15 }}>
                  {n.label}
                </Link>
              ))}
              <a href={APP_URL} style={{ fontSize: 15 }}>
                Connexion
              </a>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t mt-24" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto px-5 md:px-8 py-12" style={{ maxWidth: 1120 }}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
            <div style={{ maxWidth: 300 }}>
              <img src={logo} alt="Kadence" style={{ height: 30, width: "auto", objectFit: "contain" }} />
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 12, lineHeight: 1.7 }}>
                La gestion d'équipe pensée pour les commerces de proximité. Conçu à Bruxelles.
              </p>
            </div>

            <div className="flex flex-wrap gap-14">
              <FooterCol title="Produit">
                <Link to="/fonctionnalites">Fonctionnalités</Link>
                <Link to="/tarifs">Tarifs</Link>
                <Link to="/contact">Demander une démo</Link>
              </FooterCol>
              <FooterCol title="Société">
                <Link to="/a-propos">À propos</Link>
                <Link to="/contact">Contact</Link>
                <Link to="/confidentialite">Confidentialité</Link>
              </FooterCol>
              <FooterCol title="Accès">
                <a href={APP_URL}>Espace employé</a>
                <a href={ADMIN_URL}>Console admin</a>
              </FooterCol>
            </div>
          </div>

          <div
            className="mt-10 pt-6 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            style={{ borderColor: "var(--border)" }}
          >
            <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              © {new Date().getFullYear()} Kadence — Bruxelles, Belgique
            </p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>kadence.be</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.04em", color: "var(--foreground)" }}>{title}</div>
      <div
        className="flex flex-col gap-2.5 [&_a]:transition-opacity hover:[&_a]:opacity-70"
        style={{ fontSize: 13, color: "var(--muted-foreground)" }}
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
  tone?: "default" | "surface";
  className?: string;
}) {
  return (
    <section
      className={`px-5 md:px-8 py-16 md:py-24 ${className}`}
      style={tone === "surface" ? { backgroundColor: "#F3F1EC" } : undefined}
    >
      <div className="mx-auto" style={{ maxWidth: 1120 }}>
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="inline-flex rounded-full px-3 py-1 mb-5"
      style={{ fontSize: 11, letterSpacing: "0.06em", backgroundColor: "var(--coral-light)", color: "var(--coral-dark)", fontWeight: 500 }}
    >
      {children}
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: "clamp(24px, 3.2vw, 34px)", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
      {children}
    </h2>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 16, color: "var(--muted-foreground)", lineHeight: 1.75, marginTop: 14, maxWidth: 620 }}>
      {children}
    </p>
  );
}

export function CtaBand() {
  return (
    <Section>
      <div
        className="rounded-3xl px-7 py-14 md:px-16 text-center"
        style={{ backgroundColor: "#1A1A1A" }}
      >
        <h2 style={{ fontSize: "clamp(24px, 3.2vw, 32px)", fontWeight: 500, color: "#FAFAF8", letterSpacing: "-0.02em" }}>
          Voir Kadence sur votre propre planning
        </h2>
        <p style={{ fontSize: 15, color: "rgba(250,250,248,0.7)", marginTop: 12, lineHeight: 1.7 }}>
          On vous montre l'outil en 20 minutes, avec vos horaires et vos postes.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          <Link
            to="/contact"
            className="rounded-full px-6 py-3 transition-opacity hover:opacity-90"
            style={{ fontSize: 15, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
          >
            Demander une démo
          </Link>
          <a
            href={APP_URL}
            className="rounded-full px-6 py-3 border transition-opacity hover:opacity-80"
            style={{ fontSize: 15, fontWeight: 500, borderColor: "rgba(250,250,248,0.25)", color: "#FAFAF8" }}
          >
            Se connecter
          </a>
        </div>
      </div>
    </Section>
  );
}

export { APP_URL, ADMIN_URL };
