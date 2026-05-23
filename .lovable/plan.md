## Objectif

Rendre `/display/:studioId` totalement standalone : aucune sidebar, aucun TopBar, aucune redirection auth. C'est un écran kiosque pour l'ordi de caisse — l'employé ne doit pas pouvoir naviguer vers l'admin.

## Changement

`**src/routes/__root.tsx` — `AppShell**`

1. Ajouter une détection :
  ```ts
   const isDisplay = currentPath.startsWith("/display");
  ```
2. **Court-circuiter avant tout le reste** (avant le `useEffect` de redirection auth, avant le check `loading`) :
  ```tsx
   if (isDisplay) {
     return <Outlet />;
   }
  ```
   → Pas de sidebar, pas de TopBar, pas de Toaster, pas de redirection vers `/login`, pas de check de rôle. La page QR s'affiche brute, peu importe qu'une session admin existe ou non sur cet ordi.
3. Bonus : retirer le bouton "Afficher le QR" de `/studios` n'est PAS nécessaire — l'admin l'utilise pour ouvrir l'écran dans un nouvel onglet sur la caisse, puis ferme son onglet admin. L'URL `/display/:studioId` reste partageable / bookmarkable directement sur l'ordi de caisse sans jamais exposer l'interface admin.

## Hors scope

- Pas de changement à l'API `/api/public/studio-qr/:studioId` (déjà publique).
- Pas de changement visuel à la page `/display/:studioId`.
- Pas de touche au flow employé `/staff-app`.

## Usage côté Sacha

1. Sur l'ordi de caisse du studio, ouvrir directement `https://admin.shyft.flashsite.fr/display/<STUDIO_ID>` (ou utiliser le bouton "Afficher le QR" depuis `/studios` puis fermer l'onglet admin).
2. L'URL peut être mise en favori / page d'accueil du navigateur.
3. L'employé voit uniquement le QR + le code manuel, aucun moyen d'accéder à l'admin.  
  
ce que je veux cest que du cote admin je recois un url propo ou je pourrai lenvoyer au manager des studio pour quil ouvre sur lrodi mais un rul ou ya que le qr code rien dautre pas dacces a autre chose 