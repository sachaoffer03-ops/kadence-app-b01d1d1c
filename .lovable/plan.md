## Plan — Améliorations app employée

DA Kadence respectée partout : #FAFAF8, coral #F0997B, Inter 400/500, pas d'emoji, pas de gradient (sauf hero sombre déjà existant), pas d'ALL CAPS.

### 2. Accueil — 3 zones claires
Restructurer `AccueilTab` en 3 sections nommées :
- **Maintenant** — la carte sombre (shift en cours / prochain) reste telle quelle
- **À faire** — 1 carte qui regroupe : dispos à remplir + propositions de shifts + demandes en attente + formations obligatoires non faites. Compteur unique "X actions". Si rien → carte masquée.
- **Cette semaine** — collègues du jour + stats semaine (heures, shifts)

Supprime les boutons éparpillés actuels au profit d'une carte "À faire" unifiée.

### 3. Planning — mini-calendrier mensuel
Au-dessus de la liste de shifts dans `PlanningTab`, ajouter une grille mensuelle 7×6 :
- Jours du mois avec un point coloré (couleur de rôle) par shift
- Multi-shifts = plusieurs points empilés
- Tap sur un jour → filtre la liste en dessous
- Navigation mois précédent / suivant (flèches discrètes)
- Aujourd'hui : cercle coral fin

### 4. Demandes visibles sur Accueil
Intégrer "Mes demandes (X en attente)" dans la carte "À faire" (zone 2 ci-dessus). Clic ouvre `MyRequestsSheet` existant. Plus besoin d'aller chercher dans le Profil.

### 5. Profil — recap mensuel discret
Au-dessus de la carte stats existante, une ligne discrète :
> Juin 2026 · 142 h · 0 retard · score 92

Source : `getMyStats` server fn (déjà existante). Pas de nouvelle carte, juste un sous-titre élégant sous le nom.

### 7. Mode offline — version pragmatique
Approche **cache + indicateur** (pas de queue offline complexe, trop risqué pour pointage) :
- Cache les shifts à venir dans `localStorage` à chaque load
- Au démarrage sans réseau : affiche le cache + bandeau discret "Hors ligne — dernière sync : il y a Xmin"
- Pointage en offline : **bloqué** avec message clair "Reviens en ligne pour pointer" (la donnée pointage est trop critique pour être bufferisée sans risque de double-pointage)
- Listener `online`/`offline` pour masquer/montrer le bandeau

### Détails techniques
- Fichiers principaux modifiés : `src/routes/staff-app.tsx` (AccueilTab + PlanningTab + ProfilTab)
- Nouveau composant : `src/components/staff-app/MonthCalendar.tsx`
- Nouveau composant : `src/components/staff-app/TodoCard.tsx` (carte "À faire" unifiée)
- Nouveau hook : `src/hooks/use-offline-cache.ts`
- Aucune migration DB nécessaire

### Hors périmètre
- Queue de pointage offline (trop risqué)
- Service Worker complet PWA (peut être ajouté plus tard si besoin)
- Refactor des 1538 lignes de staff-app.tsx en sous-fichiers (peut être fait ensuite)

OK pour partir là-dessus ?
