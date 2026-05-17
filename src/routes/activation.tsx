import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSpaceUrl } from "@/lib/app-mode";
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Lock,
  User,
  MapPin,
  FileText,
  Phone,
  ShieldCheck,
  Sparkles,
  Camera,
  Upload,
  X,
} from "lucide-react";
import logo from "@/assets/kadence-logo.png";

export const Route = createFileRoute("/activation")({
  component: ActivationPage,
  validateSearch: (s: Record<string, unknown>) => ({
    token: (s.token as string) || "",
    preview: (s.preview as string) || "",
  }),
  head: () => ({ meta: [{ title: "Activation du compte — Kadence" }] }),
});

interface Invitation {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  studio_id: string | null;
  studio_ids?: string[] | null;
  contract: string | null;
  contracts?: string[] | null;
  app_role?: string | null;
  status: string;
  expires_at: string;
}

const TOTAL_STEPS = 8; // 0 welcome, 1 password, 2 identity, 3 photo, 4 address, 5 rh, 6 emergency, 7 validation

function ActivationPage() {
  const { token, preview } = Route.useSearch();
  const isPreview = !!preview;
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fields
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [niss, setNiss] = useState("");
  const [iban, setIban] = useState("");
  const [emName, setEmName] = useState("");
  const [emPhone, setEmPhone] = useState("");
  const [emRel, setEmRel] = useState("");
  const [studentValid, setStudentValid] = useState(false);
  const [accept, setAccept] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!token && !preview) {
      setError("Aucun lien d'invitation détecté");
      setLoading(false);
      return;
    }
    // Mode démo : invitation factice, pas d'appel DB
    if (preview === "demo") {
      setInvitation({
        id: "demo",
        email: "david.martin@skult.studio",
        first_name: "David",
        last_name: "Martin",
        phone: "+32 470 12 34 56",
        studio_id: null,
        contract: "Étudiant",
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      setLoading(false);
      return;
    }
    (async () => {
      const query = supabase
        .from("invitations")
        .select(
          "id, email, first_name, last_name, phone, studio_id, contract, app_role, status, expires_at",
        );
      const { data, error } = await (isPreview
        ? query.eq("id", preview).maybeSingle()
        : query.eq("token", token).maybeSingle());
      if (error || !data) {
        setError("Invitation introuvable");
      } else if (!isPreview && data.status !== "pending") {
        setError("Cette invitation a déjà été utilisée ou révoquée");
      } else if (!isPreview && new Date(data.expires_at) < new Date()) {
        setError("Cette invitation a expiré. Demandez-en une nouvelle.");
      } else {
        setInvitation(data);
        if (data.phone) setPhone(data.phone);
      }
      setLoading(false);
    })();
  }, [token, preview, isPreview]);

  // Password strength
  const pwStrength = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  }, [password]);

  const goNext = () => setStep((s) => s + 1);
  const goPrev = () => setStep((s) => Math.max(0, s - 1));

  const validateStep = () => {
    if (isPreview) return goNext(); // skip validation in preview mode
    if (step === 1) {
      if (password.length < 8) return toast.error("Mot de passe : 8 caractères minimum");
      if (password !== confirm) return toast.error("Les mots de passe ne correspondent pas");
    }
    if (step === 2) {
      if (!phone || !birthDate || !nationality) return toast.error("Tous les champs sont requis");
    }
    if (step === 3) {
      if (!photoFile && !isPreview) return toast.error("Ajoutez une photo de profil");
    }
    if (step === 4) {
      if (!city || !address) return toast.error("Tous les champs sont requis");
    }
    if (step === 5) {
      if (!niss || !iban) return toast.error("NISS et IBAN sont requis");
    }
    if (step === 6) {
      if (!emName || !emPhone || !emRel) return toast.error("Tous les champs sont requis");
    }
    goNext();
  };

  const handleSubmit = async () => {
    if (!invitation) return;
    if (isPreview) {
      setSubmitting(true);
      await new Promise((r) => setTimeout(r, 600));
      setSubmitting(false);
      setDone(true);
      return;
    }
    // Real submission below — note: employee will receive a confirmation email
    // and must click the link before being able to sign in.
    const isStudent = (invitation.contracts && invitation.contracts.length > 0)
      ? invitation.contracts.includes("Étudiant")
      : invitation.contract === "Étudiant";
    if (isStudent && !studentValid)
      return toast.error("Confirmez la validité de votre carte étudiant");
    if (!accept) return toast.error("Vous devez accepter les conditions");

    setSubmitting(true);
    const isAdmin = invitation.app_role === "admin" || invitation.app_role === "manager";
    const targetPath = isAdmin ? "/" : "/staff-app";
    // En prod, force le bon sous-domaine; en preview, reste sur l'origine actuelle.
    const host = window.location.hostname.toLowerCase();
    const isProd = host.endsWith("shyft.flashsite.fr");
    const redirectBase = isProd ? getSpaceUrl(isAdmin ? "admin" : "employee") : window.location.origin;
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: {
        data: {
          invitation_token: token,
          first_name: invitation.first_name,
          last_name: invitation.last_name,
        },
        emailRedirectTo: `${redirectBase}${targetPath}`,
      },
    });

    if (signUpError) {
      setSubmitting(false);
      return toast.error(signUpError.message);
    }

    await new Promise((r) => setTimeout(r, 600));
    const userId = signUpData.user?.id;
    if (userId) {
      let avatarUrl: string | null = null;
      if (photoFile) {
        const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type || "image/jpeg" });
        if (!upErr) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
          avatarUrl = pub.publicUrl;
        }
      }
      await supabase
        .from("profiles")
        .update({
          phone,
          birth_date: birthDate,
          nationality,
          city,
          address,
          niss,
          iban,
          emergency_contact_name: emName,
          emergency_contact_phone: emPhone,
          emergency_contact_relation: emRel,
          student_card_valid: studentValid,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        })
        .eq("id", userId);
    }
    setSubmitting(false);
    setDone(true);
    // No auto-redirect: user must confirm their email first.
  };

  // ───── render states ─────
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--background)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="animate-pulse-dot inline-block rounded-full"
            style={{ width: 6, height: 6, backgroundColor: "var(--coral)" }}
          />
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: "var(--background)" }}
      >
        <div className="max-w-md text-center">
          <div
            className="mx-auto mb-5 rounded-full flex items-center justify-center"
            style={{
              width: 56,
              height: 56,
              backgroundColor: "var(--danger-bg)",
              color: "var(--danger-text)",
            }}
          >
            <Lock size={22} strokeWidth={1.6} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 500 }}>Lien invalide</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 8 }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: "var(--background)" }}
      >
        <div className="max-w-md text-center">
          <div
            className="mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{
              width: 80,
              height: 80,
              backgroundColor: "var(--coral-light)",
              color: "var(--coral-dark)",
            }}
          >
            <Check size={36} strokeWidth={1.8} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" }}>
            {isPreview ? `Bienvenue ${invitation.first_name}` : "Plus qu'une étape"}
          </h1>
          {isPreview ? (
            <p
              style={{
                fontSize: 14,
                color: "var(--muted-foreground)",
                marginTop: 8,
                lineHeight: 1.6,
              }}
            >
              Aperçu terminé. Dans la vraie vie, l'employé reçoit un email de
              confirmation à cette étape, puis arrive sur son espace.
            </p>
          ) : (
            <>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--foreground)",
                  marginTop: 10,
                  lineHeight: 1.6,
                }}
              >
                On vient de vous envoyer un email à
                <br />
                <span style={{ fontWeight: 500 }}>{invitation.email}</span>
              </p>
              <div
                className="mt-5 rounded-xl border text-left p-4"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--card)",
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Pour finaliser votre compte :
                </p>
                <ol
                  style={{
                    fontSize: 13,
                    color: "var(--muted-foreground)",
                    lineHeight: 1.7,
                    paddingLeft: 18,
                    listStyle: "decimal",
                  }}
                >
                  <li>Ouvrez votre boîte mail</li>
                  <li>Cliquez sur le lien de confirmation</li>
                  <li>Vous serez automatiquement redirigé vers votre espace</li>
                </ol>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                    marginTop: 10,
                    fontStyle: "italic",
                  }}
                >
                  Pensez à vérifier vos spams si vous ne voyez rien dans les
                  prochaines minutes.
                </p>
              </div>
            </>
          )}
          {isPreview && (
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => navigate({ to: "/staff-app" })}
                className="rounded-md py-2.5 px-4"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  backgroundColor: "var(--coral)",
                  color: "var(--coral-text)",
                }}
              >
                Accéder à mon espace
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ───── step content ─────
  const stepIcons = [Sparkles, Lock, User, Camera, MapPin, FileText, Phone, ShieldCheck];
  const StepIcon = stepIcons[step];
  const headings = [
    { t: `Bienvenue ${invitation.first_name}`, s: "Activons votre compte en quelques étapes" },
    { t: "Sécurisez votre compte", s: "Créez un mot de passe que vous seul connaissez" },
    { t: "Votre identité", s: "On a besoin de quelques infos personnelles" },
    { t: "Votre photo de profil", s: "Pour que vos managers vous reconnaissent" },
    { t: "Votre adresse", s: "Pour les documents officiels et la déclaration Dimona" },
    { t: "Informations RH", s: "Pour le paiement de votre salaire et la déclaration sociale" },
    { t: "Contact d'urgence", s: "À prévenir en cas de problème pendant votre service" },
    { t: "Dernière étape", s: "Vérifiez et confirmez votre activation" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--background)" }}>
      {isPreview && (
        <div
          className="sticky top-0 z-20 border-b"
          style={{ backgroundColor: "var(--foreground)", borderColor: "var(--border)" }}
        >
          <div className="max-w-6xl mx-auto px-3 md:px-6 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 shrink-0" style={{ color: "var(--card)" }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  padding: "3px 7px",
                  borderRadius: 4,
                  backgroundColor: "var(--coral)",
                  color: "var(--coral-text)",
                }}
              >
                APERÇU
              </span>
              <span className="hidden md:inline" style={{ fontSize: 12, opacity: 0.85 }}>
                Données non enregistrées
              </span>
            </div>
            <button
              onClick={() => navigate({ to: "/staff" })}
              className="rounded-md px-3 py-1.5 shrink-0"
              style={{
                fontSize: 11,
                fontWeight: 500,
                backgroundColor: "var(--card)",
                color: "var(--foreground)",
              }}
            >
              ← Admin
            </button>
          </div>
          {/* Step shortcut bar — scrollable on mobile */}
          <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div
              className="max-w-6xl mx-auto px-3 md:px-6 py-2 flex items-center gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {[
                { n: 1, label: "Bienvenue" },
                { n: 2, label: "Mot de passe" },
                { n: 3, label: "Identité" },
                { n: 4, label: "Photo" },
                { n: 5, label: "Adresse" },
                { n: 6, label: "RH" },
                { n: 7, label: "Urgence" },
                { n: 8, label: "Validation" },
              ].map((s, i) => {
                const active = !done && i === step;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setStep(i);
                      setDone(false);
                    }}
                    className="rounded-full shrink-0 transition-all flex items-center gap-1.5"
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: active ? 500 : 400,
                      backgroundColor: active ? "var(--coral)" : "transparent",
                      color: active ? "var(--coral-text)" : "var(--card)",
                      opacity: active ? 1 : 0.75,
                      border: active ? "none" : "0.5px solid rgba(255,255,255,0.2)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ opacity: active ? 0.9 : 0.5 }}>{s.n}</span>
                    {s.label}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  setStep(0);
                  setDone(true);
                }}
                className="rounded-full shrink-0 flex items-center gap-1.5"
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: done ? 500 : 400,
                  backgroundColor: done ? "var(--coral)" : "transparent",
                  color: done ? "var(--coral-text)" : "var(--card)",
                  opacity: done ? 1 : 0.75,
                  border: done ? "none" : "0.5px solid rgba(255,255,255,0.2)",
                  whiteSpace: "nowrap",
                }}
              >
                <Check size={12} strokeWidth={2.2} />
                Compte créé
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Top bar */}
      <header className="px-4 md:px-8 py-5 flex items-center justify-between">
        <img src={logo} alt="Kadence" style={{ height: 40, width: "auto" }} />
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          {step > 0 && step < TOTAL_STEPS && `Étape ${step} sur ${TOTAL_STEPS - 1}`}
        </div>
      </header>

      {/* Progress bar */}
      {step > 0 && (
        <div className="px-4 md:px-8">
          <div className="max-w-xl mx-auto">
            <div
              className="h-[3px] rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${(step / (TOTAL_STEPS - 1)) * 100}%`,
                  backgroundColor: "var(--coral)",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-xl">
          {/* Icon + heading */}
          <div className="text-center mb-8">
            {step > 0 && (
              <div
                className="mx-auto mb-5 rounded-2xl flex items-center justify-center"
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: "var(--coral-light)",
                  color: "var(--coral-dark)",
                }}
              >
                <StepIcon size={24} strokeWidth={1.6} />
              </div>
            )}
            <h1
              style={{
                fontSize: 26,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                lineHeight: 1.25,
              }}
            >
              {headings[step].t}
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--muted-foreground)",
                marginTop: 8,
                lineHeight: 1.6,
              }}
            >
              {headings[step].s}
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl border p-6 md:p-7"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            {step === 0 && (
              <Welcome invitation={invitation} />
            )}

            {step === 1 && (
              <PasswordStep
                email={invitation.email}
                password={password}
                setPassword={setPassword}
                confirm={confirm}
                setConfirm={setConfirm}
                strength={pwStrength}
              />
            )}

            {step === 2 && (
              <Identity
                phone={phone}
                setPhone={setPhone}
                birthDate={birthDate}
                setBirthDate={setBirthDate}
                nationality={nationality}
                setNationality={setNationality}
              />
            )}

            {step === 3 && (
              <PhotoStep
                firstName={invitation.first_name}
                lastName={invitation.last_name}
                photoFile={photoFile}
                setPhotoFile={setPhotoFile}
                photoPreview={photoPreview}
                setPhotoPreview={setPhotoPreview}
              />
            )}

            {step === 4 && (
              <Address
                city={city}
                setCity={setCity}
                address={address}
                setAddress={setAddress}
              />
            )}

            {step === 5 && (
              <RhStep niss={niss} setNiss={setNiss} iban={iban} setIban={setIban} />
            )}

            {step === 6 && (
              <Emergency
                emName={emName}
                setEmName={setEmName}
                emPhone={emPhone}
                setEmPhone={setEmPhone}
                emRel={emRel}
                setEmRel={setEmRel}
              />
            )}

            {step === 7 && (
              <Review
                invitation={invitation}
                studentValid={studentValid}
                setStudentValid={setStudentValid}
                accept={accept}
                setAccept={setAccept}
              />
            )}
          </div>

          {/* Nav buttons */}
          <div className="flex gap-3 mt-6">
            {step > 0 && step < TOTAL_STEPS - 1 && (
              <button
                onClick={goPrev}
                className="rounded-md border px-4 py-3 inline-flex items-center justify-center gap-2 transition-colors hover:bg-[var(--secondary)]"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <ArrowLeft size={14} />
              </button>
            )}
            {step === 0 && (
              <button
                onClick={goNext}
                className="flex-1 rounded-md py-3 inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  backgroundColor: "var(--foreground)",
                  color: "var(--card)",
                }}
              >
                Commencer <ArrowRight size={14} />
              </button>
            )}
            {step > 0 && step < TOTAL_STEPS - 1 && (
              <button
                onClick={validateStep}
                className="flex-1 rounded-md py-3 inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  backgroundColor: "var(--foreground)",
                  color: "var(--card)",
                }}
              >
                Continuer <ArrowRight size={14} />
              </button>
            )}
            {step === TOTAL_STEPS - 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="rounded-md border px-4 py-3 inline-flex items-center justify-center gap-2 transition-colors hover:bg-[var(--secondary)]"
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-md py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    backgroundColor: "var(--coral)",
                    color: "var(--coral-text)",
                  }}
                >
                  {submitting ? "Activation..." : "Activer mon compte"}
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="text-center py-5">
        <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          Kadence · Skult Studios
        </p>
      </footer>
    </div>
  );
}

