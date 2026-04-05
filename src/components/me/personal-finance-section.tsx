"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import { financePeriodKey } from "@/lib/utils/personal-dates";
import type {
  FinanceCadence,
  PersonalFinanceCommitment,
  PersonalFinancePeriodPayment,
} from "@/lib/types/database";
import { PiggyBank, Loader2, Trash2, CheckCircle2, Circle, AlertCircle } from "lucide-react";

const CADENCE_LABEL: Record<FinanceCadence, string> = {
  monthly: "כל חודש",
  weekly: "כל שבוע",
  yearly: "פעם בשנה",
};

function monthlyEquivalent(amount: number, cadence: FinanceCadence): number {
  switch (cadence) {
    case "monthly":
      return amount;
    case "weekly":
      return (amount * 52) / 12;
    case "yearly":
      return amount / 12;
    default:
      return amount;
  }
}

function periodLabelHuman(cadence: FinanceCadence, key: string): string {
  if (cadence === "monthly" && /^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("he-IL", {
      month: "long",
      year: "numeric",
    });
  }
  if (cadence === "yearly") return `שנה ${key}`;
  return `תקופה ${key}`;
}

function friendlyErr(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (
    code === "42P01" ||
    (m.includes("personal_finance") &&
      (m.includes("does not exist") || m.includes("schema cache")))
  ) {
    return "חסרות טבלאות פיננסיות אישיות. הרץ migration-personal-activity-finance.sql ב-Supabase.";
  }
  if (code === "42501" || m.includes("permission denied")) {
    return "הרשאות — ודא מרחב ”אישי“.";
  }
  return message || "שגיאה";
}

