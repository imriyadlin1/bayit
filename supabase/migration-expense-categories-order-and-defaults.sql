-- קטגוריות הוצאות: סדר תצוגה + ברירות מחדל מעודכנות + קטגוריות חסרות לכל משק קיים
-- הרץ ב-Supabase SQL Editor

ALTER TABLE expense_categories
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 10000;

-- סידור מחדש לפי שם (לכל השורות הקיימות)
UPDATE expense_categories SET sort_order = CASE trim(both from name)
  WHEN 'אוכל בחוץ' THEN 1
  WHEN 'סופר' THEN 2
  WHEN 'שכר דירה' THEN 3
  WHEN 'חשמל' THEN 4
  WHEN 'מים' THEN 5
  WHEN 'גז' THEN 6
  WHEN 'ארנונה' THEN 7
  WHEN 'ועד בית' THEN 8
  WHEN 'אינטרנט' THEN 9
  WHEN 'טלוויזיה' THEN 10
  WHEN 'ביטוח' THEN 11
  WHEN 'דלק' THEN 12
  WHEN 'אחר' THEN 13
  ELSE sort_order
END;

-- הוספת קטגוריות ברירת מחדל שחסרות בכל משק
INSERT INTO expense_categories (household_id, name, icon, color, is_default, sort_order)
SELECT h.id, d.name, d.icon, d.color, TRUE, d.sort_order
FROM households h
CROSS JOIN (
  VALUES
    ('אוכל בחוץ', 'UtensilsCrossed', '#f97316'::text, 1),
    ('סופר', 'ShoppingCart', '#10b981'::text, 2),
    ('שכר דירה', 'Home', '#6366f1'::text, 3),
    ('חשמל', 'Zap', '#f59e0b'::text, 4),
    ('מים', 'Droplets', '#3b82f6'::text, 5),
    ('גז', 'Flame', '#ef4444'::text, 6),
    ('ארנונה', 'Building', '#8b5cf6'::text, 7),
    ('ועד בית', 'Building2', '#a855f7'::text, 8),
    ('אינטרנט', 'Wifi', '#06b6d4'::text, 9),
    ('טלוויזיה', 'Tv', '#7c3aed'::text, 10),
    ('ביטוח', 'Shield', '#64748b'::text, 11),
    ('דלק', 'Fuel', '#ca8a04'::text, 12),
    ('אחר', 'MoreHorizontal', '#737373'::text, 13)
) AS d(name, icon, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories ec
  WHERE ec.household_id = h.id AND ec.name = d.name
);

-- משקים חדשים: פונקציית הזרע המעודכנת
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
