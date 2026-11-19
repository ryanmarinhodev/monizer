import { compareMigrationFilenames } from "../../src/common/db/migration-filename";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { FrequencyType } from "@/scheduled-transactions/dto/create-scheduled-transaction.dto";
import { ScheduledTransactionsModule } from "@/scheduled-transactions/scheduled-transactions.module";
import { ScheduledTransactionsService } from "@/scheduled-transactions/scheduled-transactions.service";
import { RecurringBillsCommandService } from "@/scheduled-transactions/recurring-bills-command.service";
import { RecurringBillsReadService } from "@/scheduled-transactions/recurring-bills-read.service";
import { RecurringBillBudgetService } from "@/scheduled-transactions/recurring-bill-budget.service";
import { ScheduledOccurrenceService } from "@/scheduled-transactions/scheduled-occurrence.service";
import { Account } from "@/accounts/entities/account.entity";
import { TransactionsService } from "@/transactions/transactions.service";
import {
  ActionHistoryService,
  settlePendingHistoryWrites,
} from "@/action-history/action-history.service";
import { withUserContext } from "@/common/db/with-context";
import {
  createIntegrationModule,
  createTestUserDirect,
} from "../helpers/integration-setup";
import { createTestAccount } from "../helpers/test-factories";
import { createBarrier } from "../helpers/race";

