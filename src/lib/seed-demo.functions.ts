// Seed démo complet — 5 employés fictifs avec profils 100% remplis,
// checklists par rôle, dispos juin 2026, photos uploadées dans Storage.
// Admin uniquement. Toutes les actions touchent uniquement les profils
// is_test = true avec email contenant ".demo@kadence.test".
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEMO_PASSWORD = "demo1234";
const DEMO_EMAIL_PATTERN = "%.demo@kadence.test";

// ────────────────────────────────────────────────────────────────
// 5 employés démo
// ────────────────────────────────────────────────────────────────
type DemoEmployee = {
  email: string;
  first_name: string;
  last_name: string;
  contract: "CDI" | "Étudiant" | "Flexi";
  phone: string;
  birth_date: string;
  nationality: string;
  address: string;
  city: string;
  niss: string;
  iban: string;
  hourly_rate: number;
  hire_date: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  pravatar_seed: number;
  business_roles: string[];
  score: number;
  student_card_valid?: boolean;
  quota_max?: number | null;
  avail_pattern: AvailPattern;
};

type DaySlots = { start: string; end: string }[];
type AvailPattern = Record<number, DaySlots>; // 0=Sun..6=Sat

const PAT_CLARA: AvailPattern = {
  1: [{ start: "07:00", end: "15:00" }], 2: [{ start: "07:00", end: "15:00" }],
  3: [{ start: "07:00", end: "15:00" }], 4: [{ start: "07:00", end: "15:00" }],
  5: [{ start: "07:00", end: "15:00" }], 6: [{ start: "08:00", end: "14:00" }],
};
const PAT_SOFIA: AvailPattern = {
  1: [{ start: "16:00", end: "21:00" }], 2: [{ start: "16:00", end: "21:00" }],
  4: [{ start: "16:00", end: "21:00" }], 6: [{ start: "12:00", end: "21:00" }],
};
const PAT_LEA: AvailPattern = {
  5: [{ start: "17:00", end: "23:00" }], 6: [{ start: "10:00", end: "23:00" }],
  0: [{ start: "10:00", end: "22:00" }],
};
const PAT_TOM: AvailPattern = {
  1: [{ start: "07:00", end: "12:00" }, { start: "17:00", end: "22:00" }],
  3: [{ start: "08:00", end: "13:00" }],
  5: [{ start: "17:00", end: "22:00" }],
  6: [{ start: "09:00", end: "15:00" }, { start: "18:00", end: "23:00" }],
};
const PAT_MARC: AvailPattern = {
  2: [{ start: "14:00", end: "23:00" }], 3: [{ start: "14:00", end: "23:00" }],
  4: [{ start: "14:00", end: "23:00" }], 5: [{ start: "14:00", end: "23:00" }],
  6: [{ start: "14:00", end: "23:00" }],
};

