"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { useHouseholdPermissions } from "@/contexts/household-permissions-context";
import { LoadingScreen } from "@/components/ui/loading";
import type { FeatureKey } from "@/lib/types/database";
import {
  Wallet,
  ShoppingCart,
  Sprout,
  ListChecks,
  Droplets,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { PersonalLifeOverview } from "@/components/me/personal-life-overview";

interface MonthlyTotal {
  label: string;
  total: number;
}

interface DashboardData {
  monthlyExpenses: number;
  shoppingCount: number;
  plantsToWater: { id: string; name: string; location: string | null; last_watered: string | null }[];
  pendingChores: { id: string; title: string; assignee_name: string; frequency: string }[];
  recentExpenses: { title: string; amount: number; category_name: string; date: string }[];
  expenseTrend: MonthlyTotal[];
}

export default function DashboardPage() {
  const { household, userId, user, loading: hhLoading, isPersonal } = useHousehold();
  const { getLevel, canEdit, loading: permLoading, permRevision, permsSnapshot } = useHouseholdPermissions();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!household || permLoading) return;
    (async () => {
      if (getLevel("expenses") === "edit") {
        await processRecurring();
      }
      await loadDashboard();
    })();
  }, [Boolean(household?.is_personal), household?.id, permLoading, permRevision, permsSnapshot]);

  async function processRecurring() {
    if (!household || !userId) return;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startOfMonth = `${thisMonth}-01`;

    const { data: recurring } = await supabase
      .from("expenses")
      .select("*")
      .eq("household_id", household.id)
      .eq("is_recurring", true);

    if (!recurring) return;

    for (const exp of recurring) {
      const { count } = await supabase
        .from("expenses")
        .select("id", { count: "exact", head: true })
        .eq("household_id", household.id)
        .eq("title", exp.title)
        .eq("is_recurring", true)
        .gte("date", startOfMonth);

      if (count && count > 0) continue;

      const lastDate = new Date(exp.date);
      const monthsDiff = (now.getFullYear() - lastDate.getFullYear()) * 12 + now.getMonth() - lastDate.getMonth();
      let shouldCreate = false;

      if (exp.recurring_interval === "monthly" && monthsDiff >= 1) shouldCreate = true;
      else if (exp.recurring_interval === "quarterly" && monthsDiff >= 3) shouldCreate = true;
      else if (exp.recurring_interval === "yearly" && monthsDiff >= 12) shouldCreate = true;

      if (shouldCreate) {
        await supabase.from("expenses").insert({
          household_id: household.id,
          title: exp.title,
          amount: exp.amount,
          category_id: exp.category_id,
          date: `${thisMonth}-01`,
          notes: exp.notes,
          is_recurring: true,
          recurring_interval: exp.recurring_interval,
          added_by: exp.added_by,
        });
      }
    }
  }

  async function loadDashboard() {
    setLoading(true);
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const hh = household!.id;

    const see = (f: FeatureKey) => getLevel(f) !== "hidden";

    let monthlyExpenses = 0;
    let shoppingCount = 0;
    let plantsToWater: DashboardData["plantsToWater"] = [];
    let pendingChores: DashboardData["pendingChores"] = [];
    let recentExpenses: DashboardData["recentExpenses"] = [];
    const trendMonths: MonthlyTotal[] = [];

    if (see("expenses")) {
      const { data: expensesRes } = await supabase
        .from("expenses")
        .select("amount")
        .eq("household_id", hh)
        .gte("date", startOfMonth);
      monthlyExpenses =
        expensesRes?.reduce((sum, e: any) => sum + Number(e.amount), 0) || 0;

      const { data: recentRes } = await supabase
        .from("expenses")
        .select("title, amount, date, expense_categories(name)")
        .eq("household_id", hh)
        .order("date", { ascending: false })
        .limit(5);
      recentExpenses =
        recentRes?.map((e: any) => ({
          title: e.title,
          amount: Number(e.amount),
          category_name: e.expense_categories?.name || "אחר",
          date: new Date(e.date).toLocaleDateString("he-IL"),
        })) || [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const mEndD = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const mEnd = `${mEndD.getFullYear()}-${String(mEndD.getMonth() + 1).padStart(2, "0")}-01`;
        const { data: mExpenses } = await supabase
          .from("expenses")
          .select("amount")
          .eq("household_id", hh)
          .gte("date", mStart)
          .lt("date", mEnd);
        trendMonths.push({
          label: d.toLocaleDateString("he-IL", { month: "short" }),
          total: mExpenses?.reduce((s, e: any) => s + Number(e.amount), 0) || 0,
        });
      }
    }

    if (!household!.is_personal && see("shopping")) {
      const { data: shoppingRes } = await supabase
        .from("shopping_lists")
        .select("id")
        .eq("household_id", hh)
        .eq("is_active", true)
        .limit(1);
      if (shoppingRes?.[0]) {
        const { count } = await supabase
          .from("shopping_items")
          .select("id", { count: "exact", head: true })
          .eq("list_id", shoppingRes[0].id)
          .eq("is_checked", false);
        shoppingCount = count || 0;
      }
    }

    if (!household!.is_personal && see("plants")) {
      const { data: plantsRes } = await supabase
        .from("plants")
        .select("id, name, location, last_watered, next_watering")
        .eq("household_id", hh)
        .lte("next_watering", new Date().toISOString().split("T")[0]);
      plantsToWater =
        plantsRes?.map((p: any) => ({
          id: p.id,
          name: p.name,
          location: p.location,
          last_watered: p.last_watered,
        })) || [];
    }

    if (see("chores")) {
      const { data: membersRes } = await supabase
        .from("household_members")
        .select("user_id, profiles(full_name)")
        .eq("household_id", hh);
      const memberMap: Record<string, string> = {};
      membersRes?.forEach((m: any) => {
        memberMap[m.user_id] = m.profiles?.full_name || "ללא שם";
      });
      const { data: choresRes } = await supabase
        .from("chores")
        .select("id, title, frequency, assigned_to")
        .eq("household_id", hh);
      pendingChores =
        choresRes?.map((c: any) => ({
          id: c.id,
          title: c.title,
          frequency: c.frequency,
          assignee_name: memberMap[c.assigned_to] || "לא משויך",
        })) || [];
    }

    setData({
      monthlyExpenses,
      shoppingCount,
      plantsToWater,
      pendingChores,
      recentExpenses,
      expenseTrend: trendMonths,
    });

    setLoading(false);
  }

  async function waterPlant(plantId: string) {
    if (!canEdit("plants") || !userId) return;
    const today = new Date().toISOString().split("T")[0];

    const { data: plant } = await supabase
      .from("plants")
      .select("watering_frequency_days")
      .eq("id", plantId)
      .single();

    const nextWater = new Date();
    nextWater.setDate(nextWater.getDate() + ((plant as any)?.watering_frequency_days || 7));

    await supabase
      .from("plants")
      .update({
        last_watered: today,
        next_watering: nextWater.toISOString().split("T")[0],
      })
      .eq("id", plantId);

    await supabase.from("plant_care_logs").insert({
      plant_id: plantId,
      action: "water",
      done_by: userId,
    });

    loadDashboard();
  }

  if (hhLoading || permLoading || loading) return <LoadingScreen />;
  if (!data) return <LoadingScreen />;

  const see = (f: FeatureKey) => getLevel(f) !== "hidden";

  const statDefs = [
    {
      feature: "expenses" as FeatureKey,
      label: "הוצאות החודש",
      value: `₪${data.monthlyExpenses.toLocaleString()}`,
      icon: Wallet,
      color: "bg-indigo-100 text-indigo-600",
      href: "/expenses",
      personalOk: true,
    },
    {
      feature: "chores" as FeatureKey,
      label: "מטלות",
      value: String(data.pendingChores.length),
      icon: ListChecks,
      color: "bg-amber-100 text-amber-600",
      href: "/chores",
      personalOk: true,
    },
    {
      feature: "shopping" as FeatureKey,
      label: "פריטים לקנות",
      value: String(data.shoppingCount),
      icon: ShoppingCart,
      color: "bg-emerald-100 text-emerald-600",
      href: "/shopping",
      personalOk: false,
    },
    {
      feature: "plants" as FeatureKey,
      label: "צמחים להשקות",
      value: String(data.plantsToWater.length),
      icon: Sprout,
      color: "bg-green-100 text-green-600",
      href: "/plants",
      personalOk: false,
    },
  ];
  const stats = statDefs.filter(
    (s) => see(s.feature) && (!isPersonal || s.personalOk),
  );

  const quickDefs = [
    { feature: "expenses" as FeatureKey, label: "הוצאה חדשה", href: "/expenses", icon: Wallet, color: "bg-indigo-100 text-indigo-600", personalOk: true },
    { feature: "chores" as FeatureKey, label: "מטלה חדשה", href: "/chores", icon: ListChecks, color: "bg-amber-100 text-amber-600", personalOk: true },
    { feature: "shopping" as FeatureKey, label: "פריט לקניות", href: "/shopping", icon: ShoppingCart, color: "bg-emerald-100 text-emerald-600", personalOk: false },
    { feature: "plants" as FeatureKey, label: "צמח חדש", href: "/plants", icon: Sprout, color: "bg-green-100 text-green-600", personalOk: false },
  ];
  const quickActions = quickDefs.filter(
    (a) => see(a.feature) && canEdit(a.feature) && (!isPersonal || a.personalOk),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          שלום{user?.full_name ? `, ${user.full_name}` : ""}! 👋
        </h1>
        <p className="text-muted">
          {isPersonal
            ? "סיכום המרחב האישי שלך"
            : "הנה סיכום מצב הבית שלכם"}
        </p>
      </div>

      {isPersonal ? <PersonalLifeOverview /> : null}

      {/* Stats */}
      {stats.length > 0 && (
        <div className="rounded-2xl border bg-surface p-5">
          <h2 className="mb-3 font-bold">
            {isPersonal ? "סיכום מהיר" : "סיכום מצב הבית"}
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="flex items-center gap-3 rounded-xl border p-3.5 transition-all hover:bg-surface-dim"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{stat.value}</p>
                    <p className="text-xs text-muted">{stat.label}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Expense Trend Chart */}
      {see("expenses") && data.expenseTrend.some((m) => m.total > 0) && (
        <Link
          href="/expenses/trends"
          className="block rounded-2xl border bg-surface p-5 transition-all hover:border-primary/30 hover:bg-primary/[0.03]"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted" />
              <h2 className="font-bold">מגמת הוצאות - 6 חודשים אחרונים</h2>
            </div>
            <span className="text-xs font-medium text-primary">פירוט מלא ←</span>
          </div>
          {(() => {
            const max = Math.max(...data.expenseTrend.map((m) => m.total), 1);
            return (
              <div className="flex h-44 items-end gap-3">
                {data.expenseTrend.map((m, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-muted">
                      {m.total > 0 ? `₪${m.total.toLocaleString()}` : ""}
                    </span>
                    <div className="flex w-full justify-center" style={{ height: "120px" }}>
                      <div
                        className="w-full max-w-[48px] rounded-t-lg bg-primary/80 transition-all"
                        style={{
                          height: `${Math.max((m.total / max) * 100, m.total > 0 ? 4 : 0)}%`,
                          marginTop: "auto",
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted">{m.label}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </Link>
      )}

      {/* Quick Actions - top on mobile */}
      {quickActions.length > 0 && (
        <div className="rounded-2xl border bg-surface p-5 lg:hidden">
          <h2 className="mb-3 font-bold">פעולות מהירות</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-3 rounded-xl border p-3.5 transition-all hover:bg-surface-dim"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${action.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chores */}
        {see("chores") && (
        <div className="rounded-2xl border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">מטלות</h2>
            <Link href="/chores" className="text-sm text-primary hover:underline">
              הכל
            </Link>
          </div>
          {data.pendingChores.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">אין מטלות עדיין</p>
          ) : (
            <div className="space-y-3">
              {data.pendingChores.slice(0, 4).map((chore) => (
                <div
                  key={chore.id}
                  className="flex items-center justify-between rounded-xl bg-background p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                    <p className="text-sm font-medium">{chore.title}</p>
                  </div>
                  <span className="rounded-full bg-surface-dim px-3 py-1 text-xs font-medium">
                    {chore.assignee_name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Recent Expenses */}
        {see("expenses") && (
        <div className="rounded-2xl border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">הוצאות אחרונות</h2>
            <Link href="/expenses" className="text-sm text-primary hover:underline">
              הכל
            </Link>
          </div>
          {data.recentExpenses.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">אין הוצאות עדיין</p>
          ) : (
            <div className="space-y-3">
              {data.recentExpenses.map((expense, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-background p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{expense.title}</p>
                    <p className="text-xs text-muted">
                      {expense.category_name} · {expense.date}
                    </p>
                  </div>
                  <span className="font-semibold">
                    ₪{expense.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Plants to Water */}
        {see("plants") && !isPersonal && (
        <div className="rounded-2xl border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">צמחים להשקות</h2>
            <Link href="/plants" className="text-sm text-primary hover:underline">
              הכל
            </Link>
          </div>
          {data.plantsToWater.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              כל הצמחים מושקים 🌱
            </p>
          ) : (
            <div className="space-y-3">
              {data.plantsToWater.map((plant) => (
                <div
                  key={plant.id}
                  className="flex items-center justify-between rounded-xl bg-background p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-600">
                      <Droplets className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{plant.name}</p>
                      <p className="text-xs text-muted">{plant.location || ""}</p>
                    </div>
                  </div>
                  {canEdit("plants") ? (
                    <button
                      type="button"
                      onClick={() => waterPlant(plant.id)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      השקיתי ✓
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Quick Actions - desktop only */}
        {quickActions.length > 0 && (
        <div className="hidden lg:block rounded-2xl border bg-surface p-5">
          <h2 className="mb-4 font-bold">פעולות מהירות</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-3 rounded-xl border p-3.5 transition-all hover:bg-surface-dim"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${action.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
