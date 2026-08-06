# Marge de débordement — absorber les trous de 15/30 min

## Le principe

Un trou de 15, 30 (ou jusqu'à 45 min si tu veux) n'est plus laissé ouvert : il est
automatiquement rattaché à la personne déjà présente sur le créneau juste avant ou
juste après, même si sa disponibilité déclarée s'arrête un peu avant.

Exemples :
- Sophie finit à 13h30, le besoin va jusqu'à 14h00 → son shift est étendu à 14h00.
- Quelqu'un est dispo 10h–14h et le besoin commence à 9h45 → il prend le shift dès 9h45.

Règle : le débordement ne peut jamais dépasser la marge configurée (30 min par
défaut), ni sortir des bornes du besoin de staff, ni casser une règle légale.

## Ce qui est construit

### 1. Réglage "marge de débordement"
Nouveau paramètre dans les réglages planning : `0 / 15 / 30 / 45 min` (défaut 30).
À 0, le comportement actuel est conservé.

### 2. Génération de planning — extension au moment de l'assignation
Quand un employé est éligible mais que sa dispo couvre le besoin à quelques minutes
près, sa fenêtre est étirée jusqu'à la marge pour coller au besoin, au lieu de
laisser un résidu non couvert.

### 3. Nouvelle passe finale "absorption des trous courts"
Après toutes les passes existantes, chaque trou restant dont la durée ≤ marge est
rattaché à un voisin :
1. d'abord la personne du shift qui précède immédiatement (elle est déjà sur place),
2. sinon la personne du shift qui suit immédiatement.

Le rattachement est refusé si : chevauchement avec un autre shift, repos 11h non
respecté, durée max de shift dépassée, plafond hebdo dépassé, ou rôle du besoin non
tenu par la personne (segments hybrides respectés).

Si aucun voisin n'est possible, le trou reste visible dans "Trous à combler" comme
aujourd'hui — rien n'est masqué.

### 4. Rattrapage sur le planning déjà généré (septembre)
Bouton "Absorber les trous courts" sur la page **Trous à combler** : applique la même
logique aux shifts déjà enregistrés, avec un récapitulatif avant validation
(qui gagne quoi, combien de trous fermés). Les employés concernés reçoivent la
notification habituelle de modification de shift.

### 5. Côté employé
Le shift affiché est simplement l'horaire réel (ex. 07h30–14h00). Une ligne discrète
"horaire ajusté (+30 min)" apparaît sur le détail du shift concerné pour éviter toute
surprise au pointage.

## Détails techniques

- `ai_planning_settings.overflow_margin_min` (int, défaut 30) + champ dans les réglages.
- `src/lib/generate-planning.functions.ts` :
  - `buildAssignableWindow` : bornes de dispo élargies de ±marge, bornes du besoin
    (`reqStartMin`/`reqEndMin`) toujours strictes.
  - nouvelle passe F après la passe E, avant la sérialisation en shifts, opérant sur
    les `cells` non attribuées de chaque `Requirement` ; réutilise `hasConflict`,
    `restOk`, `maxShiftHFor`, `maxWeeklyHFor`.
- Rattrapage : nouvelle server function `absorbShortGaps` (admin/manager) qui étend
  les `shifts` existants adjacents et supprime les shifts-trous absorbés, avec mode
  `dryRun` pour l'aperçu.
- Aucun changement du calcul de score ni des règles de pointage : la tolérance de
  retard reste basée sur l'horaire final du shift.
