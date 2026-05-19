
# Parcours mobile de clôture de shift (employé)

Refonte complète du flow "Terminer mon shift" dans `/staff-app` en un overlay plein écran 6 étapes mobile-first, consommant la config admin de `/cloture`.

## 1. Migrations DB (1 migration)

- `studios` : ajouter `lat float NULL`, `lng float NULL` (géofencing — populés plus tard via géocodage)
- `shifts` : ajouter `dimona_status text NULL CHECK ('pending','sent','failed','not_applicable')` (anticipation profil employé)
- Aucune nouvelle RLS (colonnes additives sur tables existantes)

## 2. Serveur — server functions

Nouveau fichier `src/lib/closure-flow.server.ts` + `src/lib/closure-flow.functions.ts` :

- `validateClockOutFn({ shiftId, qrCode, lat?, lng? })` : vérifie QR match `studios.current_qr_code` (case-insensitive), géofencing si activé + studio a lat/lng, calcule `minutes_late`, UPDATE `shifts.clocked_out_at = now()`. **Ne change pas encore le status.** Retourne `{ ok, distance_m? }`.
- `finalizeClosureFn({ shiftId, submissionId, responses: [{questionId, stars?, yesno?, text?}] })` : transaction → `shifts.status = 'completed'`, `checklist_submissions.status = 'completed' + submitted_at`, INSERT `closure_question_responses` (idempotent via DELETE-then-INSERT par submission), INSERT notif manager du studio. Retourne récap calculé serveur (heures, gains, points par dimension).
- Hardcoder pour l'instant les règles de points dans le server, avec commentaire TODO "Règles de scoring configurables côté admin future".
- Toutes les fn vérifient `shift.user_id === context.userId` (pattern existant `shift-clock.server.ts`).

L'ancien `completeShiftClockOutFn` reste pour compat mais n'est plus utilisé par EndShiftSheet.

## 3. Frontend — nouveau composant `ClosureFlow.tsx`

Remplace `EndShiftSheet` (qui devient deprecated mais reste pour ne rien casser ailleurs si jamais).

`src/components/staff-app/ClosureFlow.tsx` : overlay plein écran (fixed inset-0, fond blanc, z-50), stepper 5 dots en haut, bouton "Retour" gauche + close avec confirm, bouton "Suivant" sticky bas avec `safe-area-inset-bottom`. Transitions slide horizontal 250ms.

État interne : `step` (1..6) + données collectées par étape, chaque action écrit immédiatement en DB (résilience).

### Étape 1 — Récap shift
Cartes shift + heure live + countdown + message bleu + bouton "Terminer mon shift" → step 2.

### Étape 2 — Checklist
- `findApplicableTemplate` + `getOrCreateSubmission`
- Liste items avec checkbox (toggle `checklist_submission_items.is_checked`) + icône photo si `photo_zone_id`
- Compteur live "X / N validés"
- Si `is_blocking` et items non cochés : "Suivant" disabled

### Étape 3 — Photos
- Chaque `checklist_template_photos` → carte avec input `capture="environment"`
- Upload via `uploadSubmissionPhoto` (helper existant) + INSERT `checklist_submission_photos`
- Si `analyze_with_ai` : badge "Analyse IA..." 2s puis auto-validation 100/100 (commentaire TODO clair)
- Retry upload 3× avec toast
- "Suivant" actif quand `min_photos_required` atteint ET zones `is_required` ont photo validée

### Étape 4 — Scan QR
- Lib `@yudiel/react-qr-scanner` (à ajouter avec `bun add`)
- Fallback "Entrer manuellement" → 5 inputs style input-otp
- Si `geofencing_enabled` : `navigator.geolocation` + calcul distance Haversine côté client (envoyé au server pour re-vérif)
- Server fn `validateClockOutFn` fait la vraie validation
- Bouton "Valider mon pointage de sortie" disabled tant que pas validé

### Étape 5 — Questions clôture
- Charger `closure_questions` du studio ordonné `order_index`
- Stars 1-5 / Oui-Non / Textarea selon `response_type`
- Sauvegarde immédiate dans state local; bouton "Terminer" disabled tant que tous `is_required` répondus
- Bandeau confidentialité en haut

### Étape 6 — Bien joué
- Appel `finalizeClosureFn` à l'entrée (envoie responses)
- Récupère récap calculé serveur
- Cartes : Récap (5 lignes seulement) / Gains (1 ligne, format FR via `toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })`) / Impact score (décomposé) / Prochain shift
- Bouton "Retour à l'accueil" → ferme overlay + recharge `/staff-app`

## 4. Branchement dans `staff-app.tsx`

- Remplacer le bouton qui ouvre `EndShiftSheet` par celui qui ouvre `ClosureFlow`
- Logique d'affichage du bouton "Terminer mon shift" :
  - `clocked_in_at != null` ET `clocked_out_at == null`
  - `now() >= shift.end_time - studio.clock_out_button_appears_before_min`
- Sinon countdown live "Tu pourras clôturer dans X min"
- Charger `studio.clock_out_button_appears_before_min` (déjà dans le studio query, sinon ajouter au select)

## 5. Page admin `/staff/$id`

Ajouter section "Dernier shift clôturé" (lecture seule, mêmes infos que step 6). Requête : dernier shift `status='completed'` de l'employé + ses submissions/responses.

## 6. À NE PAS faire

- Pas de vraie IA Vision (placeholder 2s, TODO commenté)
- Pas de toucher au scoring runtime (`scoring.functions.ts`)
- Pas de modif de `/cloture` ni d'`AppSidebar`
- Pas de cumul mensuel / heures semaine / Dimona sur écran final
- Garder `EndShiftSheet` en place mais ne plus l'appeler

---

**Taille estimée** : ~1500 lignes nouvelles (ClosureFlow ~900, server ~250, migration ~30, integration staff-app ~50, profil admin ~80, helpers ~50, package add). 1 migration + 1 npm package.

OK pour partir là-dessus ?
