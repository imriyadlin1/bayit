-- ===========================================
-- Bayit - Database Schema
-- ===========================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    CASE WHEN NEW.email = 'imri.yadlin1@gmail.com' THEN TRUE ELSE FALSE END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Platform admin check helper
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Households
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  is_personal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Household Members
CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

-- Expense Categories (with defaults per household)
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 10000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default categories for new households
CREATE OR REPLACE FUNCTION public.seed_expense_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO expense_categories (household_id, name, icon, color, is_default, sort_order) VALUES
    (NEW.id, 'אוכל בחוץ', 'UtensilsCrossed', '#f97316', TRUE, 1),
    (NEW.id, 'סופר', 'ShoppingCart', '#10b981', TRUE, 2),
    (NEW.id, 'שכר דירה', 'Home', '#6366f1', TRUE, 3),
    (NEW.id, 'חשמל', 'Zap', '#f59e0b', TRUE, 4),
    (NEW.id, 'מים', 'Droplets', '#3b82f6', TRUE, 5),
    (NEW.id, 'גז', 'Flame', '#ef4444', TRUE, 6),
    (NEW.id, 'ארנונה', 'Building', '#8b5cf6', TRUE, 7),
    (NEW.id, 'ועד בית', 'Building2', '#a855f7', TRUE, 8),
    (NEW.id, 'אינטרנט', 'Wifi', '#06b6d4', TRUE, 9),
    (NEW.id, 'טלוויזיה', 'Tv', '#7c3aed', TRUE, 10),
    (NEW.id, 'ביטוח', 'Shield', '#64748b', TRUE, 11),
    (NEW.id, 'דלק', 'Fuel', '#ca8a04', TRUE, 12),
    (NEW.id, 'אחר', 'MoreHorizontal', '#737373', TRUE, 13);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_household_created
  AFTER INSERT ON households
  FOR EACH ROW EXECUTE FUNCTION public.seed_expense_categories();

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  category_id UUID REFERENCES expense_categories(id),
  added_by UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  receipt_url TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_interval TEXT CHECK (recurring_interval IN ('monthly', 'quarterly', 'yearly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budgets (monthly per category)
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  category_id UUID REFERENCES expense_categories(id),
  amount DECIMAL(10,2) NOT NULL,
  month TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, category_id, month)
);

-- Expense Splits (who owes what)
CREATE TABLE expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  amount DECIMAL(10,2) NOT NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping Lists
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping Items
CREATE TABLE shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT,
  is_checked BOOLEAN DEFAULT FALSE,
  added_by UUID REFERENCES profiles(id),
  checked_by UUID REFERENCES profiles(id),
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory (Pantry/Home Stock)
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT,
  category TEXT,
  expiry_date DATE,
  min_quantity DECIMAL(10,2),
  added_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plants
CREATE TABLE plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT,
  location TEXT,
  image_url TEXT,
  watering_frequency_days INT,
  sunlight_needs TEXT CHECK (sunlight_needs IN ('full', 'partial', 'shade')),
  last_watered DATE,
  next_watering DATE,
  notes TEXT,
  added_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plant Care Logs
CREATE TABLE plant_care_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  action TEXT CHECK (action IN ('water', 'fertilize', 'repot', 'prune', 'other')),
  notes TEXT,
  image_url TEXT,
  done_by UUID REFERENCES profiles(id),
  done_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chores
CREATE TABLE chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'once')),
  assigned_to UUID REFERENCES profiles(id),
  rotate BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chore Completions
