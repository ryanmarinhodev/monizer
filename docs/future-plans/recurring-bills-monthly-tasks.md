# Minimum monthly bills task list

Status: scope revised; implementation has not started.
Spec: `docs/specs/recurring-bills-monthly.md`.
Plan: `docs/future-plans/recurring-bills-monthly.md`.

- [x] Inspect the current page, /bills, recurrence, overrides and posting claims.
- [x] Identify indispensable persistence and selected-occurrence API gaps.
- [x] Reduce scope to ordinary monthly bills, monthly amounts, reserve and pay.
- [x] Remove cards, legacy reconstruction, matching, ignore/reactivate and AI
  from first-release requirements.
- [ ] Confirm revised scope and commit the approved spec before implementation.
- [ ] Read applicable implementation/test contracts in full.
- [ ] Add minimal state/tracking migration, entity, RLS and backup integration.
- [ ] Add monthly read using shared recurrence and authoritative totals.
- [ ] Implement month navigation, summary and responsive list.
- [ ] Reuse overrides for monthly amount editing.
- [ ] Persist reservation without financial writes.
- [ ] Reuse posting claims and transaction creation for the selected slot.
- [ ] Preserve expected/actual amounts and unpaid neighboring months.
- [ ] Protect tracked history across /bills writes and transaction lifecycle.
- [ ] Verify real-DB duplicate-post races, rollback, isolation and persistence.
- [ ] Verify date boundaries, currencies, totals, stale requests and API failures.
- [ ] Finish translations, documentation/screenshots and required checks.
- [ ] Demonstrate create -> edit month -> reserve -> pay -> reload.

Deferred: card statements/transfers, old-history reconstruction, AI, instalments,
partial payments, unrelated-transaction association, ignore/reactivate,
pause/resume intervals and global default revisions.

## Simplified onboarding addition

- [x] Confirm existing account-create requirements and scheduled accountId limit.
- [x] Compare existing category budgets with a monthly planning allocation.
- [x] Specify independent totals, remainder, currency and missing-data behavior.
- [ ] Add inline quick-create account dialog and resume bill entry after saving.
- [ ] Require explicit opening balance; never seed it from the monthly budget.
- [ ] Add per-user/month planning budget persistence, RLS and backup support.
- [ ] Add validated revision-aware read/save/remove and monthly response fields.
- [ ] Add budget dialog, optional indicators and budget-only onboarding guidance.
- [ ] Test no balance effects, persistence, concurrent edits and user/month isolation.
- [ ] Test absent/zero budgets, shortfall, missing FX and no duplicate subtraction.
