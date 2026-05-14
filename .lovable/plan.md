## Vision

Aujourd'hui l'algo crée 1 shift = 1 template (rigide). Le nouveau cerveau **construit le planning** : il part du besoin (ex: accueil 9h-18h), regarde les dispos réelles des employés, **découpe le besoin en blocs de 3 à 6h**, et choisit la **meilleure combinaison de personnes** pour le couvrir.

---

## 1. Modèle de données

### Migration `availabilities` (plages horaires réelles)

```text
availabilities
- user_id
- avail_date
- start_time   (NEW)
- end_time     (NEW)
- slot         (DROP — plus utilisé)
```

Ancienne donnée (`slot` matin/midi/soir) → migrée en plages par défaut :

- matin → 07:00-12:00
- midi  → 11:00-17:00
- soir  → 16:00-23:00

Un employé peut avoir plusieurs lignes pour un même jour (ex: 9-12 + 14-18).

### Nouveaux champs `ai_planning_settings`

```text
- min_shift_hours   smallint  default 3
- max_shift_hours   smallint  default 6
```

Exposés dans **Réglages › Algorithme IA**.

---

## 2. Saisie des dispos côté employé (`DisposSheet.tsx`)

Refonte de l'écran : pour chaque jour de la semaine, l'employé peut ajouter **une ou plusieurs plages** (start → end) via un sélecteur d'heures (pas de 30 min). Suppression des 3 boutons matin/midi/soir.

UI : carte par jour, liste des plages saisies + bouton « Ajouter une plage ».

---

## 3. Nouveau cerveau (`generate-planning.functions.ts`)

Réécriture complète du handler. Pseudo-code :

```text
INPUT  : période (start..end), réglages, replaceExisting
OUTPUT : shifts générés + trous restants + KPIs

1. Charger : templates (besoins), profiles actifs, user_business_roles,
   user_studios, user_contracts, availabilities (plages), shifts existants
   (verrouillés/manuels conservés).

2. Générer la LISTE DES BESOINS atomiques :
   pour chaque template (jour, studio, rôle, start, end, required_count) :
     créer required_count "colonnes" parallèles indépendantes
     chaque colonne = un intervalle à couvrir [start..end]

3. Pour chaque besoin (colonne) :
   - calculer le pool de candidats éligibles (rôle + studio + contrat actif)
   - estimer une "difficulté" = nb de candidats × dispos cumulées
     sur la fenêtre du besoin

4. TRIER les besoins du plus difficile au plus facile (peu de candidats d'abord)

5. Pour chaque besoin trié :
   a. Calculer les SOUS-PLAGES réalisables par chaque candidat :
      intersection (dispo employé ∩ besoin)
      → générer tous les blocs de min_h à max_h dedans
      (granularité 30 min, bornés par le besoin)
   b. Filtrer par règles dures :
      - pas de chevauchement avec un shift existant du candidat
      - repos 11h respecté
      - plafond hebdo CDI (38h) avec heures déjà attribuées (existing + toInsert)
      - quota étudiant restant
   c. SCORER chaque (candidat, bloc) :
      score = wPerf·perf + wEquity·équité + wPref·préférence + wRandom·rand
      (pondérations Réglages, normalisées sur somme)
      bonus de "couverture" = longueur du bloc / besoin restant
   d. RÉSOUDRE la couverture du besoin par couverture gloutonne :
      - prendre le meilleur (candidat, bloc) qui couvre le début non couvert
      - marquer ce candidat comme occupé sur ce créneau (conflit, repos, quotas)
      - boucler jusqu'à ce que tout le besoin soit couvert OU plus aucune option
   e. Si reste un sous-intervalle non couvert → trou partiel pour ce sous-créneau

6. Insérer les shifts en batch (status="draft", non publiés)
7. Les trous remontent dans /trous (table existante via la requête actuelle —
   qui détecte besoins non couverts ; doit être adaptée pour gérer les trous
   sur sous-créneaux).
```

### Stratégie de couverture (étape 5d)

Algo glouduit déterministe + petite marge aléatoire pondérée :

- pointer = besoin.start
- tant que pointer < besoin.end :
  - lister tous les blocs valides commençant à `pointer` (ou contenant `pointer`)
  - retenir le bloc avec **score le plus élevé**
  - si aucun bloc → trou de pointer à `next_avail_start` (ou à besoin.end)
  - sinon : créer le shift, avancer pointer = bloc.end

Avantages : pas d'explosion combinatoire (testable sur 4 semaines × 2 studios × 3 rôles), résultats reproductibles + équitables.

---

## 4. Page Trous

Pas de changement structurel, mais la requête doit gérer les trous **partiels** (ex: 15h-18h alors que le template est 9h-18h). On stocke le trou comme un intervalle dérivé : besoin – shifts couvrants.

→ probablement à transformer en **vue/RPC SQL** côté Supabase pour calculer les sous-intervalles non couverts. À voir à l'étape suivante (un sous-plan dédié si besoin).

---

## 5. UI Réglages

Ajouter dans `src/routes/reglages.tsx` la section « Bornes des shifts » :

- input min_shift_hours (1 à 8)
- input max_shift_hours (3 à 12, ≥ min) 

Avec validation côté handler aussi.

---

## 6. Tests manuels (post-build)