const EMPLOYEES: DemoEmployee[] = [
  {
    email: "clara.demo@kadence.test", first_name: "Clara", last_name: "Martens",
    contract: "CDI", phone: "+32 478 11 22 33", birth_date: "1995-03-15",
    nationality: "Belge", address: "Rue de la Loi 45", city: "Bruxelles",
    niss: "95.03.15-123.45", iban: "BE68 5390 0754 7034", hourly_rate: 14.50,
    hire_date: "2024-09-01", emergency_contact_name: "Sophie Martens",
    emergency_contact_phone: "+32 478 99 88 77", emergency_contact_relation: "Mère",
    pravatar_seed: 47, business_roles: ["Barista"], score: 8.7,
    avail_pattern: PAT_CLARA,
  },
  {
    email: "sofia.demo@kadence.test", first_name: "Sofia", last_name: "De Smet",
    contract: "Étudiant", phone: "+32 479 44 55 66", birth_date: "2003-08-22",
    nationality: "Belge", address: "Avenue Brugmann 200", city: "Bruxelles",
    niss: "03.08.22-234.56", iban: "BE19 5100 0008 4445", hourly_rate: 11.20,
    hire_date: "2025-02-01", emergency_contact_name: "Marc De Smet",
    emergency_contact_phone: "+32 477 66 55 44", emergency_contact_relation: "Père",
    pravatar_seed: 44, business_roles: ["Accueil"], score: 7.5,
    student_card_valid: true, quota_max: 240, avail_pattern: PAT_SOFIA,
  },
  {
    email: "lea.demo@kadence.test", first_name: "Léa", last_name: "Berger",
    contract: "Flexi", phone: "+32 470 33 22 11", birth_date: "1998-11-30",
    nationality: "Française", address: "Chaussée de Wavre 150", city: "Bruxelles",
    niss: "98.11.30-345.67", iban: "BE71 0961 2345 6769", hourly_rate: 13.80,
    hire_date: "2024-12-15", emergency_contact_name: "Lucas Berger",
    emergency_contact_phone: "+33 6 78 90 12 34", emergency_contact_relation: "Frère",
    pravatar_seed: 45, business_roles: ["Host", "Accueil"], score: 8.0,
    avail_pattern: PAT_LEA,
  },
  {
    email: "tom.demo@kadence.test", first_name: "Tom", last_name: "Lefevre",
    contract: "Étudiant", phone: "+32 491 88 77 66", birth_date: "2002-05-10",
    nationality: "Belge", address: "Rue Haute 88", city: "Bruxelles",
    niss: "02.05.10-456.78", iban: "BE08 1234 5678 9012", hourly_rate: 11.50,
    hire_date: "2025-03-15", emergency_contact_name: "Anne Lefevre",
    emergency_contact_phone: "+32 491 11 22 33", emergency_contact_relation: "Mère",
    pravatar_seed: 12, business_roles: ["Barista", "Host"], score: 7.0,
    student_card_valid: true, quota_max: 240, avail_pattern: PAT_TOM,
  },
  {
    email: "marc.demo@kadence.test", first_name: "Marc", last_name: "Dubois",
    contract: "CDI", phone: "+32 476 55 44 33", birth_date: "1988-07-04",
    nationality: "Belge", address: "Boulevard Anspach 50", city: "Bruxelles",
    niss: "88.07.04-567.89", iban: "BE62 5100 0754 7061", hourly_rate: 16.80,
    hire_date: "2024-01-15", emergency_contact_name: "Julie Dubois",
    emergency_contact_phone: "+32 476 77 88 99", emergency_contact_relation: "Épouse",
    pravatar_seed: 33, business_roles: ["Cuisine"], score: 9.1,
    avail_pattern: PAT_MARC,
  },
];

// ────────────────────────────────────────────────────────────────
// Business roles config
// ────────────────────────────────────────────────────────────────
const BUSINESS_ROLES = [
  { name: "Barista", color: "#D97706", is_kitchen: false, position: 1 },
  { name: "Accueil", color: "#2563EB", is_kitchen: false, position: 2 },
  { name: "Host",    color: "#7C3AED", is_kitchen: false, position: 3 },
  { name: "Cuisine", color: "#DC2626", is_kitchen: true,  position: 4 },
];

// ────────────────────────────────────────────────────────────────
// Checklist templates (12 = 3 phases × 4 rôles)
// ────────────────────────────────────────────────────────────────
type ChecklistDef = {
  role: string;
  phase: "opening" | "transition" | "closing";
  name: string;
  description: string;
  analyze_with_ai: boolean;
  min_photos_required: number;
  ai_validation_threshold: number;
  ai_detection_hint?: string;
  items: string[];
  photos: { label: string; description: string; is_required: boolean }[];
};

