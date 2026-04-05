"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { useHouseholdPermissions } from "@/contexts/household-permissions-context";
import { FeatureGate } from "@/components/auth/FeatureGate";
import { LoadingScreen } from "@/components/ui/loading";
import { ViewOnlyBanner } from "@/components/ui/view-only-banner";
import { ChevronRight, BarChart3 } from "lucide-react";
import type { ExpenseCategory } from "@/lib/types/database";
import { sortExpenseCategoriesForDisplay } from "@/lib/expense-category-sort";

type RawRow = {
  date: string;
  amount: number;
  category_id: string | null;
  expense_categories: { id: string; name: string; color: string | null } | null;
};

function monthKeyFromDate(iso: string) {
  return iso.slice(0, 7);
}

function ExpenseTrendsInner() {
  const { household, loading: hhLoading } = useHousehold();
  const { canEdit } = useHouseholdPermissions();
  const canMutate = canEdit("expenses");
  const [range, setRange] = useState<6 | 12>(12);
  const [filterCatId, setFilterCatId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState<RawRow[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!household) return;
    (async () => {
      setLoading(true);
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - (range - 1), 1);
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
      const endD = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const endStr = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}-01`;

      const [expRes, catRes] = await Promise.all([
        supabase
          .from("expenses")
          .select("date, amount, category_id, expense_categories(id, name, color)")
          .eq("household_id", household.id)
          .gte("date", startStr)
          .lt("date", endStr)
          .order("date", { ascending: true }),
        supabase.from("expense_categories").select("*").eq("household_id", household.id),
      ]);

      const list: RawRow[] = (expRes.data || []).map((e: any) => ({
        date: e.date,
        amount: Number(e.amount),
        category_id: e.category_id,
        expense_categories: e.expense_categories,
      }));
      setRaw(list);
      if (catRes.data) {
        setCategories(
          sortExpenseCategoriesForDisplay(catRes.data as ExpenseCategory[])
        );
      }
      setLoading(false);
    })();
  }, [household?.id, range]);

  const filteredRaw = useMemo(() => {
    if (filterCatId === "all") return raw;
    if (filterCatId === "__none__") {
      return raw.filter((r) => !r.category_id);
    }
    return raw.filter((r) => r.category_id === filterCatId);
  }, [raw, filterCatId]);

  const { monthBuckets, categoryPeriodTotals, monthsDetail, periodTotal } =
    useMemo(() => {
      const now = new Date();
      const keys: string[] = [];
      for (let i = range - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        );
      }

      const monthTotals = new Map<string, number>();
      keys.forEach((k) => monthTotals.set(k, 0));

      const catTotals = new Map<
        string,
        { name: string; color: string; total: number }
      >();
      const perMonthCat = new Map<string, Map<string, number>>();

      function ensureMonth(m: string) {
        if (!perMonthCat.has(m)) perMonthCat.set(m, new Map());
        return perMonthCat.get(m)!;
      }

      for (const e of filteredRaw) {
        const dk = monthKeyFromDate(e.date);
        if (!monthTotals.has(dk)) continue;
        monthTotals.set(dk, (monthTotals.get(dk) || 0) + e.amount);
        const cid = e.category_id || "__none__";
        const cname = e.expense_categories?.name || "ללא קטגוריה";
        const ccolor = e.expense_categories?.color || "#737373";
        if (!catTotals.has(cid)) {
          catTotals.set(cid, { name: cname, color: ccolor, total: 0 });
        }
        const ct = catTotals.get(cid)!;
        ct.total += e.amount;
        const mc = ensureMonth(dk);
        mc.set(cid, (mc.get(cid) || 0) + e.amount);
      }

      const monthBuckets = keys.map((k) => {
        const d = new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, 1);
        return {
          key: k,
          label: d.toLocaleDateString("he-IL", { month: "short", year: "2-digit" }),
          total: monthTotals.get(k) || 0,
        };
      });

      const categoryPeriodTotals = [...catTotals.entries()]
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total);

      const monthsDetail = [...keys]
        .reverse()
        .map((k) => {
          const mc = perMonthCat.get(k) || new Map();
          const byCategory = [...mc.entries()]
            .map(([cid, amt]) => {
              const meta = catTotals.get(cid) ?? {
                name: "לא ידוע",
                color: "#737373",
                total: 0,
              };
              return { cid, name: meta.name, color: meta.color, amount: amt };
            })
            .sort((a, b) => b.amount - a.amount);
          const d = new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, 1);
          return {
            key: k,
            label: d.toLocaleDateString("he-IL", { month: "long", year: "numeric" }),
            total: monthTotals.get(k) || 0,
            byCategory,
          };
        });

      const periodTotal = categoryPeriodTotals.reduce((s, c) => s + c.total, 0);

      return { monthBuckets, categoryPeriodTotals, monthsDetail, periodTotal };
    }, [filteredRaw, range]);

  const maxMonth = Math.max(...monthBuckets.map((m) => m.total), 1);
  const maxCat = Math.max(...categoryPeriodTotals.map((c) => c.total), 1);

  if (hhLoading || loading) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      {!canMutate && <ViewOnlyBanner />}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard"
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-muted hover:bg-surface-dim"
            aria-label="חזרה לדשבורד"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">מגמת הוצאות</h1>
            <p className="text-muted">
              סיכום לפי חודשים, פילוח לפי קטגוריה ובחירת טווח
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">טווח:</span>
          {([6, 12] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRange(n)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                range === n
                  ? "bg-primary text-white"
                  : "bg-surface-dim text-muted hover:bg-border"
              }`}
            >
              {n} חודשים
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-surface p-4">
        <label className="mb-2 block text-sm font-medium">סינון לפי קטגוריה</label>
        <select
          value={filterCatId}
          onChange={(e) => setFilterCatId(e.target.value)}
          className="w-full max-w-md rounded-xl border bg-background py-2.5 px-3 text-sm sm:w-auto"
        >
          <option value="all">כל הקטגוריות</option>
          <option value="__none__">ללא קטגוריה</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-muted">
          הסינון משפיע על הגרף, על סה״כ התקופה ועל הטבלה למטה.
        </p>
      </div>

      <div className="rounded-2xl border bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted" />
            <h2 className="font-bold">הוצאות לפי חודש</h2>
          </div>
          <p className="text-sm font-semibold text-primary">
            סה״כ בתקופה: ₪{periodTotal.toLocaleString()}
          </p>
        </div>
        {monthBuckets.every((m) => m.total === 0) ? (
          <p className="py-8 text-center text-sm text-muted">אין נתונים בטווח</p>
        ) : (
          <div className="flex h-52 items-end gap-2 sm:gap-3">
            {monthBuckets.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                <span className="min-h-[1rem] text-[10px] font-semibold text-muted sm:text-xs">
                  {m.total > 0 ? `₪${m.total.toLocaleString()}` : ""}
                </span>
                <div
                  className="flex w-full justify-center"
                  style={{ height: "140px" }}
                >
                  <div
                    className="w-full max-w-[52px] rounded-t-lg bg-primary/80 transition-all"
                    style={{
                      height: `${Math.max((m.total / maxMonth) * 100, m.total > 0 ? 6 : 0)}%`,
                      marginTop: "auto",
                    }}
                    title={`${m.label}: ₪${m.total.toLocaleString()}`}
                  />
                </div>
                <span className="text-center text-[10px] text-muted sm:text-xs">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-surface p-5">
          <h2 className="mb-4 font-bold">סיכום לפי קטגוריה (בטווח)</h2>
          {categoryPeriodTotals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">אין נתונים</p>
          ) : (
            <ul className="space-y-3">
              {categoryPeriodTotals.map((c) => (
                <li key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </span>
                    <span className="font-semibold tabular-nums">
                      ₪{c.total.toLocaleString()}
                      {periodTotal > 0 && (
                        <span className="me-1 text-xs font-normal text-muted">
                          {" "}
                          ({Math.round((c.total / periodTotal) * 100)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-dim">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${Math.max((c.total / maxCat) * 100, 2)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border bg-surface p-5 lg:max-h-[480px] lg:overflow-y-auto">
          <h2 className="mb-4 font-bold">פירוט חודשי</h2>
          {monthsDetail.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">אין נתונים</p>
          ) : (
            <div className="space-y-4">
              {monthsDetail.map((row) => (
                <div
                  key={row.key}
                  className="rounded-xl border border-border/60 bg-background p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-semibold">{row.label}</span>
                    <span className="text-primary font-bold tabular-nums">
                      ₪{row.total.toLocaleString()}
                    </span>
                  </div>
                  {row.byCategory.length === 0 ? (
                    <p className="text-xs text-muted">אין הוצאות</p>
                  ) : (
                    <ul className="space-y-1.5 border-t border-border/40 pt-2">
                      {row.byCategory.map((x) => (
                        <li
                          key={x.cid}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2 text-muted">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: x.color }}
                            />
                            <span className="truncate">{x.name}</span>
                          </span>
                          <span className="shrink-0 tabular-nums font-medium">
                            ₪{x.amount.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          href="/expenses"
          className="text-sm font-medium text-primary hover:underline"
        >
          מעבר לרשימת ההוצאות ←
        </Link>
      </div>
    </div>
  );
}

export default function ExpenseTrendsPage() {
  return (
    <FeatureGate feature="expenses">
      <ExpenseTrendsInner />
    </FeatureGate>
  );
}
