import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { DataSource, In, Not, IsNull } from "typeorm";
import { withScopedDb } from "../common/db/scoped-db";
import { todayYMD, addDaysYMD } from "../common/date-utils";
import { resolveUserDefaultCurrency } from "../common/default-currency.util";
import { FxAggregate } from "../common/fx-aggregate";
import { roundMoney } from "../common/round.util";
import { ExchangeRateService } from "../currencies/exchange-rate.service";
import { ScheduledTransaction } from "./entities/scheduled-transaction.entity";
import { ScheduledTransactionPosting } from "./entities/scheduled-transaction-posting.entity";
import { RecurringBillState } from "./entities/recurring-bill-state.entity";
import { RecurringBillMonthBudget } from "./entities/recurring-bill-month-budget.entity";
import {
  ScheduledOccurrenceService,
  ResolvedScheduledOccurrence,
} from "./scheduled-occurrence.service";
import { billRevision, isMonthlyBill } from "./recurring-bill-policy";
import { assertBillMonth } from "./recurring-bill-budget.service";

export interface MonthlyBillRow {
  scheduleId: string;
  originalDate: string;
  dueDate: string;
  name: string;
  accountId: string;
  currencyCode: string;
  expectedAmount: number | null;
  paidAmount: number | null;
  paymentDate: string | null;
  transactionId: string | null;
  status: "paid" | "pending" | "overdue" | "review";
  reserved: boolean;
  paymentBlocked: boolean;
  revision: string;
}

