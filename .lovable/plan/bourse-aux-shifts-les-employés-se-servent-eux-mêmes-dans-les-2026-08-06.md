# Bourse aux shifts — les employés se servent eux-mêmes dans les trous

Objectif : au lieu de courir après tout le monde pour les dispos, tu envoies **un seul message** (email + notification in-app) avec la liste des trous. Chaque employé ouvre l'app, coche les shifts qu'il veut, valide — **le premier qui prend a le shift**. Il disparaît immédiatement de la liste des autres, apparaît dans son planning et dans le planning admin, sans aucune action de ta part.

## 1. Côté toi (admin / manager) — page « Trous à combler »

- Nouveau bouton **« Ouvrir à tous »** en haut de la page, avec le filtre studio déjà en place (ex. Châtelain) et un choix de période (semaine / mois).
- Un écran de confirmation récapitule : X trous, Y employés destinataires (ceux du studio concerné, actifs et invités), et un champ **message libre** optionnel.
- À l'envoi :
  - une **notification in-app** à chaque employé,
  - un **email** avec la liste des shifts ouverts (date, horaire, rôle, studio) et un bouton « Voir les shifts disponibles »,
  - les trous passent en statut « ouverts à tous » et restent visibles dans ta page trous avec un compteur « X pris / Y restants ».
- Tu gardes la possibilité de refermer l'ouverture à tout moment (bouton « Fermer la bourse »).

## 2. Côté employé — écran « Shifts disponibles »

- Nouvel onglet/carte dans l'app employé : **« Shifts disponibles »** avec pastille du nombre de shifts libres.
- Liste des trous ouverts sur ses studios, groupés par jour : date, horaire, rôle (couleur du rôle), studio.
- Cases à cocher : il peut en sélectionner plusieurs, puis **« Je prends ces shifts »**.
- Filtrage automatique : on masque les shifts qui chevauchent un shift qu'il a déjà, ou une indisponibilité déclarée.
- Un shift déjà pris par quelqu'un d'autre disparaît en direct de sa liste (temps réel).
- Après validation : confirmation, les shifts apparaissent immédiatement dans son planning, et une notification t'informe « Trou comblé ».

## 3. Attribution : premier arrivé, premier servi

La prise de shift est **atomique** : le shift n'est attribué que s'il est encore libre au moment exact du clic. Si deux personnes cliquent en même temps, la seconde reçoit « Trop tard, ce shift vient d'être pris » et le reste de sa sélection est quand même attribué. Aucun double-booking possible.

## 4. Dispos : n'afficher que les trous

Dans l'écran « Mes dispos », pour un mois **déjà planifié** (septembre), on remplace la saisie d'heures par la **liste des trous à cocher** : l'employé ne renseigne plus des plages horaires, il choisit directement parmi ce qui est réellement à pourvoir. La saisie d'heures classique reste pour les mois **pas encore planifiés** (octobre et suivants), puisque le générateur en a besoin.

## Détails techniques

- Réutilise le mécanisme existant `shift_proposals` + `acceptProposal` (déjà atomique : `update shifts ... where user_id is null`). Ajout d'un mode « ouvert à tous » : une proposition par employé éligible, ou un flag `open_to_all` sur le shift avec une fonction serveur `claimOpenShifts` faisant la même prise atomique en lot.
- Nouvelle server function `openShiftsToAll` (admin/manager) dans `src/lib/proposals.functions.ts` : crée les propositions, insère les notifications, et envoie l'email via `enqueueTemplateEmail`.
- Nouveau template React Email `shifts-disponibles` dans `src/emails/employee/`, enregistré dans `src/emails/index.ts` (liste des créneaux + CTA).
- UI admin : bloc d'ouverture dans `src/routes/trous.tsx`.
- UI employé : nouveau composant `src/components/staff-app/OpenShiftsSheet.tsx`, monté depuis `src/routes/staff-app.tsx`, avec abonnement temps réel sur `shifts` pour retirer les shifts pris.
- `src/components/staff-app/DisposSheet.tsx` : détection « mois déjà planifié » (présence de shifts publiés sur le mois) → bascule en mode « cocher les trous ».
- Aucune modification du générateur de planning ni des besoins de staff.
