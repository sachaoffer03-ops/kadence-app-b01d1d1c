// Seeder de données fictives pour tester le moteur de planning.
// Étapes : nettoyage des profils non-protégés → création studios/rôles/templates si manquants
// → création de 30 employés fictifs avec dispos sur 4 semaines.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// La protection des profils est désormais portée par profiles.is_protected (DB).
// Les admins sont toujours protégés implicitement (via user_roles.role='admin').

// ---------- Helpers ----------
function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtTime(h: number, m: number) { return `${pad(h)}:${pad(m)}:00`; }
function slug(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
}

// Noms belges/francophones
const FIRST_NAMES = ["Léa", "Hugo", "Inès", "Tom", "Sofia", "Nicolas", "Camille", "Lucas", "Emma", "Maxime",
  "Chloé", "Antoine", "Jade", "Théo", "Manon", "Adrien", "Sarah", "Romain", "Léna", "Quentin",
  "Alice", "Julien", "Eva", "Mehdi", "Yasmine", "Bastien", "Anaïs", "Florian", "Marine", "Élise"];
const LAST_NAMES = ["Dupont", "Lambert", "Moreau", "Janssens", "Mercier", "Vandenberg", "Leroy", "Dubois",
  "Peeters", "Martin", "Maes", "Wauters", "Hendrickx", "Lefèvre", "Goossens", "Claes", "De Smet",
  "Bernard", "Petit", "Rousseau", "Vermeulen", "Lemaire", "Fontaine", "Gérard", "Henry", "Simon",
  "Laurent", "Renard", "Thomas", "Pirard"];
const NATIONALITIES = ["Belge", "Belge", "Belge", "Française", "Marocaine", "Italienne", "Portugaise"];
const CITIES = ["Bruxelles", "Ixelles", "Saint-Gilles", "Etterbeek", "Uccle", "Schaerbeek", "Forest"];
const STREETS = ["Rue de la Paix", "Avenue Louise", "Rue du Bailli", "Chaussée de Waterloo",
  "Rue Lesbroussart", "Avenue Brugmann", "Rue Américaine", "Place Flagey"];

// ---------- Cleanup ----------
async function cleanup(log: string[]) {
  // 1. Identifier les profils à garder
  const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
  const adminIds = new Set((adminRoles ?? []).map((r: any) => r.user_id));

  const { data: protectedProfiles } = await supabaseAdmin.from("profiles")
    .select("id, email").eq("is_protected", true);
  const protectedIds = new Set((protectedProfiles ?? []).map((p: any) => p.id));

  const keepIds = new Set([...adminIds, ...protectedIds]);

  const { data: allProfiles } = await supabaseAdmin.from("profiles").select("id, email");
  const toDelete = (allProfiles ?? []).filter((p: any) => !keepIds.has(p.id));
  const deleteIds = toDelete.map((p: any) => p.id);

  log.push(`${toDelete.length} profils à supprimer`);
  log.push(`${keepIds.size} profils protégés (admins + flag is_protected)`);

  if (deleteIds.length === 0) return { deletedProfiles: 0, deletedLinked: 0, keptEmails: [] };

  // 2. Supprimer toutes les données liées en cascade
  let linkedCount = 0;
  const tables = [
    "availabilities", "shifts", "user_contracts", "user_studios", "user_business_roles",
    "user_roles", "notifications", "modification_requests", "shift_proposals",
    "formation_completions", "shift_handoffs", "shift_reports",
  ];
  for (const t of tables) {
    const { error, count } = await (supabaseAdmin.from(t as any) as any).delete({ count: "exact" }).in("user_id", deleteIds);
    if (error) console.warn(`[seed] cleanup ${t}:`, error.message);
    else linkedCount += count ?? 0;
  }

  // feedbacks (author_id)
  const { count: fbCount } = await supabaseAdmin.from("feedbacks").delete({ count: "exact" }).in("author_id", deleteIds);
  linkedCount += fbCount ?? 0;
  // signalements (author_id)
  const { count: sigCount } = await supabaseAdmin.from("signalements").delete({ count: "exact" }).in("author_id", deleteIds);
  linkedCount += sigCount ?? 0;
  // messages (sender ou recipient)
  const { count: msgCount1 } = await supabaseAdmin.from("messages").delete({ count: "exact" }).in("sender_id", deleteIds);
  const { count: msgCount2 } = await supabaseAdmin.from("messages").delete({ count: "exact" }).in("recipient_id", deleteIds);
  linkedCount += (msgCount1 ?? 0) + (msgCount2 ?? 0);
  // invitations (created_by)
  await supabaseAdmin.from("invitations").delete().in("created_by", deleteIds);

  // 3. Supprimer les profils
  await supabaseAdmin.from("profiles").delete().in("id", deleteIds);

  // 4. Supprimer les comptes auth
  for (const id of deleteIds) {
    try { await supabaseAdmin.auth.admin.deleteUser(id); }
    catch (e: any) { console.warn(`[seed] auth delete ${id}:`, e?.message); }
  }

  return {
    deletedProfiles: toDelete.length,
    deletedLinked: linkedCount,
    keptEmails: [...protectedIds].length > 0
      ? (protectedProfiles ?? []).map((p: any) => p.email)
      : [],
  };
}

