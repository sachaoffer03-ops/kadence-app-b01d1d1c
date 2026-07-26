## Objectif

Créer le site vitrine Kadence sur **kadence.be** (et www.kadence.be), positionné SaaS multi-clients, sans tarifs affichés (page Tarifs = "sur devis / nous contacter"). Zéro impact sur `app.kadence.be` (employé) et `admin.kadence.be` (admin).

## Routing / domaines

- `kadence.be` et `www.kadence.be` → nouveau mode `"marketing"` dans `src/lib/app-mode.ts` (aujourd'hui ces hôtes tombent en `admin` par défaut).
- `src/routes/index.tsx` : si mode marketing → afficher la landing au lieu de rediriger vers `/login` / `/dashboard`. Le comportement actuel reste identique sur app./admin.
- Les pages vitrine sont des routes réelles (SSR + SEO), pas des ancres :
  - `/` (accueil, uniquement en mode marketing)
  - `/fonctionnalites`
  - `/tarifs`
  - `/a-propos`
  - `/contact`
- Ces routes utilisent un layout vitrine autonome (header + footer propres), sans sidebar app : ajout à la liste des routes publiques/standalone dans `__root.tsx`.
- Bouton **Connexion** en haut à droite → `https://app.kadence.be` (et lien discret "Espace admin" en footer).

## Contenu (français, ton Kadence)

**Accueil**
- Hero : titre net + sous-titre ("La gestion d'équipe pensée pour les commerces de proximité"), CTA "Demander une démo" + "Se connecter".
- Bandeau de valeur : planning intelligent, pointage géolocalisé, dispos, clôtures, formation.
- 5–6 blocs fonctionnalités avec captures/mockups de l'app.
- Section "Comment ça marche" en 3 étapes.
- Section preuve : Skult Studios, 2 studios à Bruxelles.
- CTA final vers le formulaire de démo.

**Fonctionnalités** — détail par module : Planning & génération automatique, Disponibilités par studio, Pointage géolocalisé, Clôtures & checklists photo, Formation interne, Rapports & scoring, Notifications & emails, App mobile employé.

**Tarifs** — pas de grille. Trois profils indicatifs (1 établissement / multi-établissements / sur-mesure) avec "Tarif sur demande" et CTA unique vers `/contact`. Mention transparente : offre en cours de définition, accompagnement personnalisé.

**À propos** — origine du produit (né chez Skult Studios), philosophie, Bruxelles.

**Contact / démo** — formulaire : nom, email, entreprise, nb d'employés, message.

## Formulaire de démo (backend)

- Nouvelle table `public.demo_requests` (nom, email, entreprise, taille équipe, message, source, created_at) + GRANT `INSERT` à `anon`, `SELECT/UPDATE` à `authenticated` admin, `ALL` à `service_role`. RLS : insertion publique, lecture réservée aux admins via `has_role`.
- Envoi via une server function `src/lib/demo-requests.functions.ts` (validation zod : longueurs max, email valide) qui insère puis envoie un email de notification interne avec le système Resend déjà en place (`enqueueTemplateEmail`), plus un accusé de réception au prospect.
- Anti-abus simple : rate limit par IP/email côté server function.

## Design

Palette Kadence actuelle : fond `#FAFAF8`, surfaces `#F0EBE3`, accent coral `#F0997B`, texte `#1A1A1A`, Inter 400/500, pas d'emoji, pas de gradient, coins arrondis doux, beaucoup d'air. Mockups d'écrans générés en visuels. Entièrement responsive mobile.

## SEO

`head()` propre par route (title, description, og:title/description, og:type, canonical auto-référent sur `https://kadence.be/...`), H1 unique par page, JSON-LD `Organization` + `SoftwareApplication` sur l'accueil, `sitemap.xml` et `robots.txt` mis à jour.

## Détails techniques

- `getAppMode()` retourne désormais `"admin" | "employee" | "marketing"` ; tous les appelants existants sont audités pour que la logique admin/employé reste inchangée (fallback preview = `admin`, `?mode=marketing` pour prévisualiser).
- Le layout vitrine est un composant partagé `src/components/marketing/MarketingLayout.tsx` (header sticky, nav, footer) utilisé par les 5 routes.
- Aucun contenu app (auth, données, sidebar) n'est chargé sur les routes vitrine.

## Action manuelle requise

Dans **Réglages du projet → Domaines**, `kadence.be` et `www.kadence.be` doivent déjà pointer sur ce projet (c'est le cas). Rien à changer côté DNS.