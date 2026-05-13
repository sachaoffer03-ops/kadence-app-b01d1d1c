// Mock/seed data + types partagés. Les rôles métier sont libres (table business_roles).
export type Role = string;
export type ContractType = 'Étudiant' | 'Flexi' | 'CDI';
export type Studio = string;
export type ShiftStatus = 'terminé' | 'en-cours' | 'retard' | 'à-venir';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  city: string;
  contract: ContractType;
  roles: Role[];
  score: number;
  quotaUsed: number | null;
  quotaMax: number | null;
  shiftsCount: number;
  lastShift: string;
  studio: Studio;
  phone?: string;
  email?: string;
  niss?: string;
  iban?: string;
  nationality?: string;
  studentCardValid?: boolean;
  punctuality?: number;
  presentation?: number;
  autonomy?: number;
  speed?: number;
  serviceQuality?: number;
  communication?: number;
  roleScores?: Partial<Record<Role, number>>;
}

export interface TodayShift {
  employeeId: string;
  name: string;
  role: Role;
  studio: Studio;
  startHour: string;
  endHour: string;
  status: ShiftStatus;
  statusLabel: string;
  checkedIn: boolean;
  delayMinutes?: number;
}

export interface HoleShift {
  id: string;
  date: string;
  dateLabel: string;
  day: string;
  time: string;
  role: Role;
  studio: Studio;
  urgency: 'critique' | 'urgent' | 'normal';
  reason: string;
  eligibleCount: number;
  eligible: { employeeId: string; name: string; score: number; aiRecommended: boolean; available: boolean; hoursLeft?: number }[];
}

export interface ModificationRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  role: Role;
  studio: Studio;
  shiftDate: string;
  shiftTime: string;
  reason: 'maladie' | 'examen' | 'famille' | 'transport' | 'conflit' | 'autre';
  reasonLabel: string;
  comment: string;
  submittedAt: string;
  urgency: 'critique' | 'urgent' | 'normal';
  replacementCount: number;
  status: 'en-attente' | 'acceptée' | 'refusée';
}

export interface DimonaEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  role: Role;
  studio: Studio;
  shiftDate: string;
  shiftTime: string;
  status: 'prête' | 'données-manquantes' | 'envoyée' | 'erreur';
  missingData?: string;
  urgency: 'critique' | 'urgent' | 'normal';
  niss?: string;
}

export interface TrainingPath {
  id: string;
  title: string;
  type: 'commun' | 'role';
  role?: Role;
  moduleCount: number;
  videoCount: number;
  avgCompletion: number;
  modules: TrainingModule[];
}

export interface TrainingModule {
  id: string;
  title: string;
  duration: string;
  videos: { id: string; title: string; duration: string }[];
}

export interface ChecklistTemplate {
  id: string;
  studio: Studio;
  role: Role;
  items: { id: string; label: string; photoRequired: boolean; aiValidation: boolean }[];
  completionRate: number;
  frequentlySkipped: string[];
}

export interface StudioException {
  id: string;
  studio: Studio;
  date: string;
  dateLabel: string;
  type: 'fermeture' | 'événement' | 'ajustement';
  title: string;
  description: string;
  impact: { role: Role; delta: number }[];
  hoursAdjust?: string;
}

export interface PendingSignup {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  age: number;
  city: string;
  experience: string;
  desiredRoles: Role[];
  desiredStudios: Studio[];
  submittedAt: string;
  status: 'en-attente' | 'approuvé' | 'refusé';
}

export interface PointageEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  role: Role;
  studio: Studio;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  clockIn?: string;
  clockOut?: string;
  status: 'à-temps' | 'retard' | 'absent' | 'en-cours' | 'à-venir';
  delayMinutes?: number;
}

export interface FeedbackEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  role: Role;
  studio: Studio;
  date: string;
  shiftRating: number;
  teamRating: number;
  selfRating: number;
  comment?: string;
}

// roleColors : proxy dynamique qui lit la table business_roles via le cache du hook.
// Conserve l'API existante `roleColors[role].dot/bg/text` partout dans l'app.
import { getRoleStyle } from "./staff-helpers";
export const roleColors: Record<string, { bg: string; text: string; dot: string }> = new Proxy(
  {},
  { get: (_t, prop: string) => getRoleStyle(prop) },
) as any;

