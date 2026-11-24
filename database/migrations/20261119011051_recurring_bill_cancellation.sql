-- Retain monthly amounts and history when excluding an unpaid occurrence.
ALTER TABLE recurring_bill_states ADD COLUMN IF NOT EXISTS cancelled BOOLEAN NOT NULL DEFAULT FALSE;
