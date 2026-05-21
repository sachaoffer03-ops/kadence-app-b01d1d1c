# Plan — Fix critiques côté employé

Cinq chantiers de tailles très différentes. Je propose de les livrer dans cet ordre, chacun étant testable indépendamment.

## 1. Seed démo enrichi (FIX 4) — ~30 min
Enrichir `src/lib/seed-demo.functions.ts > resetDemoEnvironment` :
- Forcer sur le studio de Clara : `current_qr_code = "DEMO5"`, grace periods 15/20, `geofencing_enabled = false`.
- Purge + insertion d'un `checklist_template` Barista actif avec 6 items + 3 zones photo (Plan de travail, Caisse, Sol & poubelles).
- Insertion de 5 `closure_questions` pour le studio (stars/yes_no/free_text).
- Insertion d'un `training_course` "Parcours Barista — Démo" publié, 2 sections, 3 modules dont 1 quiz à 3 questions ; Clara complète 60% + 1 quiz réussi.
- Dispos déjà créées : OK, je vérifie qu'on couvre bien le mois suivant.
- Aucune publication planning pour le mois courant (déjà le cas — je m'en assure dans la purge).
- Étendre la purge `purgeDemoUserData` / `cleanupAllDemoData` pour wiper proprement ces nouvelles entités liées au studio démo.

## 2. Bug "Aucun créneau libre" (FIX 3) — ~20 min
Dans `DisposSheet.tsx` (et éventuellement `availabilities.functions.ts`) :
- Quand on clique "+ Ajouter" sur un jour qui a déjà ≥1 plage, calculer les trous ≥4h entre 00:00 et 24:00.
- Si au moins un trou : pré-remplir avec ce trou (capé à 4h+ raisonnable, ex. premier trou trouvé).
- Si aucun : message clair "Cette journée est déjà entièrement couverte".

## 3. Dispos jusqu'à publication (FIX 2) — ~25 min
Dans `src/lib/availabilities.functions.ts` :
- Réécrire `isMonthLocked` : check `planning_publications` sur intersection avec le mois cible.
- Ne plus bloquer sur la deadline (jour 20).
- Côté `DisposSheet` :
  - Si publication → bandeau rouge "Planning publié, plus modifiable, fais une demande de modification".
  - Sinon → bandeau info "Deadline indicative : jour X" + édition libre.
- Renvoyer un flag `lockedReason: "planning_published" | null` depuis la server fn pour piloter l'UI.

## 4. Scan QR à l'arrivée (FIX 1) — ~1h
Nouvelle sheet `ClockInSheet.tsx` calquée sur `EndShiftSheet` (étape QR) :
- Scanner QR (réutilise composant existant `QrScanner` du flow de clôture).
- Champ manuel OTP 5 inputs (collapsé par défaut).
- Géofencing si `studio.geofencing_enabled`.
- Bouton "✓ Valider mon arrivée" gated.

Server fn `validateClockIn({ shiftId, qrCode, lat?, lng? })` dans `shift-clock.functions.ts` :
- Vérifs : shift à l'employé, pas déjà pointé, QR matche `studio.current_qr_code` (lower), géofencing OK.
- Update `clocked_in_at = now()`, `minutes_late` calculé.
- Insert `shift_clock_audit`.

Côté `staff-app.tsx` (Accueil + tab Pointage) :
- Logique fenêtre : si `start - now > 30min` → message "Tu pourras pointer 30 min avant".
- Sinon (`-30min .. +1h`) → bouton "Commencer mon shift" → ouvre `ClockInSheet`.
- Après `+1h` sans pointage → état "En retard, contacte ton manager".
- Action admin `manualClockIn` reste inchangée.

## 5. Audit mobile staff-app (FIX 5) — ~45 min
Passage écran par écran (viewport 375px) sur :
1. `staff-app.tsx` — 6 tabs (overflow horizontal, bottom nav, safe-area-inset-bottom).
2. `ClosureFlow.tsx` — étapes 1‑par‑1, tap targets ≥44px.
3. `staff-app/formation/*` — FormationHub, CourseDetailView, ModulePlayer, Video/Pdf/ImageViewer, QuizPlayer.
4. `ProfileSheets.tsx` — DocumentsSheet, NotificationsSheet, ShiftDetailSheet en full-screen <640px.
5. `MyStatsCard`, `EmployeeNotifsWidget`, `EditProfileSheet`.

Checklist appliquée partout : pas d'overflow X, tap targets ≥44px, font ≥14px, padding latéral ≥16px, `pb-[env(safe-area-inset-bottom)]` sur les zones sticky bottom, sheets full-screen mobile, skeletons partout.

## Détails techniques

```text
src/lib/
├── seed-demo.functions.ts       # FIX 4 — enrich
├── availabilities.functions.ts  # FIX 2 — isMonthLocked
├── shift-clock.functions.ts     # FIX 1 — validateClockIn
└── shift-clock.server.ts        # FIX 1 — helper

src/components/staff-app/
├── ClockInSheet.tsx             # FIX 1 — NEW
├── DisposSheet.tsx              # FIX 2 + FIX 3
├── ClosureFlow.tsx              # FIX 5
├── ProfileSheets.tsx            # FIX 5
└── formation/*                  # FIX 5

src/routes/staff-app.tsx         # FIX 1 + FIX 5
```

Aucune migration SQL (les colonnes existent toutes). Aucun changement sur scoring / IA planning / éligibilité / pages admin.

## Vérification finale
Après chaque fix : test rapide via `/admin/seed` → reset → login Clara → reproduit le flow concerné. Mobile audit en dernier avec viewport 375px dans le preview.

Validez ce plan et je commence par le FIX 4 (seed enrichi) puisqu'il débloque les tests des autres.
