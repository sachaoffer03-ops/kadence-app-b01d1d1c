## Plan — Fix 5 bugs critiques

### Bug 1 — Bouton "Pointer ma sortie" sur l'Accueil (rapide)

**Cause** : dans `AccueilTab` de `src/routes/staff-app.tsx` (l.451), la condition est `canClockOut = nowTs >= openAt` où `openAt = endTime - clock_out_button_appears_before_min`. Sur le shift démo Clara (18:02→23:02), il faut attendre 22:47 pour que le bouton s'active, alors que le tab Pointage (l.1138) l'active dès que `clocked_in_at` existe.

**Fix** : ajouter une fenêtre alternative `nowTs >= clockedInAt + 30 min`. Le bouton devient actif si :
- `nowTs ≥ shift_end - before_min` (fenêtre normale), OU
- `nowTs ≥ clocked_in_at + 30 min` (garde-fou pour shifts courts/démo).

Texte du badge "dans X min" affiché uniquement si AUCUNE des 2 conditions n'est vraie.

### Bug 2 — Checklist au pointage d'arrivée

**Investigation** : `ClockInSheet` rend déjà `<OpeningFlow>` quand `done` est set (l.86-101). `OpeningFlow` appelle déjà `detectChecklistMoment` + `findApplicableTemplate`. Donc le flow existe mais doit échouer silencieusement.

**Fix** :
1. Vérifier dans `OpeningFlow` que même si `phase === null` ou `template === null`, l'écran Bienvenue (Step 1) s'affiche **toujours** avec un CTA "Commencer mon service →". C'est déjà le cas (l.265-277) — vérifier que `loading` se résout bien.
2. Ajouter un log+toast côté `ClockInSheet` si la transition vers OpeningFlow échoue.
3. Vérifier que pour Clara (role Barista), il existe bien un template `phase=transition` ou `phase=opening`. Si non, c'est un problème de seed → fix le seed démo pour garantir au moins un template par rôle.
4. Tester réellement après reset seed.

### Bug 3 — Étape "Avant de partir" dans ClosureFlow (gros morceau)

**Fix** : ajouter une nouvelle étape dans `src/components/staff-app/ClosureFlow.tsx`, juste avant l'étape récap finale, **toujours visible** (closing OU transition) :

3 sections dans un seul écran scrollable :
- **Note pour l'équipe suivante** (handoff) — textarea, sauvé dans `shift_handoffs`
- **Feedback admin privé** — textarea, sauvé dans `shift_reports` (resolved=false)
- **Comment s'est passé ton shift** — rating 1-5★ + commentaire court, sauvé dans `feedbacks`

Tout optionnel. Bouton "Continuer →" passe à l'étape récap finale. Stepper incrémenté.

Tables existent déjà (`shift_handoffs`, `shift_reports`, `feedbacks`) — pas de migration.

### Bug 4 — Vidéo formation invisible côté employé

**Investigation rapide** : vérifier la query côté `FormationHub` / `CourseDetailView`. Si la query filtre `is_published=true` au niveau parcours mais pas au niveau contenu, c'est OK ; le problème est le cache.

**Fix** :
1. Forcer un refetch au montage du composant CourseDetailView (déjà sans cache stale).
2. Ajouter un subscribe realtime sur `training_contents` filtré par les modules du parcours actuel pour rafraîchir live.
3. S'assurer que le parcours est `is_published=true` (vérification côté admin, pas de code à changer).

### Bug 5a — Bouton "Trouver un remplaçant" sur toutes les demandes pending

**Fix** : dans `src/routes/demandes.tsx`, ajouter le bouton "Trouver un remplaçant" pour toutes les demandes pending (cancel, time_change, unavailable). Au clic, ouvrir une modal de sélection d'employés éligibles (réutiliser logique existante de `proposals.functions.ts > sendReplacementProposals`).

### Bug 5b — Masquer accept/refuse si propositions actives

**Fix** : dans `src/routes/demandes.tsx`, pour chaque demande pending avec au moins une `shift_proposals` `status=pending` :
- Masquer boutons "Accepter" / "Refuser"
- Afficher "Recherche de remplaçant en cours" + liste des propositions + leur statut
- Bouton "Annuler les propositions" qui ré-affiche les actions standard

Si toutes les propositions sont declined/expired → ré-afficher accept/refuse.

### Hors scope (rappel)
- Pas de modif moteur IA planning
- Pas de modif scoring
- Pas de modif `proposals.functions.ts` (race-safe)
- Pas de modif `/cloture`

### Ordre d'exécution
1. Bug 1 (5 min, surgical)
2. Bug 5a+5b (UI demandes)
3. Bug 3 (étape Avant de partir)
4. Bug 2 (investigation + ajustement OpeningFlow)
5. Bug 4 (realtime training_contents)

Estimation totale : ~12-15 tool calls.
