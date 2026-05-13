
# Planning production-ready : édition manuelle, verrouillage, publication, notifs

Objectif : rendre la partie planning utilisable au quotidien par un admin gérant 40-50 employés. On garde le moteur IA actuel et on ajoute tout ce qui manque autour.

## 1. Schéma DB — extension de `shifts` + nouvelles tables

### Modifs `shifts`
- `is_locked boolean default false` — un shift verrouillé ne peut pas être écrasé par une régénération IA.
- `is_manual boolean default false` — créé/modifié à la main (auto-verrouille).
- `status` étendu : nouvelle valeur `draft` (en plus de `scheduled`, `completed`, `cancelled`). Les shifts générés naissent en `draft`.
- `published_at timestamptz` — date de publication (null = brouillon).

### Nouvelle table `planning_publications`
Trace chaque publication d'une période (audit + permet de savoir qui a publié quoi quand).
- `id`, `published_by`, `published_at`, `period_start`, `period_end`, `shifts_count`.

### Nouvelle table `notifications`
Pour la notif aux employés à la publication (et réutilisable plus tard).
- `id`, `user_id`, `type` (`planning_published`, `shift_modified`, …), `title`, `body`, `link`, `read_at`, `created_at`.
- RLS : l'utilisateur voit/marque ses propres notifs ; admins peuvent insérer.

## 2. Génération IA — respect des verrous

Modifier `src/lib/generate-planning.functions.ts` :
- Lors du DELETE de la période ciblée, ajouter `AND is_locked = false AND is_manual = false`.
- Ne pas réassigner les créneaux déjà couverts par un shift verrouillé conservé.
- Les nouveaux shifts générés sortent en `status = 'draft'`, `published_at = null`.

## 3. Édition manuelle dans la grille planning (`src/routes/planning.tsx`)

Trois interactions :

### a) Clic sur un shift → drawer/dialog "Modifier le shift"
- Champs : employé assigné (select parmi profils du studio + rôle métier compatible), heure début, heure fin, rôle métier, studio, notes.
- Bouton "Supprimer" (déjà présent, on garde).
- À la sauvegarde : update + `is_manual = true`, `is_locked = true`.

### b) Drag & drop pour réassigner
- Utiliser `@dnd-kit/core` (déjà légère, compatible).
- Glisser un badge employé d'une cellule vers une autre = update `user_id` du shift cible (ou swap si la cellule cible est déjà occupée → demander confirmation).
- Glisser depuis la liste latérale "Employés disponibles" vers une cellule vide d'un shift `unfilled` = assigne.
- Update auto → `is_manual = true`, `is_locked = true`.

### c) Bouton "+ Ajouter shift" sur cellule vide
- Ouvre le même dialog que (a) en mode création.
- Crée avec `is_manual = true`, `is_locked = true`, `status = 'draft'` si la période n'est pas encore publiée, sinon `scheduled` + génère une notif pour l'employé.

### d) Indicateurs visuels
- Pastille / icône cadenas sur les shifts verrouillés.
- Badge "Brouillon" sur les shifts non publiés.
- Bandeau orange en haut si la période affichée contient des brouillons : "X shifts non publiés. [Publier la semaine]".
- Détection chevauchements : surlignage rouge si un même employé a 2 shifts qui se chevauchent.

## 4. Mode brouillon → bouton Publier

### Sur `src/routes/planning.generate.tsx`
- Après génération, message clair : "X shifts créés en BROUILLON. Aucune notification envoyée. Va sur Planning pour ajuster puis publier."
- Plus de redirection automatique vers la grille avec statut `scheduled`.

### Sur `src/routes/planning.tsx`
- Bouton "Publier la période" en haut à droite si des `draft` existent dans la vue.
- Dialog de confirmation : "Tu vas publier N shifts du X au Y. M employés concernés recevront une notification. Continuer ?"
- Server function `publishPlanning({ startDate, endDate })` :
  1. Update `shifts` set `status = 'scheduled'`, `published_at = now()` where `status = 'draft'` and date dans [start, end].
  2. Insert dans `planning_publications`.
  3. Pour chaque user_id distinct concerné, insert une notification `planning_published` avec `link = /mon-planning`.

## 5. Notifications côté employé

### Backend
- Realtime activé sur `notifications` (`ALTER PUBLICATION supabase_realtime ADD TABLE notifications`).

### UI
- Cloche dans la sidebar (top) avec compteur de non-lues.
- Dropdown listant les 10 dernières, marquage comme lu au clic.
- Toast en temps réel à la réception (subscribe Realtime).

> Pas d'email à ce stade — uniquement notif in-app (peut être ajouté plus tard via `scaffold_transactional_email` si besoin).

## 6. Performance / scalabilité (50 employés × 30 jours)

- Index sur `shifts(shift_date, studio_id)` pour les requêtes de la grille.
- Pagination explicite : la grille charge **uniquement la semaine affichée** (déjà le cas via `currentWeek`), avec `.range(0, 999)` explicite et fetch en plusieurs pages si dépassement.
- Page `planning.generate.tsx` : ajout d'un avertissement si on régénère un mois entier (~6000 shifts) — confirmation requise.

## 7. Détails techniques

- Tous les writes shift → server function dédiée (`updateShift`, `createShift`, `publishPlanning`) avec `requireSupabaseAuth` + check rôle admin/manager.
- Les server functions vivent dans `src/lib/shifts.functions.ts` (nouveau fichier).
- Pas de modification du moteur scoring IA actuel — juste le respect des verrous.

## 8. Ordre d'implémentation

```text
1. Migration DB (colonnes shifts + tables notifications + planning_publications + index + realtime)
2. Server functions shifts.functions.ts (update, create, publish)
3. Adapter generate-planning.functions.ts (status=draft, respect locks)
4. UI planning.tsx : dialog édition + bouton +Ajouter + indicateurs (locked/draft/conflits)
5. UI publication : bouton + dialog + bandeau brouillon
6. UI notifications : cloche sidebar + dropdown + toast Realtime
7. Drag & drop (@dnd-kit) — en dernier car le plus lourd, peut être livré en 2e passe
8. Tests : générer un mois, modifier 5 shifts à la main, régénérer la même période → vérifier que les 5 modifs sont préservées. Publier → vérifier notif côté employé.
```

## 9. Hors scope (à traiter dans des passes suivantes)

- Échanges de shift entre employés (déjà partiellement via `modification_requests`)
- Export PDF/iCal du planning
- Vue mobile optimisée de la grille admin (mobile employé reste prioritaire)
- Email de notification (in-app suffit pour démarrer)

Une fois ce plan validé, on enchaîne migration → server functions → UI dans le même flux.
