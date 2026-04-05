"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import { googleCalendarUrl } from "@/lib/utils/calendar";
import {
  activityWindowStart,
  todayLocalYmd,
  ymdCompare,
} from "@/lib/utils/personal-dates";
import type { PersonalActivityLog, PersonalActivitySection } from "@/lib/types/database";
import type { LucideIcon } from "lucide-react";
import {
  Loader2,
  Trash2,
  CalendarPlus,
  AlertCircle,
  BarChart3,
} from "lucide-react";

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
  }
> = {
  sport: {
    headline: "ספורט וגוף",
    why:
      "כאן מתעדים מתי באמת יצאת לאימון / תנועה — בלי רשימת מטלות. בוחרים חלון זמן ורואים כמה פעמים היית פעיל בתקופה.",
    titleLabel: "מה עשית",
    titlePlaceholder: "למשל: ריצה 8 ק״מ, כוח רגליים, שחייה",
    durationHint: "משך בדקות (אופציונלי) — עוזר לראות סך זמן בתקופה",
    notesPlaceholder: "איך הרגשת, מסלול, דופק…",
    logButton: "שמירת אימון / פעילות",
    emptyHint:
      "עדיין אין רשומות בחלון שנבחר. תיעוד קצר אחרי אימון נותן תמונה אמיתית על השבועות.",
  },
  studies: {
    headline: "לימודים",
    why:
      "מעקב אחרי ימים שבהם באמת ישבת על חומר — מבחנים, עבודות, קריאה. לא תחליף ל”מטלות במשק“, אלא לוג של מיקוד בזמן.",
    titleLabel: "מה למדת או על מה עבדת",
    titlePlaceholder: "למשל: סיכום שיעור מאקרו, תרגילי סטטיסטיקה",
    durationHint: "דקות למידה (אופציונלי)",
    notesPlaceholder: "קישור לחומר, מה נשאר לפתוח…",
    logButton: "שמירת יום לימודים",
    emptyHint: "כשתוסיף רשומות, תראה כמה ימי לימוד היו בחודש האחרון.",
  },
  work: {
    headline: "עבודה ומקצוע",
    why:
      "משמרות, דדליינים, ימים שבהם נגעת בעבודה מעל המינימום — כדי שלא ייעלם מהרדאר ליד שאר החיים.",
    titleLabel: "מה תיעדת",
    titlePlaceholder: "למשל: משמרת ערך, דוח ללקוח, יום רזרבות",
    durationHint: "שעות/דקות (אופציונלי) — אפשר להקליד דקות",
    notesPlaceholder: "הערות פנימיות",
    logButton: "שמירת רשומת עבודה",
    emptyHint: "מעקב זה לך; עוזר לראות עומס לאורך זמן.",
  },
  health: {
    headline: "בריאות",
    why:
      "תורים שעברו, ימים טובים, שינה שנשמרה — לא ”לעשות“ אלא מה שכבר קרה. מתאים גם למי שמתמודד עם אנרגיה / טיפולים.",
    titleLabel: "מה קרה",
    titlePlaceholder: "למשל: בדיקת דם, שינה 8 שעות, פיזיותרפיסט",
    durationHint: "דקות (אופציונלי)",
    notesPlaceholder: "מה הלאה, תרופות, המלצות…",
    logButton: "שמירת רשומת בריאות",
    emptyHint: "תיעוד קצר עוזר בדיונים עם רופא או לעצמך בבדיקה לאחור.",
  },
};

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
  const copy = SECTION_COPY[section];
  const { household, userId, loading: hhLoading } = useHousehold();
  const supabase = useMemo(() => createClient(), []);
  const [windowDays, setWindowDays] = useState<7 | 30 | 60>(30);
  const [logs, setLogs] = useState<PersonalActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ kind: "err" | "ok"; text: string } | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayLocalYmd());
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");

  const fromDate = useMemo(() => activityWindowStart(windowDays), [windowDays]);

  const loadLogs = useCallback(async () => {
    if (!household?.id) return;
    setLoading(true);
    setBanner(null);
    const { data, error } = await supabase
      .from("personal_activity_logs")
      .select("*")
      .eq("household_id", household.id)
      .eq("section", section)
      .gte("occurred_at", fromDate)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setBanner({ kind: "err", text: friendlyErr(error.message, error.code) });
      setLogs([]);
    } else {
      setLogs((data as PersonalActivityLog[]) || []);
    }
    setLoading(false);
  }, [household?.id, section, fromDate, supabase]);

  useEffect(() => {
    if (!household?.id) return;
    loadLogs();
  }, [household?.id, loadLogs]);

  const filteredInWindow = useMemo(() => {
    return logs.filter((l) => ymdCompare(l.occurred_at, fromDate) >= 0);
  }, [logs, fromDate]);

  const totalMinutes = useMemo(() => {
    return filteredInWindow.reduce(
      (s, l) => s + (l.duration_minutes != null ? Number(l.duration_minutes) : 0),
      0,
    );
  }, [filteredInWindow]);

  const count = filteredInWindow.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    if (!household?.id || !userId || !title.trim()) return;
    setSaving(true);
    const dur =
      durationMinutes.trim() === ""
        ? null
        : Math.max(0, parseInt(durationMinutes, 10) || 0);
    const { error } = await supabase.from("personal_activity_logs").insert({
      household_id: household.id,
      section,
      title: title.trim(),
      occurred_at: occurredAt,
      duration_minutes: dur,
      notes: notes.trim() || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      setBanner({ kind: "err", text: friendlyErr(error.message, error.code) });
      return;
    }
    setTitle("");
    setOccurredAt(todayLocalYmd());
    setDurationMinutes("");
    setNotes("");
    setBanner({ kind: "ok", text: "נשמר." });
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
    return googleCalendarUrl({
      title: `${copy.headline}: ${row.title}`,
      date: row.occurred_at,
      details: row.notes?.trim() || undefined,
    });
  }

  if (hhLoading && !household) return <LoadingScreen />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{copy.headline}</h1>
          <p className="text-sm leading-relaxed text-muted">{copy.why}</p>
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

      <div className="rounded-2xl border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted" />
          <span className="text-sm font-semibold">טווח זמן להשוואה</span>
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
          <p className="text-sm text-muted">טוען…</p>
        ) : (
          <p className="text-sm leading-relaxed">
            <span className="font-semibold text-foreground">{count}</span>
            {section === "sport"
              ? ` אימונים או פעילויות מתועדים בטווח שבחרת`
              : section === "studies"
                ? ` רשומות למידה מתועדות בטווח שבחרת`
                : ` רשומות בטווח שבחרת`}
            {totalMinutes > 0
              ? ` · סך כ${totalMinutes} דקות`
              : null}
            .
          </p>
        )}
      </div>

      <div className="rounded-2xl border-2 border-primary/20 bg-surface p-4">
        <h2 className="mb-3 font-bold">תיעוד חדש (היום או אחורה)</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{copy.titleLabel}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder={copy.titlePlaceholder}
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
          <div>
            <label className="mb-1 block text-sm font-medium">{copy.durationHint}</label>
            <input
              inputMode="numeric"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value.replace(/\D/g, ""))}
              className="w-full max-w-xs rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="למשל 45"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">הערות (אופציונלי)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[72px] w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder={copy.notesPlaceholder}
            />
          </div>
          <button
            type="submit"
            disabled={saving || !userId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {copy.logButton}
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted">יומן בתקופה</h2>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">טוען יומן…</p>
        ) : filteredInWindow.length === 0 ? (
          <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted">
            {copy.emptyHint}
          </p>
        ) : (
          <ul className="space-y-2">
            {filteredInWindow.map((row) => (
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
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
