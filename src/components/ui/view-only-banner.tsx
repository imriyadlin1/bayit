import { Eye } from "lucide-react";

export function ViewOnlyBanner() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
      <Eye className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <span>מצב צפייה — אפשר לראות בלבד. אין אפשרות להוסיף, לערוך או למחוק.</span>
    </div>
  );
}