export const employees: Employee[] = [
  { id: '1', firstName: 'Clara', lastName: 'Martens', age: 22, city: 'Bruxelles', contract: 'Étudiant', roles: ['Barista', 'Accueil'], score: 9.4, quotaUsed: 198, quotaMax: 650, shiftsCount: 23, lastShift: "Aujourd'hui", studio: 'Skult Rhodes', phone: '+32 479 12 34 56', email: 'clara.martens@student.be', niss: '00.07.15-123.45', iban: 'BE68 5390 0754 7034', nationality: 'Belge', studentCardValid: true, punctuality: 9.8, presentation: 9.2, autonomy: 9.5, speed: 9.1, serviceQuality: 9.6, communication: 9.2, roleScores: { Barista: 9.6, Accueil: 9.1 } },
  { id: '2', firstName: 'Sofia', lastName: 'De Smet', age: 21, city: 'Bruxelles', contract: 'Étudiant', roles: ['Accueil', 'Host'], score: 9.2, quotaUsed: 487, quotaMax: 650, shiftsCount: 19, lastShift: "Aujourd'hui", studio: 'Skult Châtelain', phone: '+32 486 23 45 67', email: 'sofia.desmet@ulb.be', niss: '01.03.22-234.56', iban: 'BE71 0961 2345 6789', nationality: 'Belge', studentCardValid: true, punctuality: 9.0, presentation: 9.5, autonomy: 9.0, speed: 9.3, serviceQuality: 9.4, communication: 9.0, roleScores: { Accueil: 9.4, Host: 9.0 } },
  { id: '3', firstName: 'Léa', lastName: 'Berger', age: 23, city: 'Anvers', contract: 'Étudiant', roles: ['Host', 'Accueil'], score: 8.9, quotaUsed: 612, quotaMax: 650, shiftsCount: 17, lastShift: 'Hier', studio: 'Skult Rhodes', phone: '+32 477 34 56 78', email: 'lea.berger@uantwerpen.be', niss: '99.11.08-345.67', iban: 'BE42 0001 2345 6789', nationality: 'Belge', studentCardValid: true, punctuality: 8.5, presentation: 9.1, autonomy: 9.0, speed: 8.8, serviceQuality: 9.2, communication: 8.7, roleScores: { Host: 9.1, Accueil: 8.7 } },
  { id: '4', firstName: 'Emma', lastName: 'Vermeulen', age: 20, city: 'Anvers', contract: 'Étudiant', roles: ['Host'], score: 8.5, quotaUsed: 312, quotaMax: 650, shiftsCount: 15, lastShift: "Aujourd'hui", studio: 'Skult Rhodes', phone: '+32 485 45 67 89', email: 'emma.v@student.be', niss: '02.06.14-456.78', iban: 'BE51 0634 5678 9012', nationality: 'Belge', studentCardValid: true, punctuality: 8.3, presentation: 8.8, autonomy: 8.2, speed: 8.5, serviceQuality: 8.7, communication: 8.5, roleScores: { Host: 8.5 } },
  { id: '5', firstName: 'Marc', lastName: 'Peeters', age: 31, city: 'Bruxelles', contract: 'CDI', roles: ['Cuisine', 'Barista'], score: 9.1, quotaUsed: null, quotaMax: null, shiftsCount: 22, lastShift: "Aujourd'hui", studio: 'Skult Châtelain', phone: '+32 475 56 78 90', email: 'marc.peeters@gmail.com', nationality: 'Belge', punctuality: 9.3, presentation: 8.9, autonomy: 9.4, speed: 9.0, serviceQuality: 9.1, communication: 8.8, roleScores: { Cuisine: 9.3, Barista: 8.9 } },
  { id: '6', firstName: 'Lina', lastName: 'Kouri', age: 25, city: 'Bruxelles', contract: 'Flexi', roles: ['Barista', 'Accueil'], score: 8.7, quotaUsed: null, quotaMax: null, shiftsCount: 14, lastShift: "Aujourd'hui", studio: 'Skult Châtelain', phone: '+32 488 67 89 01', email: 'lina.kouri@outlook.com', nationality: 'Belge', punctuality: 8.5, presentation: 9.0, autonomy: 8.7, speed: 8.8, serviceQuality: 8.9, communication: 8.3, roleScores: { Barista: 8.9, Accueil: 8.5 } },
  { id: '7', firstName: 'Rania', lastName: 'Berkani', age: 19, city: 'Bruxelles', contract: 'Étudiant', roles: ['Barista', 'Accueil'], score: 7.9, quotaUsed: 156, quotaMax: 650, shiftsCount: 9, lastShift: 'Lundi', studio: 'Skult Rhodes', phone: '+32 476 78 90 12', email: 'rania.b@vub.be', niss: '03.08.20-567.89', nationality: 'Belge', studentCardValid: true, punctuality: 7.5, presentation: 8.2, autonomy: 7.8, speed: 8.0, serviceQuality: 8.1, communication: 7.8, roleScores: { Barista: 8.0, Accueil: 7.8 } },
  { id: '8', firstName: 'Marie', lastName: 'Dubois', age: 24, city: 'Bruxelles', contract: 'Étudiant', roles: ['Barista'], score: 8.8, quotaUsed: 234, quotaMax: 650, shiftsCount: 18, lastShift: "Aujourd'hui", studio: 'Skult Rhodes', phone: '+32 479 89 01 23', email: 'marie.dubois@uclouvain.be', niss: '98.04.11-678.90', iban: 'BE26 3630 0123 4567', nationality: 'Belge', studentCardValid: true, punctuality: 9.0, presentation: 8.8, autonomy: 8.9, speed: 8.6, serviceQuality: 8.8, communication: 8.7, roleScores: { Barista: 8.8 } },
  { id: '9', firstName: 'Thomas', lastName: 'Janssens', age: 28, city: 'Gand', contract: 'CDI', roles: ['Cuisine'], score: 9.0, quotaUsed: null, quotaMax: null, shiftsCount: 21, lastShift: 'Hier', studio: 'Skult Châtelain', phone: '+32 486 90 12 34', email: 'thomas.j@gmail.com', nationality: 'Belge', punctuality: 9.2, presentation: 8.7, autonomy: 9.3, speed: 9.0, serviceQuality: 8.9, communication: 8.9, roleScores: { Cuisine: 9.0 } },
  { id: '10', firstName: 'Amira', lastName: 'El Amrani', age: 20, city: 'Bruxelles', contract: 'Étudiant', roles: ['Accueil'], score: 8.3, quotaUsed: 289, quotaMax: 650, shiftsCount: 16, lastShift: 'Hier', studio: 'Skult Rhodes', phone: '+32 477 01 23 45', email: 'amira.ea@student.be', niss: '02.12.05-789.01', nationality: 'Marocaine', studentCardValid: true, punctuality: 8.0, presentation: 8.5, autonomy: 8.2, speed: 8.3, serviceQuality: 8.5, communication: 8.3, roleScores: { Accueil: 8.3 } },
  { id: '11', firstName: 'Lucas', lastName: 'Van den Berg', age: 22, city: 'Louvain', contract: 'Étudiant', roles: ['Barista'], score: 8.1, quotaUsed: 178, quotaMax: 650, shiftsCount: 11, lastShift: 'Lundi', studio: 'Skult Châtelain', phone: '+32 485 12 34 56', email: 'lucas.vdb@kuleuven.be', niss: '00.09.17-890.12', nationality: 'Belge', studentCardValid: true, punctuality: 7.8, presentation: 8.3, autonomy: 8.0, speed: 8.2, serviceQuality: 8.4, communication: 7.9, roleScores: { Barista: 8.1 } },
  { id: '12', firstName: 'Yasmine', lastName: 'Hadji', age: 21, city: 'Bruxelles', contract: 'Étudiant', roles: ['Host', 'Accueil'], score: 8.6, quotaUsed: 345, quotaMax: 650, shiftsCount: 20, lastShift: "Aujourd'hui", studio: 'Skult Rhodes', phone: '+32 488 23 45 67', email: 'yasmine.h@ulb.be', niss: '01.05.29-901.23', nationality: 'Belge', studentCardValid: true, punctuality: 8.4, presentation: 8.9, autonomy: 8.5, speed: 8.6, serviceQuality: 8.8, communication: 8.4, roleScores: { Host: 8.8, Accueil: 8.4 } },
  { id: '13', firstName: 'Antoine', lastName: 'Lambert', age: 26, city: 'Namur', contract: 'Flexi', roles: ['Barista', 'Cuisine'], score: 7.8, quotaUsed: null, quotaMax: null, shiftsCount: 8, lastShift: 'Vendredi', studio: 'Skult Châtelain', phone: '+32 476 34 56 78', email: 'antoine.l@gmail.com', nationality: 'Belge', punctuality: 7.5, presentation: 7.9, autonomy: 7.8, speed: 8.0, serviceQuality: 7.9, communication: 7.7, roleScores: { Barista: 7.9, Cuisine: 7.7 } },
  { id: '14', firstName: 'Inès', lastName: 'Bouazza', age: 19, city: 'Bruxelles', contract: 'Étudiant', roles: ['Accueil'], score: 8.4, quotaUsed: 123, quotaMax: 650, shiftsCount: 7, lastShift: 'Mercredi', studio: 'Skult Rhodes', phone: '+32 479 45 67 89', email: 'ines.b@student.be', niss: '03.02.14-012.34', nationality: 'Belge', studentCardValid: true, punctuality: 8.2, presentation: 8.6, autonomy: 8.3, speed: 8.4, serviceQuality: 8.5, communication: 8.4, roleScores: { Accueil: 8.4 } },
  { id: '15', firstName: 'Noah', lastName: 'Willems', age: 23, city: 'Bruxelles', contract: 'Étudiant', roles: ['Barista', 'Host'], score: 8.2, quotaUsed: 267, quotaMax: 650, shiftsCount: 14, lastShift: 'Hier', studio: 'Skult Châtelain', phone: '+32 486 56 78 90', email: 'noah.w@vub.be', niss: '99.10.03-123.45', nationality: 'Belge', studentCardValid: true, punctuality: 8.0, presentation: 8.3, autonomy: 8.1, speed: 8.4, serviceQuality: 8.3, communication: 8.1, roleScores: { Barista: 8.3, Host: 8.1 } },
  { id: '16', firstName: 'Chloé', lastName: 'Dupont', age: 20, city: 'Liège', contract: 'Étudiant', roles: ['Barista'], score: 7.6, quotaUsed: 89, quotaMax: 650, shiftsCount: 5, lastShift: 'Jeudi', studio: 'Skult Rhodes', phone: '+32 477 67 89 01', email: 'chloe.d@uliege.be', niss: '02.08.22-234.56', nationality: 'Belge', studentCardValid: true, punctuality: 7.3, presentation: 7.8, autonomy: 7.5, speed: 7.7, serviceQuality: 7.8, communication: 7.5, roleScores: { Barista: 7.6 } },
  { id: '17', firstName: 'Mehdi', lastName: 'Benali', age: 27, city: 'Bruxelles', contract: 'Flexi', roles: ['Cuisine', 'Barista'], score: 8.9, quotaUsed: null, quotaMax: null, shiftsCount: 16, lastShift: "Aujourd'hui", studio: 'Skult Châtelain', phone: '+32 485 78 90 12', email: 'mehdi.b@outlook.com', nationality: 'Belge', punctuality: 8.8, presentation: 9.0, autonomy: 9.1, speed: 8.9, serviceQuality: 8.8, communication: 8.7, roleScores: { Cuisine: 9.1, Barista: 8.7 } },
  { id: '18', firstName: 'Julie', lastName: 'Maes', age: 22, city: 'Bruxelles', contract: 'Étudiant', roles: ['Host'], score: 8.0, quotaUsed: 401, quotaMax: 650, shiftsCount: 18, lastShift: 'Lundi', studio: 'Skult Rhodes', phone: '+32 488 89 01 23', email: 'julie.maes@ulb.be', niss: '00.04.18-345.67', nationality: 'Belge', studentCardValid: true, punctuality: 7.8, presentation: 8.2, autonomy: 8.0, speed: 8.1, serviceQuality: 8.2, communication: 7.7, roleScores: { Host: 8.0 } },
  { id: '19', firstName: 'Adam', lastName: 'Claes', age: 21, city: 'Anvers', contract: 'Étudiant', roles: ['Barista', 'Accueil'], score: 7.7, quotaUsed: 211, quotaMax: 650, shiftsCount: 12, lastShift: 'Mercredi', studio: 'Skult Châtelain', phone: '+32 476 90 12 34', email: 'adam.c@uantwerpen.be', niss: '01.07.09-456.78', nationality: 'Belge', studentCardValid: true, punctuality: 7.5, presentation: 7.9, autonomy: 7.6, speed: 7.8, serviceQuality: 7.9, communication: 7.5, roleScores: { Barista: 7.8, Accueil: 7.6 } },
  { id: '20', firstName: 'Sarah', lastName: 'Hermans', age: 24, city: 'Bruxelles', contract: 'Étudiant', roles: ['Accueil', 'Host'], score: 8.5, quotaUsed: 378, quotaMax: 650, shiftsCount: 19, lastShift: 'Hier', studio: 'Skult Rhodes', phone: '+32 479 01 23 45', email: 'sarah.h@student.be', niss: '98.11.25-567.89', nationality: 'Belge', studentCardValid: true, punctuality: 8.3, presentation: 8.7, autonomy: 8.5, speed: 8.4, serviceQuality: 8.6, communication: 8.5, roleScores: { Accueil: 8.6, Host: 8.4 } },
  { id: '21', firstName: 'Victor', lastName: 'Renard', age: 29, city: 'Bruxelles', contract: 'CDI', roles: ['Barista', 'Cuisine'], score: 9.3, quotaUsed: null, quotaMax: null, shiftsCount: 24, lastShift: "Aujourd'hui", studio: 'Skult Rhodes', phone: '+32 486 12 34 56', email: 'victor.r@gmail.com', nationality: 'Français', punctuality: 9.5, presentation: 9.1, autonomy: 9.4, speed: 9.2, serviceQuality: 9.3, communication: 9.3, roleScores: { Barista: 9.4, Cuisine: 9.2 } },
  { id: '22', firstName: 'Nora', lastName: 'Deschamps', age: 20, city: 'Bruxelles', contract: 'Étudiant', roles: ['Barista'], score: 8.1, quotaUsed: 145, quotaMax: 650, shiftsCount: 10, lastShift: 'Vendredi', studio: 'Skult Châtelain', phone: '+32 477 23 45 67', email: 'nora.d@ulb.be', niss: '02.03.16-678.90', nationality: 'Belge', studentCardValid: true, punctuality: 7.9, presentation: 8.3, autonomy: 8.0, speed: 8.2, serviceQuality: 8.3, communication: 7.9, roleScores: { Barista: 8.1 } },
  { id: '23', firstName: 'Axel', lastName: 'De Vos', age: 22, city: 'Gand', contract: 'Étudiant', roles: ['Cuisine'], score: 7.5, quotaUsed: 98, quotaMax: 650, shiftsCount: 6, lastShift: 'Jeudi', studio: 'Skult Rhodes', phone: '+32 485 34 56 78', email: 'axel.dv@ugent.be', niss: '00.01.30-789.01', nationality: 'Belge', studentCardValid: true, punctuality: 7.2, presentation: 7.6, autonomy: 7.4, speed: 7.5, serviceQuality: 7.7, communication: 7.6, roleScores: { Cuisine: 7.5 } },
  { id: '24', firstName: 'Fatima', lastName: 'Ozdemir', age: 23, city: 'Bruxelles', contract: 'Étudiant', roles: ['Accueil', 'Host'], score: 8.7, quotaUsed: 423, quotaMax: 650, shiftsCount: 21, lastShift: "Aujourd'hui", studio: 'Skult Châtelain', phone: '+32 488 45 67 89', email: 'fatima.o@vub.be', niss: '99.06.12-890.12', nationality: 'Belge', studentCardValid: true, punctuality: 8.5, presentation: 9.0, autonomy: 8.7, speed: 8.6, serviceQuality: 8.9, communication: 8.5, roleScores: { Accueil: 8.9, Host: 8.5 } },
  { id: '25', firstName: 'Julien', lastName: 'Petit', age: 26, city: 'Namur', contract: 'Flexi', roles: ['Barista'], score: 8.0, quotaUsed: null, quotaMax: null, shiftsCount: 11, lastShift: 'Lundi', studio: 'Skult Rhodes', phone: '+32 476 56 78 90', email: 'julien.p@gmail.com', nationality: 'Belge', punctuality: 7.8, presentation: 8.2, autonomy: 8.0, speed: 8.1, serviceQuality: 8.1, communication: 7.8, roleScores: { Barista: 8.0 } },
  { id: '26', firstName: 'Aïcha', lastName: 'Mertens', age: 19, city: 'Bruxelles', contract: 'Étudiant', roles: ['Barista', 'Accueil'], score: 7.3, quotaUsed: 67, quotaMax: 650, shiftsCount: 4, lastShift: 'Mercredi', studio: 'Skult Châtelain', phone: '+32 479 67 89 01', email: 'aicha.m@student.be', niss: '03.10.08-901.23', nationality: 'Belge', studentCardValid: true, punctuality: 7.0, presentation: 7.5, autonomy: 7.2, speed: 7.4, serviceQuality: 7.5, communication: 7.2, roleScores: { Barista: 7.4, Accueil: 7.2 } },
  { id: '27', firstName: 'Diego', lastName: 'Santos', age: 30, city: 'Bruxelles', contract: 'Flexi', roles: ['Cuisine'], score: 8.4, quotaUsed: null, quotaMax: null, shiftsCount: 13, lastShift: 'Hier', studio: 'Skult Rhodes', phone: '+32 486 78 90 12', email: 'diego.s@gmail.com', nationality: 'Portugais', punctuality: 8.2, presentation: 8.5, autonomy: 8.4, speed: 8.3, serviceQuality: 8.6, communication: 8.4, roleScores: { Cuisine: 8.4 } },
  { id: '28', firstName: 'Eva', lastName: 'Claessens', age: 21, city: 'Louvain', contract: 'Étudiant', roles: ['Host', 'Barista'], score: 8.6, quotaUsed: 334, quotaMax: 650, shiftsCount: 17, lastShift: "Aujourd'hui", studio: 'Skult Châtelain', phone: '+32 477 89 01 23', email: 'eva.c@kuleuven.be', niss: '01.02.07-012.34', nationality: 'Belge', studentCardValid: true, punctuality: 8.4, presentation: 8.8, autonomy: 8.5, speed: 8.7, serviceQuality: 8.8, communication: 8.4, roleScores: { Host: 8.8, Barista: 8.4 } },
];

