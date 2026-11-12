import { BadRequestException, ConflictException } from "@nestjs/common";
import { createHash } from "crypto";
import { EntityManager } from "typeorm";
import { AccountType } from "../accounts/entities/account.entity";
import { tr } from "../i18n/translate";
import { ScheduledTransaction } from "./entities/scheduled-transaction.entity";
import { RecurringBillState } from "./entities/recurring-bill-state.entity";
import type { ResolvedScheduledOccurrence } from "./scheduled-occurrence.service";

export function isMonthlyBill(row: ScheduledTransaction): boolean {
  return (
    row.frequency === "MONTHLY" &&
    !row.isSplit &&
    !row.isTransfer &&
    !row.isInvestment &&
    !row.originalCurrencyCode &&
    row.occurrencesRemaining === null &&
    Number(row.amount) < 0 &&
    !!row.account &&
    row.account.userId === row.userId &&
    [AccountType.CHEQUING, AccountType.SAVINGS, AccountType.CASH].includes(
      row.account.accountType,
    ) &&
    row.account.currencyCode === row.currencyCode
  );
}

export function assertMonthlyBill(row: ScheduledTransaction): void {
  if (!isMonthlyBill(row))
    throw new BadRequestException(
      tr(
        "errors.recurringBills.unsupported",
        "Select a plain monthly expense paid from your own bank or cash account. Limited repetitions, transfers, cards, splits and investments are not supported here.",
      ),
    );
}

export function assertNotMonthlyTracked(row: ScheduledTransaction): void {
  if (row.monthlyTrackingStart)
    throw new ConflictException(
      tr(
        "errors.recurringBills.managed",
        "This bill has monthly history. Use Recurring Bills to change an individual month; deleting or changing the series would erase its history.",
      ),
    );
}

export function monthlyConflict(): ConflictException {
  return new ConflictException(
    tr(
      "errors.scheduled.changedConcurrently",
      "The scheduled transaction changed during the operation. Reload it and retry.",
    ),
  );
}

export function billRevision(
  occurrence: ResolvedScheduledOccurrence,
  state: RecurringBillState | null,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        occurrence.schedule.updatedAt,
        occurrence.originalDate,
        occurrence.dueDate,
        occurrence.amount,
        occurrence.overrideId,
        state?.revision ?? 0,
        state?.expectedAmount ?? null,
        state?.dueDate ?? null,
      ]),
    )
    .digest("hex");
}

/** Called under the schedule lock before the existing posting path consumes its override. */
export async function snapshotMonthlyBill(
  m: EntityManager,
  occurrence: ResolvedScheduledOccurrence,
): Promise<void> {
  if (occurrence.amount === null || occurrence.amount >= 0)
    throw monthlyConflict();
  const repo = m.getRepository(RecurringBillState);
  const key = {
    scheduledTransactionId: occurrence.scheduledTransactionId,
    originalDate: occurrence.originalDate,
  };
  const state = await repo.findOne({ where: key });
  if (state) {
    await repo.update(state.id, {
      expectedAmount:
        state.expectedAmount === null
          ? -occurrence.amount
          : state.expectedAmount,
      dueDate: state.dueDate === null ? occurrence.dueDate : state.dueDate,
      revision: state.revision + 1,
    });
  } else {
    await repo.save(
      repo.create({
        ...key,
        userId: occurrence.schedule.userId,
        expectedAmount: -occurrence.amount,
        dueDate: occurrence.dueDate,
        reserved: false,
        revision: 1,
      }),
    );
  }
}