const CHECKLISTS: ChecklistDef[] = [
  // BARISTA
  {
    role: "Barista", phase: "opening", name: "Démo - Ouverture Barista",
    description: "Préparation matinale du poste barista",
    analyze_with_ai: true, min_photos_required: 2, ai_validation_threshold: 75,
    ai_detection_hint: "comptoir propre, machine prête, stock visible",
    items: [
      "Allumer la machine à café (mode chauffe)",
      "Vérifier niveau de grains (au moins 2kg en stock)",
      "Préparer le lait frais (sortir 4 bouteilles du frigo)",
      "Nettoyer le comptoir avec dégraissant",
      "Vérifier que les tasses propres sont disponibles",
      "Allumer terminal de caisse et vérifier connexion",
    ],
    photos: [
      { label: "Plan de travail prêt", description: "comptoir, machine, tasses", is_required: true },
      { label: "Frigo barista", description: "lait, sirops, alternatives lactées", is_required: false },
    ],
  },
  {
    role: "Barista", phase: "transition", name: "Démo - Transition Barista",
    description: "Passage de relais entre deux services barista",
    analyze_with_ai: false, min_photos_required: 1, ai_validation_threshold: 75,
    items: [
      "Vérifier état machine (purge, mousseur propre)",
      "Compter caisse intermédiaire",
      "Lire les notes laissées par l'équipe précédente",
    ],
    photos: [{ label: "État machine à mi-service", description: "Machine en cours de service", is_required: false }],
  },
  {
    role: "Barista", phase: "closing", name: "Démo - Fermeture Barista",
    description: "Fermeture complète du poste barista",
    analyze_with_ai: true, min_photos_required: 3, ai_validation_threshold: 80,
    ai_detection_hint: "comptoir vide propre, machine éteinte, sol propre, poubelles fermées",
    items: [
      "Nettoyer la machine à café (purge, détartrage léger)",
      "Vider et nettoyer le porte-filtre et le mousseur",
      "Ranger lait et sirops au frigo",
      "Désinfecter le comptoir",
      "Compter caisse finale (rapprocher avec terminal)",
      "Sortir les poubelles",
      "Balayer la zone barista",
      "Éteindre machine et terminal",
    ],
    photos: [
      { label: "Comptoir nettoyé", description: "Comptoir vide et propre", is_required: true },
      { label: "Machine éteinte", description: "Machine off, mousseur propre", is_required: true },
      { label: "Sol et poubelles", description: "Sol balayé, poubelles fermées", is_required: false },
    ],
  },

  // ACCUEIL
  {
    role: "Accueil", phase: "opening", name: "Démo - Ouverture Accueil",
    description: "Préparation de la zone d'accueil",
    analyze_with_ai: false, min_photos_required: 1, ai_validation_threshold: 75,
    items: [
      "Allumer l'écran d'accueil",
      "Vérifier emplacement chaises",
      "Préparer la carte du jour",
      "Ranger les magazines",
    ],
    photos: [{ label: "Zone accueil prête", description: "Vue d'ensemble accueil", is_required: true }],
  },
  {
    role: "Accueil", phase: "transition", name: "Démo - Transition Accueil",
    description: "Réorganisation à mi-service",
    analyze_with_ai: false, min_photos_required: 0, ai_validation_threshold: 75,
    items: ["Réorganiser les flyers", "Refaire le stock à l'accueil"],
    photos: [],
  },
  {
    role: "Accueil", phase: "closing", name: "Démo - Fermeture Accueil",
    description: "Fermeture de la zone d'accueil",
    analyze_with_ai: true, min_photos_required: 2, ai_validation_threshold: 75,
    ai_detection_hint: "accueil rangé, comptoir propre, écran éteint",
    items: [
      "Ranger magazines et flyers",
      "Éteindre écran d'accueil",
      "Vider la corbeille à l'accueil",
      "Désinfecter le comptoir",
    ],
    photos: [
      { label: "Accueil rangé", description: "Zone accueil rangée", is_required: true },
      { label: "Comptoir propre", description: "Comptoir désinfecté", is_required: true },
    ],
  },

  // HOST
  {
    role: "Host", phase: "opening", name: "Démo - Ouverture Host",
    description: "Préparation salle et accueil clients",
    analyze_with_ai: false, min_photos_required: 0, ai_validation_threshold: 75,
    items: [
      "Vérifier réservations du jour",
      "Préparer plan de salle",
      "Allumer carillons et écrans",
    ],
    photos: [],
  },
  {
    role: "Host", phase: "transition", name: "Démo - Transition Host",
    description: "Reset à mi-service",
    analyze_with_ai: false, min_photos_required: 0, ai_validation_threshold: 75,
    items: ["Compter couverts disponibles", "Reset des terminaux paiement"],
    photos: [],
  },
  {
    role: "Host", phase: "closing", name: "Démo - Fermeture Host",
    description: "Fermeture salle et terrasse",
    analyze_with_ai: true, min_photos_required: 2, ai_validation_threshold: 75,
    ai_detection_hint: "salle vide et rangée, chaises propres, terminaux fermés",
    items: [
      "Ranger les menus",
      "Éteindre écrans terrasse",
      "Nettoyer les chaises hautes",
      "Fermer les terminaux paiement",
    ],
    photos: [
      { label: "Salle vide rangée", description: "Salle vide après service", is_required: true },
      { label: "Terrasse", description: "Terrasse rangée", is_required: true },
    ],
  },

  // CUISINE
  {
    role: "Cuisine", phase: "opening", name: "Démo - Ouverture Cuisine",
    description: "Mise en place cuisine",
    analyze_with_ai: true, min_photos_required: 3, ai_validation_threshold: 85,
    ai_detection_hint: "plan de travail propre, stations prêtes, frigos OK",
    items: [
      "Vérifier températures frigo et congélo",
      "Mise en place des stations",
      "Sortir produits du jour",
      "Allumer les plaques et fours",
      "Vérifier propreté du plan de travail",
      "Préparer mise en place sauces",
    ],
    photos: [
      { label: "Plan de travail propre", description: "Plan de travail nettoyé", is_required: true },
      { label: "Frigos OK", description: "Frigos avec température affichée", is_required: true },
      { label: "Stations mise en place", description: "Stations prêtes", is_required: true },
    ],
  },
  {
    role: "Cuisine", phase: "transition", name: "Démo - Transition Cuisine",
    description: "Update mise en place et stations",
    analyze_with_ai: false, min_photos_required: 0, ai_validation_threshold: 75,
    items: ["Update mise en place", "Reset station chaud", "Vérifier stocks"],
    photos: [],
  },
  {
    role: "Cuisine", phase: "closing", name: "Démo - Fermeture Cuisine",
    description: "Fermeture complète cuisine",
    analyze_with_ai: true, min_photos_required: 4, ai_validation_threshold: 90,
    ai_detection_hint: "cuisine entièrement propre, sol propre, équipements éteints",
    items: [
      "Nettoyer plaques et fours",
      "Désinfecter plans de travail",
      "Ranger sauces et préparations",
      "Vider poubelles cuisine",
      "Balayer et serpiller",
      "Fermer frigos avec contrôle température",
      "Éteindre toutes les équipements",
      "Sortir linge sale",
    ],
    photos: [
      { label: "Cuisine propre", description: "Vue d'ensemble cuisine propre", is_required: true },
      { label: "Plaques nettoyées", description: "Plaques et fours nettoyés", is_required: true },
      { label: "Frigos fermés", description: "Frigos fermés avec température", is_required: true },
      { label: "Sol propre", description: "Sol propre après serpillière", is_required: true },
    ],
  },
];

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin");
  if (!ok) throw new Error("Réservé aux administrateurs");
}

