export type Role = 'Barista' | 'Accueil' | 'Host' | 'Cuisine';
export type ContractType = 'Étudiant' | 'Flexi' | 'CDI';
export type Studio = 'Skult Rhodes' | 'Skult Châtelain';
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
  quotaUsed: number | null; // null = no quota (CDI/Flexi)
  quotaMax: number | null;
  shiftsCount: number;
  lastShift: string;
  studio: Studio;
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

export const roleColors: Record<Role, { bg: string; text: string; dot: string }> = {
  Barista: { bg: 'var(--role-barista-bg)', text: 'var(--role-barista-text)', dot: 'var(--role-barista-dot)' },
  Accueil: { bg: 'var(--role-accueil-bg)', text: 'var(--role-accueil-text)', dot: 'var(--role-accueil-dot)' },
  Host: { bg: 'var(--role-host-bg)', text: 'var(--role-host-text)', dot: 'var(--role-host-dot)' },
  Cuisine: { bg: 'var(--role-cuisine-bg)', text: 'var(--role-cuisine-text)', dot: 'var(--role-cuisine-dot)' },
};

export const employees: Employee[] = [
  { id: '1', firstName: 'Clara', lastName: 'Martens', age: 22, city: 'Bruxelles', contract: 'Étudiant', roles: ['Barista', 'Accueil'], score: 9.4, quotaUsed: 198, quotaMax: 650, shiftsCount: 23, lastShift: 'Aujourd\'hui', studio: 'Skult Rhodes' },
  { id: '2', firstName: 'Sofia', lastName: 'De Smet', age: 21, city: 'Bruxelles', contract: 'Étudiant', roles: ['Accueil', 'Host'], score: 9.2, quotaUsed: 487, quotaMax: 650, shiftsCount: 19, lastShift: 'Aujourd\'hui', studio: 'Skult Châtelain' },
  { id: '3', firstName: 'Léa', lastName: 'Berger', age: 23, city: 'Anvers', contract: 'Étudiant', roles: ['Host', 'Accueil'], score: 8.9, quotaUsed: 612, quotaMax: 650, shiftsCount: 17, lastShift: 'Hier', studio: 'Skult Rhodes' },
  { id: '4', firstName: 'Emma', lastName: 'Vermeulen', age: 20, city: 'Anvers', contract: 'Étudiant', roles: ['Host'], score: 8.5, quotaUsed: 312, quotaMax: 650, shiftsCount: 15, lastShift: 'Aujourd\'hui', studio: 'Skult Rhodes' },
  { id: '5', firstName: 'Marc', lastName: 'Peeters', age: 31, city: 'Bruxelles', contract: 'CDI', roles: ['Cuisine', 'Barista'], score: 9.1, quotaUsed: null, quotaMax: null, shiftsCount: 22, lastShift: 'Aujourd\'hui', studio: 'Skult Châtelain' },
  { id: '6', firstName: 'Lina', lastName: 'Kouri', age: 25, city: 'Bruxelles', contract: 'Flexi', roles: ['Barista', 'Accueil'], score: 8.7, quotaUsed: null, quotaMax: null, shiftsCount: 14, lastShift: 'Aujourd\'hui', studio: 'Skult Châtelain' },
  { id: '7', firstName: 'Rania', lastName: 'Berkani', age: 19, city: 'Bruxelles', contract: 'Étudiant', roles: ['Barista', 'Accueil'], score: 7.9, quotaUsed: 156, quotaMax: 650, shiftsCount: 9, lastShift: 'Lundi', studio: 'Skult Rhodes' },
  { id: '8', firstName: 'Marie', lastName: 'Dubois', age: 24, city: 'Bruxelles', contract: 'Étudiant', roles: ['Barista'], score: 8.8, quotaUsed: 234, quotaMax: 650, shiftsCount: 18, lastShift: 'Aujourd\'hui', studio: 'Skult Rhodes' },
  { id: '9', firstName: 'Thomas', lastName: 'Janssens', age: 28, city: 'Gand', contract: 'CDI', roles: ['Cuisine'], score: 9.0, quotaUsed: null, quotaMax: null, shiftsCount: 21, lastShift: 'Hier', studio: 'Skult Châtelain' },
  { id: '10', firstName: 'Amira', lastName: 'El Amrani', age: 20, city: 'Bruxelles', contract: 'Étudiant', roles: ['Accueil'], score: 8.3, quotaUsed: 289, quotaMax: 650, shiftsCount: 16, lastShift: 'Hier', studio: 'Skult Rhodes' },
  { id: '11', firstName: 'Lucas', lastName: 'Van den Berg', age: 22, city: 'Louvain', contract: 'Étudiant', roles: ['Barista'], score: 8.1, quotaUsed: 178, quotaMax: 650, shiftsCount: 11, lastShift: 'Lundi', studio: 'Skult Châtelain' },
  { id: '12', firstName: 'Yasmine', lastName: 'Hadji', age: 21, city: 'Bruxelles', contract: 'Étudiant', roles: ['Host', 'Accueil'], score: 8.6, quotaUsed: 345, quotaMax: 650, shiftsCount: 20, lastShift: 'Aujourd\'hui', studio: 'Skult Rhodes' },
  { id: '13', firstName: 'Antoine', lastName: 'Lambert', age: 26, city: 'Namur', contract: 'Flexi', roles: ['Barista', 'Cuisine'], score: 7.8, quotaUsed: null, quotaMax: null, shiftsCount: 8, lastShift: 'Vendredi', studio: 'Skult Châtelain' },
  { id: '14', firstName: 'Inès', lastName: 'Bouazza', age: 19, city: 'Bruxelles', contract: 'Étudiant', roles: ['Accueil'], score: 8.4, quotaUsed: 123, quotaMax: 650, shiftsCount: 7, lastShift: 'Mercredi', studio: 'Skult Rhodes' },
  { id: '15', firstName: 'Noah', lastName: 'Willems', age: 23, city: 'Bruxelles', contract: 'Étudiant', roles: ['Barista', 'Host'], score: 8.2, quotaUsed: 267, quotaMax: 650, shiftsCount: 14, lastShift: 'Hier', studio: 'Skult Châtelain' },
  { id: '16', firstName: 'Chloé', lastName: 'Dupont', age: 20, city: 'Liège', contract: 'Étudiant', roles: ['Barista'], score: 7.6, quotaUsed: 89, quotaMax: 650, shiftsCount: 5, lastShift: 'Jeudi', studio: 'Skult Rhodes' },
  { id: '17', firstName: 'Mehdi', lastName: 'Benali', age: 27, city: 'Bruxelles', contract: 'Flexi', roles: ['Cuisine', 'Barista'], score: 8.9, quotaUsed: null, quotaMax: null, shiftsCount: 16, lastShift: 'Aujourd\'hui', studio: 'Skult Châtelain' },
  { id: '18', firstName: 'Julie', lastName: 'Maes', age: 22, city: 'Bruxelles', contract: 'Étudiant', roles: ['Host'], score: 8.0, quotaUsed: 401, quotaMax: 650, shiftsCount: 18, lastShift: 'Lundi', studio: 'Skult Rhodes' },
  { id: '19', firstName: 'Adam', lastName: 'Claes', age: 21, city: 'Anvers', contract: 'Étudiant', roles: ['Barista', 'Accueil'], score: 7.7, quotaUsed: 211, quotaMax: 650, shiftsCount: 12, lastShift: 'Mercredi', studio: 'Skult Châtelain' },
  { id: '20', firstName: 'Sarah', lastName: 'Hermans', age: 24, city: 'Bruxelles', contract: 'Étudiant', roles: ['Accueil', 'Host'], score: 8.5, quotaUsed: 378, quotaMax: 650, shiftsCount: 19, lastShift: 'Hier', studio: 'Skult Rhodes' },
  { id: '21', firstName: 'Victor', lastName: 'Renard', age: 29, city: 'Bruxelles', contract: 'CDI', roles: ['Barista', 'Cuisine'], score: 9.3, quotaUsed: null, quotaMax: null, shiftsCount: 24, lastShift: 'Aujourd\'hui', studio: 'Skult Rhodes' },
  { id: '22', firstName: 'Nora', lastName: 'Deschamps', age: 20, city: 'Bruxelles', contract: 'Étudiant', roles: ['Barista'], score: 8.1, quotaUsed: 145, quotaMax: 650, shiftsCount: 10, lastShift: 'Vendredi', studio: 'Skult Châtelain' },
  { id: '23', firstName: 'Axel', lastName: 'De Vos', age: 22, city: 'Gand', contract: 'Étudiant', roles: ['Cuisine'], score: 7.5, quotaUsed: 98, quotaMax: 650, shiftsCount: 6, lastShift: 'Jeudi', studio: 'Skult Rhodes' },
  { id: '24', firstName: 'Fatima', lastName: 'Ozdemir', age: 23, city: 'Bruxelles', contract: 'Étudiant', roles: ['Accueil', 'Host'], score: 8.7, quotaUsed: 423, quotaMax: 650, shiftsCount: 21, lastShift: 'Aujourd\'hui', studio: 'Skult Châtelain' },
  { id: '25', firstName: 'Julien', lastName: 'Petit', age: 26, city: 'Namur', contract: 'Flexi', roles: ['Barista'], score: 8.0, quotaUsed: null, quotaMax: null, shiftsCount: 11, lastShift: 'Lundi', studio: 'Skult Rhodes' },
  { id: '26', firstName: 'Aïcha', lastName: 'Mertens', age: 19, city: 'Bruxelles', contract: 'Étudiant', roles: ['Barista', 'Accueil'], score: 7.3, quotaUsed: 67, quotaMax: 650, shiftsCount: 4, lastShift: 'Mercredi', studio: 'Skult Châtelain' },
  { id: '27', firstName: 'Diego', lastName: 'Santos', age: 30, city: 'Bruxelles', contract: 'Flexi', roles: ['Cuisine'], score: 8.4, quotaUsed: null, quotaMax: null, shiftsCount: 13, lastShift: 'Hier', studio: 'Skult Rhodes' },
  { id: '28', firstName: 'Eva', lastName: 'Claessens', age: 21, city: 'Louvain', contract: 'Étudiant', roles: ['Host', 'Barista'], score: 8.6, quotaUsed: 334, quotaMax: 650, shiftsCount: 17, lastShift: 'Aujourd\'hui', studio: 'Skult Châtelain' },
];

