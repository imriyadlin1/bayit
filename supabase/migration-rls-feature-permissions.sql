-- ===========================================
-- RLS: enforce member_permissions (view vs edit)
-- Run this in Supabase SQL Editor on existing projects.
-- Default when no row in member_permissions = full edit (matches app).
-- ===========================================

CREATE OR REPLACE FUNCTION effective_feature_access(p_household uuid, p_feature text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  lvl text;
BEGIN
  IF p_household IS NULL OR auth.uid() IS NULL THEN
    RETURN 'hidden';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = p_household AND user_id = auth.uid() AND role = 'admin'
  ) INTO is_admin;

  IF is_admin THEN
    RETURN 'edit';
  END IF;

  SELECT mp.access_level INTO lvl
  FROM member_permissions mp
  WHERE mp.household_id = p_household
    AND mp.user_id = auth.uid()
    AND mp.feature = p_feature;

  IF lvl IS NULL THEN
    RETURN 'edit';
  END IF;

  RETURN lvl;
END;
$$;

-- --- Drop old broad member policies ---
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'expense_categories', 'expenses', 'budgets', 'shopping_lists',
    'inventory_items', 'plants', 'chores', 'maintenance_items', 'household_notes'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Members can view %1$s" ON %1$s', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can insert %1$s" ON %1$s', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can update %1$s" ON %1$s', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can delete %1$s" ON %1$s', tbl);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Members can view shopping items" ON shopping_items;
DROP POLICY IF EXISTS "Members can manage shopping items" ON shopping_items;

DROP POLICY IF EXISTS "Members can view plant logs" ON plant_care_logs;
DROP POLICY IF EXISTS "Members can manage plant logs" ON plant_care_logs;

DROP POLICY IF EXISTS "Members can view completions" ON chore_completions;
DROP POLICY IF EXISTS "Members can manage completions" ON chore_completions;

DROP POLICY IF EXISTS "Members can view splits" ON expense_splits;
DROP POLICY IF EXISTS "Members can manage splits" ON expense_splits;

-- --- expense_categories (feature: expenses) ---
CREATE POLICY "expense_categories_select_perm" ON expense_categories
  FOR SELECT USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') IN ('view', 'edit')
  );
CREATE POLICY "expense_categories_insert_perm" ON expense_categories
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') = 'edit'
  );
CREATE POLICY "expense_categories_update_perm" ON expense_categories
  FOR UPDATE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') = 'edit'
  ) WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') = 'edit'
  );
CREATE POLICY "expense_categories_delete_perm" ON expense_categories
  FOR DELETE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') = 'edit'
  );

-- --- expenses ---
CREATE POLICY "expenses_select_perm" ON expenses
  FOR SELECT USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') IN ('view', 'edit')
  );
CREATE POLICY "expenses_insert_perm" ON expenses
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') = 'edit'
  );
CREATE POLICY "expenses_update_perm" ON expenses
  FOR UPDATE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') = 'edit'
  ) WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') = 'edit'
  );
CREATE POLICY "expenses_delete_perm" ON expenses
  FOR DELETE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') = 'edit'
  );

-- --- budgets ---
CREATE POLICY "budgets_select_perm" ON budgets
  FOR SELECT USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') IN ('view', 'edit')
  );
CREATE POLICY "budgets_insert_perm" ON budgets
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') = 'edit'
  );
CREATE POLICY "budgets_update_perm" ON budgets
  FOR UPDATE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') = 'edit'
  ) WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') = 'edit'
  );
CREATE POLICY "budgets_delete_perm" ON budgets
  FOR DELETE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'expenses') = 'edit'
  );

-- --- shopping_lists ---
CREATE POLICY "shopping_lists_select_perm" ON shopping_lists
  FOR SELECT USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'shopping') IN ('view', 'edit')
  );
CREATE POLICY "shopping_lists_insert_perm" ON shopping_lists
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'shopping') = 'edit'
  );