export function PersonalFinanceSection() {
  const { household, userId, loading: hhLoading } = useHousehold();
  const supabase = useMemo(() => createClient(), []);
  const [commitments, setCommitments] = useState<PersonalFinanceCommitment[]>([]);
  const [payments, setPayments] = useState<PersonalFinancePeriodPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ kind: "err" | "ok"; text: string } | null>(
    null,
  );
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<FinanceCadence>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [notes, setNotes] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const loadAll = useCallback(async () => {
    if (!household?.id) return;
    setLoading(true);
    setBanner(null);
    const [cRes, pRes] = await Promise.all([
      supabase
        .from("personal_finance_commitments")
        .select("*")
        .eq("household_id", household.id)
        .order("active", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("personal_finance_period_payments")
        .select("*")
        .eq("household_id", household.id),
    ]);

    if (cRes.error) {
      setBanner({ kind: "err", text: friendlyErr(cRes.error.message, cRes.error.code) });
      setCommitments([]);
      setPayments([]);
    } else {
      setCommitments((cRes.data as PersonalFinanceCommitment[]) || []);
      if (pRes.error) {
        setPayments([]);
      } else {
        setPayments((pRes.data as PersonalFinancePeriodPayment[]) || []);
      }
    }
    setLoading(false);
  }, [household?.id, supabase]);

  useEffect(() => {
    if (!household?.id) return;
    loadAll();
  }, [household?.id, loadAll]);

  const visibleCommitments = useMemo(() => {
    if (showInactive) return commitments;
    return commitments.filter((c) => c.active);
  }, [commitments, showInactive]);

  const estimatedMonthly = useMemo(() => {
    return visibleCommitments
      .filter((c) => c.active)
      .reduce((s, c) => s + monthlyEquivalent(Number(c.amount), c.cadence), 0);
  }, [visibleCommitments]);

  function isPaidForCurrentPeriod(c: PersonalFinanceCommitment): boolean {
    const key = financePeriodKey(c.cadence, new Date());
    return payments.some((p) => p.commitment_id === c.id && p.period_key === key);
  }

  async function addCommitment(e: React.FormEvent) {
    e.preventDefault();
    if (!household?.id || !userId || !name.trim()) return;
    const amt = parseFloat(amount.replace(",", "."));
    if (Number.isNaN(amt) || amt < 0) {
      setBanner({ kind: "err", text: "סכום לא תקין." });
      return;
    }
    const dom =
      dayOfMonth.trim() === ""
        ? null
        : Math.min(28, Math.max(1, parseInt(dayOfMonth, 10) || 0));

    setSaving(true);
    const { error } = await supabase.from("personal_finance_commitments").insert({
      household_id: household.id,
      name: name.trim(),
      amount: amt,
      cadence,
      day_of_month: cadence === "monthly" ? dom : null,
      notes: notes.trim() || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      setBanner({ kind: "err", text: friendlyErr(error.message, error.code) });
      return;
    }
    setName("");
    setAmount("");
    setCadence("monthly");
    setDayOfMonth("");
    setNotes("");
    setBanner({ kind: "ok", text: "התחייבות נשמרה." });
    loadAll();
  }

  async function togglePaid(c: PersonalFinanceCommitment) {
    if (!household?.id || !userId) return;
    const periodKey = financePeriodKey(c.cadence, new Date());
    const existing = payments.find(
      (p) => p.commitment_id === c.id && p.period_key === periodKey,
    );
    setBanner(null);
    if (existing) {
      const { error } = await supabase
        .from("personal_finance_period_payments")
        .delete()
        .eq("id", existing.id);
      if (error) {
        setBanner({ kind: "err", text: friendlyErr(error.message, error.code) });
        return;
      }
    } else {
      const { error } = await supabase.from("personal_finance_period_payments").insert({
        commitment_id: c.id,
        household_id: household.id,
        period_key: periodKey,
        created_by: userId,
      });
      if (error) {
        setBanner({ kind: "err", text: friendlyErr(error.message, error.code) });
        return;
      }
    }
    loadAll();
  }

  async function removeCommitment(id: string) {
    setBanner(null);
    const { error } = await supabase
      .from("personal_finance_commitments")
      .delete()
      .eq("id", id);
    if (error) {
      setBanner({ kind: "err", text: friendlyErr(error.message, error.code) });
      return;
    }
    loadAll();
  }

  async function setActive(c: PersonalFinanceCommitment, active: boolean) {
    const { error } = await supabase
      .from("personal_finance_commitments")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) {
      setBanner({ kind: "err", text: friendlyErr(error.message, error.code) });
      return;
    }
    loadAll();
  }

  if (hhLoading && !household) return <LoadingScreen />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <PiggyBank className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">פיננסים אישיים</h1>
          <p className="text-sm leading-relaxed text-muted">
            כאן מנהלים <strong className="text-foreground">התחייבויות קבועות</strong>{" "}
            (מנוי, ביטוח, הלוואה קבועה) — נפרד מהוצאות היום־יומיות ב”הוצאות“ של
            המשק. לכל סעיף מסמנים אם שילמת בתקופה הנוכחית, ורואים הערכה של עומס
            חודשי.
          </p>
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
        <p className="text-sm font-semibold text-foreground">
          סה״כ חודשי משוער (התחייבויות פעילות):{" "}
          <span className="text-primary">
            ₪{Math.round(estimatedMonthly).toLocaleString("he-IL")}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted">
          שבועי מומר ל×52÷12, שנתי ל÷12 — הערכה בלבד.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-primary/20 bg-surface p-4">
        <h2 className="mb-3 font-bold">הוספת התחייבות קבועה</h2>
        <form onSubmit={addCommitment} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">שם</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="למשל: מנוי חדר כושר, ביטוח רכב"
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">סכום לתקופה (₪)</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                inputMode="decimal"
                placeholder="299"
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">תדירות</label>
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value as FinanceCadence)}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="monthly">{CADENCE_LABEL.monthly}</option>
                <option value="weekly">{CADENCE_LABEL.weekly}</option>
                <option value="yearly">{CADENCE_LABEL.yearly}</option>
              </select>
            </div>
          </div>
          {cadence === "monthly" && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                יום טיפוסי בחודש (1–28, אופציונלי)
              </label>
              <input
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value.replace(/\D/g, ""))}
                className="w-full max-w-xs rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="למשל 1"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[64px] w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="מספר חוזה, קישור לחשבון…"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !userId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            שמירת התחייבות
          </button>
        </form>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">התחייבויות</h2>
        <button
          type="button"
          onClick={() => setShowInactive(!showInactive)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {showInactive ? "הצג רק פעילות" : "הצג גם לא פעילות"}
        </button>
      </div>

      {loading ? (
        <p className="text-center text-muted">טוען…</p>
      ) : visibleCommitments.length === 0 ? (
        <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted">
          עדיין אין התחייבויות. הוסף מעלה — זה לא מחובר אוטומטית ל”הוצאות“ של המשק.
        </p>
      ) : (
        <ul className="space-y-3">
          {visibleCommitments.map((c) => {
            const paid = isPaidForCurrentPeriod(c);
            const pk = financePeriodKey(c.cadence, new Date());
            return (
              <li
                key={c.id}
                className={`rounded-2xl border bg-surface p-4 ${!c.active ? "opacity-60" : ""}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{c.name}</p>
                      {!c.active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">לא פעיל</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      ₪{Number(c.amount).toLocaleString("he-IL")} · {CADENCE_LABEL[c.cadence]}
                      {c.day_of_month != null ? ` · סביב יום ${c.day_of_month}` : ""}
                    </p>
                    {c.notes ? (
                      <p className="mt-2 text-xs text-muted">{c.notes}</p>
                    ) : null}
                    <p className="mt-2 text-xs font-medium text-foreground">
                      תקופה נוכחית ({periodLabelHuman(c.cadence, pk)}):{" "}
                      {paid ? (
                        <span className="text-emerald-600">שולם / סומן</span>
                      ) : (
                        <span className="text-amber-700">טרם סומן</span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <button
                      type="button"
                      onClick={() => togglePaid(c)}
                      disabled={!c.active}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                        paid
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border border-amber-200 bg-amber-50 text-amber-900"
                      } disabled:opacity-40`}
                    >
                      {paid ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                      {paid ? "בטל סימון לתקופה" : "סמן ששילמת בתקופה"}
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActive(c, !c.active)}
                        className="text-xs text-muted hover:text-foreground"
                      >
                        {c.active ? "השבת (ארכיון)" : "הפעל שוב"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCommitment(c.id)}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                      >
                        <Trash2 className="h-3 w-3" />
                        מחק
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
