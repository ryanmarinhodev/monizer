# Monthly recurring bills: minimum usable release

Status: revised proposal; implementation has not started.
Date: 2026-11-11. Supersedes the broader proposal in this working document.

## Product boundary

Deliver one usable workflow: create a monthly bill once, browse months, change
only that occurrence's expected amount, reserve/unreserve, record its payment,
and see month total, paid and outstanding. Reservation is an independent marker:
an overdue bill can also be reserved. Show reserved outstanding as a small
additional figure, not another amount added to the month total.

Reuse scheduled transactions, the monthly recurrence engine, overrides and the
financial transaction services. Do not introduce a second recurrence engine or
payment ledger. First release supports ordinary monthly expenses paid from a
compatible non-card cash/bank account, without transfers, loans, investments,
complex splits or foreign-entry pricing. Different account currencies still
require correct conversion and explicit missing-rate handling.

Exclude cards (including scheduled card transfers), old-history reconstruction,
AI, instalments, automatic/manual association of unrelated ledger transactions,
ignore/reactivate, partial payments, default-template revisions and new payment
reversal UI. These are future features, not prerequisites for this release.

## What the existing code provides

- ScheduledTransaction stores the template and recurrence anchor.
- ScheduledOccurrenceService and expandOccurrenceSlots select and price slots;
  the current expansion starts at nextDueDate, not at the historical start.
- Overrides uniquely identify (schedule, originalDate) and supply monthly values.
- Posting claims uniquely identify (schedule, originalDueDate), with a unique
  linked transaction where present. The existing post path writes the claim,
  financial transaction and cursor advance within a scoped transaction.
- Public post/skip operate on the current slot. Changing transactionDate does
  not select a different occurrence.
- Posting/cursor advancement removes old overrides. Claims alone do not preserve
  the expected amount and some old claims have no linked transaction.

## Minimal durable additions

Propose one small occurrence-state table in the existing scheduled module,
unique by (schedule, originalDate), storing reservation, revision and the
expected amount/currency/effective due-date snapshot retained when paid.
The actual paid amount/date come from the linked financial transaction, through
existing posting claims. Do not add an independently editable paid balance.
Reservation changes neither transactions nor account balances.

Use the existing override table as the source of pending monthly amount edits.
Capture the expected snapshot under the schedule lock before posting removes
that override. Forecasts are derived, not inserted as financial transactions.
No unbounded generation of monthly rows on create or page read.

Record a monthly-tracking start boundary on the schedule when it enters this
workflow (new schedules: first due date). Adopt existing compatible unposted
schedules from their current outstanding slot, without copying the schedule.
Require explicit confirmation for adoption; do not guess prior payment history.
Months before tracking begins are outside recorded history, not purported paid
or zero-obligation history. The month navigation itself remains unrestricted.

The additional entity needs a paired migration/schema change, tenant isolation,
backup/restore coverage and parent lifecycle checks. No unrelated schema changes.

## Minimal API and shared-path changes

1. A bounded monthly read in the scheduled module returns authoritative rows,
   expected/actual values, payment status, reservation and converted totals.
   Reuse the existing recurrence/pricing helpers and union recorded history.
2. Monthly amount and reservation mutations name originalDate and the expected
   revision. Reuse override validation, preserve unrelated override fields and
   reject edits of a paid occurrence before writing.
3. A selected-occurrence payment operation reuses existing transaction creation
   and claim uniqueness. Validate the supported schedule shape, owner, slot,
   current revision and override inside withScopedDb under the parent lock.
   It accepts actual amount and payment date independently of slot identity.
4. A future payment leaves earlier outstanding slots in place. Advance the
   existing cursor only when its current slot is consumed, stepping across
   consecutive claimed slots through the existing cursor helper. Shared
   occurrence reads exclude those future claimed slots, so /bills and forecasts
   do not offer them as unpaid. Keep current public post pin semantics.
5. Existing post entry points for a tracked schedule must also capture the
   expected snapshot and honor the same claim. This is a small shared helper,
   not a rewrite of loan/investment/transfer posting branches.

No silent historical rewriting through /bills: tracked schedules do not support
changing their recurrence anchor, funding account or base amount in this first
release. Use monthly overrides instead. Refuse hard deletion/skip for tracked
schedules where it would erase/unrecord history, with an explanation directing
the user to the monthly screen. Untagged schedules keep their existing behavior.
Closing future recurrence can use an effective end date while retaining earlier
unpaid slots/history; no pause/resume interval model is required now.

