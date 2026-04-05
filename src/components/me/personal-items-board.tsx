"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import { googleCalendarUrl } from "@/lib/utils/calendar";
import type { PersonalItem, PersonalItemSection } from "@/lib/types/database";
import type { LucideIcon } from "lucide-react";
import {
  Plus,
  Trash2,
  Check,
  Loader2,
  CalendarPlus,
  AlertCircle,
} from "lucide-react";

export const PERSONAL_SECTION_UI: Record<
  PersonalItemSection,
  {
    title: string;
    intro: string;
    placeholder: string;
    dateLabel: string;
    calendarPrefix: string;
  }
> = {
  studies: {
    title: "לימודים",
    intro:
      "כאן נשמרים מה שקשור ללימודים אצלך — מבחנים, מטלות, חומר. מה שתרשום נשמר ברשימה; אפשר לשבץ תזכורת ביומן גוגל.",
    placeholder: 'למשל: "סיכום פרק 4 — כלכלה" לפני המבחן',
    dateLabel: "תאריך ביומן / תזכורת (אופציונלי)",
    calendarPrefix: "📚",
  },
  work: {
    title: "עבודה",
    intro:
      "משימות מקצועיות, רזרבות, פרויקטים אישיים — נפרד מ”משק הבית“.",
    placeholder: "למשל: לשלוח דוח, שיחת מעקב, משמרת מחר",
    dateLabel: "תאריך או יעד (אופציונלי)",
    calendarPrefix: "💼",
  },
  sport: {
    title: "ספורט",
    intro: "אימונים, תחרויות, יעדי גוף — עם תאריך או בלי.",
    placeholder: "למשל: ריצה ארוכה בשבת, שחייה בבריכה",
    dateLabel: "יום האימון / אירוע (אופציונלי)",
    calendarPrefix: "🏃",
  },
  finance: {
    title: "פיננסים אישיים",
    intro:
      "נפרד מהוצאות המשק ב”הוצאות“. כאן תזכורות ויעדים אישיים.",
    placeholder: "למשל: לחדש ביטוח רכב, לבדוק קרן השתלמות",
    dateLabel: "תאריך יעד (אופציונלי)",
    calendarPrefix: "💰",
  },
  health: {
    title: "בריאות",
    intro: "תורים, בדיקות, ליווי בריאותי — עם קישור ליומן גוגל אם תרצה.",
    placeholder: "למשל: בדיקת דם, חיסון",
    dateLabel: "תאריך ביקור / תזכורת (אופציונלי)",
    calendarPrefix: "❤️",
  },
};

function friendlyDbMessage(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (
    code === "42P01" ||
    (m.includes("personal_items") &&
      (m.includes("does not exist") ||
        m.includes("schema cache") ||
        m.includes("not find")))
  ) {
    return "חסרה ב-Supabase הטבלה personal_items. פתח SQL Editor והרץ את סקריפט המיגרציה מהפרויקט (migration-personal-items.sql — או החלק של personal_items מהמסר הקודם), ואז רענן את האתר.";
  }
  if (
    code === "42501" ||
    m.includes("permission denied") ||
    m.includes("row-level security")
  ) {
    return "השמירה נחסמה (הרשאות). ודא שנמצאים במרחב ”אישי“, גם אם הטבלה קיימת.";
  }
  if (m.includes("jwt") || m.includes("auth")) {
    return "בעיית התחברות — נסה להתנתק ולהתחבר שוב.";
  }
  return message || "שגיאה לא ידועה בשמירה או בטעינה.";
}

