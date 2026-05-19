# Page Rapports — Plan d'implémentation

## 1. Sidebar + routing

- `src/components/AppSidebar.tsx` : ajouter entrée **Rapports** (icône `BarChart3`) dans la section PILOTAGE, entre Dashboard et Planning, visible admin/manager seulement (même règle que les autres entrées de pilotage).
- `src/routes/rapports.tsx` : nouvelle route. Garde admin/manager via `useAuth` ; sinon `navigate({ to: "/staff-app" })`.

## 2. Filtres globaux (mémorisés en URL via `validateSearch`)

Search params : `from`, `to`, `preset` (today|yesterday|week|month|30d|custom), `studios` (csv uuids), `roles` (csv uuids), `view` (overview|employees|shifts).

Barre haut : preset Dropdown + DateRangePicker (Popover + 2 Calendar shadcn) + multi-select Studios + multi-select Rôles + bouton **Exporter CSV** à droite. Tabs shadcn pour basculer entre les 3 vues (synchronisées avec `view`).

## 3. Server functions — `src/lib/reports.functions.ts`

Toutes avec `requireSupabaseAuth` + helper `assertAdminOrManager(supabase, userId)`. Input Zod : `{ from, to, studioIds?, roleIds? }`.

- `getOverviewKpis` — counts completed vs scheduled, score moyen équipe (avec sparkline 30j en sous-requête `date_trunc('day')`), payroll (sum hours * hourly_rate, exclut hourly_rate NULL et renvoie `employeesWithoutRate`), checklist completion % (avg done/total par submission).
- `getTopAndBottomPerformers` — top 5 et bottom 5 (≥3 shifts sur période), avec score période actuelle vs période précédente (delta).
- `getRecentActivity` — 20 derniers shifts `status=completed`, joints sur profiles + studios.
- `getEmployeesReport` — agrégation par user : nb shifts, heures, coût, score actuel, Δ vs période précédente, last clôture.
- `getEmployeeDetail` — sparkline 90j, breakdown 3 sous-scores (réutilise logique de `calculate_profile_score` simplifiée côté SQL), 10 derniers shifts, gains total, quota étudiant si contract='student'.
- `getShiftsReport` — tous shifts completed, retard, % checklist, photos validées count.
- `getShiftDetail` — items checklist, photos avec validation, **réponses `closure_question_responses`** (RLS bloque déjà les autres rôles), breakdown score du shift, gain €.

Toutes mappées en DTO sérialisables.

## 4. Migration — indexes manquants

Une migration légère `add_reports_indexes` :

```sql
CREATE INDEX IF NOT EXISTS idx_shifts_status_date ON public.shifts (status, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON public.shifts (user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_studio_date ON public.shifts (studio_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_checklist_subs_user ON public.checklist_submissions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_closure_resp_sub ON public.closure_question_responses (submission_id);
```

Pas de schema change métier ; juste perf.

## 5. UI — `src/routes/rapports.tsx`

Une seule route, 3 sous-composants : `OverviewView`, `EmployeesView`, `ShiftsView`. Chacune utilise `useQuery` (staleTime 5 min, pas de refetchOnWindowFocus) via `useServerFn`.

### Overview
- Grille 4 KPI cards (`grid-cols-2 md:grid-cols-4`) : Shifts clôturés, Score moyen équipe (couleur conditionnelle vert/orange/rouge + sparkline recharts `LineChart` 80×24), Coût payroll (+ avertissement employés sans tarif), Taux complétion checklists (+ sparkline).
- Sous : 2 colonnes (`md:grid-cols-2`) Top 5 / À surveiller. Avatar + nom + score + delta coloré + raison.
- En bas : Activité récente, 20 lignes timeline ; clic → `setView("shifts")` + ouvre detail sheet sur le shiftId.

### Employees
- Table shadcn desktop, cards stack `md:hidden` sur mobile.
- Tri client sur les colonnes (useState `{ key, dir }`).
- Bouton "Voir détail" → `Sheet` (side=right, w-full sm:max-w-xl) qui appelle `getEmployeeDetail`. Contient sparkline 90j (recharts), 3 BarChart horizontales pour sous-scores, table 10 derniers shifts, carte Gains, badge quota étudiant si applicable, lien `/staff/$id`.

### Shifts
- Table tous shifts. Mobile = cards.
- Clic ligne → `Sheet` qui appelle `getShiftDetail`. Sections : Pointages, Checklist (items + photo si liée, click photo = lightbox simple `Dialog`), Photos (grille), **Réponses post-shift** avec bandeau coral `🔒 Confidentiel`, Score gagné (breakdown), Gains. Boutons "Voir l'employé" et "Voir dans planning" (Link to `/planning` avec query `?shift={id}` — pas besoin de modifier planning pour ce prompt, le param sera juste là).

## 6. Export CSV

`src/lib/csv.ts` helper `toCsv(rows, columns) → string` + `downloadCsv(filename, csv)`. Le bouton "Exporter CSV" appelle la même server function que la vue courante (`getOverviewKpis` → flatten en KV, `getEmployeesReport` direct, `getShiftsReport` SANS les réponses confidentielles), génère CSV et déclenche download. Nom : `kadence-rapport-{view}-{from}-{to}.csv`.

## 7. Design

- Tokens existants uniquement (`var(--card)`, `var(--border)`, `var(--coral)`, `var(--success-text)` etc.).
- Pas d'emoji décoratif ; l'icône cadenas vient de lucide (`Lock`).
- Skeletons shadcn pendant chargement.
- Couleurs sémantiques pour les deltas score (vert ↑, rouge ↓, gris =).

## 8. À NE PAS toucher

`/cloture`, `ClosureFlow`, `scoring.functions.ts`, page Feedbacks. Pas de nouvelle page "Règles de scoring".

## Récap fichiers

Création :
- `src/routes/rapports.tsx`
- `src/lib/reports.functions.ts`
- `src/lib/reports.server.ts` (helpers SQL + types DTO partagés)
- `src/components/reports/OverviewView.tsx`
- `src/components/reports/EmployeesView.tsx`
- `src/components/reports/ShiftsView.tsx`
- `src/components/reports/EmployeeDetailSheet.tsx`
- `src/components/reports/ShiftDetailSheet.tsx`
- `src/components/reports/FiltersBar.tsx`
- `src/components/reports/KpiCard.tsx`
- `src/components/reports/Sparkline.tsx`
- `src/lib/csv.ts`
- 1 migration `add_reports_indexes`

Modifs :
- `src/components/AppSidebar.tsx` (1 entrée)

Volume estimé ~1400 lignes. Pas de nouvelles deps (recharts, shadcn Sheet/Tabs déjà là).