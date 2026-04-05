/** תאריך מקומי YYYY-MM-DD */
export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** יום שני מקומי של אותה שבוע */
export function startOfLocalMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return x;
}

/** מפתח תקופה לתשלום לפי תדירות (חודש / שבוע / שנה) */
export function financePeriodKey(cadence: string, ref: Date = new Date()): string {
  if (cadence === "monthly") {
    return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
  }
  if (cadence === "yearly") {
    return String(ref.getFullYear());
  }
  return localYmd(startOfLocalMonday(ref));
}

/** תאריך התחלה (כולל) לחלון של N ימים אחורה מהיום */
export function activityWindowStart(days: number): string {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  start.setDate(start.getDate() - (days - 1));
  return localYmd(start);
}

export function todayLocalYmd(): string {
  return localYmd(new Date());
}

/** השוואת YYYY-MM-DD */
export function ymdCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
