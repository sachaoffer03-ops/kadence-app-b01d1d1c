## Objectif

Refaire entièrement le site vitrine `kadence.be` : aujourd'hui il est trop plat, trop textuel, trop répétitif, et le logo est illisible. On vise un site de présentation qui impressionne dès la première seconde, porté par le visuel plutôt que par les paragraphes.

Aucun impact sur `app.kadence.be` ni `admin.kadence.be` — le site vitrine reste isolé sur son domaine.

## Direction visuelle retenue

Coral éditorial poussé à fond : fond off-white `#FAFAF8`, surfaces crème `#F3F1EC`, accent coral `#F0997B`, noir profond `#1A1A1A` pour les blocs de rupture.

Ce qui change concrètement par rapport à l'existant :
- Typographie hero beaucoup plus grande (jusqu'à ~88px sur desktop), respiration doublée entre les sections.
- Alternance de fonds : crème → blanc → noir → coral, pour casser la monotonie actuelle.
- Fin des grilles de 6 cartes identiques : chaque fonctionnalité a son propre traitement (pleine largeur, split, superposition, bande sombre).
- Micro-animations à l'apparition (fade + translation douce au scroll), effets de survol sur les visuels.

## Logo

- Header : hauteur 34px → 46px, plus de padding vertical, version compacte sur mobile.
- Footer : hauteur 30px → 44px.
- Si le PNG actuel manque de netteté à cette taille, je régénère une version haute résolution du même logo (mêmes formes, mêmes couleurs).

## Visuels : mockups produit reconstitués

Plutôt que des captures d'écran, je recrée des interfaces Kadence en HTML/CSS directement dans le site — nettes à tous les écrans, animables, et sans aucune donnée réelle.

Mockups prévus :
1. **Planning semaine** — grille de shifts colorés par rôle, animation de remplissage automatique.
2. **Génération de planning** — barre de progression + compteur de couverture qui monte à 100%.
3. **Pointage géolocalisé** — écran mobile avec carte, rayon de validation, bouton de pointage.
4. **Clôture avec photos** — checklist qui se coche, vignettes photo.
5. **Rapports** — cartes de KPI et mini-graphiques.
6. **Disponibilités** — calendrier mensuel avec sélection de créneaux.

Données 100% fictives : établissements « Le Comptoir Nord » / « Atelier Sablon », prénoms inventés. Zéro donnée Skult, et aucune modification des données réelles de l'app.

En complément, 3–4 images d'ambiance générées (comptoir de café, équipe en service, salle en fin de journée) pour les respirations émotionnelles entre les sections produit.

## Vidéo de démonstration

Vidéo motion de ~25 secondes, produite en code (Remotion), livrée en même temps :
- Ouverture logo Kadence sur fond crème.
- Séquence 1 : besoins en staff qui se remplissent.
- Séquence 2 : génération du planning, couverture qui atteint 100%.
- Séquence 3 : côté employé — shift du jour, pointage.
- Séquence 4 : clôture photo + rapport.
- Fermeture : logo + « kadence.be ».

Même palette, mêmes données fictives. Intégrée en autoplay muet et en boucle dans le hero de la page d'accueil, avec fallback image si la lecture échoue.

## Pages

- `/` — refonte totale : hero avec vidéo, preuve de valeur, parcours produit en 5 blocs alternés, section mobile, bande CTA sombre.
- `/fonctionnalites` — une section illustrée par fonctionnalité, plus de liste de cartes.
- `/tarifs` — mise en page repensée, toujours sur devis.
- `/a-propos` — histoire du projet, ancrage bruxellois. **Skult n'est pas mentionné.**
- `/contact` — formulaire de démo conservé, habillage refait.
- `/confidentialite` — conservée, harmonisée au nouveau design.
- `/mentions-legales` — **nouvelle page** avec le texte fourni :

  KOL INVEST, SRL dont le siège est établi Avenue d'Orbaix 23/A Boîte 4, 1180 Uccle, enregistrée à la Banque Carrefour des Entreprises sous le numéro 0776.362.165, responsable du traitement des données. Contact : privacy@skult-studios.com

  Ce texte légal est reproduit tel quel (obligation légale), mais aucune page éditoriale ne parle de Skult.

  Ajout au footer et au sitemap.

## Détails techniques

- Refonte de `MarketingLayout.tsx` (header, footer, primitives de section) et de `MarketingHome.tsx`.
- Nouveaux composants sous `src/components/marketing/mockups/` (un fichier par mockup produit) et `src/components/marketing/motion.tsx` (révélation au scroll via IntersectionObserver, sans dépendance ajoutée).
- Nouvelle route `src/routes/mentions-legales.tsx`, ajoutée aux routes publiques/standalone de `__root.tsx` et à `sitemap.xml`.
- Vidéo produite dans un projet `remotion/` versionné, rendue en MP4 puis hébergée via le CDN d'assets.
- `head()` propre par route : titre, description, og:title, og:description, canonical.
- Vérification responsive mobile/desktop après implémentation.

## Hors périmètre

- Aucune modification de l'app employé ni de la console admin.
- Aucune modification des données Skult existantes.