export const todayShifts: TodayShift[] = [
  { employeeId: '1', name: 'Clara Martens', role: 'Barista', studio: 'Skult Rhodes', startHour: '07h', endHour: '12h', status: 'terminé', statusLabel: 'Terminé', checkedIn: true },
  { employeeId: '8', name: 'Marie Dubois', role: 'Barista', studio: 'Skult Rhodes', startHour: '08h', endHour: '15h', status: 'en-cours', statusLabel: 'En cours', checkedIn: true },
  { employeeId: '4', name: 'Emma Vermeulen', role: 'Host', studio: 'Skult Rhodes', startHour: '10h', endHour: '15h', status: 'retard', statusLabel: 'Retard 8\'', checkedIn: false, delayMinutes: 8 },
  { employeeId: '5', name: 'Marc Peeters', role: 'Cuisine', studio: 'Skult Châtelain', startHour: '14h', endHour: '22h', status: 'à-venir', statusLabel: 'Dans 4h', checkedIn: false },
  { employeeId: '2', name: 'Sofia De Smet', role: 'Accueil', studio: 'Skult Châtelain', startHour: '14h', endHour: '21h', status: 'à-venir', statusLabel: 'Dans 4h', checkedIn: false },
  { employeeId: '6', name: 'Lina Kouri', role: 'Barista', studio: 'Skult Châtelain', startHour: '17h', endHour: '23h', status: 'à-venir', statusLabel: 'Dans 7h', checkedIn: false },
];

