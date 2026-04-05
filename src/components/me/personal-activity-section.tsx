"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import { googleCalendarUrl } from "@/lib/utils/calendar";
import { activityWindowStart, todayLocalYmd } from "@/lib/utils/personal-dates";
import {
  buildWeekBuckets,
  computePeriodCompare,
  consecutiveWeeksWithActivity,
  deltaMinutesSentence,
  deltaPercentSentence,
  filterLogsInWindow,
} from "@/lib/utils/personal-activity-insights";
import { parseWatchWorkoutPaste } from "@/lib/utils/watch-export-parse";
import {
  mergeSectionCopy,
  type PersonalSectionSettingsPayload,
} from "@/lib/personal-section-settings";
import type {
  PersonalActivityLog,
  PersonalActivityMetadata,
  PersonalActivitySection,
} from "@/lib/types/database";
import type { LucideIcon } from "lucide-react";
import {
  Loader2,
  Trash2,
  CalendarPlus,
  AlertCircle,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Minus,
  Flame,
  CalendarRange,
  Settings2,
  Watch,
} from "lucide-react";

const FETCH_DAYS = 190;

const WINDOW_OPTIONS = [
  { days: 7 as const, label: "שבוע" },
  { days: 30 as const, label: "חודש" },
  { days: 60 as const, label: "חודשיים" },
];

const SECTION_COPY: Record<
  PersonalActivitySection,
  {
    headline: string;
    why: string;
    titleLabel: string;
    titlePlaceholder: string;
    durationHint: string;
    notesPlaceholder: string;
    logButton: string;
    emptyHint: string;
    unitPlural: string;
  }
> = {
  sport: {
    headline: "ספורט וגוף",
    why:
      "תיעוד אחרי פעילות + מבט לאחור מדיד — כמה באמת יצא לך השבוע לעומת הקודם, ואיך נראית השגרה בשבועות האחרונים.",
    titleLabel: "מה עשית",
    titlePlaceholder: "למשל: ריצה 8 ק״מ, כוח רגליים, שחייה",
    durationHint: "משך בדקות (אופציונלי) — נספר לסך זמן",
    notesPlaceholder: "איך הרגשת, מסלול, דופק…",
    logButton: "שמירת אימון / פעילות",
    emptyHint:
      "עדיין אין רשומות בחלון. כל רשומה קצרה הופכת את הגרף וההשוואה למשמעותיים.",
    unitPlural: "פעילויות",
  },
  studies: {
    headline: "לימודים",
    why:
      "לא רשימת משימות — רק מה שכבר עשית, עם מספרים: כמה ימים עם למידה, כמה דקות סה״כ, ומגמה לעומת החודש שקודם.",
    titleLabel: "מה למדת או על מה עבדת",
    titlePlaceholder: "למשל: סיכום שיעור מאקרו, תרגילי סטטיסטיקה",
    durationHint: "דקות למידה (אופציונלי)",
    notesPlaceholder: "קישור לחומר, מה נשאר…",
    logButton: "שמירת יום לימודים",
    emptyHint: "כשתתעד, תראה כאן חיווי ברור על קצב הלמידה שלך.",
    unitPlural: "רשומות למידה",
  },
  work: {
    headline: "עבודה ומקצוע",
    why:
      "משמרות ודאדליינים יכולים להישאר ב”מטלות“ — כאן רק מה שכבר קרה בפועל: עומס לאורך זמן, במספרים.",
    titleLabel: "מה תיעדת",
    titlePlaceholder: "למשל: משמרת ערך, דוח ללקוח, יום רזרבות",
    durationHint: "דקות (אופציונלי)",
    notesPlaceholder: "הערות פנימיות",
    logButton: "שמירת רשומת עבודה",
    emptyHint: "תיעוד עוזר לראות אם העומס עלה או ירד בפועל.",
    unitPlural: "רשומות עבודה",
  },
  health: {
    headline: "בריאות",
    why:
      "תורים, מעקב אנרגיה, שינה — לוג ממה שכבר היה, כדי שבמבט לאחור יהיה ברור איך נראית תקופה.",
    titleLabel: "מה קרה",
    titlePlaceholder: "למשל: בדיקת דם, שינה טובה, פיזיותרפיה",
    durationHint: "דקות (אופציונלי)",
    notesPlaceholder: "מה הלאה, המלצות…",
    logButton: "שמירת רשומת בריאות",
    emptyHint: "גם רשומה אחת בשבוע נותנת כיוון כשמסתכלים אחורה.",
    unitPlural: "רשומות בריאות",
  },
};

