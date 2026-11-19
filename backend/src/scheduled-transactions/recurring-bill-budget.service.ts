import {
  BadRequestException,
  Injectable,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { User } from "../users/entities/user.entity";
import { withScopedDb } from "../common/db/scoped-db";
import { resolveUserDefaultCurrency } from "../common/default-currency.util";
import { CurrenciesService } from "../currencies/currencies.service";
import { RecurringBillMonthBudget } from "./entities/recurring-bill-month-budget.entity";
import { monthlyConflict } from "./recurring-bill-policy";
import { tr } from "../i18n/translate";
import { isCalendarDate } from "../common/validators/is-calendar-date.validator";

export function assertBillMonth(month: string): void {
  if (!isCalendarDate(month) || !month.endsWith("-01"))
    throw new BadRequestException(
      tr("errors.recurringBills.month", "Select a valid calendar month."),
    );
}

@Injectable()
export class RecurringBillBudgetService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => CurrenciesService))
    private readonly currencies: CurrenciesService,
  ) {}

  async save(
    userId: string,
    month: string,
    amount: number | null,
    revision: number,
  ) {
    assertBillMonth(month);
    return withScopedDb(this.dataSource, async (m) => {
      // The owner's row serializes the absent-row case as well as updates/removal.
      const owner = await m.findOne(User, {
        where: { id: userId },
        lock: { mode: "pessimistic_write" },
      });
      if (!owner) throw monthlyConflict();
      const repo = m.getRepository(RecurringBillMonthBudget);
      const existing = await repo.findOne({ where: { userId, month } });
      if ((existing?.revision ?? 0) !== revision) throw monthlyConflict();
      if (!existing && amount === null) return null;
      const currencyCode =
        existing?.currencyCode ??
        (await resolveUserDefaultCurrency(this.dataSource, userId));
      await this.currencies.ensureCurrencyForUser(userId, currencyCode);
      if (existing) {
        await repo.update(existing.id, { amount, revision: revision + 1 });
      } else {
        await repo.save(
          repo.create({ userId, month, amount, currencyCode, revision: 1 }),
        );
      }
      return repo.findOneByOrFail({ userId, month });
    });
  }
}
