-- יעדים אישיים (מרחב is_personal בלבד) — הרץ ב-Supabase SQL Editor
CREATE TABLE IF NOT EXISTS personal_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE personal_goals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_personal_household(h_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM households WHERE id = h_id AND is_personal IS TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER;

DROP POLICY IF EXISTS "personal_goals_select" ON personal_goals;
DROP POLICY IF EXISTS "personal_goals_insert" ON personal_goals;
DROP POLICY IF EXISTS "personal_goals_update" ON personal_goals;
DROP POLICY IF EXISTS "personal_goals_delete" ON personal_goals;

CREATE POLICY "personal_goals_select" ON personal_goals
  FOR SELECT USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );
CREATE POLICY "personal_goals_insert" ON personal_goals
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND is_personal_household(household_id)
    AND created_by = auth.uid()
  );
CREATE POLICY "personal_goals_update" ON personal_goals
  FOR UPDATE USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  ) WITH CHECK (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );
CREATE POLICY "personal_goals_delete" ON personal_goals
  FOR DELETE USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );

CREATE INDEX IF NOT EXISTS idx_personal_goals_household ON personal_goals(household_id);
