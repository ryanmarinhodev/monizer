import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";
import { ensureYMD } from "../../common/recurrence";

/** Initial allocation for a whole month. Never contributes to a bank balance. */
@Entity("recurring_bill_month_budgets")
@Unique(["userId", "month"])
export class RecurringBillMonthBudget {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "uuid", name: "user_id" }) userId: string;
  @Column({
    type: "date",
    transformer: {
      from: ensureYMD,
      to: (value: string) => value,
    },
  })
  month: string;
  @Column({
    type: "numeric",
    precision: 24,
    scale: 8,
    nullable: true,
    transformer: {
      from: (value: string | null) => (value === null ? null : Number(value)),
      to: (value: number | null) => value,
    },
  })
  amount: number | null;
  @Column({ type: "varchar", length: 3, name: "currency_code" })
  currencyCode: string;
  @Column({ type: "integer", default: 1 }) revision: number;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}