async function ensureStudio(): Promise<{ id: string; name: string }> {
  const { data: studios } = await supabaseAdmin
    .from("studios").select("id, name").is("deleted_at", null).order("created_at").limit(1);
  let studioId = studios?.[0]?.id as string | undefined;
  let studioName = studios?.[0]?.name as string | undefined;
  if (!studioId) {
    const { data: ins, error } = await supabaseAdmin.from("studios").insert({
      name: "Brussels Centre",
      short_name: "Centre",
      address: "Avenue Louise 100, 1050 Bruxelles",
      city: "Bruxelles",
      postal_code: "1050",
      phone: "+32 2 555 12 34",
      capacity: 30,
      has_kitchen: true,
    }).select("id, name").single();
    if (error) throw new Error(`studio: ${error.message}`);
    studioId = ins.id; studioName = ins.name;
  }
  await supabaseAdmin.from("studios").update({
    current_qr_code: "DEMO5",
    clock_in_grace_period_min: 15,
    clock_out_grace_period_min: 20,
    clock_out_button_appears_before_min: 30,
    geofencing_enabled: false,
  }).eq("id", studioId!);
  return { id: studioId!, name: studioName! };
}

async function ensureBusinessRoles(studioId: string) {
  for (const br of BUSINESS_ROLES) {
    const { data: existing } = await supabaseAdmin
      .from("business_roles").select("id").eq("name", br.name).maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("business_roles").insert({
        name: br.name, color: br.color, is_kitchen: br.is_kitchen,
        position: br.position, is_active: true,
      });
    } else {
      await supabaseAdmin.from("business_roles").update({
        color: br.color, is_kitchen: br.is_kitchen, is_active: true,
      }).eq("id", existing.id);
    }
    // S'assure que le studio offre ce rôle
    await supabaseAdmin.from("studio_business_roles")
      .upsert({ studio_id: studioId, role: br.name }, { onConflict: "studio_id,role" });
  }
}

