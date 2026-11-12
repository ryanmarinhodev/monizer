import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";
import { ensureYMD } from "../../common/recurrence";

/** Metadata for a slot; actual payments remain in the transaction ledger. */
@Entity("recurring_bill_states")
@Unique(["scheduledTransactionId", "originalDate"])
export class RecurringBillState {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "uuid", name: "user_id" }) userId: string;
  @Column({ type: "uuid", name: "scheduled_transaction_id" })
  scheduledTransactionId: string;
  @Column({
    type: "date",
    name: "original_date",
    transformer: {
      from: ensureYMD,
      to: (value: string) => value,
    },
  })
  originalDate: string;
  @Column({ default: false }) reserved: boolean;
  @Column({ type: "integer", default: 0 }) revision: number;
  @Column({
    type: "numeric",
    precision: 24,
    scale: 8,
    name: "expected_amount",
    nullable: true,
    transformer: {
      from: (value: string | null) => (value === null ? null : Number(value)),
      to: (value: number | null) => value,
    },
  })
  expectedAmount: number | null;
  @Column({
    type: "date",
    name: "due_date",
    nullable: true,
    transformer: {
      from: (value: string | Date | null) =>
        value === null ? null : ensureYMD(value),
      to: (value: string | null) => value,
    },
  })
  dueDate: string | null;
  @Column({ type: "jsonb", name: "payment_transaction_ids", default: [] })
  paymentTransactionIds: string[];

  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}
