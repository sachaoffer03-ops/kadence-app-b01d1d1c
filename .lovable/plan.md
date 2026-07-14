ic## Objectif

Lancer une génération de planning **test** pour Rhode en août 2026 en faisant comme si Anaïs n'existait pas (ses dispos ignorées), sans que la simulation n'apparaisse dans l'historique des runs ni pour les autres utilisateurs.

## Approche

Deux ajouts très ciblés au générateur existant, réservés admin :

1. **Paramètre `exclude_user_ids`** dans `generatePlanning` (server fn) : filtre les employés listés avant l'appel à l'algo (dispos ignorées, non-affectables). Aucun impact BDD, purement en mémoire pendant le run.

2. **Paramètre `silent`** : quand `dry_run=true` et `silent=true`, on n'insère **rien** dans `planning_runs` (aujourd'hui un dry-run laisse quand même une ligne d'historique). Le résultat est renvoyé uniquement à l'appelant.

## Où le déclencher

Ajout d'un petit bloc "Simulation avancée (admin)" sur `/admin/diagnostic` (ou nouvelle page `/admin/planning-sandbox`) avec :
- sélecteur studio (Rhode présélectionné)
- mois (août 2026)
- multi-select d'employés à exclure
- bouton "Lancer simulation"
- affichage inline du résultat (shifts générés, couverture, trous, logs)

Rien n'est publié, rien n'est visible ailleurs. Fermer la page = tout disparaît.

## Fichiers touchés

- `src/lib/generate-planning.functions.ts` — nouveaux champs `exclude_user_ids` (uuid[]) et `silent` (bool) dans le schéma d'input ; filtre la liste employés ; skip l'insert dans `planning_runs` si `silent && dry_run`.
- Nouvelle page admin (ou section dans diagnostic) pour l'UI de simulation.

Aucune migration, aucune modification de RLS, aucun changement pour les employés.

## Alternative plus légère

Si tu veux zéro nouvelle UI : je fais juste la modif serveur et je lance moi-même la simulation depuis un appel one-shot, puis je te colle le résultat dans le chat. Rien n'est ajouté à ton app.

Dis-moi : **UI admin réutilisable** ou **one-shot ponctuel** ?