export const holeShifts: HoleShift[] = [
  {
    id: 'h1', date: '2026-05-08', dateLabel: 'Vendredi 8 mai', day: 'Demain', time: '10h — 15h', role: 'Barista', studio: 'Skult Rhodes', urgency: 'critique', reason: 'Léa Berger en maladie',
    eligibleCount: 6,
    eligible: [
      { employeeId: '1', name: 'Clara Martens', score: 9.4, aiRecommended: true, available: true, hoursLeft: 452 },
      { employeeId: '8', name: 'Marie Dubois', score: 8.8, aiRecommended: true, available: true, hoursLeft: 416 },
      { employeeId: '11', name: 'Lucas Van den Berg', score: 8.1, aiRecommended: false, available: true, hoursLeft: 472 },
      { employeeId: '7', name: 'Rania Berkani', score: 7.9, aiRecommended: false, available: false, hoursLeft: 494 },
      { employeeId: '16', name: 'Chloé Dupont', score: 7.6, aiRecommended: false, available: true, hoursLeft: 561 },
      { employeeId: '26', name: 'Aïcha Mertens', score: 7.3, aiRecommended: false, available: false, hoursLeft: 583 },
    ],
  },
  {
    id: 'h2', date: '2026-05-09', dateLabel: 'Samedi 9 mai', day: 'Sam', time: '14h — 19h', role: 'Host', studio: 'Skult Châtelain', urgency: 'urgent', reason: 'Aucun dispo dans les préférences',
    eligibleCount: 4,
    eligible: [
      { employeeId: '2', name: 'Sofia De Smet', score: 9.2, aiRecommended: true, available: true, hoursLeft: 163 },
      { employeeId: '12', name: 'Yasmine Hadji', score: 8.6, aiRecommended: true, available: true, hoursLeft: 305 },
      { employeeId: '4', name: 'Emma Vermeulen', score: 8.5, aiRecommended: false, available: false, hoursLeft: 338 },
      { employeeId: '18', name: 'Julie Maes', score: 8.0, aiRecommended: false, available: true, hoursLeft: 249 },
    ],
  },
  {
    id: 'h3', date: '2026-05-11', dateLabel: 'Lundi 11 mai', day: 'Lun', time: '17h — 23h', role: 'Accueil', studio: 'Skult Rhodes', urgency: 'normal', reason: 'Shift ajouté pour événement',
    eligibleCount: 5,
    eligible: [
      { employeeId: '10', name: 'Amira El Amrani', score: 8.3, aiRecommended: true, available: true, hoursLeft: 361 },
      { employeeId: '14', name: 'Inès Bouazza', score: 8.4, aiRecommended: true, available: true, hoursLeft: 527 },
      { employeeId: '24', name: 'Fatima Ozdemir', score: 8.7, aiRecommended: false, available: false, hoursLeft: 227 },
      { employeeId: '20', name: 'Sarah Hermans', score: 8.5, aiRecommended: false, available: true, hoursLeft: 272 },
      { employeeId: '6', name: 'Lina Kouri', score: 8.7, aiRecommended: false, available: true },
    ],
  },
  {
    id: 'h4', date: '2026-05-13', dateLabel: 'Mercredi 13 mai', day: 'Mer', time: '07h — 12h', role: 'Cuisine', studio: 'Skult Châtelain', urgency: 'normal', reason: 'Thomas Janssens en congé',
    eligibleCount: 3,
    eligible: [
      { employeeId: '5', name: 'Marc Peeters', score: 9.1, aiRecommended: true, available: true },
      { employeeId: '17', name: 'Mehdi Benali', score: 8.9, aiRecommended: true, available: true },
      { employeeId: '27', name: 'Diego Santos', score: 8.4, aiRecommended: false, available: false },
    ],
  },
];

