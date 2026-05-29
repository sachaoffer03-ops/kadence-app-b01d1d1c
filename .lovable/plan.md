## Objectif

Permettre à l'employé d'attacher **jusqu'à 3 photos** à un signalement (en plus du texte), et les afficher dans la page admin `/signalements`.

Il faut que l'admin reçoivent ses photos aussi évidemment dans un endroit dédié dans signalements 

## DB — migration

Ajouter une colonne `photos text[]` (URLs publiques) sur `public.signalements`, nullable, défaut `'{}'`. Pas de nouvelle table.

Réutiliser le bucket public existant `**chat-attachments**` (déjà public, déjà utilisé pour des médias employés) sous le préfixe `signalements/{userId}/{timestamp}-{rand}.{ext}`. Pas de nouveau bucket nécessaire.

## UI employé — `SignalementSheet` (`src/components/staff-app/StaffActionsSheets.tsx`)

Sous le champ Message, ajouter un bloc "Photos (optionnel)" :

- Bouton "+ Ajouter une photo" → `<input type="file" accept="image/*" capture="environment" multiple>` (déclenche caméra sur mobile)
- Aperçu en grille 3 colonnes des miniatures déjà choisies (max 3), avec croix pour retirer
- Validation client : max 3 fichiers, max 5 MB / fichier, type image/* uniquement
- À la soumission :
  1. Upload séquentiel vers `chat-attachments` (path `signalements/{userId}/...`)
  2. Récupère `publicUrl` de chaque fichier
  3. Insert `signalements` avec `photos: [...urls]`
- Pendant l'upload : libellé bouton "Envoi… (1/3)" + désactivation
- Erreur upload : toast, on n'insère pas le signalement

## UI admin — `/signalements` (`src/routes/signalements.tsx`)

Sous le message du signalement, si `photos?.length`, afficher une rangée de miniatures (48×48, `rounded-md`, `object-cover`). Clic sur une miniature → ouvre l'URL plein écran dans un nouvel onglet (simple `<a target="_blank">`, pas de lightbox custom).

Étendre le type `Row` local avec `photos: string[] | null`.

## Fichiers touchés

- migration SQL : ajout colonne `photos`
- `src/components/staff-app/StaffActionsSheets.tsx` — `SignalementSheet`
- `src/routes/signalements.tsx` — affichage miniatures

## Hors périmètre

- Édition / suppression de photos après envoi
- Compression côté client (on se repose sur la limite 5 MB)
- Lightbox / galerie custom