// ---------- Studios + roles + settings ----------
async function ensureBaseConfig(log: string[]) {
  // Studios — réutiliser les studios existants par fuzzy match avant d'en créer
  const { data: existingStudios } = await supabaseAdmin.from("studios").select("id, name");
  const all = existingStudios ?? [];
  const findFuzzy = (needle: string) => {
    const n = needle.toLowerCase();
    return all.find((s: any) => s.name.toLowerCase().includes(n));
  };
  const ensureStudio = async (search: string, fallbackName: string) => {
    const found = findFuzzy(search);
    if (found) { log.push(`Studio "${found.name}" réutilisé`); return found.id as string; }
    const { data } = await supabaseAdmin.from("studios").insert({ name: fallbackName }).select("id, name").single();
    log.push(`Studio "${fallbackName}" créé`);
    if (data) all.push(data);
    return data!.id as string;
  };
  const rhodeId = await ensureStudio("rhode", "Skult Rhodes");
  const chatelainId = await ensureStudio("châtelain", "Skult Châtelain");
  const studiosByName = new Map<string, string>([["Rhode", rhodeId], ["Châtelain", chatelainId]]);

  // Business roles
  const desiredRoles = [
    { name: "Accueil", color: "#3B82F6", position: 1 },
    { name: "Barista", color: "#F59E0B", position: 2 },
    { name: "Host", color: "#10B981", position: 3 },
    { name: "Cuisine", color: "#EF4444", position: 4 },
  ];
  const { data: existingRoles } = await supabaseAdmin.from("business_roles").select("name");
  const existingRoleNames = new Set((existingRoles ?? []).map((r: any) => r.name));
  for (const r of desiredRoles) {
    if (!existingRoleNames.has(r.name)) {
      await supabaseAdmin.from("business_roles").insert({ ...r, is_active: true });
      log.push(`Rôle "${r.name}" créé`);
    }
  }

  // ai_planning_settings
  const { data: existingSettings } = await supabaseAdmin.from("ai_planning_settings").select("id").limit(1);
  if (!existingSettings || existingSettings.length === 0) {
    await supabaseAdmin.from("ai_planning_settings").insert({ max_shift_hours_cdi: 9.5 });
    log.push("ai_planning_settings initialisé");
  }

  return {
    rhodeId: studiosByName.get("Rhode")!,
    chatelainId: studiosByName.get("Châtelain")!,
  };
}