CREATE POLICY "shopping_lists_update_perm" ON shopping_lists
  FOR UPDATE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'shopping') = 'edit'
  ) WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'shopping') = 'edit'
  );
CREATE POLICY "shopping_lists_delete_perm" ON shopping_lists
  FOR DELETE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'shopping') = 'edit'
  );

-- --- shopping_items ---
CREATE POLICY "shopping_items_select_perm" ON shopping_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shopping_lists sl
      WHERE sl.id = shopping_items.list_id
        AND is_household_member(sl.household_id)
        AND effective_feature_access(sl.household_id, 'shopping') IN ('view', 'edit')
    )
  );
CREATE POLICY "shopping_items_insert_perm" ON shopping_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_lists sl
      WHERE sl.id = list_id
        AND is_household_member(sl.household_id)
        AND effective_feature_access(sl.household_id, 'shopping') = 'edit'
    )
  );
CREATE POLICY "shopping_items_update_perm" ON shopping_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM shopping_lists sl
      WHERE sl.id = shopping_items.list_id
        AND is_household_member(sl.household_id)
        AND effective_feature_access(sl.household_id, 'shopping') = 'edit'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_lists sl
      WHERE sl.id = list_id
        AND is_household_member(sl.household_id)
        AND effective_feature_access(sl.household_id, 'shopping') = 'edit'
    )
  );
CREATE POLICY "shopping_items_delete_perm" ON shopping_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM shopping_lists sl
      WHERE sl.id = shopping_items.list_id
        AND is_household_member(sl.household_id)
        AND effective_feature_access(sl.household_id, 'shopping') = 'edit'
    )
  );

-- --- inventory_items ---
CREATE POLICY "inventory_select_perm" ON inventory_items
  FOR SELECT USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'inventory') IN ('view', 'edit')
  );
CREATE POLICY "inventory_insert_perm" ON inventory_items
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'inventory') = 'edit'
  );
CREATE POLICY "inventory_update_perm" ON inventory_items
  FOR UPDATE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'inventory') = 'edit'
  ) WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'inventory') = 'edit'
  );
CREATE POLICY "inventory_delete_perm" ON inventory_items
  FOR DELETE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'inventory') = 'edit'
  );

-- --- plants ---
CREATE POLICY "plants_select_perm" ON plants
  FOR SELECT USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'plants') IN ('view', 'edit')
  );
CREATE POLICY "plants_insert_perm" ON plants
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'plants') = 'edit'
  );
CREATE POLICY "plants_update_perm" ON plants
  FOR UPDATE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'plants') = 'edit'
  ) WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'plants') = 'edit'
  );
CREATE POLICY "plants_delete_perm" ON plants
  FOR DELETE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'plants') = 'edit'
  );

-- --- plant_care_logs ---
CREATE POLICY "plant_care_logs_select_perm" ON plant_care_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plants p
      WHERE p.id = plant_care_logs.plant_id
        AND is_household_member(p.household_id)
        AND effective_feature_access(p.household_id, 'plants') IN ('view', 'edit')
    )
  );
CREATE POLICY "plant_care_logs_insert_perm" ON plant_care_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM plants p
      WHERE p.id = plant_id
        AND is_household_member(p.household_id)
        AND effective_feature_access(p.household_id, 'plants') = 'edit'
    )
  );
CREATE POLICY "plant_care_logs_update_perm" ON plant_care_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM plants p
      WHERE p.id = plant_care_logs.plant_id
        AND is_household_member(p.household_id)
        AND effective_feature_access(p.household_id, 'plants') = 'edit'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM plants p
      WHERE p.id = plant_id
        AND is_household_member(p.household_id)
        AND effective_feature_access(p.household_id, 'plants') = 'edit'
    )
  );
CREATE POLICY "plant_care_logs_delete_perm" ON plant_care_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM plants p
      WHERE p.id = plant_care_logs.plant_id
        AND is_household_member(p.household_id)
        AND effective_feature_access(p.household_id, 'plants') = 'edit'
    )
  );

