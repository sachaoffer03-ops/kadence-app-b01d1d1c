import type { ComponentType } from "react";

import InvitationEmployeEmail, {
  subject as invitationEmployeSubject,
} from "./employee/InvitationEmployeEmail";
import BienvenueEmail, {
  subject as bienvenueSubject,
} from "./employee/BienvenueEmail";
import ResetPasswordEmail, {
  subject as resetPasswordSubject,
} from "./employee/ResetPasswordEmail";
import ShiftAssigneEmail, {
  subject as shiftAssigneSubject,
} from "./employee/ShiftAssigneEmail";
import PropositionShiftEmail, {
  subject as propositionShiftSubject,
} from "./employee/PropositionShiftEmail";
import DemandeAccepteeEmail, {
  subject as demandeAccepteeSubject,
} from "./employee/DemandeAccepteeEmail";
import DemandeRefuseeEmail, {
  subject as demandeRefuseeSubject,
} from "./employee/DemandeRefuseeEmail";
import PlanningPublieEmail, {
  subject as planningPublieSubject,
} from "./employee/PlanningPublieEmail";
import RappelShiftEmail, {
  subject as rappelShiftSubject,
} from "./employee/RappelShiftEmail";
import DebriefingShiftEmail, {
  subject as debriefingShiftSubject,
} from "./employee/DebriefingShiftEmail";
import ShiftsDisponiblesEmail, {
  subject as shiftsDisponiblesSubject,
} from "./employee/ShiftsDisponiblesEmail";
import DispoReminderEmail, {
  subject as dispoReminderSubject,
} from "./employee/DispoReminderEmail";
import DispoDeadlineReminderEmail, {
  subject as dispoDeadlineReminderSubject,
} from "./employee/DispoDeadlineReminderEmail";

import NouvelleDemandeEmail, {
  subject as nouvelleDemandeSubject,
} from "./admin/NouvelleDemandeEmail";
import TrouCritiqueEmail, {
  subject as trouCritiqueSubject,
} from "./admin/TrouCritiqueEmail";
import EmployeRetardEmail, {
  subject as employeRetardSubject,
} from "./admin/EmployeRetardEmail";
import QuotaEtudiantDepasseEmail, {
  subject as quotaEtudiantDepasseSubject,
} from "./admin/QuotaEtudiantDepasseEmail";
import NouvelleInscriptionEmail, {
  subject as nouvelleInscriptionSubject,
} from "./admin/NouvelleInscriptionEmail";

import SignupConfirmEmail from "./auth/SignupConfirmEmail";
import MagicLinkEmail from "./auth/MagicLinkEmail";
import ChangeEmailEmail from "./auth/ChangeEmailEmail";
import ReauthEmail from "./auth/ReauthEmail";

export const SUBJECT_RESOLVERS: Record<string, (data: any) => string> = {
  "invitation-employe": invitationEmployeSubject,
  "bienvenue-employe": bienvenueSubject,
  "reset-password": resetPasswordSubject,
  "shift-assigne": shiftAssigneSubject,
  "proposition-shift": propositionShiftSubject,
  "demande-acceptee": demandeAccepteeSubject,
  "demande-refusee": demandeRefuseeSubject,
  "planning-publie": planningPublieSubject,
  "rappel-shift": rappelShiftSubject,
  "debriefing-shift": debriefingShiftSubject,
  "shifts-disponibles": shiftsDisponiblesSubject,
  "dispo-reminder": dispoReminderSubject,
  "dispo-deadline-reminder": dispoDeadlineReminderSubject,
  "nouvelle-demande": nouvelleDemandeSubject,
  "trou-critique": trouCritiqueSubject,
  "employe-retard": employeRetardSubject,
  "quota-etudiant-depasse": quotaEtudiantDepasseSubject,
  "nouvelle-inscription": nouvelleInscriptionSubject,
};

export interface EmailTemplate {
  id: string;
  name: string;
  category: "employee" | "admin" | "auth";
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
      appUrl: "https://app.kadence.be/staff-app",
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
    id: "shifts-disponibles",
    name: "Shifts disponibles (bourse)",
    category: "employee",
    description:
      "Envoyé quand un admin/manager ouvre des trous à tous les employés d'un studio. Premier arrivé, premier servi.",
    subject: "3 shifts à prendre — premier arrivé, premier servi",
    component: ShiftsDisponiblesEmail,
    mockData: {
      firstName: "Léa",
      totalCount: 3,
      slots: [
        { dateLabel: "jeudi 3 septembre", timeLabel: "07:30 – 15:30", role: "Barista", studioName: "Châtelain" },
        { dateLabel: "samedi 5 septembre", timeLabel: "14:30 – 22:00", role: "Accueil", studioName: "Châtelain" },
        { dateLabel: "dimanche 6 septembre", timeLabel: "09:00 – 17:00", role: "Barista", studioName: "Rhode" },
      ],
      message: "On a besoin de renfort ce week-end, merci !",
      studioName: "Skult Châtelain",
      appUrl: "https://app.kadence.be/staff-app",
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
    id: "dispo-deadline-reminder",
    name: "Rappel deadline dispos (auto)",
    category: "employee",
    description:
      "Envoyé automatiquement par le cron aux seuils 3j / 24h / 1h avant deadline. Le variant urgency change le ton et la couleur.",
    subject: "📅 Plus que 3 jours pour tes dispos de Juillet 2026",
    component: DispoDeadlineReminderEmail,
    mockData: {
      firstName: "Léa",
      monthLabel: "Juillet 2026",
      deadlineLabel: "Vendredi 25 juin à 23h59",
      urgency: "soft",
      studioName: "Skult Châtelain",
      statsAppUrl: "https://app.kadence.be/staff-app",
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
  {
    id: "auth-signup-confirm",
    name: "Auth · Confirmation d'inscription",
    category: "auth",
    description:
      "Envoyé quand un user s'inscrit et doit confirmer son adresse email (Supabase Auth signup).",
    subject: "Confirme ton compte Kadence",
    component: SignupConfirmEmail,
    mockData: {
      firstName: "Léa",
      confirmationUrl: "https://app.kadence.be/auth/callback?token=abc",
    },
  },
  {
    id: "auth-magic-link",
    name: "Auth · Magic link",
    category: "auth",
    description:
      "Envoyé pour une connexion sans mot de passe (Supabase Auth magiclink).",
    subject: "Ton lien de connexion Kadence",
    component: MagicLinkEmail,
    mockData: {
      confirmationUrl: "https://app.kadence.be/auth/callback?token=abc",
    },
  },
  {
    id: "auth-email-change",
    name: "Auth · Changement d'email",
    category: "auth",
    description:
      "Envoyé à la nouvelle adresse pour confirmer un changement d'email (Supabase Auth email_change).",
    subject: "Confirme ta nouvelle adresse email Kadence",
    component: ChangeEmailEmail,
    mockData: {
      confirmationUrl: "https://app.kadence.be/auth/callback?token=abc",
      oldEmail: "ancienne@example.com",
      newEmail: "nouvelle@example.com",
    },
  },
  {
    id: "auth-reauthentication",
    name: "Auth · Réauthentification",
    category: "auth",
    description:
      "Envoyé avec un code à 6 chiffres pour confirmer une action sensible (Supabase Auth reauthentication).",
    subject: "Code de vérification Kadence",
    component: ReauthEmail,
    mockData: {
      token: "123456",
    },
  },
];

