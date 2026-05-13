## Contexte

Aujourd'hui :
- Les besoins par studio sont éditables dans **Réglages › Besoins par studio** et sauvegardés dans `staffing_templates` ✅
- La fonction serveur `generatePlanning` lit `staffing_templates` à chaque exécution → elle utilise donc **toujours la dernière version** ✅
- Mais : la régénération ne marche que **mois entier**, et la grille `planning.tsx` n'affiche pas encore les shifts réels du DB

Tu veux pouvoir **changer les besoins quand tu veux** et **relancer la génération sur la bonne période** sans tout casser.

## Ce que je vais faire

### 1. Régénération sur période choisie (du X au Y)
- Étendre `generatePlanning` : accepter `startDate` + `endDate` au lieu de `year`/`month`
- Quand `replaceExisting=true`, supprimer uniquement les shifts dans cette plage (pas tout le mois)
- Garder la possibilité "mois entier" comme raccourci (bouton)

### 2. UI de génération (`/planning/generate`)
- Deux modes : **Mois entier** (raccourci) ou **Période personnalisée** (date début → date fin via 2 datepickers shadcn)
- Bandeau d'info : "L'IA utilise les besoins définis dans Réglages › Besoins par studio à l'instant T"
- Lien rapide vers Réglages depuis cette page

### 3. Réassurance dans Réglages › Besoins
- Petit message persistant en haut de l'onglet : "Tes modifications sont enregistrées immédiatement. Pour les appliquer au planning existant, va sur Planning › Générer et choisis la période à recalculer."
- Bouton raccourci "Régénérer une période" qui amène directement sur `/planning/generate`

### 4. Brancher la grille `planning.tsx` sur le DB
- Remplacer le mock par un `useQuery` qui lit `shifts` (jointure `profiles` pour nom/avatar) sur la semaine/mois affiché
- Filtres studio + rôle déjà présents → les conserver
- Les shifts générés par l'IA apparaissent immédiatement après génération
- Realtime optionnel (channel postgres_changes sur `shifts`) pour refresh auto

## Détails techniques

**Server fn `generatePlanning`** — nouveau schéma d'entrée :
```ts
{ startDate: string, endDate: string, replaceExisting: boolean }
```
La logique de scoring/repos 11h reste identique, juste la boucle de jours s'adapte à la plage.

**`planning.tsx`** : actuellement ~1000 lignes de mock. Je remplace la source de données par `supabase.from('shifts').select('*, profiles(first_name, last_name, avatar_url)').gte('shift_date', start).lte('shift_date', end)` avec pagination si > 1000 lignes (limite Supabase). Pour 50 employés × ~5 shifts/semaine = 250 lignes/semaine → safe en vue semaine, mais en vue mois il faut paginer.

**Pas de versioning daté** : un seul jeu de besoins actif à la fois (ton choix). Si tu modifies un besoin et régénères, c'est la nouvelle version qui s'applique sur la période choisie.

## Ordre d'implémentation
1. Server fn période + UI génération (rapide, débloque le flux)
2. Bandeau Réglages
3. Branchement grille `planning.tsx` sur DB (le plus gros morceau, ~300 lignes à toucher)

Approuve et je lance.