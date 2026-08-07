# Application mobile employés (App Store + Google Play)

Objectif : les employés gardent le site `app.kadence.be` comme aujourd'hui, et en plus ils peuvent télécharger une vraie application Kadence sur iPhone et Android, avec des notifications push.

## L'approche

L'app mobile affiche exactement la même interface employé que le site, encapsulée dans une vraie application native (via Median.co, déjà partiellement préparé dans le projet). Avantages : un seul code à maintenir, chaque mise à jour du site est immédiatement visible dans l'app, sans repasser par la validation des stores.

Ce que l'app apporte en plus du site :
- icône sur l'écran d'accueil, ouverture plein écran sans barre de navigateur
- notifications push (nouveau planning publié, shift proposé, trous à combler, rappel de shift, rappel de dispos)
- session qui reste ouverte durablement (pas de reconnexion tous les 2 jours)
- géolocalisation native plus fiable pour le pointage
- bouton retour Android géré proprement

## Ce qui est déjà en place

- détection du contexte app (`is-median-app.ts`), bouton retour Android, géolocalisation sécurisée, safe-areas
- deep links iOS/Android déjà déclarés
- squelette de notifications push présent mais inactif (identifiant OneSignal manquant)
- page confidentialité et suppression de compte (exigées par les stores)

## Le travail à faire

### 1. Notifications push (le coeur du sujet)
- brancher OneSignal : enregistrement de l'appareil à la connexion, table des abonnements liée au profil employé
- envoyer une push en même temps que les notifications déjà existantes : planning publié, shift proposé, shift attribué, trous ouverts à tous, rappel de shift, rappel de dispos
- tap sur la notification → ouverture directe de l'écran concerné dans l'app
- réglage dans le profil employé pour choisir quelles notifications recevoir
- désinscription automatique à la déconnexion (pour ne pas envoyer les pushs d'un employé à un autre sur un téléphone partagé)

### 2. Finitions app
- écran de démarrage (splash) et icône Kadence aux formats iOS/Android
- gestion hors-ligne : message clair quand il n'y a pas de réseau au lieu d'une page blanche
- demande de permission notifications au bon moment (après la première connexion, pas au tout premier lancement — sinon beaucoup de refus)
- pull-to-refresh natif sur les écrans principaux

### 3. Préparation des stores
- page de politique de confidentialité et de suppression de compte accessibles publiquement (déjà faites, à vérifier)
- textes de fiche store, captures d'écran, description
- déclaration des données collectées (localisation, e-mail) pour Apple et Google

## À prévoir de ton côté

Ces étapes ne peuvent pas se faire depuis le code :
- compte Apple Developer (99 $/an) et compte Google Play Developer (25 $ une fois)
- compte Median.co pour générer les binaires iOS/Android (formule payante pour publier)
- compte OneSignal (gratuit jusqu'à un large volume) — il me faudra l'identifiant d'application
- validation Apple : compter 1 à 2 semaines pour la première soumission

## Détails techniques

- Wrapper : Median.co pointant sur `https://app.kadence.be`, mode employé forcé
- Push : OneSignal (natif Median côté iOS/Android), `ONESIGNAL_APP_ID` renseigné dans `src/lib/push-notifications.ts`
- Nouvelle table `push_subscriptions` (user_id, player_id, platform, updated_at) avec RLS par utilisateur
- Envoi serveur via une server function appelée depuis les points d'émission de notification existants (`notifications.server.ts`), clé API OneSignal stockée en secret
- Deep links déjà déclarés dans `.well-known/apple-app-site-association` et `assetlinks.json`
- Aucun service worker ajouté : les pushs passent par le canal natif Median, pas par le web
