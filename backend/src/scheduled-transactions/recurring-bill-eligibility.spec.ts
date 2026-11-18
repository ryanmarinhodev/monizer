import { AccountType } from "../accounts/entities/account.entity";
import type { ScheduledTransaction } from "./entities/scheduled-transaction.entity";
import type { Transaction } from "../transactions/entities/transaction.entity";
import {
  isMonthlyBill,
  isMonthlyBillPayment,
} from "./recurring-bill-eligibility";

const schedule = {
  frequency: "MONTHLY",
  amount: -100,
  userId: "owner",
  currencyCode: "USD",
  occurrencesRemaining: null,
  isSplit: false,
  isTransfer: false,
  isInvestment: false,
  originalCurrencyCode: null,
  account: {
    userId: "owner",
    currencyCode: "USD",
    accountType: AccountType.CHEQUING,
  },
} as ScheduledTransaction;
const payment = {
  userId: "owner",
  accountId: "bank",
  currencyCode: "USD",
  amount: -100,
  status: "UNRECONCILED",
  isSplit: false,
  isTransfer: false,
  originalCurrencyCode: null,
} as Transaction;

describe("monthly bill eligibility (templates and posted ledger rows)", () => {
  it("accepts a plain monthly expense and its actual payment", () => {
    expect(isMonthlyBill(schedule)).toBe(true);
    expect(isMonthlyBillPayment(payment, "owner", "bank", "USD")).toBe(true);
  });
  it.each([
    { amount: 0 },
    { amount: 100 },
    { isSplit: true },
    { isTransfer: true },
    { isInvestment: true },
    { originalCurrencyCode: "EUR" },
    { frequency: "WEEKLY" },
    { occurrencesRemaining: 3 },
    { account: { ...schedule.account, userId: "other" } },
    { account: { ...schedule.account, currencyCode: "EUR" } },
    { account: { ...schedule.account, accountType: AccountType.CREDIT_CARD } },
  ])("rejects an unsupported template: %j", (change) => {
    expect(
      isMonthlyBill({ ...schedule, ...change } as ScheduledTransaction),
    ).toBe(false);
  });
  it.each([
    { amount: 0 },
    { amount: 100 },
    { status: "VOID" },
    { userId: "other" },
    { accountId: "other" },
    { currencyCode: "EUR" },
    { isSplit: true },
    { isTransfer: true },
    { originalCurrencyCode: "EUR" },
  ])("rejects a payment that cannot settle this bill: %j", (change) => {
    expect(
      isMonthlyBillPayment(
        { ...payment, ...change } as Transaction,
        "owner",
        "bank",
        "USD",
      ),
    ).toBe(false);
  });
  it("refuses a missing payment", () => {
    expect(isMonthlyBillPayment(undefined, "owner", "bank", "USD")).toBe(false);
  });
});
