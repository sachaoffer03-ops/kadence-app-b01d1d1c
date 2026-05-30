import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, PrimaryButton, SecondaryButton, FormField } from "@/components/staff-app/shared";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useBusinessRoles } from "@/hooks/use-business-roles";
import { useStudios } from "@/hooks/use-studios";
import { regenerateEmployeeAccessLink } from "@/lib/employee-access.functions";
import { setContributorStatus } from "@/lib/ai-suggestions.functions";
import { Link2, Copy, Sparkles } from "lucide-react";

const CONTRACTS = ["Étudiant", "Flexi", "CDI"] as const;

export interface AdminEmployeePatch {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  birth_date: string | null;
  hire_date: string | null;
  nationality: string | null;
  city: string | null;
  address: string | null;
  niss: string | null;
  iban: string | null;
  hourly_rate: number | null;
  quota_max: number | null;
  student_card_valid: boolean | null;
  status: string;
  contracts: string[];
  studio_ids: string[];
  business_roles: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  initial: AdminEmployeePatch;
  onSaved: (next: AdminEmployeePatch) => void;
}

const inputClass = "w-full rounded-md border px-3 py-2 outline-none focus:border-[var(--foreground)]";
const inputStyle: React.CSSProperties = { fontSize: 13, borderColor: "rgba(0,0,0,0.12)", backgroundColor: "#fff" };

function T({ value, onChange, type = "text", placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} style={inputStyle} />;
}

