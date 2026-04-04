import type { ExpenseCategory } from "@/lib/types/database";

/** מאחד רווחים/תווים בלתי נראים — להשוואת שמות אחידה */
export function normalizeExpenseCategoryName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/\u05F3|\u2018|\u2019|`/g, "'") // גרש עברי / מירכאות → אפוסטרוף אחיד
    .replace(/\s+/g, " ")
    .trim();
}

/** רשימת שמות לברירת מחדל בזריעת משק חדש (בסכמה / מיגרציות) */
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

/** מיון תצוגה: לפי sort_order במסד, ואז שם — כולל אחרי סידור מחדש בגרירה */
export function sortExpenseCategoriesForDisplay<T extends Pick<ExpenseCategory, "name" | "sort_order">>(
  categories: T[]
): T[] {
  return [...categories].sort((a, b) => {
    const ao = Number(a.sort_order ?? 100000);
    const bo = Number(b.sort_order ?? 100000);
    if (ao !== bo) return ao - bo;
    return String(a.name).localeCompare(String(b.name), "he");
  });
}
