-- Retain occurrence links across transaction delete/undo without copying money.
ALTER TABLE recurring_bill_states ADD COLUMN IF NOT EXISTS payment_transaction_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_recurring_bill_payment_links ON recurring_bill_states USING gin (payment_transaction_ids);

CREATE OR REPLACE FUNCTION restore_recurring_bill_payment_claim()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE slot RECORD;
BEGIN
  FOR slot IN
    SELECT bs.scheduled_transaction_id, bs.original_date
    FROM recurring_bill_states bs
    JOIN scheduled_transactions st ON st.id = bs.scheduled_transaction_id AND st.user_id = bs.user_id
    WHERE bs.user_id = NEW.user_id AND bs.payment_transaction_ids ? NEW.id::text
    FOR UPDATE OF st
  LOOP
    INSERT INTO scheduled_transaction_postings
      (scheduled_transaction_id, original_due_date, posted_date, transaction_id, source)
    VALUES (slot.scheduled_transaction_id, slot.original_date, NEW.transaction_date, NEW.id, 'post')
    ON CONFLICT (scheduled_transaction_id, original_due_date) DO UPDATE
      SET transaction_id = EXCLUDED.transaction_id
      WHERE scheduled_transaction_postings.transaction_id = EXCLUDED.transaction_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Recurring bill occurrence already has another payment' USING ERRCODE = '23505';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'restore_recurring_bill_payment_claim') THEN
    CREATE TRIGGER restore_recurring_bill_payment_claim AFTER INSERT ON transactions
      FOR EACH ROW EXECUTE FUNCTION restore_recurring_bill_payment_claim();
  END IF;
END $$;
