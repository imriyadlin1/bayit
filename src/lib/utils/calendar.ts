/**
 * Build a Google Calendar "create event" URL (opens in browser, no API needed).
 */
export function googleCalendarUrl({
  title,
  date,
  allDay = true,
  details,
  recurrence,
}: {
  title: string;
  date: string; // YYYY-MM-DD
  allDay?: boolean;
  details?: string;
  recurrence?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
}): string {
  const d = date.replace(/-/g, "");
  const endD = allDay ? nextDay(date).replace(/-/g, "") : d;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${d}/${endD}`,
  });

  if (details) params.set("details", details);
  if (recurrence) params.set("recur", `RRULE:FREQ=${recurrence}`);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