export const todayShifts: TodayShift[] = [
  { employeeId: '1', name: 'Clara Martens', role: 'Barista', studio: 'Skult Rhodes', startHour: '07h', endHour: '12h', status: 'terminé', statusLabel: 'Terminé', checkedIn: true },
  { employeeId: '8', name: 'Marie Dubois', role: 'Barista', studio: 'Skult Rhodes', startHour: '08h', endHour: '15h', status: 'en-cours', statusLabel: 'En cours', checkedIn: true },
  { employeeId: '4', name: 'Emma Vermeulen', role: 'Host', studio: 'Skult Rhodes', startHour: '10h', endHour: '15h', status: 'retard', statusLabel: 'Retard 8\'', checkedIn: false, delayMinutes: 8 },
  { employeeId: '5', name: 'Marc Peeters', role: 'Cuisine', studio: 'Skult Châtelain', startHour: '14h', endHour: '22h', status: 'à-venir', statusLabel: 'Dans 4h', checkedIn: false },
  { employeeId: '2', name: 'Sofia De Smet', role: 'Accueil', studio: 'Skult Châtelain', startHour: '14h', endHour: '21h', status: 'à-venir', statusLabel: 'Dans 4h', checkedIn: false },
  { employeeId: '6', name: 'Lina Kouri', role: 'Barista', studio: 'Skult Châtelain', startHour: '17h', endHour: '23h', status: 'à-venir', statusLabel: 'Dans 7h', checkedIn: false },
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
