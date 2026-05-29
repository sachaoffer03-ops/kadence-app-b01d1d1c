## Objectif

Sur la page **Pointage** (admin/manager), permettre d'éditer les horaires de **pointage entrée** et **pointage sortie** d'un shift, même après la fin du shift (statut « Terminé »), avec audit complet et raison obligatoire.

## Pourquoi

Aujourd'hui l'admin peut :
- pointer manuellement un employé à l'arrivée / au départ (si pas encore fait)
- éditer le « retard » en minutes
- ajouter une note admin

…mais ne peut **pas corriger** un horaire de pointage déjà enregistré (ex : employé arrivé à 9h05 mais a oublié de scanner, ou pointage parti en double, ou clôture trop tardive).

## UI — page /pointage

Sur chaque ligne shift, dans le menu d'actions admin existant, ajouter :

- **« Modifier les pointages »** (visible si `clocked_in_at` OU `clocked_out_at` est rempli)

Ouvre une `Dialog` « Modifier les pointages » avec :

```text
Employé · Studio · Date du shift  (lecture seule)
Prévu : 09h00 – 17h00              (lecture seule, contexte)

Heure d'arrivée   [ 09:05 ]        ← <input type="time">  (vide = effacer)
Heure de sortie   [ 17:12 ]        ← <input type="time">  (vide = effacer, désactivé si pas d'arrivée)

Recalculer le retard automatiquement   [✓]   (par défaut coché)

Raison de la modification *
[ textarea, 5-500 caractères, obligatoire ]

[ Annuler ]                        [ Enregistrer ]
```

Règles UX :
- Les deux inputs sont préremplis avec les valeurs actuelles (HH:mm local Bruxelles).
- La **date** est figée sur `shift_date` — pas d'édition cross-day (cas marginal, à demander plus tard si besoin).
- Validation côté UI : `out ≥ in` ; si l'utilisateur vide l'arrivée, on vide aussi la sortie automatiquement.
- Toast succès + invalidation de la query `pointage-today` ; ligne mise à jour, badge statut recalculé.

## Backend — nouveau server function

Ajouter dans `src/lib/pointage.functions.ts` :

```text
editClockTimesFn (POST, requireSupabaseAuth)
  input (zod):
    shiftId: uuid
    clockedInTime: string | null    // "HH:mm" ou null pour effacer
    clockedOutTime: string | null   // "HH:mm" ou null pour effacer
    recomputeLate: boolean
    reason: string (min 5, max 500)
  handler:
    - assertAdminOrManager
    - charge le shift (shift_date, start_time, end_time, clocked_in_at, clocked_out_at, minutes_late)
    - construit les ISO complets en combinant shift_date + HH:mm (timezone wall-clock Bruxelles, cohérent avec le reste du moteur)
    - règles :
        * out non null ⇒ in non null
        * out >= in
        * si in null ⇒ out null + status repasse à "scheduled"
        * si in non null + out non null ⇒ status = "completed"
        * si in non null + out null ⇒ status = "scheduled" (en cours)
    - si recomputeLate ET in non null : recalcule minutes_late = max(0, in - start_time)
      sinon : ne touche pas à minutes_late
    - UPDATE shifts (clocked_in_at, clocked_out_at, status, minutes_late)
    - writeAudit avec action "edit_clock_times", before/after complets, note = reason
    - retourne { ok: true, clockedInAt, clockedOutAt, minutesLate, status }
```

La RLS existante (admins/managers gèrent les shifts) suffit. Pas de migration DB nécessaire (toutes les colonnes existent déjà : `clocked_in_at`, `clocked_out_at`, `minutes_late`, `status`, `clock_admin_note`).

## Audit

Le helper `writeAudit` existant trace déjà l'action. L'historique affiché par `getShiftAuditHistoryFn` (déjà branché sur la modale d'audit) montrera automatiquement le nouvel évènement `edit_clock_times` — il suffit d'ajouter le libellé FR dans la table de mapping côté UI audit.

## Fichiers touchés

- `src/lib/pointage.functions.ts` — ajout de `editClockTimesFn`
- `src/routes/pointage.tsx` — nouveau bouton + composant `EditClockTimesDialog` + libellé audit
- Aucune migration DB

## Hors périmètre (à confirmer plus tard si besoin)

- Édition cross-day (pointage qui déborde sur le lendemain)
- Édition en lot
- Le futur système d'incompatibilités entre employés (sujet précédent) — sera traité après celui-ci.
