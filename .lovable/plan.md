# Plan — Flow employé complet A→Z

Gros chantier. Je le livre **en 2 sous-tours** comme tu l'autorises, sinon je risque de tout casser.

## Sous-tour 1 — Données + côté employé

### 1. Migrations SQL (parties 2A / 2B / 2C, adaptées au schéma réel)

Le schéma actuel diffère de ton SQL — je vais corriger :
- `shifts.business_role` est un `text` (pas `business_role_id`)
- `notifications` n'a pas de colonne `is_read` (c'est `read_at timestamptz`)
- `shifts.status` enum n'a pas `'published'` — on utilise `published_at IS NOT NULL` à la place, status reste `'scheduled'`
- `feedbacks` n'a pas de `target_user_id` (la cible se déduit via `shift_id → shifts.user_id`)

Migration unique qui :
- crée le shift Tom du jour 10h→16h (idempotent, `is_manual=true`, `published_at=now()`)
- insère 2 notifs (`planning_published`, `shift_reminder`) si absentes < 1h
- crée le template `Fin de shift test — Flow complet` + 4 items + 2 photos Unsplash

### 2. Card "Prochain shift" dynamique (4 états) — `src/routes/staff.index.tsx`

Composant `ShiftStatusCard` :
- **A** Pas de shift aujourd'hui → garder existant
- **B** Shift prévu, pas commencé → bouton vert "Pointer mon arrivée" (orange + "en retard de X min" si dépassé)
- **C** En service → fond accent, timer live `useEffect(setInterval, 1000)` depuis `clocked_in_at`, bouton rouge "Pointer ma sortie"
- **D** Terminé → fond grisé, résumé heures + retard + statut checklist

Boutons clock-in/out écrivent directement dans `shifts` (`clocked_in_at` / `clocked_out_at`). Le clock-out ouvre la `EndShiftSheet` existante (qui gère déjà la checklist) au lieu d'écrire directement → respecte le `is_blocking`.

### 3. Onglet "Pointage" dans bottom nav staff-app

- Nouvelle route `src/routes/staff.pointage.tsx`
- Section "Aujourd'hui" : réutilise `ShiftStatusCard`
- Section "Mes 10 derniers shifts" : table simple (date, prévu, arrivée, retard, durée, checklist OK)
- Ajout entrée bottom nav dans `src/routes/staff.tsx` (icône Timer entre Planning et Formation)

## Sous-tour 2 — Côté admin + notifs chat + cleanup

### 4. Page `/pointage` admin avec Realtime
- Tableau "Shifts du jour" avec channel realtime sur `shifts` (filter `shift_date=eq.${today}`)
- Statuts dérivés temps réel + timer live "en service depuis Xh"
- Click ligne → drawer détail

### 5. Drawer checklist amélioré
- 3 onglets : Checklist / Photos / Note
- Photos côte à côte (référence vs employé, placeholder rouge si manquante)
- Badge gris "IA Vision — V2"
- Zone feedback sticky avec toggle "Notifier" → insert dans `notifications` (`type='feedback_received'`)

### 6. Fiche employé `/staff/:id` — sections
- Activité récente (dernier shift + score breakdown)
- Historique pointages (10 derniers, code couleur retard)
- 5 dernières checklists

### 7. Notif sur chat admin → employé
- Dans `ChatPanel.tsx`/`ChatSheet.tsx` send message → si sender est admin/manager, insert notif `type='new_message'`
- La cloche `useStaffNotifications` consomme déjà la table `messages` directement — j'ajoute la notif explicite en plus pour cohérence avec ton flow

### 8. Bouton "🗑️ Nettoyer données flow test" sur `/admin/qa-test-suite`
- Nouvelle server function `cleanupFlowTest` qui exécute le DELETE en cascade (corrigé pour le schéma réel : pas de `target_user_id` sur feedbacks)

## Ce que je ne touche pas
- Les 15 tests QA existants (vérifiés après chaque sous-tour)
- `client.ts`, `types.ts`, RLS existantes
- La logique `EndShiftSheet` actuelle (réutilisée telle quelle)

## Risques identifiés
- Le score recalc "live" dépend des triggers DB existants (`trg_recalculate_score`) — je vérifie qu'ils sont bien attachés ; sinon je les ajoute dans la même migration.
- `is_read` n'existe pas sur `notifications` → j'utilise `read_at` partout (toi tu l'as écrit `is_read` dans le SQL, c'est faux pour ce projet).

**Tu valides ce plan et je commence par le sous-tour 1 ?** (migrations + card employé + onglet Pointage)