function Chips<T extends string>({ options, selected, onToggle }: { options: readonly T[] | T[]; selected: T[]; onToggle: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className="rounded-full px-2.5 py-1"
            style={{
              fontSize: 11,
              fontWeight: 500,
              border: on ? "1px solid var(--coral)" : "0.5px solid rgba(0,0,0,0.12)",
              backgroundColor: on ? "var(--coral)" : "#fff",
              color: on ? "var(--coral-text)" : "var(--foreground)",
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function AdminEditEmployeeSheet({ open, onClose, userId, initial, onSaved }: Props) {
  const { names: roleNames } = useBusinessRoles({ onlyActive: true });
  const { studios } = useStudios();
  const [s, setS] = useState<AdminEmployeePatch>(initial);
  const [saving, setSaving] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [aiContributor, setAiContributor] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const regenFn = useServerFn(regenerateEmployeeAccessLink);
  const setContribFn = useServerFn(setContributorStatus);

  useEffect(() => {
    if (open) {
      setS(initial);
      setGeneratedLink(null);
      supabase.from("profiles").select("ai_contributor").eq("id", userId).maybeSingle()
        .then(({ data }) => setAiContributor(Boolean((data as any)?.ai_contributor)));
    }
  }, [open, initial, userId]);

  const toggleAiContributor = async () => {
    setAiSaving(true);
    const next = !aiContributor;
    try {
      await setContribFn({ data: { userId, is_contributor: next } });
      setAiContributor(next);
      toast.success(next ? "Contributeur IA activé" : "Contributeur IA désactivé");
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setAiSaving(false);
    }
  };

  const regenerateLink = async () => {
    if (!confirm("Générer un nouveau lien d'accès unique pour cet employé ?\n\nLe lien permettra à l'employé de se connecter et choisir un nouveau mot de passe. Il fonctionne partout (WhatsApp, mail, SMS) et est valide une seule fois.")) return;
    setRegenerating(true);
    try {
      const res = await regenFn({ data: { userId } });
      setGeneratedLink(res.url);
      try {
        await navigator.clipboard.writeText(res.url);
        toast.success("Lien généré et copié dans le presse-papier");
      } catch {
        toast.success("Lien généré");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la génération du lien");
    } finally {
      setRegenerating(false);
    }
  };

  const copyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast.success("Lien copié");
    } catch {
      toast.error("Impossible de copier");
    }
  };


  const toggle = <K extends keyof AdminEmployeePatch>(key: K, v: string) => {
    setS((p) => {
      const arr = (p[key] as unknown as string[]) || [];
      const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
      return { ...p, [key]: next } as AdminEmployeePatch;
    });
  };

  const save = async () => {
    if (!s.first_name.trim() || !s.last_name.trim()) return toast.error("Prénom et nom requis");
    setSaving(true);
    try {
      // 1. Profile
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          first_name: s.first_name.trim(),
          last_name: s.last_name.trim(),
          email: s.email.trim(),
          phone: s.phone?.trim() || null,
          birth_date: s.birth_date || null,
          hire_date: s.hire_date || null,
          nationality: s.nationality?.trim() || null,
          city: s.city?.trim() || null,
          address: s.address?.trim() || null,
          niss: s.niss?.trim() || null,
          iban: s.iban?.trim() || null,
          hourly_rate: s.hourly_rate,
          quota_max: s.quota_max,
          student_card_valid: s.student_card_valid,
          status: s.status as any,
          contract: (s.contracts[0] as any) ?? null,
          studio_id: s.studio_ids[0] ?? null,
        })
        .eq("id", userId);
      if (pErr) throw pErr;

      // 2. Replace contracts
      await supabase.from("user_contracts").delete().eq("user_id", userId);
      if (s.contracts.length > 0) {
        const { error } = await supabase.from("user_contracts").insert(
          s.contracts.map((c) => ({ user_id: userId, contract: c as any })),
        );
        if (error) throw error;
      }

      // 3. Replace studios
      await supabase.from("user_studios").delete().eq("user_id", userId);
      if (s.studio_ids.length > 0) {
        const { error } = await supabase.from("user_studios").insert(
          s.studio_ids.map((sid) => ({ user_id: userId, studio_id: sid })),
        );
        if (error) throw error;
      }

      // 4. Replace business roles
      await supabase.from("user_business_roles").delete().eq("user_id", userId);
      if (s.business_roles.length > 0) {
        const { error } = await supabase.from("user_business_roles").insert(
          s.business_roles.map((r) => ({ user_id: userId, role: r })),
        );
        if (error) throw error;
      }

      toast.success("Profil mis à jour");
      onSaved(s);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Modifier l'employé">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Prénom"><T value={s.first_name} onChange={(v) => setS({ ...s, first_name: v })} /></FormField>
        <FormField label="Nom"><T value={s.last_name} onChange={(v) => setS({ ...s, last_name: v })} /></FormField>
      </div>
      <FormField label="Email"><T value={s.email} onChange={(v) => setS({ ...s, email: v })} type="email" /></FormField>
      <FormField label="Téléphone"><T value={s.phone || ""} onChange={(v) => setS({ ...s, phone: v })} type="tel" /></FormField>

      <FormField label="Contrats (multi)">
        <Chips options={CONTRACTS} selected={s.contracts as any} onToggle={(v) => toggle("contracts", v)} />
      </FormField>
      {s.contracts.includes("Étudiant") && (
        <FormField label="Carte étudiant">
          <Chips
            options={["Valide", "Manquante"]}
            selected={[s.student_card_valid ? "Valide" : "Manquante"]}
            onToggle={(v) => setS({ ...s, student_card_valid: v === "Valide" })}
          />
        </FormField>
      )}

      <FormField label="Postes (rôles métier)">
        <Chips options={roleNames} selected={s.business_roles} onToggle={(v) => toggle("business_roles", v)} />
      </FormField>

      <FormField label="Studios rattachés">
        <div className="flex flex-col gap-1.5">
          {studios.map((st) => {
            const on = s.studio_ids.includes(st.id);
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => toggle("studio_ids", st.id)}
                className="rounded-md px-3 py-2 text-left"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  border: on ? "1px solid var(--coral)" : "0.5px solid rgba(0,0,0,0.12)",
                  backgroundColor: on ? "rgba(240,153,123,0.10)" : "#fff",
                }}
              >
                {st.name}
              </button>
            );
          })}
        </div>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date d'embauche"><T value={s.hire_date || ""} onChange={(v) => setS({ ...s, hire_date: v })} type="date" /></FormField>
        <FormField label="Date de naissance"><T value={s.birth_date || ""} onChange={(v) => setS({ ...s, birth_date: v })} type="date" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Taux horaire (€/h)">
          <T value={s.hourly_rate !== null ? String(s.hourly_rate) : ""} onChange={(v) => setS({ ...s, hourly_rate: v.trim() === "" ? null : Number(v.replace(",", ".")) })} type="number" />
        </FormField>
        <FormField label="Quota max (h)">
          <T value={s.quota_max !== null ? String(s.quota_max) : ""} onChange={(v) => setS({ ...s, quota_max: v.trim() === "" ? null : Number(v) })} type="number" />
        </FormField>
      </div>
      <FormField label="Ville"><T value={s.city || ""} onChange={(v) => setS({ ...s, city: v })} /></FormField>
      <FormField label="Adresse"><T value={s.address || ""} onChange={(v) => setS({ ...s, address: v })} /></FormField>
      <FormField label="Nationalité"><T value={s.nationality || ""} onChange={(v) => setS({ ...s, nationality: v })} /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="NISS"><T value={s.niss || ""} onChange={(v) => setS({ ...s, niss: v })} /></FormField>
        <FormField label="IBAN"><T value={s.iban || ""} onChange={(v) => setS({ ...s, iban: v })} /></FormField>
      </div>

      <FormField label="Statut">
        <Chips
          options={["active", "invited", "suspended"]}
          selected={[s.status]}
          onToggle={(v) => setS({ ...s, status: v })}
        />
      </FormField>

      <div
        className="mt-5 rounded-lg p-3 flex items-start gap-3"
        style={{ border: "0.5px solid rgba(0,0,0,0.12)", backgroundColor: "rgba(240,153,123,0.06)" }}
      >
        <div
          className="rounded-md flex items-center justify-center shrink-0"
          style={{ width: 32, height: 32, backgroundColor: "color-mix(in oklch, #F0997B 18%, transparent)" }}
        >
          <Sparkles size={15} style={{ color: "#F0997B" }} />
        </div>
        <div className="flex-1">
          <div style={{ fontSize: 12, fontWeight: 500 }}>Contributeur IA</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.5, marginTop: 2 }}>
            Autorise cet employé à envoyer des suggestions (FAQ, infos) pour améliorer l'assistant. Tu valides chaque envoi.
          </div>
        </div>
        <button
          type="button"
          onClick={toggleAiContributor}
          disabled={aiSaving}
          className="rounded-full px-3 py-1 shrink-0"
          style={{
            fontSize: 11, fontWeight: 500,
            border: aiContributor ? "1px solid var(--coral)" : "0.5px solid rgba(0,0,0,0.18)",
            backgroundColor: aiContributor ? "var(--coral)" : "#fff",
            color: aiContributor ? "var(--coral-text)" : "var(--foreground)",
            opacity: aiSaving ? 0.5 : 1,
          }}
        >
          {aiContributor ? "Activé" : "Désactivé"}
        </button>
      </div>

      <div
        className="mt-3 rounded-lg p-3 flex flex-col gap-2"
        style={{ border: "0.5px solid rgba(0,0,0,0.12)", backgroundColor: "rgba(0,0,0,0.02)" }}
      >
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
          Accès au compte
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
          Génère un lien d'accès unique pour cet employé. Utile s'il a perdu son mot de passe ou n'arrive pas à se connecter. Le lien fonctionne partout (WhatsApp, mail, SMS).
        </div>
        <button
          type="button"
          onClick={regenerateLink}
          disabled={regenerating}
          className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2"
          style={{
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: "#fff",
            color: "var(--foreground)",
            border: "0.5px solid rgba(0,0,0,0.18)",
            opacity: regenerating ? 0.5 : 1,
          }}
        >
          <Link2 size={13} /> {regenerating ? "Génération…" : "Régénérer un lien d'accès"}
        </button>
        {generatedLink && (
          <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5" style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.12)" }}>
            <span className="truncate flex-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {generatedLink}
            </span>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1 rounded px-2 py-1 shrink-0"
              style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid rgba(0,0,0,0.18)" }}
            >
              <Copy size={11} /> Copier
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 mt-5">
        <PrimaryButton onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</PrimaryButton>
        <SecondaryButton onClick={onClose} disabled={saving}>Annuler</SecondaryButton>
      </div>
    </Sheet>
  );
}