-- --- chores ---
CREATE POLICY "chores_select_perm" ON chores
  FOR SELECT USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'chores') IN ('view', 'edit')
  );
CREATE POLICY "chores_insert_perm" ON chores
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'chores') = 'edit'
  );
CREATE POLICY "chores_update_perm" ON chores
  FOR UPDATE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'chores') = 'edit'
  ) WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'chores') = 'edit'
  );
CREATE POLICY "chores_delete_perm" ON chores
  FOR DELETE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'chores') = 'edit'
  );

-- --- chore_completions ---
CREATE POLICY "chore_completions_select_perm" ON chore_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chores c
      WHERE c.id = chore_completions.chore_id
        AND is_household_member(c.household_id)
        AND effective_feature_access(c.household_id, 'chores') IN ('view', 'edit')
    )
  );
CREATE POLICY "chore_completions_insert_perm" ON chore_completions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chores c
      WHERE c.id = chore_id
        AND is_household_member(c.household_id)
        AND effective_feature_access(c.household_id, 'chores') = 'edit'
    )
  );
CREATE POLICY "chore_completions_update_perm" ON chore_completions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM chores c
      WHERE c.id = chore_completions.chore_id
        AND is_household_member(c.household_id)
        AND effective_feature_access(c.household_id, 'chores') = 'edit'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM chores c
      WHERE c.id = chore_id
        AND is_household_member(c.household_id)
        AND effective_feature_access(c.household_id, 'chores') = 'edit'
    )
  );
CREATE POLICY "chore_completions_delete_perm" ON chore_completions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM chores c
      WHERE c.id = chore_completions.chore_id
        AND is_household_member(c.household_id)
        AND effective_feature_access(c.household_id, 'chores') = 'edit'
    )
  );

-- --- maintenance_items ---
CREATE POLICY "maintenance_select_perm" ON maintenance_items
  FOR SELECT USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'maintenance') IN ('view', 'edit')
  );
CREATE POLICY "maintenance_insert_perm" ON maintenance_items
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'maintenance') = 'edit'
  );
CREATE POLICY "maintenance_update_perm" ON maintenance_items
  FOR UPDATE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'maintenance') = 'edit'
  ) WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'maintenance') = 'edit'
  );
CREATE POLICY "maintenance_delete_perm" ON maintenance_items
  FOR DELETE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'maintenance') = 'edit'
  );

-- --- household_notes ---
CREATE POLICY "household_notes_select_perm" ON household_notes
  FOR SELECT USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'notes') IN ('view', 'edit')
  );
CREATE POLICY "household_notes_insert_perm" ON household_notes
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'notes') = 'edit'
  );
CREATE POLICY "household_notes_update_perm" ON household_notes
  FOR UPDATE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'notes') = 'edit'
  ) WITH CHECK (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'notes') = 'edit'
  );
CREATE POLICY "household_notes_delete_perm" ON household_notes
  FOR DELETE USING (
    is_household_member(household_id)
    AND effective_feature_access(household_id, 'notes') = 'edit'
  );

-- --- expense_splits ---
CREATE POLICY "expense_splits_select_perm" ON expense_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_splits.expense_id
        AND is_household_member(e.household_id)
        AND effective_feature_access(e.household_id, 'expenses') IN ('view', 'edit')
    )
  );
CREATE POLICY "expense_splits_insert_perm" ON expense_splits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_id
        AND is_household_member(e.household_id)
        AND effective_feature_access(e.household_id, 'expenses') = 'edit'
    )
  );
CREATE POLICY "expense_splits_update_perm" ON expense_splits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_splits.expense_id
        AND is_household_member(e.household_id)
        AND effective_feature_access(e.household_id, 'expenses') = 'edit'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_id
        AND is_household_member(e.household_id)
        AND effective_feature_access(e.household_id, 'expenses') = 'edit'
    )
  );
CREATE POLICY "expense_splits_delete_perm" ON expense_splits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_splits.expense_id
        AND is_household_member(e.household_id)
        AND effective_feature_access(e.household_id, 'expenses') = 'edit'
    )
  );
