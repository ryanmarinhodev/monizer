-- Include monthly bill budgets in the global currency kind-change gate.
CREATE OR REPLACE FUNCTION currency_code_referenced_by_data(p_code VARCHAR)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shared_groups WHERE currency_code = p_code
    UNION ALL SELECT 1 FROM shared_entries WHERE original_currency_code = p_code
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

COMMENT ON FUNCTION currency_code_referenced_by_data(VARCHAR) IS
  'True when any row anywhere other than a user_currency_preferences activation '
  'references currencies(code) = p_code. The kind-change gate: an activation is '
  'a list entry, not a use. SECURITY DEFINER so the answer is global; must '
  'consult every other FK to currencies(code) -- enforced by '
  'currency-references.spec.ts.';

REVOKE ALL ON FUNCTION currency_code_referenced_by_data(VARCHAR) FROM PUBLIC;