// ─────────── small components ───────────
const labelStyle = { fontSize: 12, fontWeight: 500 as const, color: "var(--muted-foreground)" };
const inputCls =
  "mt-1.5 w-full rounded-md border px-3 py-2.5 outline-none transition-colors focus:border-[var(--foreground)]";
const inputStyle = {
  fontSize: 14,
  borderColor: "var(--border)",
  backgroundColor: "var(--background)",
};

function Welcome({ invitation }: { invitation: Invitation }) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <div
          className="rounded-lg flex items-center justify-center shrink-0"
          style={{
            width: 36,
            height: 36,
            backgroundColor: "var(--card)",
          }}
        >
          <User size={16} strokeWidth={1.6} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500 }}>
            {invitation.first_name} {invitation.last_name}
          </p>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
            {invitation.email}
            {(() => { const cs = invitation.contracts ?? (invitation.contract ? [invitation.contract] : []); return cs.length > 0 ? ` · ${cs.join(" + ")}` : ""; })()}
          </p>
        </div>
      </div>
      <div className="space-y-3 pt-2">
        {[
          { i: Lock, t: "Création de votre mot de passe" },
          { i: User, t: "Vos informations personnelles" },
          { i: FileText, t: "Données de conformité (NISS, IBAN)" },
          { i: ShieldCheck, t: "Activation et accès à votre espace" },
        ].map(({ i: I, t }, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div
              className="rounded-md flex items-center justify-center shrink-0"
              style={{
                width: 28,
                height: 28,
                backgroundColor: "var(--coral-light)",
                color: "var(--coral-dark)",
              }}
            >
              <I size={14} strokeWidth={1.6} />
            </div>
            <p style={{ fontSize: 13, color: "var(--foreground)" }}>{t}</p>
          </div>
        ))}
      </div>
      <p
        style={{
          fontSize: 12,
          color: "var(--muted-foreground)",
          marginTop: 8,
          lineHeight: 1.6,
        }}
      >
        Comptez environ 3 minutes. Toutes vos informations sont chiffrées et
        utilisées uniquement pour la gestion de votre contrat.
      </p>
    </div>
  );
}

