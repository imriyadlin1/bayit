"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import {
  Plus,
  X,
  Wallet,
  TrendingUp,
  TrendingDown,
  Filter,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Trash2,
  Download,
} from "lucide-react";
import type { Expense, ExpenseCategory } from "@/lib/types/database";

export default function ExpensesPage() {
  const { household, userId, loading: hhLoading } = useHousehold();
  const [expenses, setExpenses] = useState<(Expense & { category?: ExpenseCategory })[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Form state
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState("monthly");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!household) return;
    loadData();
  }, [household, currentMonth, filterCat]);

  async function loadData() {
    setLoading(true);
    const [year, month] = currentMonth.split("-").map(Number);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const { data: cats } = await supabase
      .from("expense_categories")
      .select("*")
      .eq("household_id", household!.id);

    if (cats) setCategories(cats as ExpenseCategory[]);

    let query = supabase
      .from("expenses")
      .select("*, expense_categories(*)")
      .eq("household_id", household!.id)
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", { ascending: false });

    if (filterCat !== "all") {
      query = query.eq("category_id", filterCat);
    }

    const { data } = await query;
    if (data) {
      setExpenses(
        data.map((e: any) => ({ ...e, category: e.expense_categories }))
      );
    }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId) return;
    setSaving(true);

    await supabase.from("expenses").insert({
      household_id: household.id,
      title,
      amount: parseFloat(amount),
      category_id: categoryId || null,
      date,
      notes: notes || null,
      is_recurring: isRecurring,
      recurring_interval: isRecurring ? recurringInterval : null,
      added_by: userId,
    });

    setTitle("");
    setAmount("");
    setCategoryId("");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setIsRecurring(false);
    setShowForm(false);
    setSaving(false);
    loadData();
  }

  async function handleDelete(id: string) {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function exportCSV() {
    const bom = "\uFEFF";
    const headers = ["תיאור", "סכום", "קטגוריה", "תאריך", "הערות", "חוזר"];
    const rows = expenses.map((e) => [
      e.title,
      Number(e.amount),
      e.category?.name || "ללא קטגוריה",
      e.date,
      e.notes || "",
      e.is_recurring ? "כן" : "לא",
    ]);

    const csv =
      bom +
      [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `הוצאות-${monthName.replace(" ", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalMonth = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const [year, month] = currentMonth.split("-").map(Number);
  const monthName = new Date(year, month - 1).toLocaleDateString("he-IL", {
    month: "long",
    year: "numeric",
  });

  function prevMonth() {
    const d = new Date(year, month - 2);
    setCurrentMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  function nextMonth() {
    const d = new Date(year, month);
    setCurrentMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  if (hhLoading) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">הוצאות</h1>
          <p className="text-muted">מעקב אחרי ההוצאות של משק הבית</p>
        </div>
        <div className="flex items-center gap-2">
          {expenses.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-surface-dim transition-colors"
            >
              <Download className="h-4 w-4" />
              ייצוא
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            <Plus className="h-4 w-4" />
            הוצאה חדשה
          </button>
        </div>
      </div>

      {/* Month Navigation + Total */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-surface p-5">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="rounded-lg p-1.5 hover:bg-surface-dim">
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="text-lg font-bold">{monthName}</span>
          <button onClick={nextMonth} className="rounded-lg p-1.5 hover:bg-surface-dim">
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
        <div className="text-left">
          <p className="text-sm text-muted">סה״כ החודש</p>
          <p className="text-2xl font-bold">₪{totalMonth.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="h-4 w-4 shrink-0 text-muted" />
        <button
          onClick={() => setFilterCat("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            filterCat === "all"
              ? "bg-primary text-white"
              : "bg-surface-dim hover:bg-border"
          }`}
        >
          הכל
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCat(cat.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterCat === cat.id
                ? "bg-primary text-white"
                : "bg-surface-dim hover:bg-border"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Expenses List */}
      {loading ? (
        <LoadingScreen />
      ) : expenses.length === 0 ? (
        <div className="rounded-2xl border bg-surface p-12 text-center">
          <Wallet className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="font-medium">אין הוצאות החודש</p>
          <p className="mt-1 text-sm text-muted">
            לחצו על ״הוצאה חדשה״ להוסיף
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between rounded-xl border bg-surface p-4 transition-colors hover:bg-surface-dim"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: expense.category?.color || "#737373",
                  }}
                />
                <div>
                  <p className="font-medium">{expense.title}</p>
                  <p className="text-xs text-muted">
                    {expense.category?.name || "ללא קטגוריה"} ·{" "}
                    {new Date(expense.date).toLocaleDateString("he-IL")}
                    {expense.is_recurring && " · חוזר"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">
                  ₪{Number(expense.amount).toLocaleString()}
                </span>
                <button
                  onClick={() => handleDelete(expense.id)}
                  className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Breakdown */}
      {expenses.length > 0 && (
        <div className="rounded-2xl border bg-surface p-5">
          <h2 className="mb-4 font-bold">פילוח לפי קטגוריה</h2>
          <div className="space-y-3">
            {categories
              .map((cat) => {
                const catTotal = expenses
                  .filter((e) => e.category_id === cat.id)
                  .reduce((sum, e) => sum + Number(e.amount), 0);
                return { ...cat, total: catTotal };
              })
              .filter((c) => c.total > 0)
              .sort((a, b) => b.total - a.total)
              .map((cat) => (
                <div key={cat.id} className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color || "#737373" }}
                  />
                  <span className="flex-1 text-sm">{cat.name}</span>
                  <span className="text-sm font-semibold">
                    ₪{cat.total.toLocaleString()}
                  </span>
                  <div className="w-24">
                    <div className="h-2 rounded-full bg-surface-dim">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          backgroundColor: cat.color || "#737373",
                          width: `${Math.min((cat.total / totalMonth) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">הוצאה חדשה</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 hover:bg-surface-dim"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  תיאור
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='למשל: "סופר שופרסל" או "חשבון חשמל"'
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    סכום (₪)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                    required
                    min="0"
                    step="0.01"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    תאריך
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  קטגוריה
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                >
                  <option value="">בחרו קטגוריה</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  הערות
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="אופציונלי"
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                הוצאה חוזרת
              </label>

              {isRecurring && (
                <select
                  value={recurringInterval}
                  onChange={(e) => setRecurringInterval(e.target.value)}
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                >
                  <option value="monthly">חודשי</option>
                  <option value="quarterly">רבעוני</option>
                  <option value="yearly">שנתי</option>
                </select>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "שומר..." : "הוספת הוצאה"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
