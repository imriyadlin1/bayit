import type { ExpenseCategory } from "@/lib/types/database";

/** מאחד רווחים/תווים בלתי נראים — שמות בדאטאבייס לפעמים לא מתאימים בדיוק לרשימה */
export function normalizeExpenseCategoryName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/\u05F3|\u2018|\u2019|`/g, "'") // גרש עברי / מירכאות → אפוסטרוף אחיד
    .replace(/\s+/g, " ")
    .trim();
}

/** סדר תצוגה לקטגוריות ברירת מחדל (כפי שהמשתמש הגדיר) — תמיד לפני קטגוריות מותאמות אישית */
export const DEFAULT_EXPENSE_CATEGORY_NAMES = [
  "אוכל בחוץ",
  "סופר",
  "שכר דירה",
  "חשמל",
  "מים",
  "גז",
  "ארנונה",
  "ועד בית",
  "אינטרנט",
  "טלוויזיה",
  "ביטוח",
  "דלק",
  "אחר",
] as const;

const PRESET_NORMALIZED = (DEFAULT_EXPENSE_CATEGORY_NAMES as readonly string[]).map(
  normalizeExpenseCategoryName
);

function displayRank(cat: Pick<ExpenseCategory, "name" | "sort_order">): number {
  const key = normalizeExpenseCategoryName(String(cat.name));
  const presetIdx = PRESET_NORMALIZED.indexOf(key);
  if (presetIdx !== -1) return presetIdx;

  const so = Number(cat.sort_order);
  const tail = Number.isFinite(so) ? so : 100_000;
  return 10_000 + tail;
}

/** מיון קטגוריות להצגה: ברירות מחדל בסדר הקבוע, אחריהן מותאמות אישית לפי sort_order */
export function sortExpenseCategoriesForDisplay<T extends Pick<ExpenseCategory, "name" | "sort_order">>(
  categories: T[]
): T[] {
  return [...categories].sort((a, b) => {
    const ra = displayRank(a);
    const rb = displayRank(b);
    if (ra !== rb) return ra - rb;
    return String(a.name).localeCompare(String(b.name), "he");
  });
}