Paid means a valid, non-VOID linked transaction, not merely a client-side flag.
Trace transaction edit/VOID/delete/undo: read actual amounts from the ledger,
retain the expected snapshot, and do not offer another payment while a surviving
claim blocks it. A released claim can reopen the recorded occurrence even behind
the cursor. This lifecycle consistency is required even without a reversal UI.
Invalidate scheduled/balance caches after commit using existing mechanisms.

The supported workflow registers payment through Contas Fixas or the existing
scheduled post flow. A manually entered unrelated transaction cannot safely be
recognized by name/date/amount. Explain that it is not auto-associated and must
not be registered again; unrelated-transaction association is deferred. The
unique claim prevents duplicate payments of an identified occurrence, not
arbitrary duplicate manual ledger entries.

## Month, status and totals

Identity is (schedule, originalDate), never payment date or month label alone.
List by effective dueDate month. Respect start/end dates and the user's financial
today; reuse the existing 29/30/31 anchoring behavior. Future and past unpaid
tracked occurrences are payable without paying a neighboring month.

| Situation | Month total | Paid | Outstanding | Reserved |
| --- | ---: | ---: | ---: | ---: |
| Pending expected 180 | 180 | 0 | 180 | 0 |
| Overdue expected 180, reserved | 180 | 0 | 180 | 180 |
| Paid 165, expected 180, previously reserved | 165 | 165 | 0 | 0 |
| Empty month within tracked coverage | 0 | 0 | 0 | 0 |

Month total = paid actual + outstanding expected. Example: paid 165 + pending
180 + reserved pending 300 gives total 645, paid 165, outstanding 480, reserved
300. A November obligation paid in December stays in November's obligation list;
its financial transaction keeps the real December payment date.

Use sumMoney/roundMoney at each currency's precision and FxAggregate before
summing currencies. Honor stored transaction FX provenance; otherwise use the
payment date for paid amounts. Pending rates use due date up to today, or today
for future forecasts, labelled estimated. Missing components/rates produce null
only in dependent totals, with the named pair/date and repair instruction.
Never substitute rate 1 or unknown amount 0. Distinguish request failure,
loading, empty month and history outside tracking coverage.

## Focused acceptance tests

- Nov start absent Oct; Dec/Jan, leap February and 29/30/31; user's timezone.
- Nov override leaves Dec/default and paid history unchanged.
- Reservation persists across reload/devices, changes no balance and disappears
  from outstanding reserved totals after payment.
- Expected 180 / actual 165 remain distinct after override pruning.
- Past/future payments preserve other slots and earlier unpaid cursor.
- Two DB connections racing pay/pay or pay/existing-post create one financial
  effect through the unique claim and scoped transaction; rejected stale edits
  leave no writes. Test tenant isolation and rollback with real PostgreSQL.
- Shared /bills reads do not offer a claimed future slot as unpaid.
- Ledger edit/VOID/delete/undo produces a coherent occurrence state.
- Empty totals, missing FX, currency precision and reservation double count.
- Fast month navigation cannot display a late response for another month;
  failed payment is never shown as successful.
- Existing unsupported schedules retain their previous behavior.

Affected invariants: INV-OCCURRENCE-001/002/003, INV-CACHE-001, INV-FX-001/002.
No broad refactoring, threshold weakening or production-data test mutations.

## Simplified onboarding and optional planning budget

Added to the revised proposal before implementation, at the user's request.

### Financial account onboarding

On entering the screen, load compatible accounts with the existing accounts API.
An account-list request failure is an error with retry, not proof that no account
exists. Existing accounts remain selectable. If none exists, explain: a financial
account tells Monize where an actual payment is recorded; it is separate from the
bill itself and from the optional monthly planning budget.

Offer a short inline dialog using accountsApi.create / POST /accounts. Existing
CreateAccountDto requires name, accountType and currencyCode for a simple bank or
cash account; institution, account number and loan/card configuration are not
required. Offer only compatible basic types, with the user's currency preselected
and visible. Immediately select the returned saved account and resume bill entry;
a failed create keeps the dialog and does not create a scheduled transaction.