function PasswordStep({
  email,
  password,
  setPassword,
  confirm,
  setConfirm,
  strength,
}: {
  email: string;
  password: string;
  setPassword: (v: string) => void;
  confirm: string;
  setConfirm: (v: string) => void;
  strength: number;
}) {
  const labels = ["Trop court", "Faible", "Moyen", "Bon", "Excellent"];
  const colors = ["var(--muted)", "var(--danger-bg)", "var(--warning-bg)", "var(--coral-light)", "var(--success-bg)"];
  const txtColors = ["var(--muted-foreground)", "var(--danger-text)", "var(--warning-text)", "var(--coral-dark)", "var(--success-text)"];
  return (
    <div className="space-y-4">
      <div>
        <label style={labelStyle}>Email (déjà associé à votre invitation)</label>
        <input
          type="email"
          disabled
          value={email}
          className={inputCls}
          style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
        />
      </div>
      <div>
        <label style={labelStyle}>Nouveau mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 caractères minimum"
          className={inputCls}
          style={inputStyle}
        />
        {password.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex-1 h-1 rounded-full transition-colors"
                  style={{
                    backgroundColor: i < strength ? colors[strength] : "var(--secondary)",
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: 11, color: txtColors[strength], fontWeight: 500 }}>
              {labels[strength]}
            </span>
          </div>
        )}
      </div>
      <div>
        <label style={labelStyle}>Confirmer le mot de passe</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputCls}
          style={inputStyle}
        />
        {confirm.length > 0 && password !== confirm && (
          <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 6 }}>
            Les mots de passe ne correspondent pas
          </p>
        )}
      </div>
    </div>
  );
}