function logMetadata(row: PersonalActivityLog): PersonalActivityMetadata {
  const m = row.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  return m as PersonalActivityMetadata;
}

function formatSportMetaLine(m: PersonalActivityMetadata): string | null {
  const parts: string[] = [];
  if (m.distance_km != null && m.distance_km > 0) {
    parts.push(`${m.distance_km} ק״מ`);
  }
  if (m.avg_heart_rate != null && m.avg_heart_rate > 0) {
    parts.push(`דופק ממוצע ${m.avg_heart_rate}`);
  }
  if (m.calories != null && m.calories > 0) {
    parts.push(`${m.calories} קל׳`);
  }
  if (m.source === "watch_paste") {
    parts.push("מהשעון (הדבקה)");
  } else if (m.source === "watch_manual") {
    parts.push("נתוני שעון (ידני)");
  }
  return parts.length ? parts.join(" · ") : null;
}

function friendlyErr(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (
    code === "42P01" ||
    (m.includes("personal_activity_logs") &&
      (m.includes("does not exist") || m.includes("schema cache")))
  ) {
    return "חסרה ב-Supabase הטבלה personal_activity_logs. הרץ את migration-personal-activity-finance.sql (SQL Editor).";
  }
  if (
    m.includes("metadata") &&
    (m.includes("does not exist") || m.includes("column"))
  ) {
    return "חסרה עמודת metadata. הרץ את migration-personal-metadata-section-settings.sql ב-Supabase.";
  }
  if (
    m.includes("personal_section_settings") &&
    (m.includes("does not exist") || m.includes("schema cache"))
  ) {
    return "חסרה טבלת personal_section_settings. הרץ את migration-personal-metadata-section-settings.sql ב-Supabase.";
  }
  if (
    code === "42501" ||
    m.includes("permission denied") ||
    m.includes("row-level security")
  ) {
    return "הפעולה נחסמה. ודא שנמצאים במרחב ”אישי“.";
  }
  return message || "שגיאה";
}