The account service defaults an omitted openingBalance to zero and uses it as
currentBalance. Do not represent an unknown bank balance as zero silently.
The short form must request the starting balance, including an explicit choice
of zero when that is the intended recorded starting balance. Explain that this
is a real account record; the planning budget never populates this field.
No placeholder accounts, artificial income, external bank connection or silent
account creation. Preserve entered bill data while the account dialog is open.
If account creation succeeded but subsequent bill creation fails, retain/select
the created account rather than creating another one on retry.

scheduledTransactionsApi.create still requires accountId. Budget-only onboarding
can save a plan and show existing known obligations, but cannot create an
account-less bill or a real payment. Explain this limit beside the actions.
Supporting account-less bill drafts would introduce another lifecycle and is
explicitly deferred. No financial-account API expansion is required for this UX.

### Monthly planning budget

One optional amount per user and calendar month, independent of any schedule or
financial account. Existing budgets/baseIncome and budget periods belong to the
category/strategy budgeting subsystem. Do not create a hidden budget there or
reuse its actual-income/activity aggregates as this screen's planning envelope.

Propose a small dedicated record (proposed name: recurring_bill_month_budgets):
user id from authenticated identity, month as its first calendar date, amount
NUMERIC(24,8), currency code, revision and timestamps. Unique (user_id, month),
with scoped RLS and backup/restore coverage. Amount is nonnegative, finite and
validated at the currency's money precision; explicitly entered zero is valid.
Missing record means no budget, not zero. The amount is the initial allocation
for the WHOLE month including already paid obligations, not today's remaining
cash; say this in the form so historical payments are not deducted twice.

Add bounded read/save/remove operations inside this feature's backend services.
Save upserts through the unique key with revision/conditional-write protection
against stale edits, including concurrent creates; remove also validates the
expected revision. No transaction or account-balance write, rollover, cron,
category allocation or dependency on an account. Refresh only affected monthly
planning reads; keep the operation scoped to the selected month/user.

Store currency explicitly, initially using the reporting preference. A later
preference change must not relabel the saved amount as a different currency.
Convert it through the existing FX mechanism to the monthly summary currency,
using the same declared valuation date policy as the month's planned figures;
return date/pair provenance and null on unavailable conversion. Editing displays
its saved currency; no currency-switching UI is needed in this first release.

### Independent figures and examples

Obligations determine total, paid and outstanding even when no budget exists.
Show initial budget and forecast remainder only when a budget was supplied;
if required conversion or obligation data is unknown, show the named limitation.
No automatic fallback to current bank balances in this release: such balances
need a separate dated cash-flow contract and cannot stand for a month's allocation.

Forecast remainder = initial monthly budget - month total.
Do not subtract paid again, or subtract reserved on top of outstanding.
Negative remainder means a projected shortfall; retain the negative value.

| Inputs | Total | Paid | Outstanding | Forecast remainder |
| --- | ---: | ---: | ---: | ---: |
| Budget 1000, paid 165, pending 180, reserved pending 300 | 645 | 165 | 480 | 355 |
| Same obligations, no budget | 645 | 165 | 480 | not supplied |
| Budget 0, same obligations | 645 | 165 | 480 | -645 |
| Budget 1000, successfully loaded empty tracked month | 0 | 0 | 0 | 1000 |
| Budget 1000, obligations request failed | unavailable | unavailable | unavailable | unavailable |

The remainder covers registered Contas Fixas only; it is not a claim about all
household expenses or bank cash. Before tracking coverage or with missing history,
do not label an unknown obligation total as zero. Removing the budget hides its
projection without changing any bill, payment or the three obligation indicators.
November's budget does not appear in December unless explicitly entered there.

### Additional focused tests

- No accounts vs failed account-list request; create in dialog and select result.
- No fabricated balance, budget-to-openingBalance copy or account on budget save.
- Account saved/bill save fails: retry reuses the same account.
- Budget create/update/delete persists across reload/devices, scoped by user/month.
- Unique month record and stale concurrent edits refused without overwrites.
- Budget absence versus explicit zero; negative remainder and no double deduction.
- Reporting-currency preference changes preserve the stored budget currency.
- Missing FX/history and API failures do not become zero or an available remainder.
- Budget-only start clearly explains accountId is still needed for bill/payment.
- Budget mutations leave ledger row counts and bank balances unchanged.
