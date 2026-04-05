-- מטא-נתוני פעילות (ספורט משעון / ידני) + הגדרות התאמה אישית למדור

ALTER TABLE personal_activity_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS personal_section_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('studies', 'work', 'sport', 'health')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, user_id, section)
);

CREATE INDEX IF NOT EXISTS idx_personal_section_settings_lookup
  ON personal_section_settings (household_id, user_id, section);

ALTER TABLE personal_section_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_section_settings_select" ON personal_section_settings;
DROP POLICY IF EXISTS "personal_section_settings_insert" ON personal_section_settings;
DROP POLICY IF EXISTS "personal_section_settings_update" ON personal_section_settings;
DROP POLICY IF EXISTS "personal_section_settings_delete" ON personal_section_settings;

CREATE POLICY "personal_section_settings_select" ON personal_section_settings
  FOR SELECT USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
    AND user_id = auth.uid()
  );

CREATE POLICY "personal_section_settings_insert" ON personal_section_settings
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND is_personal_household(household_id)
    AND user_id = auth.uid()
  );

CREATE POLICY "personal_section_settings_update" ON personal_section_settings
  FOR UPDATE USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
    AND user_id = auth.uid()
  )
  WITH CHECK (
    is_household_member(household_id)
    AND is_personal_household(household_id)
    AND user_id = auth.uid()
  );

CREATE POLICY "personal_section_settings_delete" ON personal_section_settings
  FOR DELETE USING (
    is_household_member(household_id)
    AND is_personal_household(household_id)
    AND user_id = auth.uid()
  );