export function PersonalItemsBoard({
  section,
  icon: Icon,
}: {
  section: PersonalItemSection;
  icon: LucideIcon;
}) {
  const copy = PERSONAL_SECTION_UI[section];
  const { household, userId, loading: hhLoading } = useHousehold();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<PersonalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ kind: "error" | "ok"; text: string } | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reminderDate, setReminderDate] = useState("");

  const loadItems = useCallback(async () => {
    if (!household?.id) return;
    setLoading(true);
    setBanner(null);
    const { data, error } = await supabase
      .from("personal_items")
      .select("*")
      .eq("household_id", household.id)
      .eq("section", section)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[personal_items load]", error);
      setBanner({
        kind: "error",
        text: friendlyDbMessage(error.message, error.code),
      });
      setItems([]);
    } else {
      setItems((data as PersonalItem[]) || []);
    }
    setLoading(false);
  }, [household?.id, section, supabase]);

  useEffect(() => {
    if (!household?.id) return;
    loadItems();
  }, [household?.id, loadItems]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    if (!household?.id) {
      setBanner({ kind: "error", text: "לא נטען מרחב — רענן את העמוד." });
      return;
    }
    if (!userId) {
      setBanner({
        kind: "error",
        text: "לא זוהית משתמש — צא מהחשבון והתחבר שוב.",
      });
      return;
    }
    if (!title.trim()) return;

    setSaving(true);
    const { error } = await supabase.from("personal_items").insert({
      household_id: household.id,
      section,
      title: title.trim(),
      description: description.trim() || null,
      reminder_date: reminderDate || null,
      created_by: userId,
    });
    setSaving(false);

    if (error) {
      console.error("[personal_items insert]", error);
      setBanner({
        kind: "error",
        text: friendlyDbMessage(error.message, error.code),
      });
      return;
    }

    setTitle("");
    setDescription("");
    setReminderDate("");
    setBanner({ kind: "ok", text: "נשמר." });
    loadItems();
  }

  async function toggleComplete(row: PersonalItem) {
    setBanner(null);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("personal_items")
      .update({
        completed: !row.completed,
        completed_at: !row.completed ? now : null,
        updated_at: now,
      })
      .eq("id", row.id);
    if (error) {
      setBanner({
        kind: "error",
        text: friendlyDbMessage(error.message, error.code),
      });
      return;
    }
    loadItems();
  }

  async function removeRow(id: string) {
    setBanner(null);
    const { error } = await supabase.from("personal_items").delete().eq("id", id);
    if (error) {
      setBanner({
        kind: "error",
        text: friendlyDbMessage(error.message, error.code),
      });
      return;
    }
    loadItems();
  }

  function calendarHrefFor(row: PersonalItem): string {
    const date =
      row.reminder_date || new Date().toISOString().split("T")[0];
    return googleCalendarUrl({
      title: `${copy.calendarPrefix} ${row.title}`,
      date,
      details:
        row.description?.trim() ||
        `ממרחב אישי — ${copy.title} (בית)`,
    });
  }

  if (hhLoading || (loading && !household?.id)) return <LoadingScreen />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-sm leading-relaxed text-muted">{copy.intro}</p>
        </div>
      </div>

      {banner && (
        <div
          className={`flex gap-3 rounded-2xl border p-4 text-sm ${
            banner.kind === "error"
              ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
          }`}
          role="alert"
        >
          <AlertCircle className="h-5 w-5 shrink-0 opacity-80" />
          <div>{banner.text}</div>
        </div>
      )}

      <div className="rounded-2xl border-2 border-primary/25 bg-surface p-1">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Plus className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-foreground">הוספת פריט חדש</h2>
        </div>
        <form onSubmit={handleAdd} className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">מה לזכור</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder={copy.placeholder}
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              פירוט (אופציונלי)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[88px] w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="הערות, קישורים, שלבים..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {copy.dateLabel}
            </label>
            <input
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              className="w-full max-w-xs rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1.5 text-xs text-muted">
              אופציונלי. ליומן גוגל: אם אין תאריך נשתמש בהיום (אפשר לערוך בגוגל).
            </p>
          </div>
          <button
            type="submit"
            disabled={saving || !userId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            שמור לרשימה
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted">טוען רשימה…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-surface/50 py-10 text-center text-sm text-muted">
          עדיין אין פריטים ברשימה. מלא את הטופס למעלה ולחץ ”שמור לרשימה“.
        </p>
      ) : (
        <ul className="space-y-3">
          <li className="text-sm font-semibold text-muted">הרשימה שלך</li>
          {items.map((row) => (
            <li
              key={row.id}
              className={`rounded-2xl border bg-surface p-4 transition-opacity ${
                row.completed ? "opacity-70" : ""
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleComplete(row)}
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                      row.completed
                        ? "border-primary bg-primary text-white"
                        : "border-muted hover:border-primary"
                    }`}
                    aria-label={
                      row.completed ? "סמן כלא הושלם" : "סמן כהושלם"
                    }
                  >
                    {row.completed ? <Check className="h-4 w-4" /> : null}
                  </button>
                  <div className="min-w-0">
                    <p
                      className={`font-semibold ${
                        row.completed ? "text-muted line-through" : ""
                      }`}
                    >
                      {row.title}
                    </p>
                    {row.description ? (
                      <p className="mt-1 text-sm text-muted">
                        {row.description}
                      </p>
                    ) : null}
                    {row.reminder_date ? (
                      <p className="mt-2 text-xs text-muted">
                        תאריך:{" "}
                        {new Date(
                          row.reminder_date + "T12:00:00",
                        ).toLocaleDateString("he-IL")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <a
                    href={calendarHrefFor(row)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    ליומן גוגל
                  </a>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-600"
                    aria-label="מחק"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
