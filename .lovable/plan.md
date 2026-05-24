# Emails Kadence — plan d'implémentation

Tu m'as confirmé :

- Domaine : **shyft.flashsite.fr** (sous-domaine `notify.shyft.flashsite.fr` pour l'envoi)
- 4 événements à brancher : invitation, notifs urgentes, planning publié, demandes/swaps
- Fréquence : 1 email par événement (instantané)

L'idée : on pose **l'infra une bonne fois**, puis on construit les 4 templates **un par un, ensemble**, pour que tu valides chaque design avant qu'on passe au suivant.

---

## Étape 0 — Préparer le domaine d'envoi (one-shot, ~5 min)

Tu cliques sur le bouton de config, tu colles `shyft.flashsite.fr`, tu choisis `notify` comme sous-domaine. Tu vas chez ton registrar (OVH/Cloudflare/etc.) et tu colles 2 lignes NS que je te donnerai. Vérif DNS automatique (24–72h max, souvent en quelques minutes).

Ensuite je mets en place automatiquement :

- La file d'attente d'emails (retry auto en cas d'erreur réseau, anti-spam)
- La table de désinscription (1-clic, conforme RGPD)
- Le log d'envois (qui a reçu quoi, statut livraison)
- La page `/unsubscribe` brandée Skult

---

## Étape 1 — Charte visuelle email (avant tout template)

Je crée un **template de base partagé** avec :

- Fond blanc cassé `#FAFAF8`
- Logo Kadence en header
- Typo Inter, accent coral `#F0997B`
- Footer signature «   Kadence — Skult Studios » + lien désabo
- Boutons d'action coral, rayon 8px, pas d'emoji, pas de majuscules
- Responsive mobile (90% des employés ouvrent sur tel)

Ce template sera réutilisé par les 4 emails — on garantit une cohérence visuelle.

---

## Étape 2 — On code les 4 templates ensemble, 1 par 1

À chaque template, je te montre :

1. Le déclencheur exact (« cet email part quand X se passe »)
2. Le sujet de l'email
3. Le contenu (titre, corps, CTA)
4. Une preview du rendu

Tu valides → je passe au suivant.

### Template A — Invitation employé

- **Déclenche** : admin clique « Inviter » dans Staff
- **Destinataire** : nouveau collaborateur
- **Existe déjà** (edge function `send-invitation` avec HTML inline) → **on refait propre** via le système Lovable, lien d'activation conservé
- **Sujet** : « Bienvenue chez Skult — active ton compte »
- **CTA** : bouton coral « Activer mon compte » + lien fallback

### Template B — Notification urgente / RH

- **Déclenche** : nouvelle ligne dans `notifications` avec `priority = 'urgent'`
- **Destinataire** : l'employé concerné
- **Sujet** : « [Urgent] {titre de la notif} »
- **Contenu** : titre + corps de la notif + bouton « Ouvrir dans Kadence » vers le lien associé
- **Anti-spam** : 1 seul email par notif, jamais de double envoi

### Template C — Planning publié

- **Déclenche** : admin clique « Publier le planning » (workflow `planning-workflow`)
- **Destinataire** : chaque employé qui a au moins 1 shift dans la semaine publiée
- **Sujet** : « Ton planning de la semaine du {date} »
- **Contenu** : récap des shifts (jour, heure, studio, poste) + CTA « Voir mon planning »
- **Anti-spam** : 1 email par employé par publication, même si republication

### Template D — Demandes & propositions de swap

3 sous-cas dans le même template, variante par type :

- **D1** : nouvelle proposition reçue → « {Prénom} te propose un échange de shift »
- **D2** : ta demande de modif est validée → « Ta demande du {date} est acceptée »
- **D3** : ta demande de modif est refusée → « Ta demande du {date} n'a pas été retenue »
- **CTA** : bouton « Répondre » / « Voir le détail »

---

## Étape 3 — Logs & contrôle

Après publication, dans **Cloud → Emails** tu pourras voir :

- Qui a reçu quoi, quand
- Échecs (mauvaise adresse, boîte pleine)
- Liste des désabonnés (auto-bloqués pour les futurs envois)

Les emails d'activation/invitation **passent toujours** même si l'employé s'est désabonné des notifs (légalement nécessaires).

---

## Détails techniques (pour mémoire)

- Stack : Lovable Emails (Mailgun derrière, géré par Lovable) — pas de clé API à gérer, pas de Resend manuel
- Code des templates : React Email (`.tsx`) dans `src/lib/email-templates/`
- Envoi : appel à `/lovable/email/transactional/send` via un helper `sendTransactionalEmail()` côté serveur
- L'edge function `send-invitation` actuelle sera migrée vers ce nouveau flow puis supprimée
- Chaque envoi a un `idempotencyKey` → impossible d'envoyer 2x le même email même en cas de retry

---

## Ce que je te demande maintenant

Approuve ce plan, et je commence par **Étape 0 (domaine)** + **Étape 1 (template de base brandé)**. Une fois le domaine en vérification, on enchaîne directement sur le **Template A (invitation)** ensemble, et on valide design + texte avant de passer aux suivants.