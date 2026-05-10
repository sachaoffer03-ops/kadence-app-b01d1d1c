## Refonte interface employée

### 1. Accueil (`/staff-app`)
- **Carte « Prochain shift »** devient cliquable → ouvre la sheet détail (heures, poste, studio, notes, checklist, handoff précédent, bouton fin de shift).
- Affichage des **3 prochains shifts** (au lieu d'un seul) cliquables.
- Bloc **« À faire »** : formations non terminées + demandes en attente de réponse admin.

### 2. Formation (employée + admin)
- Côté employée : la sheet « Formations » liste les **parcours** (`training_paths`) avec leurs **modules** (`formations`) et la progression. Si vide, message d'invitation.
- Si la base est vide, je seed automatiquement 2 parcours fictifs (Onboarding Barista, Sécurité Cuisine) avec 3 modules chacun pour que ça s'affiche immédiatement.

### 3. Demande de modification (sélection du shift)
- Nouveau champ obligatoire **« Quel shift ? »** : dropdown des shifts à venir (date + heure + poste).
- L'urgence est calculée automatiquement selon la date du shift (>72h = normal, 24-72h = urgent, <24h = critique) mais reste modifiable.
- Stockage du `shift_id` en base (déjà supporté par la table).

### 4. Dispos — page dédiée `/staff-app/dispos`
- Page séparée avec **bandeau d'explication clair** : « Une fois par mois, indique tes créneaux de disponibilité pour le mois suivant. Tu pourras ensuite faire des demandes de modification ponctuelles. »
- **Calendrier mensuel** (mois suivant par défaut) : pour chaque jour, choix matin / midi / soir.
- État « verrouillé » si la fenêtre d'envoi est passée (pour l'instant simulé : toujours ouvert, je laisse un bouton « Envoyer mes dispos » qui horodate).
- Bouton « Voir les dispos du mois en cours » en consultation.

### 5. Profil employée (refonte)
La sheet profil devient un écran complet en **onglets** :
- **Informations** : identité, contrat, contact urgence, IBAN/NISS (lecture seule, demander modif via chat).
- **Formations** : parcours en cours + complétés, badges.
- **Mes documents** : fiches de paie, contrat, attestations (3 docs fictifs téléchargeables).
- **Notifications** : liste fictive (nouveau planning, réponse à une demande, nouveau message admin) — marquables comme lues.
- **Paramètres** : avatar, mot de passe, déconnexion.

### 6. Chat admin ↔ employé (NOUVEAU)
- **Nouvelle table** `messages` (id, sender_id, recipient_id, content, read_at, created_at) avec RLS : chacun voit ses propres conversations.
- **Realtime activé** sur la table.
- **Côté employée** : nouvel onglet **« Messages »** dans la sheet profil + accès rapide depuis l'accueil. Conversation 1-à-1 avec l'admin (Sacha pour l'instant).
- **Côté admin** : nouvelle entrée sidebar **« Messages »** → liste des conversations à gauche, fil de messages à droite, indicateur non lus.
- Pas de pièce jointe pour l'instant (V2).

---

### Détails techniques
- Migration : nouvelle table `messages` + RLS + realtime + index sur `(sender_id, recipient_id)` et `created_at`.
- Seed automatique des `training_paths`/`formations` si vides (2 parcours × 3 modules) + quelques documents fictifs et notifications fictives stockés en mémoire (pas de table — trop tôt).
- Côté employée : `staff-app.tsx` est déjà gros — j'extrais les onglets en sous-composants (`StaffHome.tsx`, `StaffPlanning.tsx`, `StaffDispos.tsx`, `StaffProfile.tsx`, `StaffMessages.tsx`).
- Côté admin : nouvelle route `/messages.tsx`, ajout dans `AppSidebar.tsx`.
- Synchro temps réel via canal Supabase (déjà utilisé sur les autres pages).

---

### Hors scope (à voir plus tard)
- Verrouillage temporel réel des dispos (24-48h fenêtre par mois) — nécessite une table `availability_windows` pilotée par l'admin. Pour l'instant la page est toujours accessible.
- Pièces jointes / images dans le chat.
- Push notifications.
- Vraies fiches de paie / contrats stockés (storage).

Tu valides et je fonce ? Si tu veux qu'on découpe (ex. faire chat en dernier), dis-moi.