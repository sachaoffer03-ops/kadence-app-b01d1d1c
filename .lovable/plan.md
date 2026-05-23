## Constat actuel

Dans `/cloture` → Checklists, aujourd'hui :
- Chaque item peut être **lié à une zone photo** via un menu déroulant « Lier une photo ». L'employé doit prendre la photo pour cocher l'item.
- La section « Photos & analyse IA » liste les zones photo (label + description + obligatoire/optionnelle) **sans afficher la vignette de référence**.
- Quand l'IA refuse une photo, **l'admin n'a aucun moyen de la valider manuellement** : `ShiftDetailSheet` affiche juste une grille de vignettes, sans le statut IA ni bouton d'action.

## Ce qu'on veut

1. Items et photos = **deux étapes indépendantes**. Un item est un simple texte à cocher (frigo nettoyé, sol balayé…), sans champ photo. Les zones photo vivent uniquement dans la section « Photos & analyse IA » avec leur propre nom + description (qui devient le message affiché à l'employé : « Frigo — prends en photo le frigo bien rangé »).
2. Côté admin, dans chaque carte de zone photo, **afficher la vignette de la photo de référence** uploadée (preview immédiat, plus juste un « ✓ déjà uploadée »).
3. Côté admin, dans le rapport d'un shift, **lister chaque photo soumise avec son statut IA** (validée / refusée + raison) et un bouton **« Valider manuellement »** pour forcer l'acceptation d'une photo refusée à tort (ex. il manque vraiment du lait, l'employé ne peut rien y faire).

## Plan

### 1. Page `/cloture` → onglet Checklists (`src/routes/cloture.tsx`)

- **Items** : retirer le `<Select>` « Lier une photo… » dans `SortableItem` (lignes ~893-901). On garde le champ `photo_zone_id` en base pour la compat mais l'UI ne l'expose plus, et on ne le set plus à la création.
- **Carte zone photo (`PhotoCard`)** : ajouter, en haut de la carte, un carré aperçu (~80×80) avec la photo de référence si `reference_photo_url` est définie (URL signée via le bucket `checklist-photos`), sinon un placeholder « Pas d'image de référence ». Au clic sur la vignette → ouvre le modal d'édition.
- **Modal `PhotoEditModal`** : remplacer le simple « ✓ déjà uploadée » par une **vraie preview** de l'image actuelle (URL signée) + bouton « Remplacer ». Indique clairement que le `Nom` + `Description` seront ceux affichés à l'employé au moment de prendre la photo.

### 2. Validation manuelle côté admin

Côté base : on réutilise les colonnes existantes de `checklist_submission_photos` (`ai_validation_status`, `ai_validation_message`, `ai_validated_at`). On ajoute via migration trois colonnes pour tracer l'override :
- `admin_override_by uuid`
- `admin_override_at timestamptz`
- `admin_override_reason text`

Et on met à jour la policy UPDATE pour autoriser admin/manager (déjà couvert par la policy ALL existante via `has_role`).

### 3. `ShiftDetailSheet` (`src/components/reports/ShiftDetailSheet.tsx`)

Refondre le bloc « Photos » pour afficher pour chaque photo soumise :
- vignette
- label de la zone (frigo, plonge…)
- badge de statut : ✅ Validée IA / ⚠️ Refusée IA / ✋ Validée manuellement
- raison renvoyée par l'IA (`ai_validation_message`)
- si statut = `rejected` : bouton **« Valider manuellement »** qui ouvre un petit prompt (raison courte facultative), puis appelle un nouveau serverFn `overrideRejectedPhoto({ photoId, reason })` qui :
  - bascule `ai_validation_status` à `validated`
  - remplit `admin_override_by/at/reason`
  - écrit `ai_validation_message = "Validée manuellement par l'admin : <raison>"`

Le serverFn vit dans `src/lib/closure-flow.functions.ts` + helper dans `closure-flow.server.ts` (déjà le bon emplacement, contient déjà la logique IA). Il vérifie via `requireSupabaseAuth` que l'appelant est admin/manager.

Côté `reports.server.ts` (qui alimente `ShiftDetailSheet`), exposer les nouveaux champs (`reason`, `overrideBy`, `overrideAt`) dans la map des photos.

### 4. Effet sur le scoring

`calculate_profile_score` lit déjà uniquement `ai_validation_status`. Une override → `status='validated'` → l'employé regagne automatiquement les points perdus, sans logique supplémentaire à écrire.

## Détails techniques

- Migration SQL :
  ```sql
  ALTER TABLE public.checklist_submission_photos
    ADD COLUMN admin_override_by uuid,
    ADD COLUMN admin_override_at timestamptz,
    ADD COLUMN admin_override_reason text;
  ```
- Nouveau serverFn `overrideRejectedPhoto` avec validation Zod `{ photoId: uuid, reason: string.max(280).optional() }`.
- URL signée pour les vignettes : `supabase.storage.from("checklist-photos").createSignedUrl(path, 3600)` (déjà le pattern utilisé dans `use-checklists.ts`).
- Pas de breaking change : `checklist_template_items.photo_zone_id` reste en base, simplement plus exposé dans l'UI admin et ignoré dans le flow employé (il l'est déjà — `ClosureFlow` traite items et photos comme deux listes parallèles).

## Hors scope

- Pas de modification de `ClosureFlow` côté employé : il sépare déjà items (checkboxes) et photos (upload). La seule chose qui change pour l'employé : il ne voit plus de photo « collée » à un item, uniquement le label + description que l'admin a saisis dans la zone photo.
- Pas de refonte du moteur IA ni du seuil.