# Plan: minimum usable monthly bills

Status: revised proposal, before implementation.
Specification: `docs/specs/recurring-bills-monthly.md`.
Tasks: `docs/future-plans/recurring-bills-monthly-tasks.md`.

## Delivery

One usable release, built in three increments; cards, historical reconstruction,
AI and instalments are not dependencies.

1. Monthly read and UI: reuse recurrence/overrides, establish tracking coverage,
   list selected month and calculate total/paid/outstanding on the server.
2. Monthly edit and reservation: use existing overrides, add durable reservation
   metadata and a short amount dialog. No ignore/reactivate in this release.
3. Selected-occurrence payment: reuse financial creation and posting claims,
   preserve expected amount, handle past/future slots and verify concurrency,
   cursor behavior and transaction lifecycle before enabling payment controls.

The result must support create -> month navigation -> amount edit -> reserve ->
pay -> reload with persistent history. A read-only monthly screen is not the
completed release. Do not add generic architecture for deferred features.

## Changes that are necessary

- `backend/src/scheduled-transactions/`: monthly read/DTOs, a focused command
  helper for supported plain monthly expenses, occurrence-state entity,
  tracking boundary, shared snapshot/claim integration and lifecycle validation.
- `backend/src/scheduled-transactions/scheduled-occurrence.service.ts` and
  `backend/src/common/scheduled-occurrences.ts`: reuse selection, exclude claimed
  future slots and include recorded reopened slots. No browser recurrence engine.
- `backend/src/scheduled-transactions/schedule-cursor.ts`: reuse consecutive
  claimed-slot advancement, not an independent monthly cursor.
- `backend/src/scheduled-transactions/scheduled-transaction-override.service.ts`:
  share validated edits; protect paid tracked slots and stale mutations.
- `database/schema.sql` and one new migration in `database/migrations/`:
  additive tracking/state storage with indexes, constraints and tenant policy.
  Register new state in backup/restore and test its round trip.
- `frontend/src/app/recurring-bills/page.tsx`: compose small components for
  navigation, summary, list, creation and short amount/payment dialogs.
- `frontend/src/lib/scheduled-transactions.ts` and
  `frontend/src/types/scheduled-transaction.ts`: monthly contracts and invalidation.
- Existing /bills write entry points: targeted protections for tracked schedules,
  no redesign of that screen or unsupported posting branches.
- Locale catalogs, feature tests and user documentation under `website/docs/`.

Reuse CalendarMonthNav, useFinancialToday, useNumberFormat, CurrencyInput,
DateInput, Modal, Badge and EmptyState. Keep requests keyed to the selected month.

## Deliberate exclusions

No card integration, historic invoice model, reconstruction of old skips/payments,
transaction matching/association, AI, instalments, partial payments,
ignore/reactivate, pause/resume versioning or editing defaults for future series.
Monthly amount edits are sufficient for the first release. Close future
recurrence without deleting the recorded schedule/history.

Existing compatible schedules are adopted explicitly at a known tracking start,
not duplicated or silently reinterpreted. Before that boundary, say history is
not tracked. Ordinary manual transactions are not automatically recognized as
occurrence payments; disclose this before a second entry is made.

## Validation

Read applicable layer/financial/concurrency/test contracts before implementation;
commit the approved specification first. Run focused tests while developing and
changed tests per layer. Real database tests cover RLS, lock/claim races,
rollback, backup/restore and history persistence; run database suites serially.

Before push, run the backend lint/typecheck/build/integration gates and frontend
lint/type-check/i18n:check/changed-tests/build gates from AGENTS.md. For the
migration run migration:lint:test and migration:lint from backend, then
`scripts/verify-schema.sh` and `node scripts/check-migration-prefixes.mjs` at root.
Run `node scripts/check-docs-manifests.mjs` and environment checks as applicable.
Update user docs/screenshots with the existing workflow. Do not weaken guards
or erase unrelated local changes to get a green result.

Completion evidence is the full create/edit/reserve/pay/reload flow plus a
concurrent duplicate-post test and correct month totals, not just a rendered UI.

## Onboarding addition: bounded scope

Include in the same minimum usable release:

- A quick-create account dialog on Contas Fixas using existing accountsApi.create,
  with name, basic compatible type, currency and explicit starting balance.
  No account endpoint or account-less scheduling redesign.
- An optional initial planning amount for the selected month. One small separate
  monthly-budget entity/table, not a record per bill and not a hidden category
  budget. It requires a paired migration/schema update, RLS, uniqueness,
  revision-aware read/save/remove, backup registration and tests.
- Budget and remainder fields in the monthly read model, with independent
  completeness. Reuse existing money/FX helpers. No bank-balance fallback.
- A short budget dialog and an onboarding message distinguishing a financial
  account from an optional monthly allocation. Preserve bill form state while
  creating the account and select the returned id.

Existing code inspected: accounts create DTO/service and frontend accounts API;
scheduled create DTO's required accountId; budget/period entities and create DTO.
The account API already handles basic accounts. The category budgeting subsystem
is not a drop-in store for an independent per-month allocation; adapting its
period/activity logic would add scope without serving the requested flow.

Implement the planning record alongside monthly-read persistence; it does not
need to wait for the payment dialog, but the release still requires the full
payment workflow. Account onboarding is a frontend integration of the existing
service, with its own failure/retry tests. Budget writes require real persistence,
isolation and no-ledger-effect tests. See the spec's examples for the formula.

Still excluded: bills without accounts, draft-to-financial conversion, real bank
connections, bank-derived spending capacity, recurring budgets, advanced budget
categories and bank balance reconciliation. No implementation has begun.
