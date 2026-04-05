-- פריטים אישיים לפי מדור (לימודים, עבודה וכו') — רק משקים is_personal
CREATE TABLE IF NOT EXISTS personal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('studies', 'work', 'sport', 'finance', 'health')),
  title TEXT NOT NULL,
  description TEXT,
  reminder_date DATE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE personal_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_items_select" ON personal_items;
DROP POLICY IF EXISTS "personal_items_insert" ON personal_items;
DROP POLICY IF EXISTS "personal_items_update" ON personal_items;
DROP POLICY IF EXISTS "personal_items_delete" ON personal_items;

CREATE POLICY "personal_items_select" ON personal_items
  FOR SELECT USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );
CREATE POLICY "personal_items_insert" ON personal_items
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND is_personal_household(household_id)
    AND created_by = auth.uid()
  );
CREATE POLICY "personal_items_update" ON personal_items
  FOR UPDATE USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  ) WITH CHECK (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );
CREATE POLICY "personal_items_delete" ON personal_items
  FOR DELETE USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
  );

CREATE INDEX IF NOT EXISTS idx_personal_items_household_section ON personal_items(household_id, section);
