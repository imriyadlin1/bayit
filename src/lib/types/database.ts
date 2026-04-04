export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Household {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  is_personal: boolean;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
}

export interface ExpenseCategory {
  id: string;
  household_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  household_id: string;
  category_id: string | null;
  added_by: string;
  title: string;
  amount: number;
  date: string;
  notes: string | null;
  receipt_url: string | null;
  is_recurring: boolean;
  recurring_interval: "monthly" | "quarterly" | "yearly" | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  household_id: string;
  category_id: string | null;
  amount: number;
  month: string;
  created_by: string;
  created_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  is_paid: boolean;
  created_at: string;
}

export interface ShoppingList {
  id: string;
  household_id: string;
  name: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShoppingItem {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  is_checked: boolean;
  added_by: string;
  checked_by: string | null;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  household_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: string | null;
  expiry_date: string | null;
  min_quantity: number | null;
  added_by: string;
  created_at: string;
  updated_at: string;
}

export interface Plant {
  id: string;
  household_id: string;
  name: string;
  species: string | null;
  location: string | null;
  image_url: string | null;
  watering_frequency_days: number | null;
  sunlight_needs: "full" | "partial" | "shade" | null;
  last_watered: string | null;
  next_watering: string | null;
  notes: string | null;
  added_by: string;
  created_at: string;
  updated_at: string;
}

export interface PlantCareLog {
  id: string;
  plant_id: string;
  action: "water" | "fertilize" | "repot" | "prune" | "other";
  notes: string | null;
  image_url: string | null;
  done_by: string;
  done_at: string;
}

export interface Chore {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "once";
  assigned_to: string | null;
  rotate: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChoreCompletion {
  id: string;
  chore_id: string;
  completed_by: string;
  completed_at: string;
  notes: string | null;
}

export interface MaintenanceItem {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  frequency: "monthly" | "quarterly" | "biannual" | "yearly" | "once";
  last_done: string | null;
  next_due: string | null;
  category: string | null;
  service_provider: string | null;
  service_phone: string | null;
  cost: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type FeatureKey = "expenses" | "shopping" | "inventory" | "plants" | "chores" | "maintenance" | "notes";
export type AccessLevel = "hidden" | "view" | "edit";

export interface MemberPermission {
  id: string;
  household_id: string;
  user_id: string;
  feature: FeatureKey;
  access_level: AccessLevel;
}

export interface HouseholdNote {
  id: string;
  household_id: string;
  title: string | null;
  content: string;
  color: string | null;
  pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