export const modificationRequests: ModificationRequest[] = [
  { id: 'mr1', employeeId: '3', employeeName: 'Léa Berger', role: 'Host', studio: 'Skult Rhodes', shiftDate: 'Vendredi 9 mai', shiftTime: '10h — 15h', reason: 'maladie', reasonLabel: 'Maladie', comment: 'Forte fièvre depuis hier soir, certificat médical à fournir demain.', submittedAt: 'Il y a 2h', urgency: 'critique', replacementCount: 4, status: 'en-attente' },
  { id: 'mr2', employeeId: '19', employeeName: 'Adam Claes', role: 'Barista', studio: 'Skult Châtelain', shiftDate: 'Samedi 10 mai', shiftTime: '14h — 19h', reason: 'examen', reasonLabel: 'Examen', comment: 'Examen de droit commercial à 14h, pas moyen de décaler.', submittedAt: 'Il y a 5h', urgency: 'urgent', replacementCount: 6, status: 'en-attente' },
  { id: 'mr3', employeeId: '18', employeeName: 'Julie Maes', role: 'Host', studio: 'Skult Rhodes', shiftDate: 'Mardi 13 mai', shiftTime: '17h — 23h', reason: 'famille', reasonLabel: 'Famille', comment: 'Anniversaire de ma grand-mère, elle a 90 ans cette année.', submittedAt: 'Hier', urgency: 'normal', replacementCount: 3, status: 'en-attente' },
  { id: 'mr4', employeeId: '11', employeeName: 'Lucas Van den Berg', role: 'Barista', studio: 'Skult Châtelain', shiftDate: 'Jeudi 15 mai', shiftTime: '07h — 12h', reason: 'transport', reasonLabel: 'Transport', comment: 'Grève SNCB annoncée, pas de train Louvain-Bruxelles ce jour-là.', submittedAt: 'Il y a 1 jour', urgency: 'normal', replacementCount: 5, status: 'en-attente' },
  { id: 'mr5', employeeId: '7', employeeName: 'Rania Berkani', role: 'Accueil', studio: 'Skult Rhodes', shiftDate: 'Lundi 11 mai', shiftTime: '10h — 15h', reason: 'conflit', reasonLabel: 'Conflit horaire', comment: 'Stage obligatoire qui a été déplacé à cette date.', submittedAt: 'Il y a 2 jours', urgency: 'normal', replacementCount: 4, status: 'en-attente' },
];

