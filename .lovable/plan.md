## Objectif

Rendre le générateur plus utile sans surcharger : (1) toujours voir le résultat avant que ça touche la vraie base, (2) comparer 2 essais côte à côte et publier le meilleur en 1 clic.

Principe UX : un seul écran, gros chiffres lisibles, 2 boutons max (Publier / Refaire).

---

## 1. Aperçu avant publication

Aujourd'hui `/planning/generate` écrit directement les shifts en base. On passe à un flux en 2 temps :

**Étape A — Simuler (par défaut)**
- Le bouton principal devient "Prévisualiser" (au lieu de "Générer").
- Sous le capot : appel `generatePlanning` en mode `dry_run: true, silent: true` (déjà supporté).
- Rien n'est écrit en base, rien n'apparaît dans l'historique.

**Étape B — Écran de résultat**
Un seul écran, 3 blocs visuels :

```text
┌─────────────────────────────────────────────┐
│  Août 2026 · Rhode + Châtelain             │
├─────────────────────────────────────────────┤
│  ✓ 87 shifts remplis    ✕ 4 trous restants │
│  ⚖ Équité : bonne       ⏱ 312h planifiées  │
├─────────────────────────────────────────────┤
│  🔴 4 trous à combler                      │
│    • Sam 8 août 07-12  Rhode Barista       │
│    • Dim 9 août 14-19  Châtelain Accueil   │
│    ...                                      │
│                                             │
│  🟡 3 employés sous-utilisés               │
│    • Lucas : 12h / 40h dispo               │
│    ...                                      │
├─────────────────────────────────────────────┤
│  [Refaire]              [Publier ce plan]  │
└─────────────────────────────────────────────┘
```

- **Publier** = re-run en mode `dry_run: false`, écriture réelle. Toast de succès, redirection vers `/planning`.
- **Refaire** = retour au formulaire, paramètres conservés.

**Pourquoi utile** : Sacha n'a plus jamais peur de "casser" le planning en cliquant. Le résultat est visible AVANT que ce soit publié.

---

## 2. Comparer 2 scénarios

Sur l'écran d'aperçu, un bouton discret : **"Comparer avec une autre config"**.

Ouvre un panneau latéral (droite) avec les mêmes filtres (whitelist, exclusions, studios). Le user modifie, clique "Lancer le comparatif" → 2e simulation.

**Écran comparaison** :

```text
┌──────────────── Scénario A ─────┬──────────── Scénario B ────────┐
│ Sans Anaïs                       │ Avec Anaïs + Marie prioritaire │
├──────────────────────────────────┼─────────────────────────────────┤
│ Trous       4  🔴                │ Trous       1  🟢              │
│ Équité      bonne                │ Équité      moyenne            │
│ Heures      312h                 │ Heures      328h               │
│ Étudiants   ok (450/650)         │ Étudiants   ok (490/650)       │
├──────────────────────────────────┼─────────────────────────────────┤
│ [Publier A]                      │ [Publier B]  ← recommandé      │
└──────────────────────────────────┴─────────────────────────────────┘
```

- Le "recommandé" est calculé simplement : moins de trous > meilleure équité > respect quotas.
- Un seul clic publie le scénario choisi ; l'autre est jeté.

**Pourquoi utile** : le user teste "et si..." sans risque, et voit noir sur blanc quel choix est le meilleur.

---

## Fichiers touchés (léger, ciblé)

- `src/routes/planning.generate.tsx` — Refonte du flux : bouton "Prévisualiser" par défaut, nouvel état `previewResult`, écran résultat, panneau comparatif.
- Réutilisation directe de ce qui existe déjà :
  - `generatePlanning({ dry_run, silent })` — déjà en place
  - Composants d'affichage de résultat de `/admin/planning-sandbox` (trous, sous-utilisés) — on extrait 2-3 composants partagés dans `src/components/planning/PreviewResult.tsx`.
- Rien côté serveur, rien en BDD, aucune migration.

## Ce qu'on NE fait PAS (pour rester simple)

- Pas de sauvegarde des scénarios (éphémère, disparaît si on quitte la page).
- Pas de comparaison à 3+ scénarios (A vs B suffit).
- Pas de diff shift-par-shift entre A et B (juste les KPIs et la liste des trous).
- L'admin sandbox (`/admin/planning-sandbox`) reste pour les cas power-user avancés, on ne fusionne pas les deux pour l'instant.

## Résultat attendu

Sacha ouvre `/planning/generate`, coche Rhode + Châtelain, clique **Prévisualiser**. Il voit "4 trous, équité bonne". Il clique **Comparer**, ajoute Marie en whitelist, relance. Scénario B a 1 trou et est marqué recommandé. Clic sur **Publier B**. Terminé, planning en ligne. Zéro trace des scénarios rejetés.