/** Local runs may use an existing, schema-only cloned test database: no teardown or personal-data writes. */
describe("Monthly bills: persisted occurrence identity and financial effects", () => {
  let module: TestingModule;
  let ds: DataSource;
  let commands: RecurringBillsCommandService;
  let read: RecurringBillsReadService;
  let budgets: RecurringBillBudgetService;
  let schedules: ScheduledTransactionsService;
  let userId: string;
  let accountId: string;
  const asUser = <T>(fn: () => Promise<T>) => withUserContext(userId, fn);

  beforeAll(async () => {
    const preserve = /^monize_recurring_bills_test_/.test(
      process.env.DATABASE_NAME ?? "",
    );
    module = await createIntegrationModule(
      [ScheduledTransactionsModule],
      preserve
        ? {
            typeOrmOptions: { synchronize: false, dropSchema: false },
            applyRls: false,
          }
        : {},
    );
    ds = module.get(DataSource);
    const dir = join(__dirname, "../../../database/migrations");
    for (const name of readdirSync(dir)
      .filter((n) =>
        /_recurring_bill(s_monthly|_payment_restore)\.sql$/.test(n),
      )
      .sort(compareMigrationFilenames)) {
      await ds.query(readFileSync(join(dir, name), "utf8"));
    }
    await ds.query(
      `INSERT INTO currencies (code, name, symbol, decimal_places) VALUES ('USD','US Dollar','$',2) ON CONFLICT DO NOTHING`,
    );
    commands = module.get(RecurringBillsCommandService);
    read = module.get(RecurringBillsReadService);
    budgets = module.get(RecurringBillBudgetService);
    schedules = module.get(ScheduledTransactionsService);
  }, 120000);
  afterAll(async () => {
    await settlePendingHistoryWrites();
    await module?.close();
  });
  beforeEach(async () => {
    userId = (await createTestUserDirect(ds)).id;
    accountId = (
      await createTestAccount(ds, userId, {
        openingBalance: 1000,
        currentBalance: 1000,
      })
    ).id;
  });
  const create = (amount = 180) =>
    asUser(() =>
      commands.create(userId, {
        accountId,
        name: "Monthly electricity",
        amount,
        firstDueDate: "2024-01-31",
      }),
    );
  const month = (date: string) => asUser(() => read.month(userId, date));
  const balance = async () =>
    Number(
      (await ds.getRepository(Account).findOneByOrFail({ id: accountId }))
        .currentBalance,
    );

  it("reuses month-end recurrence, edits February only, reserves without money and preserves expected/actual after reload", async () => {
    const bill = await create();
    expect((await month("2023-12-01")).rows).toHaveLength(0);
    const feb = (await month("2024-02-01")).rows[0];
    expect(feb.originalDate).toBe("2024-02-29");
    await asUser(() =>
      commands.amount(userId, bill.id, feb.originalDate, {
        amount: 200,
        revision: feb.revision,
      }),
    );
    const edited = (await month("2024-02-01")).rows[0];
    expect(edited.expectedAmount).toBe(200);
    expect((await month("2024-03-01")).rows[0].expectedAmount).toBe(180);
    await asUser(() =>
      commands.reserve(userId, bill.id, edited.originalDate, {
        reserved: true,
        revision: edited.revision,
      }),
    );
    const reserved = await month("2024-02-01");
    expect(reserved.reserved).toBe(200);
    expect(await balance()).toBe(1000);
    await asUser(() =>
      commands.pay(userId, bill.id, edited.originalDate, {
        amount: 165,
        paymentDate: "2024-03-05",
        revision: reserved.rows[0].revision,
      }),
    );
    const paid = await month("2024-02-01");
    expect(paid).toMatchObject({
      total: 165,
      paid: 165,
      outstanding: 0,
      reserved: 0,
    });
    expect(paid.rows[0]).toMatchObject({
      expectedAmount: 200,
      paidAmount: 165,
      paymentDate: "2024-03-05",
    });
    expect((await month("2024-01-01")).rows[0].status).toBe("overdue");
    expect((await month("2024-03-01")).rows[0].paidAmount).toBe(0);
    expect(await balance()).toBe(835);
    const shared = await asUser(() =>
      module
        .get(ScheduledOccurrenceService)
        .findOccurrences(userId, { from: "2024-01-01", through: "2024-03-31" }),
    );
    expect(shared.map((o) => o.originalDate)).toEqual([
      "2024-01-31",
      "2024-03-31",
    ]);
  });

  it("plans the first tracked month without losing monthly edits or inventing earlier history", async () => {
    const old = await asUser(() =>
      schedules.create(userId, {
        accountId,
        name: "Adopted monthly bill",
        amount: -180,
        currencyCode: "USD",
        frequency: FrequencyType.MONTHLY,
        startDate: "2024-01-22",
        nextDueDate: "2026-12-22",
        autoPost: false,
      }),
    );
    await asUser(() => commands.adopt(userId, old.id));
    expect(await month("2026-11-01")).toMatchObject({
      total: null,
      paid: null,
      reserved: null,
    });
    const december = await month("2026-12-01");
    expect(december).toMatchObject({
      total: 180,
      paid: 0,
      outstanding: 180,
      reserved: 0,
    });
    await asUser(() =>
      commands.amount(userId, old.id, december.rows[0].originalDate, {
        amount: 240,
        revision: december.rows[0].revision,
      }),
    );
    await asUser(() => budgets.save(userId, "2026-12-01", 1000, 0));
    expect(await month("2026-12-01")).toMatchObject({
      total: 240,
      remainder: 760,
    });
    expect((await month("2027-01-01")).rows[0].expectedAmount).toBe(180);
    expect((await month("2026-12-01")).rows[0].expectedAmount).toBe(240);
    expect(await balance()).toBe(1000);
  });

  it("excludes only the selected month, retaining its edited value and refusing every payment path", async () => {
    const bill = await create();
    let january = (await month("2024-01-01")).rows[0];
    await asUser(() =>
      commands.amount(userId, bill.id, january.originalDate, {
        amount: 230,
        revision: january.revision,
      }),
    );
    january = (await month("2024-01-01")).rows[0];
    await asUser(() =>
      commands.remove(userId, bill.id, january.originalDate, {
        scope: "occurrence",
        revision: january.revision,
      }),
    );
    expect(await month("2024-01-01")).toMatchObject({
      rows: [],
      total: 0,
      reserved: 0,
    });
    expect((await month("2024-02-01")).rows[0].expectedAmount).toBe(180);
    const overrides = await ds.query(
      "SELECT amount FROM scheduled_transaction_overrides WHERE scheduled_transaction_id = $1",
      [bill.id],
    );
    expect(Number(overrides[0].amount)).toBe(-230);
    await expect(
      asUser(() =>
        commands.pay(userId, bill.id, january.originalDate, {
          amount: 230,
          paymentDate: january.originalDate,
          revision: january.revision,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(() =>
        schedules.post(userId, bill.id, {
          amount: -230,
          transactionDate: january.originalDate,
        }),
      ),
    ).rejects.toThrow();
    expect(await balance()).toBe(1000);
  });

  it("ends future recurrence but preserves earlier monthly values and even payments recorded in later months", async () => {
    const bill = await create();
    const january = (await month("2024-01-01")).rows[0];
    await asUser(() =>
      commands.amount(userId, bill.id, january.originalDate, {
        amount: 210,
        revision: january.revision,
      }),
    );
    const march = (await month("2024-03-01")).rows[0];
    await asUser(() =>
      commands.pay(userId, bill.id, march.originalDate, {
        amount: 170,
        paymentDate: "2024-01-15",
        revision: march.revision,
      }),
    );
    const february = (await month("2024-02-01")).rows[0];
    await asUser(() =>
      commands.remove(userId, bill.id, february.originalDate, {
        scope: "future",
        revision: february.revision,
      }),
    );
    expect((await month("2024-01-01")).rows[0].expectedAmount).toBe(210);
    expect((await month("2024-02-01")).rows).toEqual([]);
    expect((await month("2024-03-01")).rows[0]).toMatchObject({
      status: "paid",
      expectedAmount: 180,
      paidAmount: 170,
    });
    expect((await month("2024-04-01")).rows).toEqual([]);
    expect(await balance()).toBe(830);
    await expect(
      asUser(() =>
        commands.pay(userId, bill.id, february.originalDate, {
          amount: 180,
          paymentDate: february.originalDate,
          revision: february.revision,
        }),
      ),
    ).rejects.toThrow();
  });

  it("refuses foreign, paid and stale deletion requests without changing history", async () => {
    const bill = await create();
    const row = (await month("2024-01-01")).rows[0];
    const other = await createTestUserDirect(ds);
    await expect(
      withUserContext(other.id, () =>
        commands.remove(other.id, bill.id, row.originalDate, {
          scope: "future",
          revision: row.revision,
        }),
      ),
    ).rejects.toThrow();
    await asUser(() =>
      commands.reserve(userId, bill.id, row.originalDate, {
        reserved: true,
        revision: row.revision,
      }),
    );
    await expect(
      asUser(() =>
        commands.remove(userId, bill.id, row.originalDate, {
          scope: "occurrence",
          revision: row.revision,
        }),
      ),
    ).rejects.toThrow();
    const fresh = (await month("2024-01-01")).rows[0];
    await asUser(() =>
      commands.pay(userId, bill.id, row.originalDate, {
        amount: 180,
        paymentDate: row.originalDate,
        revision: fresh.revision,
      }),
    );
    const paid = (await month("2024-01-01")).rows[0];
    await expect(
      asUser(() =>
        commands.remove(userId, bill.id, row.originalDate, {
          scope: "occurrence",
          revision: paid.revision,
        }),
      ),
    ).rejects.toThrow();
    expect((await month("2024-01-01")).paid).toBe(180);
    expect((await month("2024-02-01")).total).toBe(180);
    expect(await balance()).toBe(820);
  });

  it("serializes cancellation against payment without losing a committed payment", async () => {
    const bill = await create();
    const row = (await month("2024-01-01")).rows[0];
    const barrier = createBarrier();
    const results = await Promise.allSettled([
      asUser(async () => {
        await barrier.arrive();
        return commands.remove(userId, bill.id, row.originalDate, {
          scope: "occurrence",
          revision: row.revision,
        });
      }),
      asUser(async () => {
        await barrier.arrive();
        return commands.pay(userId, bill.id, row.originalDate, {
          amount: 180,
          paymentDate: row.originalDate,
          revision: row.revision,
        });
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const report = await month("2024-01-01");
    if (results[0].status === "fulfilled") {
      expect(report.rows).toEqual([]);
      expect(await balance()).toBe(1000);
    } else {
      expect(report.rows[0]).toMatchObject({ status: "paid", paidAmount: 180 });
      expect(await balance()).toBe(820);
    }
  });

  it("serializes duplicate payments and rejects a stale edit without another financial effect", async () => {
    const bill = await create();
    const row = (await month("2024-01-01")).rows[0];
    const barrier = createBarrier();
    const original = schedules.findOne.bind(schedules);
    const spy = jest
      .spyOn(schedules, "findOne")
      .mockImplementation(async (...args) => {
        const result = await original(...args);
        if (barrier.arrived < 2) await barrier.arrive();
        return result;
      });
    try {
      const results = await Promise.allSettled(
        [1, 2].map(() =>
          asUser(() =>
            commands.pay(userId, bill.id, row.originalDate, {
              amount: 180,
              paymentDate: "2024-01-31",
              revision: row.revision,
            }),
          ),
        ),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
    expect(await balance()).toBe(820);
    await expect(
      asUser(() =>
        commands.amount(userId, bill.id, row.originalDate, {
          amount: 20,
          revision: row.revision,
        }),
      ),
    ).rejects.toThrow();
    expect((await month("2024-01-01")).total).toBe(180);
  });

  it("preserves the snapshot on the existing post path and refuses erasing tracked history", async () => {
    const bill = await create();
    const row = (await month("2024-01-01")).rows[0];
    await asUser(() =>
      commands.amount(userId, bill.id, row.originalDate, {
        amount: 200,
        revision: row.revision,
      }),
    );
    await asUser(() =>
      schedules.post(userId, bill.id, {
        amount: -150,
        transactionDate: "2024-01-31",
      }),
    );
    expect((await month("2024-01-01")).rows[0]).toMatchObject({
      expectedAmount: 200,
      paidAmount: 150,
    });
    await expect(
      asUser(() => schedules.skip(userId, bill.id)),
    ).rejects.toThrow();
    await expect(
      asUser(() => schedules.remove(userId, bill.id)),
    ).rejects.toThrow();
    expect(await balance()).toBe(850);
  });

  it("reopens deleted payments behind the cursor and restores their claim on undo", async () => {
    const bill = await create();
    const row = (await month("2024-01-01")).rows[0];
    await asUser(() =>
      commands.pay(userId, bill.id, row.originalDate, {
        amount: 175,
        paymentDate: "2024-01-31",
        revision: row.revision,
      }),
    );
    const paid = (await month("2024-01-01")).rows[0];
    await settlePendingHistoryWrites();
    await asUser(() =>
      module.get(TransactionsService).remove(userId, paid.transactionId!),
    );
    await settlePendingHistoryWrites();
    const reopened = (await month("2024-01-01")).rows[0];
    expect(reopened).toMatchObject({
      expectedAmount: 180,
      paymentBlocked: false,
      paidAmount: 0,
    });
    await asUser(() => module.get(ActionHistoryService).undo(userId));
    expect((await month("2024-01-01")).rows[0]).toMatchObject({
      status: "paid",
      paidAmount: 175,
      paymentBlocked: true,
    });
    expect(await balance()).toBe(825);
  });

  it("keeps budgets independent, including zero, removal, concurrent stale saves and tenant/month isolation", async () => {
    await create();
    expect((await month("2024-01-01")).budget).toBeNull();
    await asUser(() => budgets.save(userId, "2024-01-01", 500, 0));
    expect(await month("2024-01-01")).toMatchObject({
      total: 180,
      paid: 0,
      outstanding: 180,
      budgetConverted: 500,
      remainder: 320,
    });
    const races = await Promise.allSettled(
      [0, 100].map((amount) =>
        asUser(() => budgets.save(userId, "2024-01-01", amount, 1)),
      ),
    );
    expect(races.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await asUser(() => budgets.save(userId, "2024-01-01", 0, 2));
    expect((await month("2024-01-01")).remainder).toBe(-180);
    expect((await month("2024-02-01")).budget).toBeNull();
    await asUser(() => budgets.save(userId, "2024-01-01", null, 3));
    expect((await month("2024-01-01")).budget?.amount).toBeNull();
    expect(await balance()).toBe(1000);
    const other = await createTestUserDirect(ds);
    expect(
      (
        await withUserContext(other.id, () =>
          read.month(other.id, "2024-01-01"),
        )
      ).rows,
    ).toHaveLength(0);
    const [bill] = (await month("2024-01-01")).rows;
    await expect(
      withUserContext(other.id, () =>
        commands.reserve(other.id, bill.scheduleId, bill.originalDate, {
          reserved: true,
          revision: bill.revision,
        }),
      ),
    ).rejects.toThrow();
  });
});