1. Saisir des dispos réelles pour 2-3 employés (DisposSheet refondu)
2. Lancer génération sur 1 semaine → vérifier découpage en blocs 3-6h
3. Cas limite : besoin 9-18h, 1 seul candidat dispo 9-13h → shift 9-13h + trou 13-18h
4. Vérifier équité (nb shifts par employé)
5. Vérifier repos 11h, plafond CDI, quota étudiant

---

## Fichiers touchés


| Fichier                                    | Action                                     |
| ------------------------------------------ | ------------------------------------------ |
| `supabase/migrations/...`                  | Migration availabilities + champs settings |
| `src/components/staff-app/DisposSheet.tsx` | Refonte UI plages horaires                 |
| `src/lib/generate-planning.functions.ts`   | Réécriture complète                        |
| `src/routes/reglages.tsx`                  | Ajouter min/max heures                     |
| `src/routes/trous.tsx`                     | Adapter détection trous partiels           |
| `src/integrations/supabase/types.ts`       | Auto-régénéré après migration              |


---

## Ordre d'exécution proposé

1. Migration DB (availabilities + ai_planning_settings)
2. Refonte `DisposSheet`
3. Réécriture du cerveau IA
4. Ajout réglages min/max
5. Adapter page Trous (si besoin de trous partiels précis)
6. Tests E2E sur le compte admin

Le tout livrable en 1 message. Je préviendrai si la page Trous demande un sous-plan séparé (calcul des sous-intervalles plus complexe que prévu).

regles des horaires :   
  
ÉTABLISSEMENT : CHÂTELAIN

&nbsp;

========================

&nbsp;

# ACCUEIL

&nbsp;

## Du lundi au vendredi

&nbsp;

Shifts obligatoires :

&nbsp;

- 06h30 → 13h30

&nbsp;

- 16h30 → 21h30

&nbsp;

## Samedi et dimanche

&nbsp;

Shift obligatoire :

&nbsp;

- 08h30 → 16h30

&nbsp;

L’IA doit toujours prévoir une personne pour couvrir ces shifts accueil.

&nbsp;

========================

&nbsp;

# BAR

&nbsp;

========================

&nbsp;

## Du lundi au vendredi

&nbsp;

Horaires du bar :

&nbsp;

- 07h45 → 20h00

&nbsp;

Structure obligatoire :

&nbsp;

- 1 employé CDI obligatoire :

&nbsp;

  - 07h45 → 15h45

&nbsp;

  - minimum 8h de travail

&nbsp;

Après le shift CDI :

&nbsp;

- des étudiants peuvent couvrir jusqu’à 20h00.

&nbsp;

Renforts optionnels selon affluence :

&nbsp;

## Si forte affluence :

&nbsp;

Ajouter :

&nbsp;

- 1 étudiant “Shake”

&nbsp;

  - 10h00 → 14h00

&nbsp;

## Si très forte affluence / rush :

&nbsp;

Ajouter :

&nbsp;

- 1 étudiant “Host”

&nbsp;

  - 10h30 → 13h30

&nbsp;

L’IA doit comprendre que ces renforts ne sont PAS obligatoires mais dépendent du niveau de fréquentation.

&nbsp;

========================

&nbsp;

# BAR WEEK-END

&nbsp;

========================

&nbsp;

## Samedi et dimanche

&nbsp;

Horaires :

&nbsp;

- 08h30 → 18h30

&nbsp;

Renforts possibles :

&nbsp;

## Si forte affluence :

&nbsp;

Ajouter :

&nbsp;

- 1 étudiant “Shake”

&nbsp;

  - 10h00 → 14h00

&nbsp;

## Si très forte affluence :

&nbsp;

Ajouter :

&nbsp;

- 1 étudiant “Host”

&nbsp;

  - 10h00 → 14h30

&nbsp;

L’IA doit pouvoir ajouter automatiquement ces renforts selon le niveau d’activité.

&nbsp;

========================

&nbsp;

# CUISINE

&nbsp;

========================

&nbsp;

## Lundi

&nbsp;

- CDI obligatoire :

&nbsp;

  - 07h00 → 15h30

&nbsp;

## Mardi à jeudi

&nbsp;

- CDI obligatoire :

&nbsp;

  - 07h00 → 14h30

&nbsp;

## Vendredi

&nbsp;

- CDI obligatoire :

&nbsp;

  - 07h00 → 16h30

&nbsp;

========================

&nbsp;

# CUISINE WEEK-END

&nbsp;

========================

&nbsp;

## Samedi et dimanche

&nbsp;

Base obligatoire :

&nbsp;

- 1 étudiant :

&nbsp;

  - 08h30 → 14h00

&nbsp;

Si forte affluence :

&nbsp;

Ajouter :

&nbsp;

- 1 deuxième étudiant :

&nbsp;

  - 08h30 → 15h30

&nbsp;

========================

&nbsp;

OBJECTIF IA

&nbsp;

========================

&nbsp;

Je veux que l’IA comprenne :

&nbsp;

- les shifts obligatoires,

&nbsp;

- les renforts optionnels,

&nbsp;

- les différences CDI / étudiant,

- les besoins minimums,

- les rôles,

- les horaires par département,

- les règles différentes semaine / week-end,

- la logique de rush horeca.

L’IA doit être capable dans le futur :

- d’analyser l’affluence,

- d’ajouter automatiquement des renforts,

- d’optimiser les coûts salariés,

- d’éviter le sous-staffing,

- d’éviter le sur-staffing,

- de générer automatiquement les meilleurs plannings possibles.

Le système doit être scalable afin d’ajouter plus tard d’autres établissements comme “Rhodes”.