function Identity({
  phone,
  setPhone,
  birthDate,
  setBirthDate,
  nationality,
  setNationality,
}: {
  phone: string;
  setPhone: (v: string) => void;
  birthDate: string;
  setBirthDate: (v: string) => void;
  nationality: string;
  setNationality: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label style={labelStyle}>Téléphone</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+32 4XX XX XX XX"
          className={inputCls}
          style={inputStyle}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Date de naissance</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Nationalité</label>
          <input
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="Belge, Française..."
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}

function PhotoStep({
  firstName,
  lastName,
  photoFile,
  setPhotoFile,
  photoPreview,
  setPhotoPreview,
}: {
  firstName: string;
  lastName: string;
  photoFile: File | null;
  setPhotoFile: (f: File | null) => void;
  photoPreview: string | null;
  setPhotoPreview: (v: string | null) => void;
}) {
  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sélectionnez une image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (5 Mo max)");
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };
  const initials = `${(firstName?.[0] || "").toUpperCase()}${(lastName?.[0] || "").toUpperCase()}`;
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-4">
        <div
          className="rounded-full flex items-center justify-center overflow-hidden relative"
          style={{
            width: 128,
            height: 128,
            backgroundColor: "var(--coral-light)",
            color: "var(--coral-dark)",
            fontSize: 36,
            fontWeight: 500,
          }}
        >
          {photoPreview ? (
            <img src={photoPreview} alt="Photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span>{initials || <User size={40} strokeWidth={1.4} />}</span>
          )}
        </div>
        {photoPreview && (
          <button
            onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1"
            style={{ fontSize: 12, color: "var(--muted-foreground)", backgroundColor: "var(--secondary)" }}
          >
            <X size={12} /> Retirer la photo
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label
          className="rounded-md border py-3 px-3 inline-flex items-center justify-center gap-2 cursor-pointer transition-colors hover:bg-[var(--secondary)]"
          style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Camera size={15} strokeWidth={1.7} />
          Prendre une photo
          <input
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
        </label>
        <label
          className="rounded-md border py-3 px-3 inline-flex items-center justify-center gap-2 cursor-pointer transition-colors hover:bg-[var(--secondary)]"
          style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Upload size={15} strokeWidth={1.7} />
          Importer
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
        </label>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.6 }}>
        Cette photo sera visible par votre équipe et vos managers. Format carré conseillé, 5 Mo maximum.
      </p>
    </div>
  );
}

