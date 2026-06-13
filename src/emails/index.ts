import type { ComponentType } from "react";

import InvitationEmployeEmail from "./employee/InvitationEmployeEmail";
import BienvenueEmail from "./employee/BienvenueEmail";
import ResetPasswordEmail from "./employee/ResetPasswordEmail";
import ShiftAssigneEmail from "./employee/ShiftAssigneEmail";
import PropositionShiftEmail from "./employee/PropositionShiftEmail";
import DemandeAccepteeEmail from "./employee/DemandeAccepteeEmail";
import DemandeRefuseeEmail from "./employee/DemandeRefuseeEmail";
import PlanningPublieEmail from "./employee/PlanningPublieEmail";
import RappelShiftEmail from "./employee/RappelShiftEmail";
import DebriefingShiftEmail from "./employee/DebriefingShiftEmail";
import DispoReminderEmail from "./employee/DispoReminderEmail";
import DispoDeadlineReminderEmail from "./employee/DispoDeadlineReminderEmail";

import NouvelleDemandeEmail from "./admin/NouvelleDemandeEmail";
import TrouCritiqueEmail from "./admin/TrouCritiqueEmail";
import EmployeRetardEmail from "./admin/EmployeRetardEmail";
import QuotaEtudiantDepasseEmail from "./admin/QuotaEtudiantDepasseEmail";
import NouvelleInscriptionEmail from "./admin/NouvelleInscriptionEmail";

export interface EmailTemplate {
  id: string;
  name: string;
  category: "employee" | "admin";
  description: string;
  subject: string;
  component: ComponentType<any>;
  mockData: Record<string, any>;
}