async function uploadAvatar(userId: string, seed: number, firstName: string, lastName: string): Promise<string | null> {
  try {
    const path = `${userId}/profile.jpg`;
    // Fetch image depuis pravatar
    let buffer: ArrayBuffer | null = null;
    let contentType = "image/jpeg";
    try {
      const res = await fetch(`https://i.pravatar.cc/300?img=${seed}`, { redirect: "follow" });
      if (res.ok) {
        buffer = await res.arrayBuffer();
        contentType = res.headers.get("content-type") || "image/jpeg";
      }
    } catch {}
    if (!buffer) {
      // Fallback ui-avatars
      const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName + " " + lastName)}&size=300&background=random&format=png`;
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) return null;
      buffer = await res.arrayBuffer();
      contentType = "image/png";
    }
    await supabaseAdmin.storage.from("avatars").remove([path]).catch(() => {});
    const { error } = await supabaseAdmin.storage.from("avatars").upload(path, buffer, {
      contentType, upsert: true,
    });
    if (error) return null;
    const { data } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
}

async function purgeUserData(userId: string) {
  await supabaseAdmin.from("notifications").delete().eq("user_id", userId);
  await supabaseAdmin.from("modification_requests").delete().eq("user_id", userId);
  await supabaseAdmin.from("shift_proposals").delete().eq("user_id", userId);
  await supabaseAdmin.from("employee_documents").delete().eq("user_id", userId);
  await supabaseAdmin.from("availabilities").delete().eq("user_id", userId);
  try { await supabaseAdmin.from("training_content_progress").delete().eq("user_id", userId); } catch {}
  try { await supabaseAdmin.from("training_course_completions").delete().eq("user_id", userId); } catch {}
  try { await supabaseAdmin.from("training_quiz_attempts").delete().eq("user_id", userId); } catch {}
  await supabaseAdmin.from("feedbacks").delete().eq("author_id", userId);
  const { data: shifts } = await supabaseAdmin.from("shifts").select("id").eq("user_id", userId);
  const shiftIds = (shifts ?? []).map((s: any) => s.id);
  if (shiftIds.length) {
    const { data: subs } = await supabaseAdmin.from("checklist_submissions").select("id").in("shift_id", shiftIds);
    const subIds = (subs ?? []).map((s: any) => s.id);
    if (subIds.length) {
      await supabaseAdmin.from("checklist_submission_items").delete().in("submission_id", subIds);
      await supabaseAdmin.from("checklist_submission_photos").delete().in("submission_id", subIds);
      await supabaseAdmin.from("closure_question_responses").delete().in("submission_id", subIds);
      await supabaseAdmin.from("checklist_submissions").delete().in("id", subIds);
    }
    await supabaseAdmin.from("shift_clock_audit").delete().in("shift_id", shiftIds);
    await supabaseAdmin.from("shift_handoffs").delete().in("shift_id", shiftIds);
    await supabaseAdmin.from("shift_reports").delete().in("shift_id", shiftIds);
  }
  await supabaseAdmin.from("shifts").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_business_roles").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_studios").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_contracts").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
}

async function deleteEmployeeFully(userId: string) {
  await purgeUserData(userId);
  // Storage avatar + documents
  await supabaseAdmin.storage.from("avatars").remove([`${userId}/profile.jpg`]).catch(() => {});
  const { data: files } = await supabaseAdmin.storage.from("employee-documents").list(userId);
  if (files?.length) {
    await supabaseAdmin.storage.from("employee-documents")
      .remove(files.map((f: any) => `${userId}/${f.name}`));
  }
  await supabaseAdmin.from("invitations").delete().eq("email",
    (await supabaseAdmin.from("profiles").select("email").eq("id", userId).maybeSingle()).data?.email ?? "");
  await supabaseAdmin.from("profiles").delete().eq("id", userId);
  await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
}

async function findDemoUserIdByEmail(email: string): Promise<string | null> {
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  return list?.users?.find((u: any) => u.email === email)?.id ?? null;
}

async function createOrUpdateEmployee(
  cfg: DemoEmployee, studioId: string, adminId: string
): Promise<{ id: string; created: boolean }> {
  // 1. Auth user (create or update password)
  let userId = await findDemoUserIdByEmail(cfg.email);
  let created = false;
  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: cfg.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: cfg.first_name, last_name: cfg.last_name },
    });
    if (error || !data?.user) throw new Error(`createUser ${cfg.email}: ${error?.message}`);
    userId = data.user.id;
    created = true;
  } else {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD, email_confirm: true,
    });
  }

  // 2. Avatar upload (best effort)
  const avatarUrl = await uploadAvatar(userId!, cfg.pravatar_seed, cfg.first_name, cfg.last_name);

  // 3. Profile complet
  await supabaseAdmin.from("profiles").upsert({
    id: userId!,
    email: cfg.email,
    first_name: cfg.first_name,
    last_name: cfg.last_name,
    phone: cfg.phone,
    birth_date: cfg.birth_date,
    nationality: cfg.nationality,
    address: cfg.address,
    city: cfg.city,
    niss: cfg.niss,
    iban: cfg.iban,
    hourly_rate: cfg.hourly_rate,
    hire_date: cfg.hire_date,
    emergency_contact_name: cfg.emergency_contact_name,
    emergency_contact_phone: cfg.emergency_contact_phone,
    emergency_contact_relation: cfg.emergency_contact_relation,
    avatar_url: avatarUrl,
    status: "active",
    contract: cfg.contract,
    studio_id: studioId,
    score: cfg.score,
    student_card_valid: cfg.student_card_valid ?? false,
    quota_max: cfg.quota_max ?? null,
    quota_used: 0,
    is_test: true,
    is_protected: false,
  }, { onConflict: "id" });

  // 4. Rôles app / contrat / studios / business_roles
  await supabaseAdmin.from("user_roles")
    .upsert({ user_id: userId!, role: "employee" }, { onConflict: "user_id,role" });
  await supabaseAdmin.from("user_contracts")
    .upsert({ user_id: userId!, contract: cfg.contract }, { onConflict: "user_id,contract" });
  await supabaseAdmin.from("user_studios")
    .upsert({ user_id: userId!, studio_id: studioId }, { onConflict: "user_id,studio_id" });
  // Reset business roles puis ré-insert
  await supabaseAdmin.from("user_business_roles").delete().eq("user_id", userId!);
  if (cfg.business_roles.length) {
    await supabaseAdmin.from("user_business_roles").insert(
      cfg.business_roles.map(r => ({ user_id: userId!, role: r }))
    );
  }

  // 5. Invitation acceptée (simulation flow normal)
  await supabaseAdmin.from("invitations").delete().eq("email", cfg.email);
  await supabaseAdmin.from("invitations").insert({
    email: cfg.email,
    first_name: cfg.first_name,
    last_name: cfg.last_name,
    phone: cfg.phone,
    app_role: "employee",
    contracts: [cfg.contract],
    business_roles: cfg.business_roles,
    studio_ids: [studioId],
    hire_date: cfg.hire_date,
    status: "accepted",
    accepted_at: new Date().toISOString(),
    created_by: adminId,
  });

  // 6. Dispos juin 2026
  await insertJuneAvailabilities(userId!, cfg.avail_pattern);

  return { id: userId!, created };
}

async function insertJuneAvailabilities(userId: string, pattern: AvailPattern) {
  await supabaseAdmin.from("availabilities").delete().eq("user_id", userId);
  const rows: any[] = [];
  const start = new Date(2026, 5, 1); // June 2026 (month 5 = June)
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dow = d.getDay();
    const slots = pattern[dow];
    if (!slots) continue;
    for (const s of slots) {
      rows.push({
        user_id: userId,
        avail_date: fmtDate(d),
        start_time: `${s.start}:00`,
        end_time: `${s.end}:00`,
      });
    }
  }
  if (rows.length) await supabaseAdmin.from("availabilities").insert(rows);
}

async function purgeAllDemoChecklistTemplates() {
  const { data: tpls } = await supabaseAdmin
    .from("checklist_templates").select("id").like("name", "Démo%");
  const ids = (tpls ?? []).map((t: any) => t.id);
  if (!ids.length) return;
  await supabaseAdmin.from("checklist_template_items").delete().in("template_id", ids);
  await supabaseAdmin.from("checklist_template_photos").delete().in("template_id", ids);
  await supabaseAdmin.from("checklist_templates").delete().in("id", ids);
}

async function createAllChecklistTemplates(studioId: string) {
  for (const def of CHECKLISTS) {
    const { data: br } = await supabaseAdmin
      .from("business_roles").select("id").eq("name", def.role).maybeSingle();
    const brId = br?.id ?? null;
    const { data: tpl, error } = await supabaseAdmin.from("checklist_templates").insert({
      studio_id: studioId,
      business_role_id: brId,
      name: def.name,
      description: def.description,
      phase: def.phase,
      is_active: true,
      is_blocking: def.phase === "closing",
      analyze_with_ai: def.analyze_with_ai,
      ai_validation_threshold: def.ai_validation_threshold,
      ai_detection_hint: def.ai_detection_hint ?? null,
      min_photos_required: def.min_photos_required,
    } as any).select("id").single();
    if (error) throw new Error(`template ${def.name}: ${error.message}`);
    const tplId = tpl!.id;
    // Photos
    let photoMap = new Map<string, string>();
    if (def.photos.length) {
      const { data: photoRows } = await supabaseAdmin.from("checklist_template_photos").insert(
        def.photos.map((p, i) => ({
          template_id: tplId, label: p.label, description: p.description,
          is_required: p.is_required, order_index: i,
        }))
      ).select("id, label");
      photoMap = new Map((photoRows ?? []).map((p: any) => [p.label, p.id]));
    }
    // Items: si on a des photos, on associe le 1er item à la 1ère photo, etc., sinon null
    const photoIds = Array.from(photoMap.values());
    await supabaseAdmin.from("checklist_template_items").insert(
      def.items.map((label, i) => ({
        template_id: tplId,
        label,
        order_index: i,
        is_required: true,
        photo_zone_id: photoIds[i] ?? null,
      }))
    );
  }
}

// ────────────────────────────────────────────────────────────────
// Server functions
// ────────────────────────────────────────────────────────────────

export const getDemoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, first_name, last_name, contract, hourly_rate, score, avatar_url, updated_at")
      .eq("is_test", true)
      .like("email", DEMO_EMAIL_PATTERN);

    const byEmail = new Map((profiles ?? []).map((p: any) => [p.email, p]));
    const employees = EMPLOYEES.map(cfg => {
      const p = byEmail.get(cfg.email);
      return {
        config: {
          email: cfg.email,
          first_name: cfg.first_name,
          last_name: cfg.last_name,
          contract: cfg.contract,
          hourly_rate: cfg.hourly_rate,
          score: cfg.score,
          business_roles: cfg.business_roles,
        },
        exists: !!p,
        profile: p ? {
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          contract: p.contract,
          hourly_rate: p.hourly_rate,
          score: p.score,
          avatar_url: p.avatar_url,
          updated_at: p.updated_at,
        } : null,
      };
    });

    return {
      employees,
      password: DEMO_PASSWORD,
      anyExists: employees.some(e => e.exists),
    };
  });

export const resetDemoEnvironment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const log: string[] = [];
    const t0 = Date.now();

    // 1. Cleanup total des données démo
    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles").select("id, email").eq("is_test", true).like("email", DEMO_EMAIL_PATTERN);
    for (const p of existingProfiles ?? []) {
      await deleteEmployeeFully(p.id);
    }
    log.push(`Cleanup: ${existingProfiles?.length ?? 0} profil(s) démo supprimé(s)`);

    // Cleanup orphans (auth users sans profile, ex: anciennes versions)
    const { data: allAuth } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    for (const u of allAuth?.users ?? []) {
      if (u.email?.endsWith(".demo@kadence.test")) {
        await supabaseAdmin.auth.admin.deleteUser(u.id).catch(() => {});
      }
    }
    await purgeAllDemoChecklistTemplates();
    log.push("Templates checklist 'Démo%' purgés");

    // 2. Studio + business roles + studio_business_roles
    const studio = await ensureStudio();
    log.push(`Studio configuré: ${studio.name}`);
    await ensureBusinessRoles(studio.id);
    log.push("Business roles configurés (Barista/Accueil/Host/Cuisine)");

    // 3. Création des 5 employés
    const createdEmployees: { email: string; id: string }[] = [];
    for (const cfg of EMPLOYEES) {
      const { id } = await createOrUpdateEmployee(cfg, studio.id, userId);
      createdEmployees.push({ email: cfg.email, id });
      log.push(`Employé créé: ${cfg.first_name} ${cfg.last_name} (${cfg.contract})`);
    }

    // 4. Checklists templates
    await createAllChecklistTemplates(studio.id);
    log.push(`${CHECKLISTS.length} templates checklist créés (3 phases × 4 rôles)`);

    return {
      ok: true,
      log,
      duration_ms: Date.now() - t0,
      employees: createdEmployees,
      password: DEMO_PASSWORD,
    };
  });

export const regenerateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const cfg = EMPLOYEES.find(e => e.email === data.email);
    if (!cfg) throw new Error(`Email démo inconnu: ${data.email}`);

    const existingId = await findDemoUserIdByEmail(cfg.email);
    if (existingId) await deleteEmployeeFully(existingId);

    const studio = await ensureStudio();
    await ensureBusinessRoles(studio.id);
    const { id } = await createOrUpdateEmployee(cfg, studio.id, userId);
    return { ok: true, employeeId: id, email: cfg.email };
  });

export const regenerateJuneAvailabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let count = 0;
    for (const cfg of EMPLOYEES) {
      const uid = await findDemoUserIdByEmail(cfg.email);
      if (!uid) continue;
      await insertJuneAvailabilities(uid, cfg.avail_pattern);
      count++;
    }
    return { ok: true, regenerated: count };
  });

export const regenerateChecklists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const studio = await ensureStudio();
    await purgeAllDemoChecklistTemplates();
    await createAllChecklistTemplates(studio.id);
    return { ok: true, count: CHECKLISTS.length };
  });

export const cleanupAllDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ confirm: z.literal("DELETE") }).parse(input))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: demoProfiles } = await supabaseAdmin
      .from("profiles").select("id, email").eq("is_test", true).like("email", DEMO_EMAIL_PATTERN);
    let deletedProfiles = 0;
    for (const p of demoProfiles ?? []) {
      await deleteEmployeeFully(p.id);
      deletedProfiles++;
    }
    // Auth orphans
    const { data: allAuth } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    for (const u of allAuth?.users ?? []) {
      if (u.email?.endsWith(".demo@kadence.test")) {
        await supabaseAdmin.auth.admin.deleteUser(u.id).catch(() => {});
      }
    }
    await purgeAllDemoChecklistTemplates();
    return { ok: true, deletedProfiles };
  });

// Kept for compatibility — generates a testable shift for Clara if she exists
export const renewTestableShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: clara } = await supabaseAdmin
      .from("profiles").select("id, studio_id").eq("email", "clara.demo@kadence.test").maybeSingle();
    if (!clara) throw new Error("Clara démo introuvable. Réinitialise d'abord.");

    const now = new Date();
    const in2h = new Date(now.getTime() + 2 * 60 * 60_000);
    const { data: toDelete } = await supabaseAdmin
      .from("shifts").select("id, shift_date, start_time")
      .eq("user_id", clara.id).is("clocked_out_at", null)
      .gte("shift_date", fmtDate(now)).lte("shift_date", fmtDate(in2h));
    const toDeleteIds = (toDelete ?? []).filter((s: any) => {
      return new Date(`${s.shift_date}T${s.start_time}`).getTime() <= in2h.getTime();
    }).map((s: any) => s.id);
    if (toDeleteIds.length) await supabaseAdmin.from("shifts").delete().in("id", toDeleteIds);

    const start = new Date(now.getTime() + 15 * 60_000);
    const end = new Date(now.getTime() + 4 * 60 * 60_000);
    const dateStr = fmtDate(start);
    const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    const { data: inserted, error } = await supabaseAdmin.from("shifts").insert({
      user_id: clara.id, studio_id: clara.studio_id,
      business_role: "Barista", shift_date: dateStr,
      start_time: fmtTime(start), end_time: fmtTime(end),
      status: "scheduled",
      published_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
      is_manual: true,
    }).select("id").single();
    if (error) throw new Error(`renew shift: ${error.message}`);
    return { ok: true, shiftId: inserted?.id, deleted: toDeleteIds.length };
  });
