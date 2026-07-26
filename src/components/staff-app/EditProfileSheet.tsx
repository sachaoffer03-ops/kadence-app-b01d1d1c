import { useRef, useState } from "react";
import { Sheet, PrimaryButton, SecondaryButton, FormField } from "./shared";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Upload, User as UserIcon } from "lucide-react";

export interface EditableProfile {
  first_name: string;
  last_name: string;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  city: string | null;
  nationality: string | null;
  niss: string | null;
  iban: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  profile: EditableProfile;
  onSaved: (next: EditableProfile) => void;
}

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  borderColor: "rgba(0,0,0,0.12)",
  backgroundColor: "#fff",
};

function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={type === "tel" ? "tel" : type === "email" ? "email" : type === "number" ? "numeric" : undefined}
      autoComplete={type === "tel" ? "tel" : type === "email" ? "email" : undefined}
      placeholder={placeholder}

      className="w-full rounded-md border px-3 py-2.5 outline-none focus:border-[var(--foreground)]"
      style={inputStyle}
    />
  );
}

export function EditProfileSheet({ open, onClose, userId, profile, onSaved }: Props) {
  const [firstName, setFirstName] = useState(profile.first_name || "");
  const [lastName, setLastName] = useState(profile.last_name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [birthDate, setBirthDate] = useState(profile.birth_date || "");
  const [address, setAddress] = useState(profile.address || "");
  const [city, setCity] = useState(profile.city || "");
  const [nationality, setNationality] = useState(profile.nationality || "");
  const [niss, setNiss] = useState(profile.niss || "");
  const [iban, setIban] = useState(profile.iban || "");
  const [emName, setEmName] = useState(profile.emergency_contact_name || "");
  const [emPhone, setEmPhone] = useState(profile.emergency_contact_phone || "");
  const [emRel, setEmRel] = useState(profile.emergency_contact_relation || "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (f: File | null) => {
    if (!f) return;
    setPhotoFile(f);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      return toast.error("Prénom et nom sont obligatoires");
    }
    setSaving(true);
    try {
      let avatarUrl: string | null = profile.avatar_url;
      if (photoFile) {
        const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type || "image/jpeg" });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = pub.publicUrl;
      }

      const patch: EditableProfile = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        address: address.trim() || null,
        city: city.trim() || null,
        nationality: nationality.trim() || null,
        niss: niss.trim() || null,
        iban: iban.trim() || null,
        emergency_contact_name: emName.trim() || null,
        emergency_contact_phone: emPhone.trim() || null,
        emergency_contact_relation: emRel.trim() || null,
        avatar_url: avatarUrl,
      };

      const { updateOwnProfile } = await import("@/lib/profile-self.functions");
      await updateOwnProfile({ data: patch as any });

      toast.success("Profil mis à jour");
      onSaved(patch);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Modifier mon profil">
      {/* Photo */}
      <div className="flex flex-col items-center mb-5">
        <div
          className="rounded-full overflow-hidden flex items-center justify-center mb-3"
          style={{
            width: 92, height: 92,
            background: "linear-gradient(135deg, var(--coral) 0%, var(--coral-dark) 100%)",
            color: "#fff",
          }}
        >
          {photoPreview ? (
            <img src={photoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <UserIcon size={36} />
          )}
        </div>
        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex-1 rounded-md border py-2.5 inline-flex items-center justify-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.12)" }}
          >
            <Camera size={14} /> Prendre une photo
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 rounded-md border py-2.5 inline-flex items-center justify-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.12)" }}
          >
            <Upload size={14} /> Importer
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onPick(e.target.files?.[0] || null)} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0] || null)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Prénom"><TextInput value={firstName} onChange={setFirstName} /></FormField>
        <FormField label="Nom"><TextInput value={lastName} onChange={setLastName} /></FormField>
      </div>
      <FormField label="Téléphone"><TextInput value={phone} onChange={setPhone} type="tel" /></FormField>
      <FormField label="Date de naissance"><TextInput value={birthDate} onChange={setBirthDate} type="date" /></FormField>
      <FormField label="Nationalité"><TextInput value={nationality} onChange={setNationality} /></FormField>
      <FormField label="Adresse"><TextInput value={address} onChange={setAddress} /></FormField>
      <FormField label="Ville"><TextInput value={city} onChange={setCity} /></FormField>

      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 12, marginBottom: 8 }}>
        Administratif
      </div>
      <FormField label="NISS"><TextInput value={niss} onChange={setNiss} /></FormField>
      <FormField label="IBAN"><TextInput value={iban} onChange={setIban} /></FormField>

      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 12, marginBottom: 8 }}>
        Contact d'urgence
      </div>
      <FormField label="Nom"><TextInput value={emName} onChange={setEmName} /></FormField>
      <FormField label="Téléphone"><TextInput value={emPhone} onChange={setEmPhone} type="tel" /></FormField>
      <FormField label="Lien"><TextInput value={emRel} onChange={setEmRel} placeholder="Parent, conjoint…" /></FormField>

      <div className="flex flex-col gap-2 mt-5">
        <PrimaryButton onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</PrimaryButton>
        <SecondaryButton onClick={onClose} disabled={saving}>Annuler</SecondaryButton>
      </div>
    </Sheet>
  );
}