// ---------- Staffing templates ----------
async function ensureStaffingTemplates(rhodeId: string, chatelainId: string, log: string[]) {
  let created = 0;

  // Vérifier si déjà présents pour chaque studio
  const { data: existing } = await supabaseAdmin.from("staffing_templates").select("studio_id");
  const studiosWithTemplates = new Set((existing ?? []).map((t: any) => t.studio_id));

  type Tpl = {
    studio_id: string; day_of_week: number; start_time: string; end_time: string;
    business_role: string; allowed_roles: string[]; required_count?: number;
    is_optional?: boolean; required_contract?: string | null; allowed_contracts?: string[];
  };
  const templates: Tpl[] = [];

  // RHODE — Accueil
  if (!studiosWithTemplates.has(rhodeId)) {
    templates.push({ studio_id: rhodeId, day_of_week: 0, start_time: "08:30:00", end_time: "14:00:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: rhodeId, day_of_week: 0, start_time: "16:30:00", end_time: "20:00:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: rhodeId, day_of_week: 1, start_time: "07:30:00", end_time: "13:00:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: rhodeId, day_of_week: 1, start_time: "16:30:00", end_time: "21:00:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    for (const d of [2, 3]) {
      templates.push({ studio_id: rhodeId, day_of_week: d, start_time: "07:30:00", end_time: "14:00:00",
        business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
      templates.push({ studio_id: rhodeId, day_of_week: d, start_time: "16:30:00", end_time: "20:00:00",
        business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    }
    templates.push({ studio_id: rhodeId, day_of_week: 4, start_time: "07:30:00", end_time: "14:00:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: rhodeId, day_of_week: 4, start_time: "15:30:00", end_time: "18:30:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: rhodeId, day_of_week: 5, start_time: "08:30:00", end_time: "12:00:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: rhodeId, day_of_week: 5, start_time: "12:00:00", end_time: "15:00:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: rhodeId, day_of_week: 6, start_time: "08:30:00", end_time: "13:30:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: rhodeId, day_of_week: 6, start_time: "13:30:00", end_time: "18:00:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
  }

  // CHÂTELAIN
  if (!studiosWithTemplates.has(chatelainId)) {
    for (const d of [0, 1, 2, 3]) {
      templates.push({ studio_id: chatelainId, day_of_week: d, start_time: "08:30:00", end_time: "13:15:00",
        business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    }
    templates.push({ studio_id: chatelainId, day_of_week: 4, start_time: "07:30:00", end_time: "15:30:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: chatelainId, day_of_week: 4, start_time: "08:30:00", end_time: "13:15:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: chatelainId, day_of_week: 4, start_time: "15:30:00", end_time: "19:15:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: chatelainId, day_of_week: 4, start_time: "17:15:00", end_time: "20:15:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: chatelainId, day_of_week: 5, start_time: "08:30:00", end_time: "12:15:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: chatelainId, day_of_week: 5, start_time: "12:15:00", end_time: "15:15:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: chatelainId, day_of_week: 6, start_time: "08:30:00", end_time: "13:30:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });
    templates.push({ studio_id: chatelainId, day_of_week: 6, start_time: "13:30:00", end_time: "17:15:00",
      business_role: "Accueil", allowed_roles: ["Accueil", "Barista", "Host"] });

    for (const d of [0, 1]) {
      templates.push({ studio_id: chatelainId, day_of_week: d, start_time: "07:30:00", end_time: "15:30:00",
        business_role: "Barista", allowed_roles: ["Barista"] });
      templates.push({ studio_id: chatelainId, day_of_week: d, start_time: "15:30:00", end_time: "19:15:00",
        business_role: "Barista", allowed_roles: ["Barista"] });
      templates.push({ studio_id: chatelainId, day_of_week: d, start_time: "17:30:00", end_time: "21:15:00",
        business_role: "Barista", allowed_roles: ["Barista"] });
    }
    templates.push({ studio_id: chatelainId, day_of_week: 2, start_time: "07:30:00", end_time: "15:30:00",
      business_role: "Barista", allowed_roles: ["Barista"] });
    templates.push({ studio_id: chatelainId, day_of_week: 2, start_time: "15:30:00", end_time: "19:30:00",
      business_role: "Barista", allowed_roles: ["Barista"] });
    templates.push({ studio_id: chatelainId, day_of_week: 2, start_time: "17:15:00", end_time: "20:15:00",
      business_role: "Barista", allowed_roles: ["Barista"] });
    for (const d of [3, 4]) {
      templates.push({ studio_id: chatelainId, day_of_week: d, start_time: "07:30:00", end_time: "15:30:00",
        business_role: "Barista", allowed_roles: ["Barista"] });
      templates.push({ studio_id: chatelainId, day_of_week: d, start_time: "15:30:00", end_time: "19:15:00",
        business_role: "Barista", allowed_roles: ["Barista"] });
      templates.push({ studio_id: chatelainId, day_of_week: d, start_time: "17:15:00", end_time: "20:15:00",
        business_role: "Barista", allowed_roles: ["Barista"] });
    }
    for (const d of [5, 6]) {
      templates.push({ studio_id: chatelainId, day_of_week: d, start_time: "08:45:00", end_time: "13:30:00",
        business_role: "Barista", allowed_roles: ["Barista"] });
      templates.push({ studio_id: chatelainId, day_of_week: d, start_time: "13:30:00", end_time: "18:15:00",
        business_role: "Barista", allowed_roles: ["Barista"] });
    }
  }

  if (templates.length > 0) {
    const normalized = templates.map((t) => ({
      studio_id: t.studio_id,
      day_of_week: t.day_of_week,
      start_time: t.start_time,
      end_time: t.end_time,
      business_role: t.business_role,
      allowed_roles: t.allowed_roles ?? [],
      allowed_contracts: t.allowed_contracts ?? [],
      required_count: t.required_count ?? 1,
      is_optional: t.is_optional ?? false,
      required_contract: t.required_contract ?? null,
    }));
    const { error } = await supabaseAdmin.from("staffing_templates").insert(normalized as any);
    if (error) throw new Error(`staffing_templates: ${error.message}`);
    created = normalized.length;
    log.push(`${created} staffing_templates créés`);
  } else {
    log.push("staffing_templates déjà présents");
  }
  return created;
}

// ---------- Profils ----------
type EmployeeSpec = {
  contract: "CDI" | "Étudiant" | "Flexi";
  roles: string[];
  studios: ("rhode" | "chatelain")[];
  forcedName?: { first: string; last: string };
};

function buildEmployeeSpecs(): EmployeeSpec[] {
  const specs: EmployeeSpec[] = [];

  // 8 CDI
  // Marco Bianchi - cuisine unique
  specs.push({ contract: "CDI", roles: ["Cuisine"], studios: ["chatelain"], forcedName: { first: "Marco", last: "Bianchi" } });
  // 7 CDI polyvalents — 4 Châtelain, 3 Rhode, 1 sur les 2
  specs.push({ contract: "CDI", roles: ["Accueil", "Barista"], studios: ["chatelain"] });
  specs.push({ contract: "CDI", roles: ["Accueil", "Barista", "Host"], studios: ["chatelain"] });
  specs.push({ contract: "CDI", roles: ["Accueil", "Barista"], studios: ["chatelain"] });
  specs.push({ contract: "CDI", roles: ["Accueil", "Barista", "Host"], studios: ["chatelain"] });
  specs.push({ contract: "CDI", roles: ["Accueil", "Barista"], studios: ["rhode"] });
  specs.push({ contract: "CDI", roles: ["Accueil", "Barista", "Host"], studios: ["rhode"] });
  specs.push({ contract: "CDI", roles: ["Accueil", "Barista"], studios: ["rhode", "chatelain"] });

  // 15 Étudiants — 6 Rhode, 6 Châtelain polyvalents, 2 poly, 1 cuisine week-end (Léa Bernardi)
  for (let i = 0; i < 6; i++) {
    specs.push({ contract: "Étudiant", roles: i % 3 === 0 ? ["Accueil", "Barista", "Host"] : ["Accueil", "Barista"], studios: ["rhode"] });
  }
  for (let i = 0; i < 6; i++) {
    specs.push({ contract: "Étudiant", roles: i % 3 === 0 ? ["Accueil", "Barista", "Host"] : ["Accueil", "Barista"], studios: ["chatelain"] });
  }
  for (let i = 0; i < 2; i++) {
    specs.push({ contract: "Étudiant", roles: ["Accueil", "Barista"], studios: ["rhode", "chatelain"] });
  }
  // Étudiante cuisine spécialisée week-end
  specs.push({ contract: "Étudiant", roles: ["Cuisine"], studios: ["chatelain"], forcedName: { first: "Léa", last: "Bernardi" } });

  // 7 Flexis — 3 Rhode, 2 Châtelain polyvalents, 1 poly, 1 cuisine week-end (Karim El Amrani)
  for (let i = 0; i < 3; i++) specs.push({ contract: "Flexi", roles: ["Accueil", "Barista"], studios: ["rhode"] });
  for (let i = 0; i < 2; i++) specs.push({ contract: "Flexi", roles: ["Accueil", "Barista"], studios: ["chatelain"] });
  specs.push({ contract: "Flexi", roles: ["Accueil", "Barista"], studios: ["rhode", "chatelain"] });
  // Flexi cuisine + accueil
  specs.push({ contract: "Flexi", roles: ["Cuisine"], studios: ["chatelain"], forcedName: { first: "Karim", last: "El Amrani" } });

  return specs;
}

async function createEmployees(rhodeId: string, chatelainId: string, log: string[]) {
  const specs = buildEmployeeSpecs();
  const usedNames = new Set<string>();

  const profilesRows: any[] = [];
  const userContracts: any[] = [];
  const userStudios: any[] = [];
  const userBizRoles: any[] = [];
  const userRoles: any[] = [];
  const createdEmployees: Array<{ id: string; spec: EmployeeSpec; firstName: string; lastName: string }> = [];

  for (const spec of specs) {
    // Nom
    let first: string, last: string, fullKey: string;
    if (spec.forcedName) {
      first = spec.forcedName.first; last = spec.forcedName.last;
      fullKey = `${first}.${last}`;
    } else {
      do {
        first = rand(FIRST_NAMES); last = rand(LAST_NAMES);
        fullKey = `${first}.${last}`;
      } while (usedNames.has(fullKey));
    }
    usedNames.add(fullKey);

    const email = `${slug(first)}.${slug(last)}@fake-coffee.test`;

    // Créer compte auth
    const password = `Test!${Math.random().toString(36).slice(2, 10)}A1`;
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { first_name: first, last_name: last },
    });
    if (authErr || !authUser?.user) {
      console.warn(`[seed] auth create ${email}:`, authErr?.message);
      continue;
    }
    const userId = authUser.user.id;

    // Le trigger handle_new_user va peut-être créer un profil + role 'employee'.
    // On purge ces lignes pour pouvoir insérer la version contrôlée.
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_studios").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_contracts").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_business_roles").delete().eq("user_id", userId);

    const primaryStudioId = spec.studios[0] === "rhode" ? rhodeId : chatelainId;
    const isStudent = spec.contract === "Étudiant";

    profilesRows.push({
      id: userId,
      email, first_name: first, last_name: last,
      phone: `+32 4${randInt(70, 99)} ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)}`,
      birth_date: `${randInt(1985, 2005)}-${pad(randInt(1, 12))}-${pad(randInt(1, 28))}`,
      nationality: rand(NATIONALITIES),
      address: `${rand(STREETS)} ${randInt(1, 250)}`,
      city: rand(CITIES),
      niss: Array.from({ length: 11 }, () => randInt(0, 9)).join(""),
      iban: "BE" + Array.from({ length: 14 }, () => randInt(0, 9)).join(""),
      emergency_contact_name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
      emergency_contact_phone: `+32 4${randInt(70, 99)} ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)}`,
      emergency_contact_relation: rand(["Parent", "Conjoint(e)", "Frère/Soeur", "Ami(e)"]),
      hire_date: `${randInt(2022, 2026)}-${pad(randInt(1, 12))}-${pad(randInt(1, 28))}`,
      status: "active",
      score: Math.round((6.5 + Math.random() * 3) * 10) / 10,
      student_card_valid: isStudent,
      quota_max: isStudent ? 650 : null,
      quota_used: 0,
      contract: spec.contract,
      studio_id: primaryStudioId,
      is_test: true,
    });

    userContracts.push({ user_id: userId, contract: spec.contract });
    for (const s of spec.studios) {
      userStudios.push({ user_id: userId, studio_id: s === "rhode" ? rhodeId : chatelainId });
    }
    for (const r of spec.roles) {
      userBizRoles.push({ user_id: userId, role: r });
    }
    userRoles.push({ user_id: userId, role: "employee" });

    createdEmployees.push({ id: userId, spec, firstName: first, lastName: last });
  }

  // Insert en batch
  if (profilesRows.length > 0) {
    const { error } = await supabaseAdmin.from("profiles").insert(profilesRows);
    if (error) throw new Error(`profiles: ${error.message}`);
  }
  if (userContracts.length > 0) await supabaseAdmin.from("user_contracts").insert(userContracts);
  if (userStudios.length > 0) await supabaseAdmin.from("user_studios").insert(userStudios);
  if (userBizRoles.length > 0) await supabaseAdmin.from("user_business_roles").insert(userBizRoles);
  if (userRoles.length > 0) await supabaseAdmin.from("user_roles").insert(userRoles);

  log.push(`${createdEmployees.length} employés créés`);
  return createdEmployees;
}

// ---------- Disponibilités ----------
function generateAvailabilities(employees: Array<{ id: string; spec: EmployeeSpec }>) {
  const rows: any[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (const emp of employees) {
    const isCDI = emp.spec.contract === "CDI";
    const isStudent = emp.spec.contract === "Étudiant";
    const isFlexi = emp.spec.contract === "Flexi";
    const isCuisine = emp.spec.roles.includes("Cuisine");

    for (let dayOffset = 0; dayOffset < 28; dayOffset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + dayOffset);
      const dow = (date.getDay() + 6) % 7; // 0=lundi
      const isWeekend = dow >= 5;

      // Jours de dispo selon contrat (cuisine non-CDI = focus week-end)
      // CDI cuisine : lun-ven uniquement (jamais le week-end → réservé Léa/Karim)
      let dispoChance = 0;
      if (isCDI && isCuisine) dispoChance = isWeekend ? 0 : 0.95;
      else if (isCDI) dispoChance = 0.75;
      else if (isStudent && isCuisine) dispoChance = isWeekend ? 0.95 : 0.20;
      else if (isFlexi && isCuisine) dispoChance = isWeekend ? 0.95 : 0.40;
      else if (isStudent) dispoChance = isWeekend ? 0.65 : 0.45;
      else if (isFlexi) dispoChance = 0.65;

      if (Math.random() > dispoChance) continue;

      // Plage horaire
      let startH: number, endH: number;
      if (isCDI && isCuisine) {
        startH = 6.5; endH = 17;
      } else if (isCuisine && isStudent) {
        // étudiante cuisine : week-end 8h-16h ; semaine après-midi 14h-19h
        if (isWeekend) { startH = 8; endH = 16; }
        else { startH = 14; endH = 19; }
      } else if (isCuisine && isFlexi) {
        // flexi cuisine : week-end 8h-17h ; semaine variable
        if (isWeekend) { startH = 8; endH = 17; }
        else { startH = 9 + Math.random() * 2; endH = 17 + Math.random() * 2; }
      } else if (isCDI) {
        startH = 7 + (Math.random() < 0.3 ? 0 : Math.random() * 2);
        endH = 21;
      } else if (isStudent) {
        const slot = Math.random();
        if (slot < 0.35) { startH = 7; endH = 14; }
        else if (slot < 0.7) { startH = 15; endH = 22; }
        else { startH = 8; endH = 20; }
      } else { // Flexi
        startH = 8 + Math.random() * 2;
        endH = 18 + Math.random() * 3;
      }

      // Snap 15 min
      const snapTo15 = (h: number) => {
        const totalMin = Math.round(h * 60 / 15) * 15;
        return [Math.floor(totalMin / 60), totalMin % 60] as const;
      };
      const [sh, sm] = snapTo15(startH);
      const [eh, em] = snapTo15(endH);
      // au moins 4h
      if ((eh * 60 + em) - (sh * 60 + sm) < 240) continue;

      rows.push({
        user_id: emp.id,
        avail_date: fmtDate(date),
        start_time: fmtTime(sh, sm),
        end_time: fmtTime(eh, em),
      });
    }
  }
  return rows;
}

// ---------- Server function principale ----------
export const seedFakeData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Vérification admin
    const { userId, supabase } = context;
    const { data: roleCheck } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleCheck) throw new Error("Réservé aux administrateurs");

    const log: string[] = [];
    const startedAt = Date.now();

    // 1. Cleanup
    const cleanupStats = await cleanup(log);

    // 2. Base config
    const { rhodeId, chatelainId } = await ensureBaseConfig(log);

    // 3. Staffing templates
    const templatesCreated = await ensureStaffingTemplates(rhodeId, chatelainId, log);

    // 4. Employés
    const employees = await createEmployees(rhodeId, chatelainId, log);

    // 5. Disponibilités
    const availRows = generateAvailabilities(employees);
    // Insert par chunks de 500
    for (let i = 0; i < availRows.length; i += 500) {
      const chunk = availRows.slice(i, i + 500);
      const { error } = await supabaseAdmin.from("availabilities").insert(chunk);
      if (error) throw new Error(`availabilities chunk ${i}: ${error.message}`);
    }
    log.push(`${availRows.length} disponibilités créées`);

    // Stats par contrat / studio
    const byContract = { CDI: 0, "Étudiant": 0, Flexi: 0 } as Record<string, number>;
    let cuisineCount = 0; let cuisineName = "";
    let rhodeOnly = 0, chatelainOnly = 0, poly = 0;
    for (const e of employees) {
      byContract[e.spec.contract]++;
      if (e.spec.roles.includes("Cuisine")) { cuisineCount++; cuisineName = `${e.firstName} ${e.lastName}`; }
      if (e.spec.studios.length > 1) poly++;
      else if (e.spec.studios[0] === "rhode") rhodeOnly++;
      else chatelainOnly++;
    }

    return {
      duration_ms: Date.now() - startedAt,
      cleanup: cleanupStats,
      seeding: {
        employees_created: employees.length,
        by_contract: byContract,
        cuisine_count: cuisineCount,
        cuisine_name: cuisineName,
        rhode_only: rhodeOnly,
        chatelain_only: chatelainOnly,
        poly: poly,
        templates_created: templatesCreated,
        availabilities_created: availRows.length,
      },
      log,
    };
  });

// ============================================================================
// addKitchenWeekendStaff
// Ajoute uniquement Léa Bernardi (étudiante cuisine) + Karim El Amrani (flexi cuisine)
// au studio Skult Châtelain — sans toucher aux autres données.
// Idempotent : si un email existe déjà, on skip et on logge.
// ============================================================================
export const addKitchenWeekendStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { data: roleCheck } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleCheck) throw new Error("Réservé aux administrateurs");

    const log: string[] = [];

    // Récupérer studio Châtelain
    const { data: chatStudio } = await supabaseAdmin.from("studios")
      .select("id, name").ilike("name", "%châtelain%").maybeSingle();
    if (!chatStudio) throw new Error("Studio Skult Châtelain introuvable");
    const chatelainId = chatStudio.id as string;

    type NewSpec = {
      first: string; last: string; contract: "Étudiant" | "Flexi"; roles: string[];
    };
    const news: NewSpec[] = [
      { first: "Léa", last: "Bernardi", contract: "Étudiant", roles: ["Cuisine"] },
      { first: "Karim", last: "El Amrani", contract: "Flexi", roles: ["Cuisine"] },
    ];

    const created: Array<{ id: string; name: string; contract: string }> = [];
    const skipped: string[] = [];

    for (const n of news) {
      const email = `${slug(n.first)}.${slug(n.last)}@fake-coffee.test`;
      const { data: existing } = await supabaseAdmin.from("profiles")
        .select("id").eq("email", email).maybeSingle();
      if (existing) {
        skipped.push(`${n.first} ${n.last} déjà présent (skip)`);
        continue;
      }

      const password = `Test!${Math.random().toString(36).slice(2, 10)}A1`;
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { first_name: n.first, last_name: n.last },
      });
      if (authErr || !authUser?.user) throw new Error(`auth ${email}: ${authErr?.message}`);
      const uid = authUser.user.id;

      // Purger lignes auto du trigger
      await supabaseAdmin.from("profiles").delete().eq("id", uid);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
      await supabaseAdmin.from("user_studios").delete().eq("user_id", uid);
      await supabaseAdmin.from("user_contracts").delete().eq("user_id", uid);
      await supabaseAdmin.from("user_business_roles").delete().eq("user_id", uid);

      const isStudent = n.contract === "Étudiant";
      await supabaseAdmin.from("profiles").insert({
        id: uid, email, first_name: n.first, last_name: n.last,
        phone: `+32 4${randInt(70, 99)} ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)}`,
        birth_date: `${randInt(1990, 2003)}-${pad(randInt(1, 12))}-${pad(randInt(1, 28))}`,
        nationality: rand(NATIONALITIES),
        address: `${rand(STREETS)} ${randInt(1, 250)}`,
        city: rand(CITIES),
        niss: Array.from({ length: 11 }, () => randInt(0, 9)).join(""),
        iban: "BE" + Array.from({ length: 14 }, () => randInt(0, 9)).join(""),
        emergency_contact_name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
        emergency_contact_phone: `+32 4${randInt(70, 99)} ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)}`,
        emergency_contact_relation: rand(["Parent", "Conjoint(e)", "Frère/Soeur", "Ami(e)"]),
        hire_date: `${randInt(2024, 2026)}-${pad(randInt(1, 12))}-${pad(randInt(1, 28))}`,
        status: "active",
        score: Math.round((6.5 + Math.random() * 3) * 10) / 10,
        student_card_valid: isStudent,
        quota_max: isStudent ? 650 : null,
        quota_used: 0,
        contract: n.contract,
        studio_id: chatelainId,
        is_test: true,
      });

      await supabaseAdmin.from("user_contracts").insert({ user_id: uid, contract: n.contract });
      await supabaseAdmin.from("user_studios").insert({ user_id: uid, studio_id: chatelainId });
      await supabaseAdmin.from("user_business_roles").insert(
        n.roles.map((r) => ({ user_id: uid, role: r })),
      );
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "employee" });

      // Disponibilités sur 28 jours — focus week-end
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const availRows: any[] = [];
      for (let dayOffset = 0; dayOffset < 28; dayOffset++) {
        const date = new Date(today);
        date.setDate(today.getDate() + dayOffset);
        const dow = (date.getDay() + 6) % 7;
        const isWeekend = dow >= 5;

        let chance: number;
        if (isStudent) chance = isWeekend ? 0.95 : 0.20;
        else chance = isWeekend ? 0.95 : 0.40;
        if (Math.random() > chance) continue;

        let sH: number, eH: number;
        if (isStudent) {
          if (isWeekend) { sH = 8; eH = 16; } else { sH = 14; eH = 19; }
        } else {
          if (isWeekend) { sH = 8; eH = 17; } else { sH = 9 + Math.random() * 2; eH = 17 + Math.random() * 2; }
        }
        const snap = (h: number) => Math.round(h * 4) * 15;
        const sM = snap(sH);
        const eM = snap(eH);
        if (eM - sM < 240) continue;
        availRows.push({
          user_id: uid,
          avail_date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
          start_time: `${pad(Math.floor(sM / 60))}:${pad(sM % 60)}:00`,
          end_time: `${pad(Math.floor(eM / 60))}:${pad(eM % 60)}:00`,
        });
      }
      if (availRows.length > 0) {
        await supabaseAdmin.from("availabilities").insert(availRows);
      }

      created.push({ id: uid, name: `${n.first} ${n.last}`, contract: n.contract });
      log.push(`${n.first} ${n.last} (${n.contract}) créé avec ${availRows.length} dispos`);
    }

    return { created, skipped, log };
  });
