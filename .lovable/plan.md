## Objectif

Aujourd'hui tout le monde passe par `/login` puis est redirigé selon le rôle. On va séparer en deux espaces clairement distincts, chacun avec sa propre URL et sa propre page de connexion.

- **admin.shyft.flashsite.fr** → espace admin / manager (dashboard, planning, staff, etc.)
- **app.shyft.flashsite.fr** → espace employé (l'app `/staff-app` orientée mobile)

## Ce qu'il faut faire côté Lovable (DNS) — à toi

Avant que la séparation marche en prod, **tu dois ajouter les deux sous-domaines** dans Lovable :

1. Project Settings → Domains → Connect Domain → `admin.shyft.flashsite.fr`
2. Pareil pour `app.shyft.flashsite.fr`
3. Suivre les instructions DNS chez ton registrar

Le domaine actuel `shyft.flashsite.fr` peut rester (page d'accueil avec deux boutons "Espace admin" / "Espace employé") ou rediriger vers l'un des deux.

## Ce que je code

### 1. Détection du sous-domaine

Helper `getAppMode()` qui lit `window.location.hostname` :
- contient `admin.` → mode admin
- contient `app.` → mode employee
- sinon (preview, dev) → fallback via `?mode=admin` dans l'URL pour pouvoir tester les deux

### 2. Deux pages de connexion distinctes

- **Login admin** : design sobre/pro, formulaire centré classique, titre "Espace administrateur — Skult Studios", fond clair off-white.
- **Login employé** : design type app mobile, plus chaleureux, accent coral plus présent, gros boutons tactiles, titre "Bonjour 👋 Connectez-vous à votre espace".

Même backend Supabase derrière, deux composants visuels.

### 3. Routing & garde-fous

Dans `src/routes/__root.tsx` :
- Mode **employee** : tout chemin admin (`/dashboard`, `/planning`, `/staff`, etc.) → redirige vers `/staff-app`. Si un admin se connecte ici → message "Cet espace est réservé aux employés. Rendez-vous sur admin.shyft.flashsite.fr".
- Mode **admin** : `/staff-app` bloqué. Si un employé se connecte ici → message "Cet espace est réservé aux administrateurs. Rendez-vous sur app.shyft.flashsite.fr".
- Après login OK, redirection vers le bon espace selon rôle + mode.

### 4. Email d'invitation

L'edge function `send-invitation` envoie le lien d'activation vers le bon sous-domaine selon le rôle invité (employee → `app.*`, admin/manager → `admin.*`).

## Fichiers touchés

```text
src/lib/app-mode.ts                              [NEW]
src/routes/login.tsx                             [EDIT — split visuel]
src/routes/__root.tsx                            [EDIT — redirections]
src/routes/activation.tsx                        [EDIT — cohérent]
supabase/functions/send-invitation/index.ts      [EDIT — URL selon rôle]
```

## Avant que je commence

Confirme-moi :
1. Tu vas bien ajouter les deux sous-domaines dans Project Settings → Domains ?
2. Le domaine racine `shyft.flashsite.fr` : on en fait quoi — page d'accueil avec deux boutons, redirection vers `app.*`, ou on le retire ?