export const dimonaEntries: DimonaEntry[] = [
  { id: 'd1', employeeId: '1', employeeName: 'Clara Martens', role: 'Barista', studio: 'Skult Rhodes', shiftDate: 'Demain 8 mai', shiftTime: '07h — 12h', status: 'prête', urgency: 'critique', niss: '00.07.15-123.45' },
  { id: 'd2', employeeId: '8', employeeName: 'Marie Dubois', role: 'Barista', studio: 'Skult Rhodes', shiftDate: 'Demain 8 mai', shiftTime: '10h — 15h', status: 'prête', urgency: 'critique', niss: '98.04.11-678.90' },
  { id: 'd3', employeeId: '4', employeeName: 'Emma Vermeulen', role: 'Host', studio: 'Skult Rhodes', shiftDate: 'Demain 8 mai', shiftTime: '14h — 19h', status: 'prête', urgency: 'critique', niss: '02.06.14-456.78' },
  { id: 'd4', employeeId: '26', employeeName: 'Aïcha Mertens', role: 'Accueil', studio: 'Skult Châtelain', shiftDate: 'Samedi 9 mai', shiftTime: '10h — 15h', status: 'données-manquantes', urgency: 'urgent', missingData: 'NISS non renseigné' },
  { id: 'd5', employeeId: '2', employeeName: 'Sofia De Smet', role: 'Accueil', studio: 'Skult Châtelain', shiftDate: 'Samedi 9 mai', shiftTime: '14h — 19h', status: 'prête', urgency: 'urgent', niss: '01.03.22-234.56' },
  { id: 'd6', employeeId: '11', employeeName: 'Lucas Van den Berg', role: 'Barista', studio: 'Skult Châtelain', shiftDate: 'Lundi 11 mai', shiftTime: '07h — 12h', status: 'prête', urgency: 'normal', niss: '00.09.17-890.12' },
  { id: 'd7', employeeId: '23', employeeName: 'Axel De Vos', role: 'Cuisine', studio: 'Skult Rhodes', shiftDate: 'Lundi 11 mai', shiftTime: '14h — 19h', status: 'données-manquantes', urgency: 'normal', missingData: 'IBAN manquant' },
  { id: 'd8', employeeId: '15', employeeName: 'Noah Willems', role: 'Host', studio: 'Skult Châtelain', shiftDate: 'Mardi 12 mai', shiftTime: '17h — 23h', status: 'envoyée', urgency: 'normal', niss: '99.10.03-123.45' },
];

export const trainingPaths: TrainingPath[] = [
  {
    id: 'tp1', title: 'Bienvenue chez Skult', type: 'commun', moduleCount: 4, videoCount: 12, avgCompletion: 78,
    modules: [
      { id: 'm1', title: 'Notre histoire & valeurs', duration: '8 min', videos: [{ id: 'v1', title: 'L\'histoire de Skult', duration: '3:12' }, { id: 'v2', title: 'Nos valeurs au quotidien', duration: '2:45' }, { id: 'v3', title: 'Les deux studios', duration: '2:30' }] },
      { id: 'm2', title: 'Hygiène & sécurité', duration: '10 min', videos: [{ id: 'v4', title: 'Les règles HACCP', duration: '4:15' }, { id: 'v5', title: 'Lavage des mains', duration: '1:30' }, { id: 'v6', title: 'Gestion des allergènes', duration: '3:45' }] },
      { id: 'm3', title: 'Service client', duration: '12 min', videos: [{ id: 'v7', title: 'Accueillir un client', duration: '3:00' }, { id: 'v8', title: 'Gérer une plainte', duration: '4:20' }, { id: 'v9', title: 'Upselling naturel', duration: '2:50' }] },
      { id: 'm4', title: 'L\'app Kadence', duration: '6 min', videos: [{ id: 'v10', title: 'Pointer son shift', duration: '2:00' }, { id: 'v11', title: 'Gérer ses dispos', duration: '2:15' }, { id: 'v12', title: 'Demander un changement', duration: '1:45' }] },
    ],
  },
  {
    id: 'tp2', title: 'Barista — Les fondamentaux', type: 'role', role: 'Barista', moduleCount: 3, videoCount: 9, avgCompletion: 65,
    modules: [
      { id: 'm5', title: 'La machine espresso', duration: '10 min', videos: [{ id: 'v13', title: 'Calibrage du moulin', duration: '3:30' }, { id: 'v14', title: 'Extraction parfaite', duration: '4:00' }, { id: 'v15', title: 'Nettoyage quotidien', duration: '2:30' }] },
      { id: 'm6', title: 'Latte art', duration: '8 min', videos: [{ id: 'v16', title: 'Le cœur', duration: '3:00' }, { id: 'v17', title: 'La rosetta', duration: '3:15' }, { id: 'v18', title: 'Le tulip', duration: '2:45' }] },
      { id: 'm7', title: 'Notre carte', duration: '6 min', videos: [{ id: 'v19', title: 'Les classiques', duration: '2:00' }, { id: 'v20', title: 'Boissons signature', duration: '2:30' }, { id: 'v21', title: 'Les alternatives', duration: '1:30' }] },
    ],
  },
  {
    id: 'tp3', title: 'Accueil — Excellence client', type: 'role', role: 'Accueil', moduleCount: 2, videoCount: 6, avgCompletion: 72,
    modules: [
      { id: 'm8', title: 'Premier contact', duration: '7 min', videos: [{ id: 'v22', title: 'Le sourire Skult', duration: '2:15' }, { id: 'v23', title: 'Placement & rotation', duration: '2:30' }, { id: 'v24', title: 'Gestion de l\'attente', duration: '2:15' }] },
      { id: 'm9', title: 'La caisse', duration: '8 min', videos: [{ id: 'v25', title: 'Prise de commande', duration: '3:00' }, { id: 'v26', title: 'Encaissement', duration: '2:45' }, { id: 'v27', title: 'Clôture de caisse', duration: '2:15' }] },
    ],
  },
  {
    id: 'tp4', title: 'Host — L\'art de recevoir', type: 'role', role: 'Host', moduleCount: 2, videoCount: 5, avgCompletion: 58,
    modules: [
      { id: 'm10', title: 'Ambiance & atmosphère', duration: '6 min', videos: [{ id: 'v28', title: 'Musique & éclairage', duration: '2:00' }, { id: 'v29', title: 'La mise en place', duration: '2:30' }] },
      { id: 'm11', title: 'Événements', duration: '8 min', videos: [{ id: 'v30', title: 'Organiser un event', duration: '3:00' }, { id: 'v31', title: 'Gérer les réservations', duration: '2:30' }, { id: 'v32', title: 'Le service en soirée', duration: '2:30' }] },
    ],
  },
  {
    id: 'tp5', title: 'Cuisine — Standards Skult', type: 'role', role: 'Cuisine', moduleCount: 2, videoCount: 6, avgCompletion: 70,
    modules: [
      { id: 'm12', title: 'Préparations', duration: '9 min', videos: [{ id: 'v33', title: 'Les tartines signature', duration: '3:00' }, { id: 'v34', title: 'Les bowls', duration: '3:30' }, { id: 'v35', title: 'Pâtisseries maison', duration: '2:30' }] },
      { id: 'm13', title: 'Organisation cuisine', duration: '7 min', videos: [{ id: 'v36', title: 'Mise en place', duration: '2:30' }, { id: 'v37', title: 'Gestion des stocks', duration: '2:15' }, { id: 'v38', title: 'Nettoyage cuisine', duration: '2:15' }] },
    ],
  },
];

