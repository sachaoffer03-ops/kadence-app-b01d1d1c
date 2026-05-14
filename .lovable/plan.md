## Ce qu'on ajoute

### 1. Besoins Skult Rhodes

Une seule personne par shift, durée 3 à 6h, jamais de CDI, jamais de Cuisine.

```
Lun-Ven  07:30 → 14:30   (1 personne, 7h → coupé en 1 ou 2 shifts par l'algo)
Lun-Ven  16:30 → 20:15   (1 personne, ~3h45)
Sam-Dim  08:30 → 17:00   (1 personne, 8h30 → coupé en 2 shifts par l'algo)
```

Total : 12 modèles de besoins ajoutés pour Rhodes.

### 2. Nouvelles règles globales (les 2 studios)

- Étudiant : maximum **15h par semaine**
- Flexi : maximum **20h par semaine**
- CDI mettre de base a max 48

Ces 3 plafonds deviennent réglables depuis Réglages › Algorithme IA, avec les valeurs par défaut 15 / 20 / 48.

### 3. Souplesse du moteur de planning

Aujourd'hui un besoin = 1 rôle précis + 1 contrat précis (ou « peu importe »). Pour Rhodes il faut :

- accepter **plusieurs contrats** sur un même créneau (Étudiant **OU** Flexi)
- accepter **plusieurs rôles** sur un même créneau (Barista **OU** Accueil **OU** Host)

On élargit donc la définition d'un besoin :

- liste de contrats autorisés (vide = tous)
- liste de rôles autorisés (vide = uniquement le rôle principal du besoin)

Un employé est éligible s'il a au moins l'un des rôles autorisés et au moins l'un des contrats autorisés.

## Détails techniques

### Migration BDD

- `staffing_templates` : ajouter `allowed_contracts contract_type[]` et `allowed_roles text[]` (NULL/vide = pas de restriction supplémentaire).
- `ai_planning_settings` : ajouter `max_weekly_student_hours smallint default 15`, `max_weekly_flexi_hours smallint default 20`, `max_weekly_cdi_hours smallint default 38`.

### Données

Insertion des 12 templates Rhodes (`studio_id = Skult Rhodes`) avec :

- `business_role = 'Barista'` (rôle de référence pour l'affichage)
- `allowed_roles = {Barista, Accueil, Host}`
- `allowed_contracts = {Étudiant, Flexi}`
- `required_count = 1`, `is_optional = false`

### Générateur (`src/lib/generate-planning.functions.ts`)

- `eligibleFor` : si `allowed_roles` est défini → candidat OK si un de ses rôles est dans la liste ; sinon comportement actuel. Idem pour `allowed_contracts`.
- `Need` : porter `allowed_roles` et `allowed_contracts` jusqu'à la couverture gloutonne.
- Nouveaux garde-fous hebdo `checkWeeklyStudent` / `checkWeeklyFlexi` (mêmes règles que `checkWeeklyCDI` mais sur les contrats Étudiant / Flexi, en utilisant les nouveaux plafonds).
- Constantes `MAX_WEEKLY_*_HOURS` lues depuis `ai_planning_settings`.

### UI Réglages

- Éditeur des besoins (`StaffingTemplatesEditor`) : ajouter un sélecteur multi pour rôles autorisés et contrats autorisés (optionnels).
- Page Algorithme IA : 2 nouveaux champs numériques pour les plafonds hebdo Étudiant / Flexi.

## Hors-scope

- L'affichage côté Planning continue de montrer le rôle principal (`business_role`) ; un badge « polyvalent » pourra être ajouté plus tard si besoin.
- Pas de re-génération automatique : il faudra relancer manuellement la génération pour Rhodes après approbation.