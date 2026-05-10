## Objectif

Permettre qu'un employé puisse :
- travailler dans **plusieurs studios**
- avoir **plusieurs types de contrat** en parallèle (ex. CDI + Flexi)
- exercer **plusieurs rôles métier** (déjà partiellement en place)

Et que toute l'app le comprenne (invitations, fiche employé, planning, dimona, etc.).

## 1. Base de données

Aujourd'hui :
- `invitations` : `studio_id` (1 seul), `contract` (1 seul), `business_roles` (déjà tableau ✅)
- `profiles` : `studio_id` (1 seul), `contract` (1 seul)
- `user_business_roles` : table déjà multi ✅

Changements :

**Sur `invitations`** :
- Ajouter `studio_ids uuid[] NOT NULL DEFAULT '{}'` (remplace progressivement `studio_id`)
- Ajouter `contracts contract_type[] NOT NULL DEFAULT '{}'` (remplace `contract`)
- On garde `studio_id` et `contract` en lecture seule pendant la transition (rempli avec le 1er du tableau pour rétrocompat).

**Nouvelle table `user_studios`** (multi-studios par employé) :
```
user_studios(user_id, studio_id) — clé composite
```
RLS :
- L'utilisateur voit ses studios
- Admin/manager voient et gèrent tout

**Nouvelle table `user_contracts`** (multi-contrats) :
```
user_contracts(user_id, contract type) — clé composite
```
RLS identique.

**Trigger `handle_new_user`** : adapté pour insérer N lignes dans `user_studios` et `user_contracts` à partir de `invitations.studio_ids` / `contracts`, plus les rôles métier déjà gérés.

`profiles.studio_id` et `profiles.contract` restent (rempli avec le "principal" = premier du tableau) pour ne pas casser les écrans existants. La source de vérité passe sur les tables de jointure.

## 2. Formulaire d'invitation (`InviteEmployeeModal`)

- **Studios** : passe d'un `<select>` à un multi-select (chips cochables, identique au design des rôles métier).
- **Contrat** : passe à multi-select (CDI, Flexi, Étudiant — case à cocher).
- **Rôles métier** : déjà multi, on garde.
- Validation : au moins 1 studio + au moins 1 contrat + au moins 1 rôle métier.
- Envoi : on poste `studio_ids` + `contracts` au lieu des champs simples.

## 3. Liste des invitations (`InvitationsList`)

- Colonne « Studio » → affiche jusqu'à 2 puces, puis « +N ».
- Colonne « Contrat » → idem (CDI, Flexi…).
- Filtres existants conservés.

## 4. Page d'activation (`/activation`)

- Affichage de bienvenue : « Vous êtes invité chez Skult X et Y, en CDI + Flexi, comme Barista et Accueil. »
- Pour la carte étudiant : on affiche la question seulement si `Étudiant` fait partie des contrats.

## 5. Reste de l'app — ajustements minimum

- **Fiche employé** (`/staff/$id`) : lister tous les studios et tous les contrats (badges).
- **Planning / shifts** : un shift garde 1 studio (logique métier inchangée). On filtre les employés disponibles par appartenance à `user_studios`.
- **Dimona** : on liste les contrats de l'employé.
- Les autres pages (feedbacks, formations…) ne dépendent pas du studio unique → rien à changer.

## 6. Edge function `send-invitation`

- Accepter `studio_ids: string[]` et `contracts: string[]` dans le body.
- Email récap : « Vous rejoignez Skult Châtelain & Skult Sablon en CDI + Flexi ».

## 7. Ordre d'exécution

1. Migration SQL (nouvelles tables + colonnes tableau sur invitations + trigger mis à jour).
2. Mise à jour de l'edge function `send-invitation`.
3. UI : modal d'invitation, liste, activation, fiche employé.
4. Vérification rapide du planning pour qu'il filtre par `user_studios`.

## Points qui restent en single (à confirmer)

- Un **shift** reste rattaché à 1 seul studio (un employé ne peut pas être à 2 endroits en même temps). ✅ pas de changement.
- Le **studio « principal »** affiché dans certains résumés = premier de la liste, ou marqué explicitement plus tard si besoin.

Validez-vous ce plan ? Je lance la migration dès votre OK.