export const checklistTemplates: ChecklistTemplate[] = [
  {
    id: 'cl1', studio: 'Skult Rhodes', role: 'Barista', completionRate: 94,
    frequentlySkipped: ['Nettoyer le bac à marc', 'Ranger les tasses'],
    items: [
      { id: 'ci1', label: 'Nettoyer les buses vapeur', photoRequired: false, aiValidation: false },
      { id: 'ci2', label: 'Vider et nettoyer le bac à marc', photoRequired: true, aiValidation: true },
      { id: 'ci3', label: 'Purger le groupe', photoRequired: false, aiValidation: false },
      { id: 'ci4', label: 'Essuyer le comptoir', photoRequired: true, aiValidation: true },
      { id: 'ci5', label: 'Ranger les tasses et verres', photoRequired: false, aiValidation: false },
      { id: 'ci6', label: 'Vérifier les stocks de lait', photoRequired: false, aiValidation: false },
      { id: 'ci7', label: 'Passer un cycle de nettoyage', photoRequired: true, aiValidation: false },
    ],
  },
  {
    id: 'cl2', studio: 'Skult Rhodes', role: 'Accueil', completionRate: 91,
    frequentlySkipped: ['Réapprovisionner les serviettes'],
    items: [
      { id: 'ci8', label: 'Clôturer la caisse', photoRequired: false, aiValidation: false },
      { id: 'ci9', label: 'Nettoyer les tables', photoRequired: true, aiValidation: true },
      { id: 'ci10', label: 'Réapprovisionner les serviettes', photoRequired: false, aiValidation: false },
      { id: 'ci11', label: 'Balayer la salle', photoRequired: true, aiValidation: true },
      { id: 'ci12', label: 'Vérifier les toilettes', photoRequired: true, aiValidation: false },
    ],
  },
  {
    id: 'cl3', studio: 'Skult Châtelain', role: 'Cuisine', completionRate: 88,
    frequentlySkipped: ['Vérifier les DLC', 'Désinfecter les plans de travail'],
    items: [
      { id: 'ci13', label: 'Nettoyer les plans de travail', photoRequired: true, aiValidation: true },
      { id: 'ci14', label: 'Ranger les ingrédients', photoRequired: false, aiValidation: false },
      { id: 'ci15', label: 'Vérifier les DLC', photoRequired: false, aiValidation: false },
      { id: 'ci16', label: 'Sortir les poubelles', photoRequired: true, aiValidation: false },
      { id: 'ci17', label: 'Désinfecter les plans de travail', photoRequired: true, aiValidation: true },
      { id: 'ci18', label: 'Fermer les frigos', photoRequired: false, aiValidation: false },
      { id: 'ci19', label: 'Vérifier le gaz', photoRequired: false, aiValidation: false },
      { id: 'ci20', label: 'Balayer et serpiller', photoRequired: true, aiValidation: true },
      { id: 'ci21', label: 'Ranger la vaisselle propre', photoRequired: false, aiValidation: false },
      { id: 'ci22', label: 'Noter les ruptures de stock', photoRequired: false, aiValidation: false },
    ],
  },
];

export const studioExceptions: StudioException[] = [
  { id: 'se1', studio: 'Skult Rhodes', date: '2026-05-21', dateLabel: 'Jeudi 21 mai', type: 'fermeture', title: 'Ascension', description: 'Jour férié — les deux studios sont fermés.', impact: [] },
  { id: 'se2', studio: 'Skult Châtelain', date: '2026-05-21', dateLabel: 'Jeudi 21 mai', type: 'fermeture', title: 'Ascension', description: 'Jour férié — les deux studios sont fermés.', impact: [] },
  { id: 'se3', studio: 'Skult Rhodes', date: '2026-05-23', dateLabel: 'Samedi 23 mai', type: 'événement', title: 'Soirée jazz live', description: 'Concert jazz de 19h à 23h. Besoin de staff supplémentaire en soirée.', impact: [{ role: 'Host', delta: 2 }, { role: 'Barista', delta: 1 }], hoursAdjust: '+2h fermeture' },
  { id: 'se4', studio: 'Skult Châtelain', date: '2026-05-14', dateLabel: 'Mercredi 14 mai', type: 'ajustement', title: 'Travaux rue Châtelain', description: 'Travaux de voirie = moins de passage. Réduction du staff midi.', impact: [{ role: 'Barista', delta: -1 }, { role: 'Cuisine', delta: -1 }] },
  { id: 'se5', studio: 'Skult Rhodes', date: '2026-06-01', dateLabel: 'Lundi 1 juin', type: 'fermeture', title: 'Lundi de Pentecôte', description: 'Jour férié.', impact: [] },
  { id: 'se6', studio: 'Skult Châtelain', date: '2026-05-30', dateLabel: 'Samedi 30 mai', type: 'événement', title: 'Brunch spécial anniversaire', description: 'Brunch à volonté de 10h à 15h pour les 2 ans du studio.', impact: [{ role: 'Cuisine', delta: 2 }, { role: 'Accueil', delta: 1 }], hoursAdjust: 'Service étendu 10h-16h' },
];

export const pendingSignups: PendingSignup[] = [
  { id: 'ps1', firstName: 'Mathis', lastName: 'Delvaux', email: 'mathis.d@gmail.com', phone: '+32 475 11 22 33', age: 20, city: 'Bruxelles', experience: "2 ans d'expérience comme barista chez Starbucks. Je cherche un endroit plus artisanal et humain. Disponible les weekends et mercredis.", desiredRoles: ['Barista'], desiredStudios: ['Skult Rhodes', 'Skult Châtelain'], submittedAt: 'Aujourd\'hui', status: 'en-attente' },
  { id: 'ps2', firstName: 'Luna', lastName: 'Vanhove', email: 'luna.vh@student.be', phone: '+32 488 44 55 66', age: 19, city: 'Bruxelles', experience: "Aucune expérience en horeca mais très motivée. Étudiante en communication à l'ULB, je suis souriante et j'adore le contact client.", desiredRoles: ['Accueil', 'Host'], desiredStudios: ['Skult Châtelain'], submittedAt: 'Hier', status: 'en-attente' },
  { id: 'ps3', firstName: 'Karim', lastName: 'Bouzid', email: 'karim.b@outlook.com', phone: '+32 476 77 88 99', age: 24, city: 'Bruxelles', experience: "3 ans en cuisine dans un restaurant italien. CAP cuisine. Je cherche un job étudiant flexible pour financer ma fin d'études.", desiredRoles: ['Cuisine'], desiredStudios: ['Skult Rhodes'], submittedAt: 'Il y a 3 jours', status: 'en-attente' },
];

