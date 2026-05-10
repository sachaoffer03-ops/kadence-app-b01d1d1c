## Objectif

Connecter complètement le côté employé au côté admin avec un vrai système d'authentification, d'invitation et d'activation. Tout passe par la base de données (Lovable Cloud) et fonctionne réellement, plus aucune donnée mockée pour les employés.

## Flux global

```
Admin crée employé  →  Email invitation envoyé  →  Employé clique le lien
       ↓                                                    ↓
  (DB: employee +                              Page activation (mdp + infos
   invitation token)                            complètes obligatoires)
                                                          ↓
                                              Connexion auto → /staff-app
                                              (planning, dispos, profil)
```

---

## Phase 1 — Base de données

Tables créées dans Lovable Cloud :

- **`profiles`** — lié à l'utilisateur authentifié (auth.users), stocke toutes les infos employé : prénom, nom, date de naissance, téléphone, email, adresse, NISS, IBAN, nationalité, contact urgence (nom + tél), photo, type de contrat, studio, sections, score, quotas, statut (invité / actif / suspendu), date d'embauche.
- **`user_roles`** — table séparée pour les rôles applicatifs (`admin`, `manager`, `employee`) et les rôles métier (Barista, Accueil, Host, Cuisine). Évite l'escalade de privilèges.
- **`invitations`** — token unique, email, données pré-remplies par l'admin (studio, rôles, contrat, permissions), date d'expiration (7 jours), statut (en attente / utilisée / expirée), créée par.
- **`studios`** — Rhodes et Châtelain (Skult).

Sécurité : RLS sur toutes les tables. Les employés ne voient que leur propre profil. Les admins voient tout via la fonction `has_role()`.

## Phase 2 — Côté admin : créer un employé

Nouveau bouton **« + Inviter un employé »** sur la page `/staff` (en haut à droite).

Modal avec formulaire :
- Prénom, nom, email (obligatoire — sert à l'invitation)
- Téléphone (optionnel)
- Studio (Rhodes / Châtelain)
- Rôles métier (multi-sélection : Barista, Accueil, Host, Cuisine)
- Type de contrat (Étudiant / Flexi / CDI)
- Date d'embauche
- Permissions applicatives (employé standard / manager)

À la validation :
1. Crée une entrée dans `invitations` avec un token sécurisé
2. Envoie un email d'invitation branded Skult Studios via Lovable Emails
3. Affiche un toast de confirmation + un bouton **« Copier le lien »** pour partage manuel (WhatsApp, SMS, etc.)
4. L'employé apparaît immédiatement dans la liste avec le badge **« Invité — en attente »**

Sur la fiche employé : bouton **« Renvoyer l'invitation »** si toujours en attente.

## Phase 3 — Email d'invitation

Email transactionnel Lovable, design Skult Studios (off-white, coral, Inter) :
- Titre : « Bienvenue chez Skult Studios »
- Texte personnalisé avec son prénom et son studio
- Bouton **« Activer mon compte »** → lien avec token (valide 7 jours)
- Mention : nécessaire pour accéder au planning et pointer ses heures

## Phase 4 — Page d'activation `/activation?token=...`

Page publique (hors auth) en 3 étapes avec progression visuelle :

**Étape 1 — Mot de passe**
- Email pré-rempli (lecture seule)
- Mot de passe + confirmation (8 car. min, force vérifiée)

**Étape 2 — Identité**
- Date de naissance, nationalité, ville, adresse complète
- Téléphone (si pas déjà fourni)
- Photo de profil (upload optionnel)

**Étape 3 — Conformité RH**
- NISS (numéro national belge)
- IBAN (pour la paie)
- Contact d'urgence (nom + téléphone + lien de parenté)
- Carte étudiant valide (case à cocher si contrat Étudiant)
- Acceptation conditions

À la fin : compte créé via Supabase Auth, profil rempli, token marqué utilisé, redirection automatique vers `/staff-app`. Toast « Bienvenue ! ».

Validation Zod sur tous les champs côté client + serveur.

## Phase 5 — Page de connexion `/login`

Pour les employés déjà activés et pour l'admin :
- Email + mot de passe
- « Mot de passe oublié » → email de réinitialisation
- Redirection selon rôle : admin → `/dashboard`, employé → `/staff-app`

## Phase 6 — Protection des routes

- Routes admin (`/dashboard`, `/staff`, `/planning`, `/trous`, etc.) → réservées aux rôles `admin` et `manager`
- Routes employé (`/staff-app`) → utilisateur authentifié uniquement
- Page d'activation et login → publiques
- Redirection automatique selon le rôle après connexion

## Phase 7 — Côté employé : connecter `/staff-app` aux vraies données

L'écran `/staff-app` actuel utilise des données mockées. On le branche sur la base :
- **Accueil** : prochain shift réel depuis la DB
- **Planning** : ses propres shifts
- **Dispos** : sauvegardées et synchronisées avec l'admin
- **Profil** : ses vraies infos, modifiables (sauf champs RH critiques qui nécessitent validation admin)

L'admin voit en temps réel les dispos saisies par l'employé sur la page `/contingents`.

---

## Détails techniques (pour référence)

- **Auth** : Supabase Auth, email/password, sans confirmation email automatique (le token d'invitation valide déjà l'email)
- **Emails** : Lovable Emails avec domaine personnalisé (à configurer si pas déjà fait — étape rapide, je m'en occupe)
- **RLS** : politiques strictes, fonction `has_role(user_id, role)` SECURITY DEFINER pour éviter la récursion
- **Tokens d'invitation** : `gen_random_uuid()`, expiration 7j, table `invitations` avec contrainte d'unicité
- **Storage** : bucket `avatars` (public) pour les photos de profil
- **Validation** : Zod côté formulaires, contraintes DB côté serveur

---

## Phasage proposé

Je propose d'avancer **en 3 livraisons** plutôt que tout d'un bloc :

1. **Livraison 1** — DB + auth + login + protection des routes + page admin de création employé + email d'invitation + page d'activation complète. → l'admin peut inviter, l'employé peut activer son compte et se connecter.
2. **Livraison 2** — Connecter `/staff-app` aux vraies données (planning, dispos, profil employé).
3. **Livraison 3** — Synchro temps réel admin ↔ employé (dispos vues immédiatement par l'admin, notifications de nouveau planning, etc.).

Tu valides chaque livraison avant de passer à la suivante. Si tu préfères tout d'un coup, on peut aussi, mais c'est plus risqué de tout tester d'un coup.

Dis-moi si tu veux ajuster quelque chose (champs supplémentaires à l'activation, design email, etc.) ou si je lance la **Livraison 1**.
