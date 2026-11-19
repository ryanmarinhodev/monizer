import { AccountType } from "../accounts/entities/account.entity";
import type { ScheduledTransaction } from "./entities/scheduled-transaction.entity";
import type { Transaction } from "../transactions/entities/transaction.entity";

/** Template eligibility only: occurrence direction is resolved separately. */
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

/** Classifies an existing ledger payment, never a future occurrence's direction. */
export function isMonthlyBillPayment(
  transaction: Transaction | null | undefined,
  userId: string,
  accountId: string,
  currencyCode: string,
): boolean {
  return (
    !!transaction &&
    transaction.userId === userId &&
    transaction.status !== "VOID" &&
    transaction.accountId === accountId &&
    transaction.currencyCode === currencyCode &&
    Number(transaction.amount) < 0 &&
    !transaction.isSplit &&
    !transaction.isTransfer &&
    !transaction.originalCurrencyCode
  );
}