function Address({
  city,
  setCity,
  address,
  setAddress,
}: {
  city: string;
  setCity: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label style={labelStyle}>Adresse complète</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rue, numéro, boîte"
          className={inputCls}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Ville</label>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Bruxelles, Ixelles..."
          className={inputCls}
          style={inputStyle}
        />
      </div>
    </div>
  );
}

function RhStep({
  niss,
  setNiss,
  iban,
  setIban,
}: {
  niss: string;
  setNiss: (v: string) => void;
  iban: string;
  setIban: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label style={labelStyle}>Numéro NISS</label>
        <input
          value={niss}
          onChange={(e) => setNiss(e.target.value)}
          placeholder="00.00.00-000.00"
          className={inputCls}
          style={inputStyle}
        />
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>
          Numéro de Sécurité Sociale (au dos de votre carte d'identité)
        </p>
      </div>
      <div>
        <label style={labelStyle}>IBAN</label>
        <input
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          placeholder="BE00 0000 0000 0000"
          className={inputCls}
          style={inputStyle}
        />
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>
          Compte sur lequel votre salaire sera versé
        </p>
      </div>
    </div>
  );
}

function Emergency({
  emName,
  setEmName,
  emPhone,
  setEmPhone,
  emRel,
  setEmRel,
}: {
  emName: string;
  setEmName: (v: string) => void;
  emPhone: string;
  setEmPhone: (v: string) => void;
  emRel: string;
  setEmRel: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label style={labelStyle}>Nom de la personne</label>
        <input
          value={emName}
          onChange={(e) => setEmName(e.target.value)}
          placeholder="Prénom Nom"
          className={inputCls}
          style={inputStyle}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Téléphone</label>
          <input
            type="tel"
            value={emPhone}
            onChange={(e) => setEmPhone(e.target.value)}
            placeholder="+32 4XX XX XX XX"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Lien</label>
          <input
            value={emRel}
            onChange={(e) => setEmRel(e.target.value)}
            placeholder="Parent, conjoint..."
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}

function Review({
  invitation,
  studentValid,
  setStudentValid,
  accept,
  setAccept,
}: {
  invitation: Invitation;
  studentValid: boolean;
  setStudentValid: (v: boolean) => void;
  accept: boolean;
  setAccept: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Vous activez le compte de</p>
        <p style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>
          {invitation.first_name} {invitation.last_name}
        </p>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
          {invitation.email}
          {(() => { const cs = invitation.contracts ?? (invitation.contract ? [invitation.contract] : []); return cs.length > 0 ? ` · ${cs.join(" + ")}` : ""; })()}
        </p>
      </div>

      {((invitation.contracts ?? (invitation.contract ? [invitation.contract] : [])).includes("Étudiant")) && (
        <label
          className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-[var(--secondary)]"
          style={{ borderColor: studentValid ? "var(--coral)" : "var(--border)" }}
        >
          <input
            type="checkbox"
            checked={studentValid}
            onChange={(e) => setStudentValid(e.target.checked)}
            className="mt-0.5"
          />
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>
            Je certifie que ma carte étudiant est valide pour l'année en cours.
          </span>
        </label>
      )}

      <label
        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-[var(--secondary)]"
        style={{ borderColor: accept ? "var(--coral)" : "var(--border)" }}
      >
        <input
          type="checkbox"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
          className="mt-0.5"
        />
        <span style={{ fontSize: 13, lineHeight: 1.5 }}>
          J'accepte que ces informations soient utilisées pour la gestion de mon
          contrat et la déclaration aux organismes sociaux.
        </span>
      </label>
    </div>
  );
}
