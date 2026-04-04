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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default categories for new households
CREATE OR REPLACE FUNCTION public.seed_expense_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO expense_categories (household_id, name, icon, color, is_default) VALUES
    (NEW.id, 'שכר דירה', 'Home', '#6366f1', TRUE),
    (NEW.id, 'חשמל', 'Zap', '#f59e0b', TRUE),
    (NEW.id, 'מים', 'Droplets', '#3b82f6', TRUE),
    (NEW.id, 'ארנונה', 'Building', '#8b5cf6', TRUE),
    (NEW.id, 'גז', 'Flame', '#ef4444', TRUE),
    (NEW.id, 'אינטרנט', 'Wifi', '#06b6d4', TRUE),
    (NEW.id, 'סופר', 'ShoppingCart', '#10b981', TRUE),
    (NEW.id, 'ביטוח', 'Shield', '#64748b', TRUE),
    (NEW.id, 'ועד בית', 'Building2', '#a855f7', TRUE),
    (NEW.id, 'אחר', 'MoreHorizontal', '#737373', TRUE);
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

-- Helper: check if user is in a household
CREATE OR REPLACE FUNCTION is_household_member(h_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = h_id AND user_id = auth.uid()
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

-- Macro policy for household-scoped tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'expense_categories', 'expenses', 'budgets', 'shopping_lists',
    'inventory_items', 'plants', 'chores', 'maintenance_items', 'household_notes'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "Members can view %1$s" ON %1$s FOR SELECT USING (is_household_member(household_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Members can insert %1$s" ON %1$s FOR INSERT WITH CHECK (is_household_member(household_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Members can update %1$s" ON %1$s FOR UPDATE USING (is_household_member(household_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Members can delete %1$s" ON %1$s FOR DELETE USING (is_household_member(household_id))',
      tbl
    );
  END LOOP;
END $$;

-- Shopping items: access through list's household
CREATE POLICY "Members can view shopping items" ON shopping_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shopping_lists sl
      WHERE sl.id = shopping_items.list_id AND is_household_member(sl.household_id)
    )
  );
CREATE POLICY "Members can manage shopping items" ON shopping_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM shopping_lists sl
      WHERE sl.id = shopping_items.list_id AND is_household_member(sl.household_id)
    )
  );

-- Plant care logs: access through plant's household
CREATE POLICY "Members can view plant logs" ON plant_care_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plants p
      WHERE p.id = plant_care_logs.plant_id AND is_household_member(p.household_id)
    )
  );
CREATE POLICY "Members can manage plant logs" ON plant_care_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM plants p
      WHERE p.id = plant_care_logs.plant_id AND is_household_member(p.household_id)
    )
  );

-- Chore completions: access through chore's household
CREATE POLICY "Members can view completions" ON chore_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chores c
      WHERE c.id = chore_completions.chore_id AND is_household_member(c.household_id)
    )
  );
CREATE POLICY "Members can manage completions" ON chore_completions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chores c
      WHERE c.id = chore_completions.chore_id AND is_household_member(c.household_id)
    )
  );

-- Expense splits: access through expense's household
CREATE POLICY "Members can view splits" ON expense_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_splits.expense_id AND is_household_member(e.household_id)
    )
  );
CREATE POLICY "Members can manage splits" ON expense_splits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_splits.expense_id AND is_household_member(e.household_id)
    )
  );

-- Member Permissions
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
CREATE INDEX idx_member_permissions_household_user ON member_permissions(household_id, user_id);
