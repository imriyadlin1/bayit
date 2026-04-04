-- =====================================================
-- Migration: Permissions + Personal Space
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add is_personal column to households
ALTER TABLE households ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;

-- 2. Create member_permissions table
CREATE TABLE IF NOT EXISTS member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('expenses', 'shopping', 'inventory', 'plants', 'chores', 'maintenance', 'notes')),
  access_level TEXT NOT NULL CHECK (access_level IN ('hidden', 'view', 'edit')),
  UNIQUE(household_id, user_id, feature)
);

ALTER TABLE member_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own permissions" ON member_permissions
  FOR SELECT USING (user_id = auth.uid() OR is_household_member(household_id));

CREATE POLICY "Admins can manage permissions" ON member_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = member_permissions.household_id
      AND hm.user_id = auth.uid() AND hm.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_member_permissions_household_user ON member_permissions(household_id, user_id);

-- 3. Create personal space RPC function
CREATE OR REPLACE FUNCTION create_personal_space(space_name TEXT)
RETURNS JSON AS $$
DECLARE
  new_id UUID;
  existing_id UUID;
BEGIN
  SELECT h.id INTO existing_id
  FROM households h
  JOIN household_members hm ON hm.household_id = h.id
  WHERE hm.user_id = auth.uid() AND h.is_personal = TRUE
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN json_build_object('id', existing_id);
  END IF;

  INSERT INTO households (name, created_by, is_personal)
  VALUES (space_name, auth.uid(), TRUE)
  RETURNING id INTO new_id;

  INSERT INTO household_members (household_id, user_id, role)
  VALUES (new_id, auth.uid(), 'admin');

  RETURN json_build_object('id', new_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