export const EMAIL_REGISTRY: EmailTemplate[] = [
  {
    id: "invitation-employe",
    name: "Invitation employé",
    category: "employee",
    description: "Envoyé quand l'admin invite un nouvel employé",
    subject:
      "Bienvenue chez Skult Châtelain – Active ton compte Kadence",
    component: InvitationEmployeEmail,
    mockData: {
      firstName: "Léa",
      studioName: "Skult Châtelain",
      inviteUrl: "https://app.kadence.io/invite/abc123",
    },
  },
  {
    id: "bienvenue-employe",
    name: "Bienvenue (compte activé)",
    category: "employee",
    description:
      "Envoyé à l'employé juste après l'activation de son compte",
    subject: "🎉 Bienvenue chez Skult Studios — Ton compte est activé",
    component: BienvenueEmail,
    mockData: {
      firstName: "Léa",
      studioName: "Skult Châtelain",
      appUrl: "https://app.shyft.flashsite.fr/staff-app",
    },
  },
  {
    id: "reset-password",
    name: "Reset password",
    category: "employee",
    description:
      "Envoyé quand l'employé demande à réinitialiser son mot de passe",
    subject: "Réinitialise ton mot de passe Kadence",
    component: ResetPasswordEmail,
    mockData: {
      firstName: "Léa",
      resetUrl: "https://app.kadence.io/reset/xyz789",
    },
  },
  {
    id: "shift-assigne",
    name: "Shift assigné",
    category: "employee",
    description: "Envoyé quand l'admin assigne un shift directement",
    subject: "Nouveau shift le Vendredi 5 Juin chez Skult Châtelain",
    component: ShiftAssigneEmail,
    mockData: {
      firstName: "Léa",
      studioName: "Skult Châtelain",
      shiftDate: "Vendredi 5 Juin",
      startTime: "17h00",
      endTime: "20h15",
      role: "Barista",
      planningUrl: "https://app.kadence.io/staff-app/planning",
    },
  },
  {
    id: "proposition-shift",
    name: "Proposition de shift",
    category: "employee",
    description:
      "Envoyé quand l'admin propose un shift à plusieurs employés",
    subject: "📨 Un shift est dispo : Mardi 27 Mai à 18h00",
    component: PropositionShiftEmail,
    mockData: {
      firstName: "Léa",
      studioName: "Skult Châtelain",
      shiftDate: "Mardi 27 Mai",
      startTime: "18h00",
      endTime: "22h00",
      role: "Barista",
      acceptUrl: "https://app.kadence.io/staff-app",
    },
  },
  {
    id: "demande-acceptee",
    name: "Demande acceptée",
    category: "employee",
    description: "Envoyé quand l'admin accepte une demande de modification",
    subject: "✅ Ta demande a été acceptée",
    component: DemandeAccepteeEmail,
    mockData: {
      firstName: "Léa",
      requestType: "swap de shift",
      shiftDate: "Samedi 31 Mai",
      adminResponse: "Pas de souci, Tom prendra ton shift.",
      planningUrl: "https://app.kadence.io/staff-app/planning",
    },
  },
  {
    id: "demande-refusee",
    name: "Demande refusée",
    category: "employee",
    description: "Envoyé quand l'admin refuse une demande de modification",
    subject: "Ta demande n'a pas été acceptée",
    component: DemandeRefuseeEmail,
    mockData: {
      firstName: "Léa",
      requestType: "swap de shift",
      shiftDate: "Samedi 31 Mai",
      adminResponse:
        "Personne n'est dispo pour reprendre, je ne peux pas valider.",
      requestsUrl: "https://app.kadence.io/staff-app/demandes",
    },
  },
  {
    id: "planning-publie",
    name: "Planning publié",
    category: "employee",
    description: "Envoyé quand l'admin publie le planning du mois",
    subject: "📅 Le planning de Juin 2026 est dispo",
    component: PlanningPublieEmail,
    mockData: {
      firstName: "Léa",
      month: "Juin 2026",
      shiftCount: 12,
      totalHours: 48,
      planningUrl: "https://app.kadence.io/staff-app/planning",
    },
  },
  {
    id: "rappel-shift",
    name: "Rappel shift (H-1)",
    category: "employee",
    description: "Envoyé 1h avant le début de chaque shift",
    subject: "⏰ Ton shift commence dans 1h",
    component: RappelShiftEmail,
    mockData: {
      firstName: "Léa",
      studioName: "Skult Châtelain",
      startTime: "17h00",
      role: "Barista",
      shiftUrl: "https://app.kadence.io/staff-app/planning",
    },
  },
  {
    id: "debriefing-shift",
    name: "Debriefing shift (post-clock-out)",
    category: "employee",
    description: "Envoyé après le clock-out et la checklist de clôture",
    subject: "✅ Shift terminé – Récap de ton Vendredi 5 Juin",
    component: DebriefingShiftEmail,
    mockData: {
      firstName: "Léa",
      studioName: "Skult Châtelain",
      shiftDate: "Vendredi 5 Juin",
      clockInTime: "16h55",
      clockOutTime: "20h18",
      durationHours: 3.3,
      pointsTotal: 8,
      pointsPonctualite: 3,
      pointsChecklist: 3,
      pointsNoteManager: 2,
      newScore: 7.9,
      managerComment:
        "Super énergie ce soir, les clients étaient ravis !",
      statsUrl: "https://app.kadence.io/staff-app/stats",
    },
  },
  {
    id: "dispo-reminder",
    name: "Rappel dispos employé",
    category: "employee",
    description:
      "Envoyé quand l'admin relance un employé qui n'a pas saisi ses dispos pour le mois prochain",
    subject: "📅 Rappel — tes dispos pour Juillet 2026 sont attendues",
    component: DispoReminderEmail,
    mockData: {
      firstName: "Léa",
      monthLabel: "Juillet 2026",
      deadlineLabel: "Vendredi 25 juin à 23h59",
      studioName: "Skult Châtelain",
      statsAppUrl: "https://app.kadence.io/staff-app",
    },
  },
  {
    id: "nouvelle-demande",
    name: "Nouvelle demande employé",
    category: "admin",
    description: "Envoyé à l'admin quand un employé fait une demande",
    subject: "📥 Léa Berger a fait une demande de swap",
    component: NouvelleDemandeEmail,
    mockData: {
      adminFirstName: "Sacha",
      employeeName: "Léa Berger",
      requestType: "swap",
      shiftDate: "Samedi 31 Mai",
      employeeMessage:
        "J'ai un imprévu, est-ce que quelqu'un peut me remplacer ?",
      requestUrl: "https://app.kadence.io/demandes",
    },
  },
  {
    id: "trou-critique",
    name: "Trou critique (H-24)",
    category: "admin",
    description: "Envoyé à l'admin si un shift dans <24h n'est pas couvert",
    subject: "🚨 Shift non couvert : Mardi 27 Mai à 18h00",
    component: TrouCritiqueEmail,
    mockData: {
      adminFirstName: "Sacha",
      shiftDate: "Mardi 27 Mai",
      startTime: "18h00",
      endTime: "22h00",
      role: "Barista",
      studioName: "Skult Châtelain",
      trousUrl: "https://app.kadence.io/trous",
    },
  },
  {
    id: "employe-retard",
    name: "Employé en retard",
    category: "admin",
    description:
      "Envoyé à l'admin quand un employé ne pointe pas à l'heure",
    subject: "⚠️ Léa Berger n'a pas pointé",
    component: EmployeRetardEmail,
    mockData: {
      adminFirstName: "Sacha",
      employeeName: "Léa Berger",
      scheduledStart: "17h00",
      studioName: "Skult Châtelain",
      role: "Barista",
      lateMinutes: 15,
      shiftUrl: "https://app.kadence.io/planning",
    },
  },
  {
    id: "quota-etudiant-depasse",
    name: "Quota étudiant dépassé",
    category: "admin",
    description:
      "Envoyé à l'admin quand un étudiant approche/dépasse son quota mensuel",
    subject: "📊 Sofia De Smet approche de son quota mensuel",
    component: QuotaEtudiantDepasseEmail,
    mockData: {
      adminFirstName: "Sacha",
      employeeName: "Sofia De Smet",
      currentHours: 56,
      quotaMax: 60,
      profileUrl: "https://app.kadence.io/staff/abc",
    },
  },
  {
    id: "nouvelle-inscription",
    name: "Nouvelle inscription",
    category: "admin",
    description:
      "Envoyé à l'admin quand un employé invité active son compte",
    subject: "🎉 Léa Berger vient de rejoindre Kadence",
    component: NouvelleInscriptionEmail,
    mockData: {
      adminFirstName: "Sacha",
      employeeName: "Léa Berger",
      employeeEmail: "lea.berger@example.com",
      profileUrl: "https://app.kadence.io/staff/abc",
    },
  },
];
