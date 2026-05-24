# Infrastructure emails Kadence — 14 templates + preview

Implémentation exacte des specs que tu m'as données. Je résume ce qui sera créé pour validation finale.

## Dépendances

```
bun add @react-email/components @react-email/render
```

(Les packages `@react-email/components` sont déjà partiellement installés via le scaffold auth — je vérifie et ajoute uniquement ce qui manque, notamment `@react-email/render` standalone.)

## Fichiers créés

### Layout commun
- `src/emails/layout/EmailLayout.tsx` — Html/Head/Body shell, header noir avec logo Kadence (texte serif pour fiabilité, pas de PNG externe pour l'instant), body blanc 32px padding, footer gris #FAFAFA avec mention studio + lien politique. Props : `children`, `studioName?`.

### 9 templates employé (`src/emails/employee/`)
1. `InvitationEmployeEmail.tsx`
2. `ResetPasswordEmail.tsx`
3. `ShiftAssigneEmail.tsx`
4. `PropositionShiftEmail.tsx` (encadré coral)
5. `DemandeAccepteeEmail.tsx`
6. `DemandeRefuseeEmail.tsx`
7. `PlanningPublieEmail.tsx`
8. `RappelShiftEmail.tsx`
9. `DebriefingShiftEmail.tsx` (le plus riche : durée + points + score + commentaire manager)

### 5 templates admin (`src/emails/admin/`)
10. `NouvelleDemandeEmail.tsx`
11. `TrouCritiqueEmail.tsx` (encadré rouge)
12. `EmployeRetardEmail.tsx` (encadré orange)
13. `QuotaEtudiantDepasseEmail.tsx`
14. `NouvelleInscriptionEmail.tsx`

Chacun : H1 + paragraphes + CTA coral `#FF6B5B`, wrappé dans `<EmailLayout>`. Subject exporté comme constante nommée à côté du composant default export. Styles inline (pas de `var(--xxx)`, les emails ne lisent pas les CSS variables).

### Registry et envoi
- `src/emails/index.ts` — `EMAIL_REGISTRY` typé avec les 14 entrées + mockData réaliste (Léa, Sacha, Skult Châtelain, dates plausibles)
- `src/lib/email.functions.ts` — `sendEmail` server function avec `requireSupabaseAuth`, valide via Zod, render le template, **stub** qui log dans la console (pas de provider branché pour l'instant)

### Page preview admin
- `src/routes/admin.email-preview.tsx` — Route TanStack à `/admin/email-preview` :
  - Sidebar gauche : 2 sections (Employé / Admin) avec liste cliquable
  - Panneau central : nom + description + sujet + JSON mockData
  - Panneau droit : iframe avec srcDoc = HTML rendu du template sélectionné
  - `render()` est async → wrappé dans `useEffect` + `useState` (la spec mentionne déjà cette adaptation)
  - Style cohérent avec le reste de l'app Kadence (off-white, Inter, bordures fines)

## Règles respectées

- Tous les templates utilisent `EmailLayout` (cohérence header/footer)
- Couleurs en dur (pas de CSS vars)
- `<Button>` et `<Link>` de `@react-email/components`
- Container 560px max, mobile-friendly
- `sendEmail` est un **stub console.log** — aucun email réel n'est envoyé pour l'instant
- Pas de wiring sur les triggers existants (`shifts`, `demandes`, `notifications`, etc.) — uniquement l'infrastructure de templates + preview

## Hors-scope (étape suivante)

- Brancher `sendEmail` sur Lovable Email queue (`enqueue_email` via RPC)
- Brancher les triggers réels (insert shift → ShiftAssigne, publish planning → PlanningPublie, etc.)
- Supprimer la vieille edge function `send-invitation`
- Cohabitation avec les templates auth déjà scaffolés dans `src/lib/email-templates/` — on garde les deux dossiers séparés pour l'instant (`src/emails/` = nouveaux templates app, `src/lib/email-templates/` = auth Supabase). On consolidera si besoin une fois la validation faite.

## Validation

Une fois construit, tu vas sur `/admin/email-preview`, tu cliques chaque template dans la sidebar, et tu vois le rendu HTML final dans l'iframe avec les mockData. Tu me dis quoi ajuster avant qu'on branche les vrais déclencheurs.