@Injectable()
export class RecurringBillsReadService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => ScheduledOccurrenceService))
    private readonly occurrences: ScheduledOccurrenceService,
    @Inject(forwardRef(() => ExchangeRateService))
    private readonly rates: ExchangeRateService,
  ) {}

  async month(userId: string, month: string) {
    assertBillMonth(month);
    const [year, monthNumber] = month.split("-").map(Number);
    const nextMonth =
      monthNumber === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;
    const through = addDaysYMD(nextMonth, -1);
    const today = todayYMD();
    const currencyCode = await resolveUserDefaultCurrency(
      this.dataSource,
      userId,
    );
    const data = await withScopedDb(
      this.dataSource,
      async (m) => {
        const schedules = await m.find(ScheduledTransaction, {
          where: { userId, monthlyTrackingStart: Not(IsNull()) },
          relations: ["account", "splits"],
        });
        const ids = schedules.map((s) => s.id);
        const states = ids.length
          ? await m.find(RecurringBillState, {
              where: { userId, scheduledTransactionId: In(ids) },
            })
          : [];
        const claims = ids.length
          ? await m.find(ScheduledTransactionPosting, {
              where: { scheduledTransactionId: In(ids) },
              relations: ["transaction"],
            })
          : [];
        const budget = await m.findOne(RecurringBillMonthBudget, {
          where: { userId, month },
        });
        const occurrences = await this.occurrences.expand(
          userId,
          schedules,
          { from: month, through },
          true,
        );
        const candidates = (
          await m.find(ScheduledTransaction, {
            where: { userId, monthlyTrackingStart: IsNull(), isActive: true },
            relations: ["account", "splits"],
          })
        )
          .filter(isMonthlyBill)
          .map((s) => ({ id: s.id, name: s.name }));
        return { schedules, states, claims, budget, occurrences, candidates };
      },
      "REPEATABLE READ",
    );
    const states = new Map(
      data.states.map((s) => [
        `${s.scheduledTransactionId}:${s.originalDate}`,
        s,
      ]),
    );
    const claims = new Map(
      data.claims.map((c) => [
        `${c.scheduledTransactionId}:${c.originalDueDate}`,
        c,
      ]),
    );
    const paid = new FxAggregate();
    const outstanding = new FxAggregate();
    const reserved = new FxAggregate();
    const rows: MonthlyBillRow[] = [];
    const missingRates: Array<{ from: string; to: string; date: string }> = [];
    for (const occurrence of data.occurrences) {
      const key = `${occurrence.scheduledTransactionId}:${occurrence.originalDate}`;
      const state = states.get(key) ?? null;
      const claim = claims.get(key);
      const transaction = claim?.transaction;
      const valid =
        transaction &&
        transaction.userId === userId &&
        transaction.status !== "VOID" &&
        transaction.accountId === occurrence.settlementAccountId &&
        transaction.currencyCode === occurrence.currencyCode &&
        Number(transaction.amount) < 0 &&
        !transaction.isSplit &&
        !transaction.isTransfer &&
        !transaction.originalCurrencyCode;
      const invalid = !!claim && !valid && transaction?.status !== "VOID";
      const expectedAmount =
        occurrence.amount === null ? null : -occurrence.amount;
      const paidAmount = valid
        ? -Number(transaction.amount)
        : invalid
          ? null
          : 0;
      const status = invalid
        ? "review"
        : valid
          ? "paid"
          : occurrence.dueDate < today
            ? "overdue"
            : "pending";
      rows.push({
        scheduleId: occurrence.scheduledTransactionId,
        originalDate: occurrence.originalDate,
        dueDate: occurrence.dueDate,
        name: occurrence.schedule.name,
        accountId: occurrence.settlementAccountId,
        currencyCode: occurrence.currencyCode,
        expectedAmount,
        paidAmount,
        paymentDate: valid ? transaction.transactionDate : null,
        transactionId: claim?.transactionId ?? null,
        status,
        reserved: state?.reserved ?? false,
        paymentBlocked: !!claim,
        revision: billRevision(occurrence, state),
      });
      if (invalid) {
        paid.addUnknown();
        outstanding.addUnknown();
        continue;
      }
      const value = valid ? paidAmount : expectedAmount;
      const date = valid ? transaction.transactionDate : occurrence.dueDate;
      const converted = await this.convert(
        value,
        occurrence.currencyCode,
        currencyCode,
        date,
        missingRates,
      );
      const target = valid ? paid : outstanding;
      if (value === null) target.addUnknown();
      else target.add(converted, occurrence.currencyCode, currencyCode);
      if (!valid && state?.reserved) {
        if (value === null) reserved.addUnknown();
        else reserved.add(converted, occurrence.currencyCode, currencyCode);
      }
    }
    // Adoption does not reconstruct months between the original start and tracking.
    const historyGaps = data.schedules.filter(
      (s) =>
        s.startDate <= through &&
        s.monthlyTrackingStart! > month &&
        s.startDate < s.monthlyTrackingStart!,
    );
    if (historyGaps.length) {
      paid.addUnknown();
      outstanding.addUnknown();
      reserved.addUnknown();
    }
    const total = new FxAggregate();
    total.merge(paid);
    total.merge(outstanding);
    const budget = data.budget;
    const allocation =
      budget?.amount === undefined || budget.amount === null
        ? null
        : await this.convert(
            budget.amount,
            budget.currencyCode,
            currencyCode,
            through,
            missingRates,
          );
    return {
      month,
      today,
      currencyCode,
      rows,
      candidates: data.candidates,
      trackingStarts: data.schedules.map((s) => ({
        name: s.name,
        date: s.monthlyTrackingStart,
      })),
      total: total.total,
      paid: paid.total,
      outstanding: outstanding.total,
      reserved: reserved.total,
      knownSubtotal: total.knownSubtotal,
      missingRates,
      unknownBills: rows
        .filter((r) => r.status === "review" || r.expectedAmount === null)
        .map((r) => r.name),
      budget: budget
        ? {
            amount: budget.amount,
            currencyCode: budget.currencyCode,
            revision: budget.revision,
          }
        : null,
      budgetConverted: allocation,
      remainder:
        allocation === null || total.total === null
          ? null
          : roundMoney(allocation - total.total, 4),
    };
  }

  private async convert(
    amount: number | null,
    from: string,
    to: string,
    date: string,
    missing: Array<{ from: string; to: string; date: string }>,
  ): Promise<number | null> {
    if (amount === null) return null;
    if (amount === 0 || from === to) return amount;
    const valuedOn = date > todayYMD() ? todayYMD() : date;
    let result = await this.rates.convertOnDate(amount, from, to, valuedOn);
    if (!result) {
      await this.rates.ensureRatesForDate([{ from, to }], valuedOn);
      result = await this.rates.convertOnDate(amount, from, to, valuedOn);
    }
    if (!result) missing.push({ from, to, date: valuedOn });
    return result?.convertedAmount ?? null;
  }

  async slot(
    userId: string,
    schedule: ScheduledTransaction,
    originalDate: string,
  ): Promise<ResolvedScheduledOccurrence | undefined> {
    const override = await withScopedDb(this.dataSource, async (m) => {
      const state = await m.findOne(RecurringBillState, {
        where: { userId, scheduledTransactionId: schedule.id, originalDate },
      });
      if (state?.dueDate) return state.dueDate;
      const rows: Array<{ date: string }> = await m.query(
        `SELECT TO_CHAR(override_date, 'YYYY-MM-DD') AS date FROM scheduled_transaction_overrides WHERE scheduled_transaction_id = $1 AND original_date = $2`,
        [schedule.id, originalDate],
      );
      return rows[0]?.date ?? originalDate;
    });
    return (
      await this.occurrences.expand(
        userId,
        [schedule],
        { from: override, through: override },
        true,
      )
    ).find((o) => o.originalDate === originalDate);
  }
}
