-- Monthly bill metadata and optional planning allocations; no ledger backfill.
ALTER TABLE scheduled_transactions ADD COLUMN IF NOT EXISTS monthly_tracking_start DATE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_transactions_id_owner ON scheduled_transactions (id, user_id);

CREATE TABLE IF NOT EXISTS recurring_bill_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_transaction_id UUID NOT NULL,
    original_date DATE NOT NULL,
    reserved BOOLEAN NOT NULL DEFAULT FALSE,
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    expected_amount NUMERIC(24,8) CHECK (expected_amount >= 0),
    due_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_recurring_bill_states_slot UNIQUE (scheduled_transaction_id, original_date),
    CONSTRAINT fk_recurring_bill_states_owner FOREIGN KEY (scheduled_transaction_id, user_id)
      REFERENCES scheduled_transactions(id, user_id) ON DELETE CASCADE,
    CONSTRAINT ck_recurring_bill_states_snapshot CHECK ((expected_amount IS NULL) = (due_date IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_recurring_bill_states_owner ON recurring_bill_states (user_id);

-- A cleared amount keeps its revision to reject stale saves after removal.
CREATE TABLE IF NOT EXISTS recurring_bill_month_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
    amount NUMERIC(24,8) CHECK (amount >= 0),
    currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_recurring_bill_month_budget UNIQUE (user_id, month)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_bill_states' AND policyname = 'recurring_bill_states_owner') THEN
        CREATE POLICY recurring_bill_states_owner ON recurring_bill_states
          USING (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()))
          WITH CHECK (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_bill_month_budgets' AND policyname = 'recurring_bill_month_budgets_owner') THEN
        CREATE POLICY recurring_bill_month_budgets_owner ON recurring_bill_month_budgets
          USING (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()))
          WITH CHECK (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()));
    END IF;
END $$;
ALTER TABLE recurring_bill_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bill_month_budgets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION currency_code_in_use_globally(p_code VARCHAR)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shared_groups WHERE currency_code = p_code
    UNION ALL SELECT 1 FROM shared_entries WHERE original_currency_code = p_code
    UNION ALL
    SELECT 1 FROM user_currency_preferences WHERE currency_code = p_code
    UNION ALL SELECT 1 FROM exchange_rates
      WHERE from_currency = p_code OR to_currency = p_code
    UNION ALL SELECT 1 FROM exchange_rate_coverage
      WHERE from_currency = p_code OR to_currency = p_code
    UNION ALL SELECT 1 FROM accounts WHERE currency_code = p_code
    UNION ALL SELECT 1 FROM transactions
      WHERE currency_code = p_code OR original_currency_code = p_code
    UNION ALL SELECT 1 FROM securities WHERE currency_code = p_code
    UNION ALL SELECT 1 FROM bond_programs WHERE currency_code = p_code
    UNION ALL SELECT 1 FROM bond_instruments WHERE currency_code = p_code
    UNION ALL SELECT 1 FROM scheduled_transactions
      WHERE currency_code = p_code OR original_currency_code = p_code
    UNION ALL SELECT 1 FROM recurring_bill_month_budgets WHERE currency_code = p_code
    UNION ALL SELECT 1 FROM budgets WHERE currency_code = p_code
    UNION ALL SELECT 1 FROM warranties WHERE currency_code = p_code
    UNION ALL SELECT 1 FROM user_preferences WHERE default_currency = p_code
  )
$$;

CREATE OR REPLACE FUNCTION currency_codes_referenced_by_user_data(p_user_id uuid)
RETURNS SETOF varchar
LANGUAGE sql
STABLE
AS $$
  SELECT code FROM (
    SELECT currency_code AS code FROM shared_groups WHERE id IN (SELECT g.id FROM shared_groups g WHERE g.owner_user_id = p_user_id OR EXISTS (SELECT 1 FROM shared_memberships m WHERE m.group_id = g.id AND m.user_id = p_user_id AND m.revoked_at IS NULL))
    UNION SELECT original_currency_code FROM shared_entries WHERE group_id IN (SELECT g.id FROM shared_groups g WHERE g.owner_user_id = p_user_id OR EXISTS (SELECT 1 FROM shared_memberships m WHERE m.group_id = g.id AND m.user_id = p_user_id AND m.revoked_at IS NULL))
    UNION SELECT default_currency AS code FROM user_preferences WHERE user_id = p_user_id
    UNION SELECT currency_code FROM accounts WHERE user_id = p_user_id
    UNION SELECT currency_code FROM transactions WHERE user_id = p_user_id
    UNION SELECT original_currency_code FROM transactions WHERE user_id = p_user_id
    UNION SELECT currency_code FROM securities WHERE user_id = p_user_id
    UNION SELECT currency_code FROM scheduled_transactions WHERE user_id = p_user_id
    UNION SELECT original_currency_code FROM scheduled_transactions WHERE user_id = p_user_id
    UNION SELECT currency_code FROM recurring_bill_month_budgets WHERE user_id = p_user_id
    UNION SELECT currency_code FROM budgets WHERE user_id = p_user_id
    UNION SELECT currency_code FROM warranties WHERE user_id = p_user_id
  ) referenced
  WHERE code IS NOT NULL
$$;

REVOKE ALL ON FUNCTION currency_code_in_use_globally(VARCHAR) FROM PUBLIC;
