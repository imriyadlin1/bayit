/**
 * ניסיון לחלץ מספרים מטקסט שמדביקים מאפליקציית שעון / סיכום אימון.
 * לא מדויק לכל יצרן — משפר את ה-UX בלי אינטגרציית API.
 */
export function parseWatchWorkoutPaste(text: string): {
  distance_km?: number;
  avg_heart_rate?: number;
  calories?: number;
} {
  const t = text.replace(/\u200f/g, "").trim();
  if (!t) return {};

  const out: { distance_km?: number; avg_heart_rate?: number; calories?: number } = {};

  const km =
    t.match(/(\d+[.,]?\d*)\s*(?:km|קילומטר|ק״מ)/i) ||
    t.match(/מרחק[:\s]*(\d+[.,]?\d*)/i);
  if (km) {
    const n = parseFloat(km[1].replace(",", "."));
    if (!Number.isNaN(n) && n > 0 && n < 500) out.distance_km = Math.round(n * 100) / 100;
  }

  const hr =
    t.match(/(?:avg|ממוצע|דופק|bpm|HR)[^\d]{0,12}(\d{2,3})/i) ||
    t.match(/\b(\d{2,3})\s*bpm\b/i);
  if (hr) {
    const n = parseInt(hr[1], 10);
    if (n >= 40 && n <= 230) out.avg_heart_rate = n;
  }

  const cal =
    t.match(/(\d+)\s*(?:cal|קלור|קלוריות|kcal)/i) ||
    t.match(/קלוריות[:\s]*(\d+)/i);
  if (cal) {
    const n = parseInt(cal[1], 10);
    if (n > 0 && n < 20000) out.calories = n;
  }

  return out;
}