CREATE TABLE chore_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id UUID REFERENCES chores(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Home Maintenance
CREATE TABLE maintenance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT CHECK (frequency IN ('monthly', 'quarterly', 'biannual', 'yearly', 'once')),
  last_done DATE,
  next_due DATE,
  category TEXT,
  service_provider TEXT,
  service_phone TEXT,
  cost DECIMAL(10,2),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Household Notes / Message Board
CREATE TABLE household_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  color TEXT,
  pinned BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- יעדים אישיים (רק למשקים עם is_personal)
CREATE TABLE personal_goals (
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

-- פריטים אישיים לפי מדור (לימודים, עבודה, ספורט, פיננסים, בריאות)
CREATE TABLE personal_items (
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

-- מעקב אישי לפי זמן (לימודים, עבודה, ספורט, בריאות) — רשומות תאריך, לא מטלות
CREATE TABLE personal_activity_logs (
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

-- התחייבויות כספיות קבועות (אישי) — לא הוצאות משק
CREATE TABLE personal_finance_commitments (
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

-- סימון תשלום לתקופה (חודש / שבוע / שנה לפי cadence)
CREATE TABLE personal_finance_period_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID NOT NULL REFERENCES personal_finance_commitments(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  UNIQUE(commitment_id, period_key)
);

-- ===========================================
-- Row Level Security (RLS)
-- ===========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_care_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE chore_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_finance_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_finance_period_payments ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is in a household
CREATE OR REPLACE FUNCTION is_household_member(h_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = h_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_personal_household(h_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM households WHERE id = h_id AND is_personal IS TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Profiles: members of same household can see each other
CREATE POLICY "Household members can view each other" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT hm.user_id FROM household_members hm
      WHERE hm.household_id IN (
        SELECT hm2.household_id FROM household_members hm2
        WHERE hm2.user_id = auth.uid()
      )
    )
  );

-- Platform admin: can view all profiles, households, and members
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_platform_admin());
CREATE POLICY "Admins can view all households" ON households
  FOR SELECT USING (is_platform_admin());
CREATE POLICY "Admins can view all members" ON household_members
  FOR SELECT USING (is_platform_admin());

-- Households: members can view
CREATE POLICY "Members can view household" ON households
  FOR SELECT USING (is_household_member(id));
CREATE POLICY "Users can create households" ON households
  FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update household" ON households
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM household_members
      WHERE household_id = id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- Household members
CREATE POLICY "Members can view members" ON household_members
  FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "Can join household" ON household_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage members" ON household_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_members.household_id
        AND hm.user_id = auth.uid() AND hm.role = 'admin'
    )
  );

-- Member Permissions (declared before RLS policies that call effective_feature_access)
CREATE TABLE member_permissions (
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

CREATE INDEX idx_member_permissions_household_user ON member_permissions(household_id, user_id);

-- Resolve view vs edit for RLS (requires member_permissions table above)
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

-- Household-scoped tables: SELECT if view/edit; mutate only if edit

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

-- ===========================================
-- RPC Functions
-- ===========================================

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

CREATE OR REPLACE FUNCTION create_household_with_member(household_name TEXT)
RETURNS JSON AS $$
DECLARE
  new_household_id UUID;
  new_invite_code TEXT;
BEGIN
  INSERT INTO households (name, created_by)
  VALUES (household_name, auth.uid())
  RETURNING id, invite_code INTO new_household_id, new_invite_code;

  INSERT INTO household_members (household_id, user_id, role)
  VALUES (new_household_id, auth.uid(), 'admin');

  RETURN json_build_object('id', new_household_id, 'invite_code', new_invite_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION join_household_by_code(invite TEXT)
RETURNS JSON AS $$
DECLARE
  found_household_id UUID;
BEGIN
  SELECT id INTO found_household_id
  FROM households
  WHERE invite_code = invite;

  IF found_household_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO household_members (household_id, user_id, role)
  VALUES (found_household_id, auth.uid(), 'member')
  ON CONFLICT (household_id, user_id) DO NOTHING;

  RETURN json_build_object('household_id', found_household_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- Indexes
-- ===========================================

CREATE INDEX idx_household_members_user ON household_members(user_id);
CREATE INDEX idx_household_members_household ON household_members(household_id);
CREATE INDEX idx_expenses_household ON expenses(household_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_budgets_household_month ON budgets(household_id, month);
CREATE INDEX idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX idx_shopping_items_list ON shopping_items(list_id);
CREATE INDEX idx_inventory_household ON inventory_items(household_id);
CREATE INDEX idx_plants_household ON plants(household_id);
CREATE INDEX idx_plants_next_watering ON plants(next_watering);
CREATE INDEX idx_chores_household ON chores(household_id);
CREATE INDEX idx_maintenance_household ON maintenance_items(household_id);
CREATE INDEX idx_maintenance_next_due ON maintenance_items(next_due);
CREATE INDEX idx_household_notes_household ON household_notes(household_id);
CREATE INDEX idx_personal_goals_household ON personal_goals(household_id);
CREATE INDEX idx_personal_items_household_section ON personal_items(household_id, section);
CREATE INDEX idx_personal_activity_household_section_date ON personal_activity_logs(household_id, section, occurred_at DESC);
CREATE INDEX idx_personal_finance_commitments_household ON personal_finance_commitments(household_id);
CREATE INDEX idx_personal_finance_payments_household ON personal_finance_period_payments(household_id);
CREATE INDEX idx_personal_finance_payments_commitment ON personal_finance_period_payments(commitment_id);
