# Mobile UI — Admin Kadence

L'admin a 14 pages, 10k+ lignes. Une adaptation ciblée veut dire : corriger ce qui casse réellement sur iPhone (390×844), sans toucher au design ni à la logique métier. Je propose 3 vagues pour rester gérable et te laisser valider entre chaque.

## Patterns à corriger partout (référentiel commun)

- **Headers de page** : titres + boutons d'action qui se chevauchent → grid `grid-cols-[minmax(0,1fr)_auto]` + `truncate` + boutons icon-only au mobile.
- **Tables debord** : passage en cartes empilées < `md`, table conservée ≥ `md`.
- **Filtres en ligne** : barre horizontale scrollable (`overflow-x-auto`) ou bouton « Filtres » qui ouvre une `Sheet` au mobile.
- **Tap targets** : tous les boutons d'action passent à `min-h-11` (44px) sur mobile.
- **Paddings** : `px-4 py-4` au mobile, `md:px-6 md:py-6` au-delà (au lieu des `px-8` desktop systématiques).
- **Modales/Dialogs** : utilisation de `Sheet` (bottom) au lieu de `Dialog` sur mobile pour les formulaires longs.
- **Sidebar mobile** : déjà OK (drawer existant), je vérifie juste que le `TopBar` reste lisible.

## Vague 1 — pages courtes & à fort impact (cette session)

Pages simples qui se lisent vite et se corrigent vite. Effet visible immédiatement.

- `dashboard.tsx` (237 l) — KPIs en grille 2-col mobile au lieu de 4, timeline scrollable.
- `notifications.tsx` (177 l) — liste compacte, swipe-friendly.
- `feedbacks.tsx` (315 l) — cards empilées.
- `signalements.tsx` (369 l) — cards empilées + statut en chip.
- `rapports.tsx` (308 l) — exports en menu déroulant, charts responsive.
- `trous.tsx` (636 l) — la page la plus critique opérationnellement, cards mobile dédiées.

## Vague 2 — pages moyennes (session suivante)

- `staff.index.tsx` (399 l) + `staff.$id.tsx` — liste équipe et fiche détaillée.
- `demandes.tsx` (761 l) — workflow validation/refus en bottom sheet.
- `pointage.tsx` (842 l) — table → cards par employé.
- `reglages.tsx` (427 l) — sections collapsibles.

## Vague 3 — les trois mastodontes (session dédiée chacun)

- `planning.tsx` (2075 l) — la grille planning au mobile demande une refonte d'affichage (vue jour au lieu de semaine, swipe entre jours). C'est le plus délicat, je veux le traiter seul pour pas tout casser.
- `cloture.tsx` (1711 l) — wizard de clôture, étapes en plein écran mobile.
- `studios.tsx` (2101 l) — config admin lourde, tabs verticales mobile.

## Ce qui ne change pas

- Aucune logique métier touchée — purement présentation.
- Design tokens existants conservés (coral, off-white, Inter, pas d'emoji, pas de gradients).
- Desktop reste identique à 100 %.
- Pas de nouvelle dépendance.

## Livrable de la session

Vague 1 implémentée et vérifiée. Tu me dis si le ton mobile te convient avant que j'attaque la vague 2.

---

**Tu valides ce découpage ?** Si tu préfères que j'attaque directement une page précise en priorité (par ex. planning qui est le plus utilisé sur le terrain), dis-le et je réorganise.