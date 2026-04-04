"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { useHouseholdPermissions } from "@/contexts/household-permissions-context";
import { FeatureGate } from "@/components/auth/FeatureGate";
import { LoadingScreen } from "@/components/ui/loading";
import { ViewOnlyBanner } from "@/components/ui/view-only-banner";
import {
  Plus,
  X,
  Wallet,
  Filter,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Trash2,
  Download,
  Target,
  PieChart,
  Users,
  Check,
} from "lucide-react";
import type { Expense, ExpenseCategory, Budget } from "@/lib/types/database";

function ExpensesPageInner() {
  const { household, userId, loading: hhLoading } = useHousehold();
  const { canEdit } = useHouseholdPermissions();
  const canMutate = canEdit("expenses");
  const [expenses, setExpenses] = useState<(Expense & { category?: ExpenseCategory; added_by_name?: string })[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [members, setMembers] = useState<{ user_id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState("monthly");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitMembers, setSplitMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [budgetCatId, setBudgetCatId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

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

    const [catsRes, memberRes, budgetRes] = await Promise.all([
      supabase.from("expense_categories").select("*").eq("household_id", household!.id),
      supabase.from("household_members").select("user_id, profiles(full_name)").eq("household_id", household!.id),
      supabase.from("budgets").select("*").eq("household_id", household!.id).eq("month", currentMonth),
    ]);

    if (catsRes.data) setCategories(catsRes.data as ExpenseCategory[]);
    if (budgetRes.data) setBudgets(budgetRes.data as Budget[]);

    const memberList = memberRes.data?.map((m: any) => ({
      user_id: m.user_id,
      name: m.profiles?.full_name || "ללא שם",
    })) || [];
    setMembers(memberList);

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
      const memberMap: Record<string, string> = {};
      memberList.forEach((m) => { memberMap[m.user_id] = m.name; });
      setExpenses(
        data.map((e: any) => ({
          ...e,
          category: e.expense_categories,
          added_by_name: memberMap[e.added_by] || "",
        }))
      );
    }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate || !household || !userId) return;
    setSaving(true);

    const { data: newExpense } = await supabase.from("expenses").insert({
      household_id: household.id,
      title,
      amount: parseFloat(amount),
      category_id: categoryId || null,
      date,
      notes: notes || null,
      is_recurring: isRecurring,
      recurring_interval: isRecurring ? recurringInterval : null,
      added_by: userId,
    }).select().single();

    if (splitEnabled && splitMembers.length > 0 && newExpense) {
      const splitAmount = parseFloat(amount) / (splitMembers.length + 1);
      const splits = splitMembers.map((uid) => ({
        expense_id: newExpense.id,
        user_id: uid,
        amount: Math.round(splitAmount * 100) / 100,
        is_paid: false,
      }));
      await supabase.from("expense_splits").insert(splits);
    }

    setTitle("");
    setAmount("");
    setCategoryId("");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setIsRecurring(false);
    setSplitEnabled(false);
    setSplitMembers([]);
    setShowForm(false);
    setSaving(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!canMutate) return;
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate || !household || !userId) return;
    setSavingBudget(true);

    const existing = budgets.find((b) => b.category_id === (budgetCatId || null));
    if (existing) {
      await supabase.from("budgets").update({ amount: parseFloat(budgetAmount) }).eq("id", existing.id);
    } else {
      await supabase.from("budgets").insert({
        household_id: household.id,
        category_id: budgetCatId || null,
        amount: parseFloat(budgetAmount),
        month: currentMonth,
        created_by: userId,
      });
    }

    setBudgetCatId("");
    setBudgetAmount("");
    setShowBudgetForm(false);
    setSavingBudget(false);
    loadData();
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
  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);

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

  const catBreakdown = categories
    .map((cat) => {
      const catTotal = expenses
        .filter((e) => e.category_id === cat.id)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const budget = budgets.find((b) => b.category_id === cat.id);
      return { ...cat, total: catTotal, budget: budget ? Number(budget.amount) : null };
    })
    .filter((c) => c.total > 0 || c.budget)
    .sort((a, b) => b.total - a.total);

  // Pie chart data
  const pieData = catBreakdown.filter((c) => c.total > 0);
  let pieAngle = 0;
  const pieSlices = pieData.map((cat) => {
    const pct = totalMonth > 0 ? (cat.total / totalMonth) * 100 : 0;
    const startAngle = pieAngle;
    pieAngle += (pct / 100) * 360;
    return { ...cat, pct, startAngle, endAngle: pieAngle };
  });

  function pieArc(startAngle: number, endAngle: number, r: number) {
    if (endAngle - startAngle >= 359.99) {
      return `M ${r} 0 A ${r} ${r} 0 1 1 ${r * Math.cos(Math.PI * 359.99 / 180)} ${r * Math.sin(Math.PI * 359.99 / 180)} A ${r} ${r} 0 0 1 ${r} 0`;
    }
    const s = (Math.PI / 180) * (startAngle - 90);
    const e = (Math.PI / 180) * (endAngle - 90);
    const x1 = r * Math.cos(s), y1 = r * Math.sin(s);
    const x2 = r * Math.cos(e), y2 = r * Math.sin(e);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  if (hhLoading) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      {!canMutate && <ViewOnlyBanner />}
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
          {canMutate && (
            <>
              <button
                onClick={() => setShowBudgetForm(true)}
                className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <Target className="h-4 w-4" />
                תקציב
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
              >
                <Plus className="h-4 w-4" />
                הוצאה חדשה
              </button>
            </>
          )}
        </div>
      </div>

      {/* Month Navigation + Total + Budget */}
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
          {totalBudget > 0 && (
            <div className="mt-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted">מתוך תקציב ₪{totalBudget.toLocaleString()}</span>
                <span className={totalMonth > totalBudget ? "text-danger font-medium" : "text-success font-medium"}>
                  {totalMonth > totalBudget ? "חריגה!" : `נותרו ₪${(totalBudget - totalMonth).toLocaleString()}`}
                </span>
              </div>
              <div className="mt-1 h-2 w-40 rounded-full bg-surface-dim">
                <div
                  className={`h-2 rounded-full transition-all ${
                    totalMonth > totalBudget ? "bg-danger" : totalMonth > totalBudget * 0.8 ? "bg-accent" : "bg-success"
                  }`}
                  style={{ width: `${Math.min((totalMonth / totalBudget) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="h-4 w-4 shrink-0 text-muted" />
        <button
          onClick={() => setFilterCat("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            filterCat === "all" ? "bg-primary text-white" : "bg-surface-dim hover:bg-border"
          }`}
        >
          הכל
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCat(cat.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterCat === cat.id ? "bg-primary text-white" : "bg-surface-dim hover:bg-border"
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
            {canMutate ? "לחצו על ״הוצאה חדשה״ להוסיף" : "אין נתונים להצגה בחודש זה"}
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
                  style={{ backgroundColor: expense.category?.color || "#737373" }}
                />
                <div>
                  <p className="font-medium">{expense.title}</p>
                  <p className="text-xs text-muted">
                    {expense.category?.name || "ללא קטגוריה"} ·{" "}
                    {new Date(expense.date).toLocaleDateString("he-IL")}
                    {expense.is_recurring && " · חוזר"}
                    {expense.added_by_name && ` · ${expense.added_by_name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">
                  ₪{Number(expense.amount).toLocaleString()}
                </span>
                {canMutate && (
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pie Chart + Category Breakdown */}
      {expenses.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pie Chart */}
          {pieSlices.length > 0 && (
            <div className="rounded-2xl border bg-surface p-5">
              <div className="mb-4 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-muted" />
                <h2 className="font-bold">פילוח הוצאות</h2>
              </div>
              <div className="flex items-center justify-center">
                <svg viewBox="-60 -60 120 120" className="h-48 w-48">
                  {pieSlices.map((slice, i) => (
                    <path
                      key={i}
                      d={pieArc(slice.startAngle, slice.endAngle, 50)}
                      fill={slice.color || "#737373"}
                      stroke="var(--surface)"
                      strokeWidth="1"
                    />
                  ))}
                </svg>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {pieSlices.map((slice, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color || "#737373" }} />
                    <span>{slice.name}</span>
                    <span className="text-muted">{Math.round(slice.pct)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Breakdown with Budgets */}
          <div className="rounded-2xl border bg-surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-muted" />
              <h2 className="font-bold">קטגוריות ותקציב</h2>
            </div>
            <div className="space-y-3">
              {catBreakdown.map((cat) => (
                <div key={cat.id}>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color || "#737373" }}
                    />
                    <span className="flex-1 text-sm">{cat.name}</span>
                    <span className="text-sm font-semibold">
                      ₪{cat.total.toLocaleString()}
                    </span>
                    {cat.budget && (
                      <span className="text-xs text-muted">
                        / ₪{cat.budget.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 mr-6 h-2 rounded-full bg-surface-dim">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        cat.budget && cat.total > cat.budget
                          ? "bg-danger"
                          : ""
                      }`}
                      style={{
                        backgroundColor: cat.budget && cat.total > cat.budget ? undefined : (cat.color || "#737373"),
                        width: cat.budget
                          ? `${Math.min((cat.total / cat.budget) * 100, 100)}%`
                          : `${Math.min((cat.total / totalMonth) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showForm && canMutate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">הוצאה חדשה</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-surface-dim">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">תיאור</label>
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
                  <label className="mb-1.5 block text-sm font-medium">סכום (₪)</label>
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
                  <label className="mb-1.5 block text-sm font-medium">תאריך</label>
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
                <label className="mb-1.5 block text-sm font-medium">קטגוריה</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                >
                  <option value="">בחרו קטגוריה</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">הערות</label>
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

              {/* Split expense */}
              {members.length > 1 && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={splitEnabled}
                      onChange={(e) => setSplitEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <Users className="h-4 w-4 text-indigo-500" />
                    פיצול הוצאה בין חברי הבית
                  </label>
                  {splitEnabled && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-muted">בחרו עם מי לפצל (אתם כלולים אוטומטית):</p>
                      {members.filter((m) => m.user_id !== userId).map((m) => (
                        <label key={m.user_id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={splitMembers.includes(m.user_id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSplitMembers((prev) => [...prev, m.user_id]);
                              } else {
                                setSplitMembers((prev) => prev.filter((id) => id !== m.user_id));
                              }
                            }}
                            className="h-4 w-4 rounded border-border accent-primary"
                          />
                          {m.name}
                        </label>
                      ))}
                      {splitMembers.length > 0 && amount && (
                        <p className="text-xs font-medium text-primary">
                          ₪{(parseFloat(amount) / (splitMembers.length + 1)).toFixed(0)} לכל אחד
                        </p>
                      )}
                    </div>
                  )}
                </div>
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

      {/* Budget Modal */}
      {showBudgetForm && canMutate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">הגדרת תקציב - {monthName}</h2>
              <button onClick={() => setShowBudgetForm(false)} className="rounded-lg p-1.5 hover:bg-surface-dim">
                <X className="h-5 w-5" />
              </button>
            </div>

            {budgets.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-sm font-medium text-muted">תקציבים קיימים:</p>
                {budgets.map((b) => {
                  const cat = categories.find((c) => c.id === b.category_id);
                  return (
                    <div key={b.id} className="flex items-center justify-between rounded-lg bg-background p-2 text-sm">
                      <span>{cat?.name || "כללי"}</span>
                      <span className="font-semibold">₪{Number(b.amount).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">קטגוריה</label>
                <select
                  value={budgetCatId}
                  onChange={(e) => setBudgetCatId(e.target.value)}
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                >
                  <option value="">כללי (כל ההוצאות)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">סכום תקציב (₪)</label>
                <input
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  placeholder="5000"
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  required
                  min="0"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                disabled={savingBudget}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {savingBudget && <Loader2 className="h-4 w-4 animate-spin" />}
                {savingBudget ? "שומר..." : "שמירת תקציב"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <FeatureGate feature="expenses">
      <ExpensesPageInner />
    </FeatureGate>
  );
}
