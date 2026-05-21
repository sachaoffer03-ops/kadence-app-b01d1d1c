# Refonte du système de notifications

Système unifié avec priorités, catégories, pages dédiées, widgets d'accueil et navigation au clic fonctionnelle.

## 1. Base de données (migration SQL)

- Ajout colonnes `priority` (`urgent`/`normal`/`info`) et `category` (`planning`/`shift`/`training`/`request`/`document`/`pointage`/`general`) à `notifications`
- Index partiel `(user_id, priority, created_at DESC) WHERE read_at IS NULL` pour requêtes rapides
- Backfill : passer à `urgent` les types `shift_late_arrival`, `shift_no_show_suspected`, et `modification_request_new` urgence haute. Reste = `normal`/`info` selon mapping.

## 2. Couche serveur centralisée

**`src/lib/notifications.functions.ts`** (nouveau, via `requireSupabaseAuth`) :
- `listMyNotifications({ filter, category, limit, offset })` → notifs paginées + counts par priorité
- `markNotificationRead({ notificationId })`
- `markAllRead({ category? })`
- `countUnread()` → `{ urgent, normal, info, total }`
- `getRecentImportantNotifications({ limit = 3 })` → top 3 urgent+normal non lues

## 3. Métadonnées partagées

**`src/lib/notifications-meta.ts`** : mapping catégorie → `{ icon, color }`, priorité → `{ color, label }`. Helper `formatRelativeFr(date)` basé sur date-fns/fr.

## 4. UI Admin

- **TopBar dropdown amélioré** : 380px, 3 onglets (Toutes / Urgent / Non lues) avec badges, pastille priorité 4px à gauche, clic = mark read + navigate(link), lien "Voir tout" → `/notifications`. Badge cloche rouge si urgent unread, coral sinon.
- **Nouvelle page `/notifications`** (`src/routes/notifications.tsx`) : filtres par catégorie (pills) + toggle "non lues", bouton "Tout marquer lu", liste paginée 50/page avec actions mark read/unread, skeletons, empty state. Entrée sidebar dans CONFIGURATION.
- **Widget Dashboard** : section "Notifications importantes" (max 5, urgent+normal non lues) entre KPIs et timeline. Caché si vide. Bouton "Voir toutes".

## 5. UI Employé

- **NotificationsSheet (cloche)** refondue avec 2 sections :
  - **Actions requises** : propositions de shifts pending (logique intacte avec accept/decline)
  - **Notifications** : tout le reste, clic = mark read + navigate(link) via `useNavigate` (interne) ou `window.location.assign` (externe)
  - Bouton "Tout marquer lu" en haut
- **Widget Accueil** (`AccueilTab` dans `staff-app.tsx`) : 3 notifs importantes non lues entre header et liste shifts, CTA contextuel par catégorie ("Voir le shift", "Voir le parcours", etc.). Si rien : "Tu es à jour 👍" discret. `FormationNotifBanner` conservé.

## 6. Backfill insert points

Tous les `from("notifications").insert(...)` dans la codebase reçoivent `priority` + `category` selon mapping :
- `proposals.functions.ts`, `shifts.functions.ts`, `planning-workflow.functions.ts`, `pointage.functions.ts`, `demandes.functions.ts`, `formation.functions.ts`, `documents.functions.ts`

## 7. Design

- Pastille priorité 4px verticale à gauche (style Linear)
- Icône catégorie cercle 28×28 fond semi-transparent
- Dates relatives FR (`formatDistanceToNow` + locale fr)
- Realtime subscribe sur `notifications WHERE user_id=auth.uid()`
- Anim slide-in nouvelle notif, skeletons loading, 100% mobile

## Hors scope

- Pas de suppression de la table `notifications` (rétro-compat)
- Logique d'acceptation des propositions inchangée
- Pas de modif scoring/IA planning

## Fichiers

**Nouveaux** : migration SQL, `src/lib/notifications.functions.ts`, `src/lib/notifications-meta.ts`, `src/routes/notifications.tsx`, `src/components/notifications/NotificationItem.tsx`, `src/components/notifications/AdminAlertsWidget.tsx`, `src/components/staff-app/EmployeeNotifsWidget.tsx`, `src/hooks/use-admin-notifications.ts`

**Modifiés** : `src/components/TopBar.tsx`, `src/components/AppSidebar.tsx`, `src/routes/dashboard.tsx`, `src/routes/staff-app.tsx`, `src/components/staff-app/ProfileSheets.tsx`, `src/hooks/use-staff-notifications.ts`, + tous les insert points listés ci-dessus
