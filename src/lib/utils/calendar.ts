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

  let url =
    `https://calendar.google.com/calendar/render` +
    `?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${d}/${endD}`;

  if (details) url += `&details=${encodeURIComponent(details)}`;
  if (recurrence) url += `&recur=RRULE:FREQ=${recurrence}`;

  return url;
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