export function PersonalActivitySection({
  section,
  icon: Icon,
}: {
  section: PersonalActivitySection;
  icon: LucideIcon;
}) {
  const baseCopy = SECTION_COPY[section];
  const { household, userId, loading: hhLoading } = useHousehold();
  const supabase = useMemo(() => createClient(), []);
  const [windowDays, setWindowDays] = useState<7 | 30 | 60>(30);
  const [allLogs, setAllLogs] = useState<PersonalActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ kind: "err" | "ok"; text: string } | null>(
    null,
  );
  const [sectionSettingsPayload, setSectionSettingsPayload] =
    useState<PersonalSectionSettingsPayload>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayLocalYmd());
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [avgHeartRate, setAvgHeartRate] = useState("");
  const [calories, setCalories] = useState("");
  const [watchPaste, setWatchPaste] = useState("");
  const [sportDataSource, setSportDataSource] = useState<"manual" | "watch_paste" | "watch_manual">(
    "manual",
  );

  const todayYmd = todayLocalYmd();
  const deepStart = activityWindowStart(FETCH_DAYS);

  const effectiveCopy = useMemo(
    () => mergeSectionCopy(section, baseCopy, sectionSettingsPayload),
    [section, baseCopy, sectionSettingsPayload],
  );

  const loadSectionSettings = useCallback(async () => {
    if (!household?.id || !userId) {
      setSettingsLoaded(true);
      return;
    }
    const { data, error } = await supabase
      .from("personal_section_settings")
      .select("settings")
      .eq("household_id", household.id)
      .eq("user_id", userId)
      .eq("section", section)
      .maybeSingle();

    if (error) {
      console.error(error);
      setSectionSettingsPayload({});
    } else if (data?.settings && typeof data.settings === "object") {
      setSectionSettingsPayload(data.settings as PersonalSectionSettingsPayload);
    } else {
      setSectionSettingsPayload({});
    }
    setSettingsLoaded(true);
  }, [household?.id, userId, section, supabase]);

  useEffect(() => {
    if (!household?.id || !userId) return;
    loadSectionSettings();
  }, [household?.id, userId, section, loadSectionSettings]);

  const loadLogs = useCallback(async () => {
    if (!household?.id) return;
    setLoading(true);
    setBanner(null);
    const { data, error } = await supabase
      .from("personal_activity_logs")
      .select("*")
      .eq("household_id", household.id)
      .eq("section", section)
      .gte("occurred_at", deepStart)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setBanner({ kind: "err", text: friendlyErr(error.message, error.code) });
      setAllLogs([]);
    } else {
      setAllLogs((data as PersonalActivityLog[]) || []);
    }
    setLoading(false);
  }, [household?.id, section, deepStart, supabase]);

  useEffect(() => {
    if (!household?.id) return;
    loadLogs();
  }, [household?.id, loadLogs]);

  const filteredInWindow = useMemo(
    () => filterLogsInWindow(allLogs, todayYmd, windowDays),
    [allLogs, todayYmd, windowDays],
  );

  const period = useMemo(
    () => computePeriodCompare(allLogs, todayYmd, windowDays),
    [allLogs, todayYmd, windowDays],
  );

  const weekBuckets = useMemo(
    () => buildWeekBuckets(allLogs, 8, todayYmd),
    [allLogs, todayYmd],
  );

  const weekStreak = useMemo(
    () => consecutiveWeeksWithActivity(weekBuckets),
    [weekBuckets],
  );

  const trendIcon =
    period.currentCount > period.previousCount ? (
      <TrendingUp className="h-4 w-4 text-emerald-600" />
    ) : period.currentCount < period.previousCount ? (
      <TrendingDown className="h-4 w-4 text-amber-700" />
    ) : (
      <Minus className="h-4 w-4 text-muted" />
    );

  const maxWeekCount = Math.max(...weekBuckets.map((b) => b.count), 1);

  async function saveSectionSettingsForm(e: React.FormEvent) {
    e.preventDefault();
    if (!household?.id || !userId) return;
    setSavingSettings(true);
    setBanner(null);
    const { error } = await supabase.from("personal_section_settings").upsert(
      {
        household_id: household.id,
        user_id: userId,
        section,
        settings: sectionSettingsPayload as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "household_id,user_id,section" },
    );
    setSavingSettings(false);
    if (error) {
      setBanner({ kind: "err", text: friendlyErr(error.message, error.code) });
      return;
    }
    setBanner({ kind: "ok", text: "ההתאמות נשמרו." });
  }

  function applyWatchPaste() {
    const parsed = parseWatchWorkoutPaste(watchPaste);
    if (parsed.distance_km != null) {
      setDistanceKm(String(parsed.distance_km));
    }
    if (parsed.avg_heart_rate != null) {
      setAvgHeartRate(String(parsed.avg_heart_rate));
    }
    if (parsed.calories != null) {
      setCalories(String(parsed.calories));
    }
    if (Object.keys(parsed).length > 0) {
      setSportDataSource("watch_paste");
      setBanner({
        kind: "ok",
        text: "חולצו ערכים מהטקסט — בדוק ולחץ שמירה.",
      });
    } else {
      setBanner({
        kind: "err",
        text: "לא זיהינו km / דופק / קלוריות בטקסט. נסה להדביק את סיכום האימון המלא.",
      });
    }
  }

  function buildSportMetadata(): PersonalActivityMetadata {
    const meta: PersonalActivityMetadata = {};
    const dk = parseFloat(distanceKm.replace(",", "."));
    if (!Number.isNaN(dk) && dk > 0 && dk < 500) {
      meta.distance_km = Math.round(dk * 100) / 100;
    }
    const hr = parseInt(avgHeartRate.replace(/\D/g, ""), 10);
    if (!Number.isNaN(hr) && hr >= 40 && hr <= 230) {
      meta.avg_heart_rate = hr;
    }
    const cal = parseInt(calories.replace(/\D/g, ""), 10);
    if (!Number.isNaN(cal) && cal > 0 && cal < 20000) {
      meta.calories = cal;
    }
    if (Object.keys(meta).length > 0) {
      meta.source = sportDataSource;
    }
    return meta;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    if (!household?.id || !userId || !title.trim()) return;
    setSaving(true);
    const dur =
      durationMinutes.trim() === ""
        ? null
        : Math.max(0, parseInt(durationMinutes, 10) || 0);
    const metadata =
      section === "sport" && effectiveCopy.sportShowWatchFields ? buildSportMetadata() : {};

    const row: Record<string, unknown> = {
      household_id: household.id,
      section,
      title: title.trim(),
      occurred_at: occurredAt,
      duration_minutes: dur,
      notes: notes.trim() || null,
      created_by: userId,
    };
    if (Object.keys(metadata).length > 0) {
      row.metadata = metadata;
    }

    const { error } = await supabase.from("personal_activity_logs").insert(row);
    setSaving(false);
    if (error) {
      setBanner({ kind: "err", text: friendlyErr(error.message, error.code) });
      return;
    }
    setTitle("");
    setOccurredAt(todayLocalYmd());
    setDurationMinutes("");
    setNotes("");
    setDistanceKm("");
    setAvgHeartRate("");
    setCalories("");
    setWatchPaste("");
    setSportDataSource("manual");
    setBanner({ kind: "ok", text: "נשמר — המספרים והגרף יתעדכנו." });
    loadLogs();
  }

  async function removeLog(id: string) {
    setBanner(null);
    const { error } = await supabase.from("personal_activity_logs").delete().eq("id", id);
    if (error) {
      setBanner({ kind: "err", text: friendlyErr(error.message, error.code) });
      return;
    }
    loadLogs();
  }

  function calLink(row: PersonalActivityLog): string {
    const meta = logMetadata(row);
    const metaLine = section === "sport" ? formatSportMetaLine(meta) : null;
    const details = [row.notes?.trim(), metaLine].filter(Boolean).join("\n") || undefined;
    return googleCalendarUrl({
      title: `${effectiveCopy.headline}: ${row.title}`,
      date: row.occurred_at,
      details,
    });
  }

  if (hhLoading && !household) return <LoadingScreen />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{effectiveCopy.headline}</h1>
          <p className="text-sm leading-relaxed text-muted">{effectiveCopy.why}</p>
        </div>
      </div>

      {banner && (
        <div
          className={`flex gap-3 rounded-2xl border p-4 text-sm ${
            banner.kind === "err"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{banner.text}</p>
        </div>
      )}

      {userId && settingsLoaded ? (
        <details className="group rounded-2xl border border-dashed border-primary/30 bg-surface p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-foreground">
            <Settings2 className="h-4 w-4 text-primary" />
            התאמה אישית של המדור
            <span className="text-xs font-normal text-muted">(טקסטים ושדות — נשמרים אצלך)</span>
          </summary>
          <form onSubmit={saveSectionSettingsForm} className="mt-4 space-y-3 border-t border-border pt-4">
            <p className="text-xs text-muted">
              השאר שדה ריק כדי לחזור לברירת המחדל. ספורט: אפשר להסתיר את בלוק נתוני השעון.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">כותרת ראשית</label>
                <input
                  value={sectionSettingsPayload.headline ?? ""}
                  onChange={(e) =>
                    setSectionSettingsPayload((p) => ({ ...p, headline: e.target.value }))
                  }
                  className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">תיאור למעלה (למה)</label>
                <textarea
                  value={sectionSettingsPayload.why ?? ""}
                  onChange={(e) =>
                    setSectionSettingsPayload((p) => ({ ...p, why: e.target.value }))
                  }
                  className="min-h-[48px] w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">תווית ״מה מילאת״</label>
                <input
                  value={sectionSettingsPayload.titleLabel ?? ""}
                  onChange={(e) =>
                    setSectionSettingsPayload((p) => ({ ...p, titleLabel: e.target.value }))
                  }
                  className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Placeholder לכותרת</label>
                <input
                  value={sectionSettingsPayload.titlePlaceholder ?? ""}
                  onChange={(e) =>
                    setSectionSettingsPayload((p) => ({
                      ...p,
                      titlePlaceholder: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">טקסט שדה משך</label>
                <input
                  value={sectionSettingsPayload.durationHint ?? ""}
                  onChange={(e) =>
                    setSectionSettingsPayload((p) => ({
                      ...p,
                      durationHint: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Placeholder הערות</label>
                <input
                  value={sectionSettingsPayload.notesPlaceholder ?? ""}
                  onChange={(e) =>
                    setSectionSettingsPayload((p) => ({
                      ...p,
                      notesPlaceholder: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">טקסט כפתור שמירה</label>
                <input
                  value={sectionSettingsPayload.logButton ?? ""}
                  onChange={(e) =>
                    setSectionSettingsPayload((p) => ({ ...p, logButton: e.target.value }))
                  }
                  className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">הודעה כשאין רשומות</label>
                <input
                  value={sectionSettingsPayload.emptyHint ?? ""}
                  onChange={(e) =>
                    setSectionSettingsPayload((p) => ({ ...p, emptyHint: e.target.value }))
                  }
                  className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">שם יחידות (רבים) בסטטיסטיקה</label>
                <input
                  value={sectionSettingsPayload.unitPlural ?? ""}
                  onChange={(e) =>
                    setSectionSettingsPayload((p) => ({ ...p, unitPlural: e.target.value }))
                  }
                  className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sectionSettingsPayload.showDuration !== false}
                  onChange={(e) =>
                    setSectionSettingsPayload((p) => ({ ...p, showDuration: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                להציג שדה משך (דקות)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sectionSettingsPayload.showNotes !== false}
                  onChange={(e) =>
                    setSectionSettingsPayload((p) => ({ ...p, showNotes: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                להציג הערות
              </label>
              {section === "sport" ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={sectionSettingsPayload.sportShowWatchFields !== false}
                    onChange={(e) =>
                      setSectionSettingsPayload((p) => ({
                        ...p,
                        sportShowWatchFields: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  להציג בלוק נתוני שעון (מרחק / דופק / קלוריות)
                </label>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              שמירת התאמה
            </button>
          </form>
        </details>
      ) : null}

      {/* מבט מדיד + מבט לאחור */}
      <div className="space-y-4 rounded-2xl border-2 border-primary/25 bg-surface p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              ניתוח לפי טווח שאתה בוחר
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-bold">
              <BarChart3 className="h-5 w-5 text-primary" />
              מבט לאחור מדיד
            </h2>
          </div>
          <div className="flex flex-wrap gap-1">
            {WINDOW_OPTIONS.map((w) => (
              <button
                key={w.days}
                type="button"
                onClick={() => setWindowDays(w.days)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  windowDays === w.days
                    ? "bg-primary text-white"
                    : "bg-surface-dim text-muted hover:bg-border"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted">טוען נתונים…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-background p-4 ring-1 ring-border">
                <p className="text-xs text-muted">בטווח הנבחר</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
                  {period.currentCount}
                </p>
                <p className="text-xs text-muted">{effectiveCopy.unitPlural}</p>
              </div>
              <div className="rounded-xl bg-background p-4 ring-1 ring-border">
                <p className="text-xs text-muted">ימים עם תיעוד</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
                  {period.activeDaysCurrent}
                </p>
                <p className="text-xs text-muted">מתוך {windowDays} ימים</p>
              </div>
              <div className="rounded-xl bg-background p-4 ring-1 ring-border">
                <p className="text-xs text-muted">רצף שבועות עם פעילות</p>
                <p className="mt-1 flex items-center gap-2 text-3xl font-bold tabular-nums text-foreground">
                  {weekStreak}
                  <Flame className="h-6 w-6 text-orange-500" aria-hidden />
                </p>
                <p className="text-xs text-muted">שבועות רצופים (נוכחי ואחורה)</p>
              </div>
            </div>

            {period.currentMinutes > 0 || period.previousMinutes > 0 ? (
              <div className="rounded-xl bg-primary/5 px-4 py-3 text-sm">
                <span className="font-semibold text-foreground">
                  {period.currentMinutes} דק׳
                </span>
                <span className="text-muted"> בתקופה · </span>
                <span className="text-muted">
                  {deltaMinutesSentence(
                    period.currentMinutes,
                    period.previousMinutes,
                  )}
                </span>
              </div>
            ) : null}

            <div className="flex flex-wrap items-start gap-3 rounded-xl border border-dashed border-primary/20 bg-primary/[0.03] p-4">
              {trendIcon}
              <p className="min-w-0 flex-1 text-sm leading-relaxed">
                {deltaPercentSentence(period.currentCount, period.previousCount)}
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
                <CalendarRange className="h-3.5 w-3.5" />
                8 שבועות אחרונים (כל תיבה = שבוע)
              </div>
              <div className="flex h-28 items-end gap-1.5">
                {weekBuckets.map((b) => (
                  <div
                    key={b.weekStart}
                    className="flex flex-1 flex-col items-center gap-1"
                    title={`${b.count} רשומות${b.minutes ? `, ${b.minutes} דק׳` : ""}`}
                  >
                    <div className="flex h-24 w-full items-end justify-center">
                      <div
                        className="w-full max-w-[36px] rounded-t-md bg-primary/80 transition-all min-h-[6px]"
                        style={{
                          height: `${Math.max(
                            (b.count / maxWeekCount) * 100,
                            b.count > 0 ? 12 : 4,
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] leading-none text-muted">
                      {b.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border-2 border-primary/20 bg-surface p-4">
        <h2 className="mb-3 font-bold">תיעוד חדש</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{effectiveCopy.titleLabel}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder={effectiveCopy.titlePlaceholder}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">תאריך המאורע</label>
            <input
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="w-full max-w-xs rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {section === "sport" && effectiveCopy.sportShowWatchFields ? (
            <div className="space-y-3 rounded-xl border border-cyan-200/80 bg-cyan-50/40 p-3 dark:border-cyan-900 dark:bg-cyan-950/20">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Watch className="h-4 w-4 text-cyan-700 dark:text-cyan-400" />
                נתונים מהשעון החכם
              </div>
              <p className="text-xs text-muted leading-relaxed">
                אין צורך באינטגרציה: העתק את סיכום האימון מאפליקציית השעון (גרמין, קורוס, Apple
                Fitness, Polar וכו׳) או מלא ידנית. אפשר גם להדביק ולנסות חילוץ אוטומטי.
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  הדבקת סיכום מהאפליקציה (אופציונלי)
                </label>
                <textarea
                  value={watchPaste}
                  onChange={(e) => setWatchPaste(e.target.value)}
                  className="min-h-[72px] w-full rounded-lg border bg-background px-2 py-2 text-xs"
                  placeholder="הדבק כאן את הטקסט מהאפליקציה…"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyWatchPaste()}
                    className="rounded-lg border border-cyan-600 bg-cyan-600/10 px-3 py-1.5 text-xs font-medium text-cyan-900 dark:text-cyan-100"
                  >
                    חילוץ מרחק / דופק / קלוריות מהטקסט
                  </button>
                  <span className="text-[10px] text-muted">מקור הנתונים:</span>
                  <select
                    value={sportDataSource}
                    onChange={(e) =>
                      setSportDataSource(e.target.value as typeof sportDataSource)
                    }
                    className="rounded-lg border bg-background px-2 py-1 text-xs"
                  >
                    <option value="manual">ידני</option>
                    <option value="watch_manual">שדות מהשעון (מולא ידנית)</option>
                    <option value="watch_paste">הודבק מהאפליקציה</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">מרחק (ק״מ)</label>
                  <input
                    inputMode="decimal"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value.replace(/[^\d.,]/g, ""))}
                    className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
                    placeholder="5.2"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">דופק ממוצע</label>
                  <input
                    inputMode="numeric"
                    value={avgHeartRate}
                    onChange={(e) => setAvgHeartRate(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
                    placeholder="148"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">קלוריות</label>
                  <input
                    inputMode="numeric"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
                    placeholder="420"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          ) : null}
          {effectiveCopy.showDuration ? (
            <div>
              <label className="mb-1 block text-sm font-medium">{effectiveCopy.durationHint}</label>
              <input
                inputMode="numeric"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value.replace(/\D/g, ""))}
                className="w-full max-w-xs rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="למשל 45"
              />
            </div>
          ) : null}
          {effectiveCopy.showNotes ? (
            <div>
              <label className="mb-1 block text-sm font-medium">הערות (אופציונלי)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[72px] w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder={effectiveCopy.notesPlaceholder}
              />
            </div>
          ) : null}
          <button
            type="submit"
            disabled={saving || !userId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {effectiveCopy.logButton}
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted">יומן בתקופה שנבחרה</h2>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">טוען…</p>
        ) : filteredInWindow.length === 0 ? (
          <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted">
            {effectiveCopy.emptyHint}
          </p>
        ) : (
          <ul className="space-y-2">
            {filteredInWindow.map((row) => {
              const meta = logMetadata(row);
              const sportLine = section === "sport" ? formatSportMetaLine(meta) : null;
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-xl border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-muted">
                      {new Date(row.occurred_at + "T12:00:00").toLocaleDateString("he-IL", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                      {row.duration_minutes != null
                        ? ` · ${row.duration_minutes} דק׳`
                        : ""}
                    </p>
                    {sportLine ? (
                      <p className="mt-1 text-xs font-medium text-cyan-800 dark:text-cyan-300">
                        {sportLine}
                      </p>
                    ) : null}
                    {row.notes ? (
                      <p className="mt-1 text-sm text-muted">{row.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a
                      href={calLink(row)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      ליומן
                    </a>
                    <button
                      type="button"
                      onClick={() => removeLog(row.id)}
                      className="rounded-lg p-1.5 text-muted hover:bg-red-500/10 hover:text-red-600"
                      aria-label="מחק"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
