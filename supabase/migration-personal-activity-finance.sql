-- מעקב לפי זמן (פעילות) + התחייבויות פיננסיות קבועות (מרחב is_personal בלבד)
-- דורש: is_household_member, is_personal_household

CREATE TABLE IF NOT EXISTS personal_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('studies', 'work', 'sport', 'health')),
  title TEXT NOT NULL,
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INT CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal_finance_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'monthly', 'yearly')),
  day_of_month INT CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 28)),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal_finance_period_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID NOT NULL REFERENCES personal_finance_commitments(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  UNIQUE(commitment_id, period_key)
);

ALTER TABLE personal_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_finance_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_finance_period_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_activity_logs_select" ON personal_activity_logs;
DROP POLICY IF EXISTS "personal_activity_logs_insert" ON personal_activity_logs;
DROP POLICY IF EXISTS "personal_activity_logs_update" ON personal_activity_logs;
DROP POLICY IF EXISTS "personal_activity_logs_delete" ON personal_activity_logs;
DROP POLICY IF EXISTS "personal_finance_commitments_select" ON personal_finance_commitments;
DROP POLICY IF EXISTS "personal_finance_commitments_insert" ON personal_finance_commitments;
DROP POLICY IF EXISTS "personal_finance_commitments_update" ON personal_finance_commitments;
DROP POLICY IF EXISTS "personal_finance_commitments_delete" ON personal_finance_commitments;
DROP POLICY IF EXISTS "personal_finance_payments_select" ON personal_finance_period_payments;
DROP POLICY IF EXISTS "personal_finance_payments_insert" ON personal_finance_period_payments;
DROP POLICY IF EXISTS "personal_finance_payments_delete" ON personal_finance_period_payments;

CREATE POLICY "personal_activity_logs_select" ON personal_activity_logs
  FOR SELECT USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );
CREATE POLICY "personal_activity_logs_insert" ON personal_activity_logs
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND is_personal_household(household_id)
    AND created_by = auth.uid()
  );
CREATE POLICY "personal_activity_logs_update" ON personal_activity_logs
  FOR UPDATE USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  ) WITH CHECK (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );
CREATE POLICY "personal_activity_logs_delete" ON personal_activity_logs
  FOR DELETE USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );

CREATE POLICY "personal_finance_commitments_select" ON personal_finance_commitments
  FOR SELECT USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );
CREATE POLICY "personal_finance_commitments_insert" ON personal_finance_commitments
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND is_personal_household(household_id)
    AND created_by = auth.uid()
  );
CREATE POLICY "personal_finance_commitments_update" ON personal_finance_commitments
  FOR UPDATE USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  ) WITH CHECK (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );
CREATE POLICY "personal_finance_commitments_delete" ON personal_finance_commitments
  FOR DELETE USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );

CREATE POLICY "personal_finance_payments_select" ON personal_finance_period_payments
  FOR SELECT USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );
CREATE POLICY "personal_finance_payments_insert" ON personal_finance_period_payments
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND is_personal_household(household_id)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM personal_finance_commitments c
      WHERE c.id = commitment_id AND c.household_id = personal_finance_period_payments.household_id
    )
  );
CREATE POLICY "personal_finance_payments_delete" ON personal_finance_period_payments
  FOR DELETE USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );

CREATE INDEX IF NOT EXISTS idx_personal_activity_household_section_date ON personal_activity_logs(household_id, section, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_finance_commitments_household ON personal_finance_commitments(household_id);
CREATE INDEX IF NOT EXISTS idx_personal_finance_payments_household ON personal_finance_period_payments(household_id);
CREATE INDEX IF NOT EXISTS idx_personal_finance_payments_commitment ON personal_finance_period_payments(commitment_id);
