"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import {
  Plus,
  X,
  Wrench,
  Calendar,
  Phone,
  Loader2,
  Trash2,
  CheckCircle,
  AlertCircle,
  CalendarPlus,
} from "lucide-react";
import { googleCalendarUrl } from "@/lib/utils/calendar";
import type { MaintenanceItem } from "@/lib/types/database";

const MAINTENANCE_CATEGORIES = [
  "מזגן",
  "אינסטלציה",
  "חשמל",
  "הדברה",
  "ניקיון מקצועי",
  "גינון",
  "מכשירי חשמל",
  "אחר",
];

const frequencyLabels: Record<string, string> = {
  monthly: "חודשי",
  quarterly: "רבעוני",
  biannual: "חצי שנתי",
  yearly: "שנתי",
  once: "חד פעמי",
};

function getDueStatus(item: MaintenanceItem): "ok" | "soon" | "overdue" {
  if (!item.next_due) return "ok";
  const due = new Date(item.next_due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "overdue";
  if (diff <= 7) return "soon";
  return "ok";
}

export default function MaintenancePage() {
  const { household, userId, loading: hhLoading } = useHousehold();
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("yearly");
  const [category, setCategory] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [serviceProvider, setServiceProvider] = useState("");
  const [servicePhone, setServicePhone] = useState("");
  const [cost, setCost] = useState("");

  const supabase = createClient();

  useEffect(() => {
    if (!household) return;
    loadItems();
  }, [household]);

  async function loadItems() {
    setLoading(true);
    const { data } = await supabase
      .from("maintenance_items")
      .select("*")
      .eq("household_id", household!.id)
      .order("next_due", { ascending: true, nullsFirst: false });

    if (data) setItems(data as MaintenanceItem[]);
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId) return;
    setSaving(true);

    await supabase.from("maintenance_items").insert({
      household_id: household.id,
      title,
      description: description || null,
      frequency,
      category: category || null,
      next_due: nextDue || null,
      service_provider: serviceProvider || null,
      service_phone: servicePhone || null,
      cost: cost ? parseFloat(cost) : null,
      created_by: userId,
    });

    setTitle("");
    setDescription("");
    setFrequency("yearly");
    setCategory("");
    setNextDue("");
    setServiceProvider("");
    setServicePhone("");
    setCost("");
    setShowForm(false);
    setSaving(false);
    loadItems();
  }

  async function markDone(item: MaintenanceItem) {
    const today = new Date().toISOString().split("T")[0];
    let newNextDue: string | null = null;

    if (item.frequency !== "once") {
      const next = new Date();
      switch (item.frequency) {
        case "monthly": next.setMonth(next.getMonth() + 1); break;
        case "quarterly": next.setMonth(next.getMonth() + 3); break;
        case "biannual": next.setMonth(next.getMonth() + 6); break;
        case "yearly": next.setFullYear(next.getFullYear() + 1); break;
      }
      newNextDue = next.toISOString().split("T")[0];
    }

    await supabase
      .from("maintenance_items")
      .update({ last_done: today, next_due: newNextDue })
      .eq("id", item.id);

    loadItems();
  }

  async function deleteItem(id: string) {
    await supabase.from("maintenance_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const overdueCount = items.filter((i) => getDueStatus(i) === "overdue").length;

  if (hhLoading) return <LoadingScreen />;

  const statusColors = {
    ok: "",
    soon: "border-accent/30 bg-accent/5",
    overdue: "border-danger/30 bg-danger/5",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">תחזוקת בית</h1>
          <p className="text-muted">
            {items.length} משימות תחזוקה
            {overdueCount > 0 && (
              <span className="text-danger"> · {overdueCount} באיחור</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          <Plus className="h-4 w-4" />
          משימה חדשה
        </button>
      </div>

      {/* Items List */}
      {loading ? (
        <LoadingScreen />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-surface p-12 text-center">
          <Wrench className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="font-medium">אין משימות תחזוקה</p>
          <p className="mt-1 text-sm text-muted">
            הוסיפו תזכורות לפילטר מזגן, הדברה, ועוד
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const status = getDueStatus(item);
            return (
              <div
                key={item.id}
                className={`rounded-2xl border bg-surface p-5 transition-colors ${statusColors[status]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{item.title}</h3>
                      {status === "overdue" && (
                        <AlertCircle className="h-4 w-4 text-danger" />
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-1 text-sm text-muted">{item.description}</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="flex items-center gap-1 rounded-full bg-surface-dim px-2.5 py-1">
                        <Calendar className="h-3 w-3" />
                        {frequencyLabels[item.frequency]}
                      </span>
                      {item.category && (
                        <span className="rounded-full bg-surface-dim px-2.5 py-1">
                          {item.category}
                        </span>
                      )}
                      {item.next_due && (
                        <span
                          className={`rounded-full px-2.5 py-1 ${
                            status === "overdue"
                              ? "bg-danger/10 text-danger font-medium"
                              : status === "soon"
                              ? "bg-accent/10 text-amber-600 font-medium"
                              : "bg-surface-dim"
                          }`}
                        >
                          {status === "overdue"
                            ? "באיחור!"
                            : `עד ${new Date(item.next_due).toLocaleDateString("he-IL")}`}
                        </span>
                      )}
                      {item.cost && (
                        <span className="rounded-full bg-surface-dim px-2.5 py-1">
                          ₪{Number(item.cost).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {(item.service_provider || item.service_phone) && (
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                        {item.service_provider && (
                          <span>{item.service_provider}</span>
                        )}
                        {item.service_phone && (
                          <a
                            href={`tel:${item.service_phone}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Phone className="h-3 w-3" />
                            {item.service_phone}
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {item.next_due && (
                      <a
                        href={googleCalendarUrl({
                          title: `🔧 ${item.title}`,
                          date: item.next_due,
                          details: [
                            item.description,
                            item.service_provider && `נותן שירות: ${item.service_provider}`,
                            item.service_phone && `טלפון: ${item.service_phone}`,
                          ].filter(Boolean).join("\n") || undefined,
                          recurrence:
                            item.frequency === "monthly" ? "MONTHLY" : item.frequency === "yearly" ? "YEARLY" : undefined,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        ליומן
                      </a>
                    )}
                    <button
                      onClick={() => markDone(item)}
                      className="flex items-center gap-1 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/20 transition-colors"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      בוצע
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="rounded-lg p-1.5 text-muted hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {item.last_done && (
                  <p className="mt-2 text-xs text-muted">
                    בוצע לאחרונה:{" "}
                    {new Date(item.last_done).toLocaleDateString("he-IL")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">משימת תחזוקה חדשה</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 hover:bg-surface-dim"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">שם</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="למשל: ניקוי פילטר מזגן"
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  תיאור
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="אופציונלי"
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    תדירות
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  >
                    <option value="monthly">חודשי</option>
                    <option value="quarterly">רבעוני</option>
                    <option value="biannual">חצי שנתי</option>
                    <option value="yearly">שנתי</option>
                    <option value="once">חד פעמי</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    קטגוריה
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  >
                    <option value="">ללא</option>
                    {MAINTENANCE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  תאריך יעד
                </label>
                <input
                  type="date"
                  value={nextDue}
                  onChange={(e) => setNextDue(e.target.value)}
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    נותן שירות
                  </label>
                  <input
                    type="text"
                    value={serviceProvider}
                    onChange={(e) => setServiceProvider(e.target.value)}
                    placeholder="שם בעל מקצוע"
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    טלפון
                  </label>
                  <input
                    type="tel"
                    value={servicePhone}
                    onChange={(e) => setServicePhone(e.target.value)}
                    placeholder="050-1234567"
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  עלות (₪)
                </label>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="אופציונלי"
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  min="0"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "שומר..." : "הוספת משימה"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
