# Refonte `/formation` — Plateforme de formation interne

Gros chantier (DB + admin UI + employé UI + tracking). Je vais le découper en **3 sous-tours** pour livrer proprement sans tout casser, comme suggéré dans ton prompt.

## Sous-tour 1 — Fondations (DB + types + data layer)

1. **Migration SQL** : 4 tables (`training_folders`, `training_steps`, `training_resources`, `training_progress`) + index + RLS policies (lecture authenticated, écriture admin, progression scopée user).
2. **Storage** : bucket `training-resources` (privé, lecture authenticated, upload admin via policies sur `storage.objects`).
3. **Types** : `src/types/training.ts` (Folder, Step, Resource, Progress, ResourceType union).
4. **Server functions** : `src/lib/training.functions.ts` avec toutes les fonctions listées (lecture, CRUD admin, tracking employé), toutes via `requireSupabaseAuth`.
5. **Hooks TanStack Query** : `src/hooks/use-training.ts` (useFolders, useFolderDetail, useMyProgress, useAllProgress + mutations avec invalidation).

## Sous-tour 2 — Admin UI

6. **Page `/formation`** refonte complète : layout 2 colonnes (sidebar dossiers + zone principale), tabs Contenu/Progression.
7. **Sidebar** : liste dossiers avec drag&drop (@dnd-kit), badge "Requis", menu kebab.
8. **Modals** : 
   - FolderModal (nom, desc, icône Lucide picker, palette 8 couleurs, multi-select rôles requis)
   - StepModal (titre, description)
   - ResourceModal (2 étapes : choix type → form selon type vidéo/PDF/note/lien, avec preview, upload Supabase Storage pour PDF, validation URL pour vidéo)
9. **Zone Contenu** : header dossier + liste étapes avec drag&drop + ressources réordonnables.
10. **Zone Progression** : filtres (studio/rôle/contrat), tableau employés × dossiers avec heatmap couleur, drawer détail, export CSV, stats globales.

## Sous-tour 3 — Employé UI + polish

11. **Page `/staff/formation`** : liste dossiers avec tri intelligent (obligatoires non commencés en premier), badges OBLIGATOIRE/Optionnel, barres de progression.
12. **Vue détail `/staff/formation/$folderId`** : étapes + ressources avec status visuel.
13. **Vue consommation `/staff/formation/$folderId/$resourceId`** : 
    - Vidéo : embed YouTube/Vimeo/Drive
    - PDF : viewer iframe + download
    - Note : rendu markdown
    - Lien : bouton ouvrir
    - Bouton "Marquer terminé" sticky bottom mobile
    - Navigation Précédent/Suivant
14. **Tracking** : mutation `markResourceCompleted`, animation checkmark, auto-nav vers ressource suivante, modal félicitations à 100%.
15. **Responsive mobile** : sidebar admin → drawer, vue employé optimisée tactile.

## Détails techniques

- **Pas de hardcoding** : icônes/couleurs définies dans un constant `src/lib/training-presets.ts` (palette 8 couleurs cohérente design system, ~20 icônes Lucide), mais tout contenu vient de la DB.
- **Permissions** : route admin gardée par `has_role('admin')`, route employé accessible à tout user authentifié.
- **Cascade DB** : ON DELETE CASCADE sur folder→steps→resources, progression conservée.
- **Soft delete** dossiers via `deleted_at`.
- **QueryKeys** : `['training','folders']`, `['training','folder',id]`, `['training','progress','me']`, `['training','progress','all']`.
- **Rich text note** : utilisera un éditeur léger (textarea + preview markdown via `react-markdown` déjà compatible, sans ajouter Tiptap pour rester léger). Si tu veux du WYSIWYG complet je peux ajouter Tiptap au sous-tour 2.
- **Coexistence avec l'existant** : les tables actuelles `training_paths`/`formations`/`formation_completions` restent en place (utilisées par `/staff-app` FormationPanel). Je les laisse intactes pour ne rien casser, et je construis le nouveau système en parallèle. À terme tu pourras supprimer l'ancien.

## Question avant de démarrer

Une seule clarif rapide : **rich text des notes** → tu veux un vrai WYSIWYG (Tiptap, ~80kb) ou markdown simple avec preview (zéro deps) ? Par défaut je pars sur **markdown simple** pour rester léger, sauf si tu préfères Tiptap.

Si tu valides ce plan, je démarre par le **sous-tour 1** (migration + data layer) et je reviens te montrer avant de continuer.
