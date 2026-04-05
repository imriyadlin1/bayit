import {
  addLocalDays,
  localYmd,
  parseLocalYmd,
  startOfLocalMonday,
  ymdCompare,
} from "@/lib/utils/personal-dates";

export type LogLike = {
  occurred_at: string;
  duration_minutes: number | null;
};

export type WeekBucket = {
  weekStart: string;
  label: string;
  count: number;
  minutes: number;
};

function sumMinutes(rows: LogLike[]): number {
  return rows.reduce(
    (s, l) => s + (l.duration_minutes != null ? Number(l.duration_minutes) : 0),
    0,
  );
}

/** חלון [start,end] כולל, בפורמט YYYY-MM-DD */
function inRange(ymd: string, start: string, end: string): boolean {
  return ymdCompare(ymd, start) >= 0 && ymdCompare(ymd, end) <= 0;
}

export function filterLogsInWindow<T extends LogLike>(
  logs: T[],
  todayYmd: string,
  windowDays: number,
): T[] {
  const end = todayYmd;
  const start = addLocalDays(todayYmd, -(windowDays - 1));
  return logs.filter((l) => inRange(l.occurred_at, start, end));
}

/** התקופה שלפני אותו אורך חלון (להשוואה) */
export function previousWindowRange(
  todayYmd: string,
  windowDays: number,
): { start: string; end: string } {
  const end = addLocalDays(todayYmd, -windowDays);
  const start = addLocalDays(end, -(windowDays - 1));
  return { start, end };
}

export function computePeriodCompare<T extends LogLike>(
  logs: T[],
  todayYmd: string,
  windowDays: number,
): {
  current: T[];
  previous: T[];
  currentCount: number;
  previousCount: number;
  currentMinutes: number;
  previousMinutes: number;
  activeDaysCurrent: number;
  activeDaysPrevious: number;
} {
  const current = filterLogsInWindow(logs, todayYmd, windowDays);
  const { start: ps, end: pe } = previousWindowRange(todayYmd, windowDays);
  const previous = logs.filter((l) => inRange(l.occurred_at, ps, pe));
  return {
    current,
    previous,
    currentCount: current.length,
    previousCount: previous.length,
    currentMinutes: sumMinutes(current),
    previousMinutes: sumMinutes(previous),
    activeDaysCurrent: new Set(current.map((c) => c.occurred_at)).size,
    activeDaysPrevious: new Set(previous.map((c) => c.occurred_at)).size,
  };
}

export function deltaPercentSentence(cur: number, prev: number): string {
  if (cur === 0 && prev === 0) return "אין עדיין מספיק נתונים — התחל לתעד ותראה כאן השוואה.";
  if (prev === 0) return "בתקופה המקבילה לפני לא היו רשומות — המגמה תתבהר אחרי עוד קצת מעקב.";
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct > 5) return `${pct}% יותר רשומות מאשר בתקופה שקודמה לאותו אורך.`;
  if (pct < -5) return `${Math.abs(pct)}% פחות רשומות מאשר בתקופה המקבילה.`;
  return "בערך באותה רמה כמו בתקופה המקבילה לפני.";
}

export function deltaMinutesSentence(cur: number, prev: number): string | null {
  if (cur === 0 && prev === 0) return null;
  if (prev === 0 && cur > 0) return `סך זמן מתועד החל לצבור: ${cur} דק׳ בתקופה.`;
  if (cur === 0 && prev > 0) return `פחות זמן מתועד מאשר קודם (היה ${prev} דק׳).`;
  const diff = cur - prev;
  if (diff === 0) return `סך הדקות דומה לתקופה הקודמת (~${cur} דק׳).`;
  if (diff > 0) return `יותר זמן מתועד ב־${diff} דק׳ לעומת התקופה המקבילה.`;
  return `פחות זמן מתועד ב־${Math.abs(diff)} דק׳ לעומת התקופה המקבילה.`;
}

/** N שבועות אחורה מיום שני הנוכחי, כל תיבה — ספירה ברשומות */
export function buildWeekBuckets(
  logs: LogLike[],
  numWeeks: number,
  todayYmd: string,
): WeekBucket[] {
  const today = parseLocalYmd(todayYmd);
  const monday = startOfLocalMonday(today);
  const buckets: WeekBucket[] = [];

  for (let i = numWeeks - 1; i >= 0; i--) {
    const ws = new Date(monday);
    ws.setDate(monday.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    const wsStr = localYmd(ws);
    const weStr = localYmd(we);
    let count = 0;
    let minutes = 0;
    for (const l of logs) {
      if (inRange(l.occurred_at, wsStr, weStr)) {
        count++;
        minutes += l.duration_minutes != null ? Number(l.duration_minutes) : 0;
      }
    }
    buckets.push({
      weekStart: wsStr,
      label: `${ws.getDate()}.${String(ws.getMonth() + 1).padStart(2, "0")}`,
      count,
      minutes,
    });
  }
  return buckets;
}

/** כמה שבועות רצופים (נוכחי ואחורה) עם לפחות רשומה אחת */
export function consecutiveWeeksWithActivity(
  bucketsNewestLast: WeekBucket[],
): number {
  let streak = 0;
  for (let i = bucketsNewestLast.length - 1; i >= 0; i--) {
    if (bucketsNewestLast[i].count > 0) streak++;
    else break;
  }
  return streak;
}