export const pointageEntries: PointageEntry[] = [
  { id: 'p1', employeeId: '1', employeeName: 'Clara Martens', role: 'Barista', studio: 'Skult Rhodes', date: "Aujourd'hui", shiftStart: '07h00', shiftEnd: '12h00', clockIn: '06h52', clockOut: '12h03', status: 'à-temps' },
  { id: 'p2', employeeId: '8', employeeName: 'Marie Dubois', role: 'Barista', studio: 'Skult Rhodes', date: "Aujourd'hui", shiftStart: '08h00', shiftEnd: '15h00', clockIn: '07h58', status: 'en-cours' },
  { id: 'p3', employeeId: '4', employeeName: 'Emma Vermeulen', role: 'Host', studio: 'Skult Rhodes', date: "Aujourd'hui", shiftStart: '10h00', shiftEnd: '15h00', clockIn: '10h08', status: 'retard', delayMinutes: 8 },
  { id: 'p4', employeeId: '5', employeeName: 'Marc Peeters', role: 'Cuisine', studio: 'Skult Châtelain', date: "Aujourd'hui", shiftStart: '14h00', shiftEnd: '22h00', status: 'à-venir' },
  { id: 'p5', employeeId: '2', employeeName: 'Sofia De Smet', role: 'Accueil', studio: 'Skult Châtelain', date: "Aujourd'hui", shiftStart: '14h00', shiftEnd: '21h00', status: 'à-venir' },
  { id: 'p6', employeeId: '6', employeeName: 'Lina Kouri', role: 'Barista', studio: 'Skult Châtelain', date: "Aujourd'hui", shiftStart: '17h00', shiftEnd: '23h00', status: 'à-venir' },
  { id: 'p7', employeeId: '12', employeeName: 'Yasmine Hadji', role: 'Host', studio: 'Skult Rhodes', date: "Aujourd'hui", shiftStart: '10h00', shiftEnd: '15h00', clockIn: '09h55', status: 'en-cours' },
  { id: 'p8', employeeId: '17', employeeName: 'Mehdi Benali', role: 'Cuisine', studio: 'Skult Châtelain', date: "Aujourd'hui", shiftStart: '07h00', shiftEnd: '14h00', clockIn: '06h58', clockOut: '14h05', status: 'à-temps' },
];

export const feedbackEntries: FeedbackEntry[] = [
  { id: 'f1', employeeId: '1', employeeName: 'Clara Martens', role: 'Barista', studio: 'Skult Rhodes', date: "Aujourd'hui", shiftRating: 5, teamRating: 5, selfRating: 4, comment: 'Super shift, bonne ambiance avec Marie !' },
  { id: 'f2', employeeId: '8', employeeName: 'Marie Dubois', role: 'Barista', studio: 'Skult Rhodes', date: "Aujourd'hui", shiftRating: 4, teamRating: 5, selfRating: 4 },
  { id: 'f3', employeeId: '17', employeeName: 'Mehdi Benali', role: 'Cuisine', studio: 'Skult Châtelain', date: "Aujourd'hui", shiftRating: 3, teamRating: 4, selfRating: 3, comment: 'Beaucoup de commandes, un peu speed mais on a géré.' },
  { id: 'f4', employeeId: '2', employeeName: 'Sofia De Smet', role: 'Accueil', studio: 'Skult Châtelain', date: 'Hier', shiftRating: 5, teamRating: 4, selfRating: 5, comment: 'Excellente journée, les clients étaient contents.' },
  { id: 'f5', employeeId: '12', employeeName: 'Yasmine Hadji', role: 'Host', studio: 'Skult Rhodes', date: 'Hier', shiftRating: 4, teamRating: 4, selfRating: 4 },
  { id: 'f6', employeeId: '21', employeeName: 'Victor Renard', role: 'Barista', studio: 'Skult Rhodes', date: 'Hier', shiftRating: 5, teamRating: 5, selfRating: 5, comment: 'Journée parfaite, le nouveau blend est top.' },
  { id: 'f7', employeeId: '7', employeeName: 'Rania Berkani', role: 'Accueil', studio: 'Skult Rhodes', date: 'Lundi', shiftRating: 3, teamRating: 3, selfRating: 3, comment: 'Journée calme, un peu ennuyeux honnêtement.' },
  { id: 'f8', employeeId: '24', employeeName: 'Fatima Ozdemir', role: 'Accueil', studio: 'Skult Châtelain', date: 'Lundi', shiftRating: 4, teamRating: 5, selfRating: 4, comment: 'Bonne team ce jour-là !' },
];

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

export function getQuotaStatus(used: number | null, max: number | null): 'safe' | 'warning' | 'danger' | null {
  if (used === null || max === null) return null;
  const pct = used / max;
  if (pct >= 0.9) return 'danger';
  if (pct >= 0.5) return 'warning';
  return 'safe';
}

export function getStatusColor(status: ShiftStatus) {
  switch (status) {
    case 'terminé': return { bg: 'var(--muted)', text: 'var(--muted-foreground)' };
    case 'en-cours': return { bg: 'var(--coral-light)', text: 'var(--coral-dark)' };
    case 'retard': return { bg: 'var(--warning-bg)', text: 'var(--warning-text)' };
    case 'à-venir': return { bg: 'var(--info-bg)', text: 'var(--info-text)' };
  }
}

export function getUrgencyColor(urgency: 'critique' | 'urgent' | 'normal') {
  switch (urgency) {
    case 'critique': return { bg: 'var(--danger-bg)', text: 'var(--danger-text)', label: 'Critique' };
    case 'urgent': return { bg: 'var(--warning-bg)', text: 'var(--warning-text)', label: 'Urgent' };
    case 'normal': return { bg: 'var(--info-bg)', text: 'var(--info-text)', label: 'Normal' };
  }
}

export const reasonIcons: Record<ModificationRequest['reason'], string> = {
  maladie: '🤒',
  examen: '📚',
  famille: '👨‍👩‍👧',
  transport: '🚆',
  conflit: '📅',
  autre: '💬',
};
