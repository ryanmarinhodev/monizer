import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { Account } from "../accounts/entities/account.entity";
import { Currency } from "../currencies/entities/currency.entity";
import { withScopedDb } from "../common/db/scoped-db";
import { tr } from "../i18n/translate";
import { ScheduledTransactionsService } from "./scheduled-transactions.service";
import { ScheduledTransactionOverrideService } from "./scheduled-transaction-override.service";
import { ScheduledTransaction } from "./entities/scheduled-transaction.entity";
import { ScheduledTransactionPosting } from "./entities/scheduled-transaction-posting.entity";
import { ScheduledTransactionOverride } from "./entities/scheduled-transaction-override.entity";
import { RecurringBillState } from "./entities/recurring-bill-state.entity";
import { RecurringBillsReadService } from "./recurring-bills-read.service";
import {
  assertMonthlyBill,
  billRevision,
  monthlyConflict,
} from "./recurring-bill-policy";
import {
  CreateMonthlyBillDto,
  MonthlyBillAmountDto,
  MonthlyBillPaymentDto,
  MonthlyBillReserveDto,
} from "./dto/recurring-bills.dto";
import { FrequencyType } from "./dto/create-scheduled-transaction.dto";

@Injectable()
export class RecurringBillsCommandService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => ScheduledTransactionsService))
    private readonly schedules: ScheduledTransactionsService,
    private readonly read: RecurringBillsReadService,
    private readonly overrides: ScheduledTransactionOverrideService,
  ) {}

  async create(userId: string, dto: CreateMonthlyBillDto) {
    const result = await withScopedDb(this.dataSource, async (m) => {
      const account = await m.findOne(Account, {
        where: { id: dto.accountId, userId },
        lock: { mode: "pessimistic_read" },
      });
      if (!account || account.isClosed) throw monthlyConflict();
      const currency = await m.findOne(Currency, {
        where: { code: account.currencyCode },
      });
      if (!currency || currency.kind !== "FIAT") throw monthlyConflict();
      const candidate = Object.assign(new ScheduledTransaction(), {
        frequency: "MONTHLY",
        amount: -dto.amount,
        account,
        accountId: account.id,
        currencyCode: account.currencyCode,
        userId,
        occurrencesRemaining: null,
      });
      assertMonthlyBill(candidate);
      if (!dto.name.trim()) throw monthlyConflict();
      const row = await this.schedules.createWithoutHistory(userId, {
        accountId: account.id,
        name: dto.name.trim(),
        amount: -dto.amount,
        currencyCode: account.currencyCode,
        frequency: FrequencyType.MONTHLY,
        nextDueDate: dto.firstDueDate,
        startDate: dto.firstDueDate,
        autoPost: false,
      });
      await m.update(ScheduledTransaction, row.id, {
        monthlyTrackingStart: dto.firstDueDate,
      });
      return { ...row, monthlyTrackingStart: dto.firstDueDate };
    });
    this.schedules.recordCreated(userId, result);
    return result;
  }

  async adopt(userId: string, id: string) {
    return withScopedDb(this.dataSource, async (m) => {
      const row = await this.lock(m, userId, id);
      assertMonthlyBill(row);
      if (row.monthlyTrackingStart) return row;
      const overrides = await m.find(ScheduledTransactionOverride, {
        where: { scheduledTransactionId: id },
      });
      if (
        overrides.some(
          (o) =>
            o.isSplit ||
            o.splits?.length ||
            o.investmentQuantity !== null ||
            (o.amount !== null && Number(o.amount) >= 0),
        )
      )
        throw monthlyConflict();
      await m.update(ScheduledTransaction, id, {
        monthlyTrackingStart: row.nextDueDate,
      });
      return { ...row, monthlyTrackingStart: row.nextDueDate };
    });
  }

  async amount(
    userId: string,
    id: string,
    date: string,
    dto: MonthlyBillAmountDto,
  ) {
    return withScopedDb(this.dataSource, async (m) => {
      const { schedule, state } = await this.validate(
        m,
        userId,
        id,
        date,
        dto.revision,
      );
      const override = await m.findOne(ScheduledTransactionOverride, {
        where: { scheduledTransactionId: id, originalDate: date },
      });
      if (override)
        await this.overrides.updateOverride(
          id,
          override.id,
          { amount: -dto.amount },
          undefined,
          schedule.currencyCode,
          true,
        );
      else
        await this.overrides.createOverride(
          id,
          {
            originalDate: date,
            overrideDate: state?.dueDate ?? date,
            amount: -dto.amount,
          },
          undefined,
          schedule.currencyCode,
          true,
        );
      await this.saveState(m, userId, id, date, state, {
        ...(state?.expectedAmount !== null &&
        state?.expectedAmount !== undefined
          ? { expectedAmount: dto.amount }
          : {}),
      });
    });
  }

  async reserve(
    userId: string,
    id: string,
    date: string,
    dto: MonthlyBillReserveDto,
  ) {
    return withScopedDb(this.dataSource, async (m) => {
      const { state } = await this.validate(m, userId, id, date, dto.revision);
      await this.saveState(m, userId, id, date, state, {
        reserved: dto.reserved,
      });
    });
  }

  async pay(
    userId: string,
    id: string,
    date: string,
    dto: MonthlyBillPaymentDto,
  ) {
    // post owns the transaction and its post-commit work. The callback joins its
    // schedule lock, validates this exact slot/revision, then the unique claim
    // and financial transaction are written in that same scoped transaction.
    await this.schedules.post(
      userId,
      id,
      { amount: -dto.amount, transactionDate: dto.paymentDate },
      {
        monthlyOriginalDate: date,
        beforeWrite: async (m) => {
          await this.validate(m, userId, id, date, dto.revision);
        },
      },
    );
  }

  private async validate(
    m: EntityManager,
    userId: string,
    id: string,
    date: string,
    revision: string,
  ) {
    const schedule = await this.lock(m, userId, id);
    assertMonthlyBill(schedule);
    if (!schedule.monthlyTrackingStart) throw monthlyConflict();
    const occurrence = await this.read.slot(userId, schedule, date);
    const state = await m.findOne(RecurringBillState, {
      where: { userId, scheduledTransactionId: id, originalDate: date },
    });
    if (!occurrence || billRevision(occurrence, state) !== revision)
      throw monthlyConflict();
    const claim = await m.findOne(ScheduledTransactionPosting, {
      where: { scheduledTransactionId: id, originalDueDate: date },
    });
    if (claim) throw monthlyConflict();
    if (occurrence.amount === null || occurrence.amount >= 0)
      throw monthlyConflict();
    return { schedule, state };
  }

  private async lock(
    m: EntityManager,
    userId: string,
    id: string,
  ): Promise<ScheduledTransaction> {
    const row = await m.findOne(ScheduledTransaction, {
      where: { id, userId },
      lock: { mode: "pessimistic_write" },
    });
    if (!row)
      throw new NotFoundException(
        tr("errors.scheduled.notFound", "Scheduled transaction not found", {
          id,
        }),
      );
    const account = await m.findOne(Account, {
      where: { id: row.accountId, userId },
    });
    if (!account || account.isClosed) throw monthlyConflict();
    return { ...row, account, splits: [] };
  }

  private async saveState(
    m: EntityManager,
    userId: string,
    id: string,
    date: string,
    state: RecurringBillState | null,
    fields: Partial<RecurringBillState>,
  ) {
    const repo = m.getRepository(RecurringBillState);
    if (state)
      await repo.update(state.id, { ...fields, revision: state.revision + 1 });
    else
      await repo.save(
        repo.create({
          userId,
          scheduledTransactionId: id,
          originalDate: date,
          reserved: false,
          revision: 1,
          ...fields,
        }),
      );
  }
}
