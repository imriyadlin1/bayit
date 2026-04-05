"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { activityWindowStart, financePeriodKey } from "@/lib/utils/personal-dates";
import type {
  PersonalActivitySection,
  PersonalFinanceCommitment,
  PersonalFinancePeriodPayment,
} from "@/lib/types/database";
import { BookOpen, Briefcase, Dumbbell, HeartPulse, PiggyBank } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const WINDOW_DAYS = 30;

const SECTION_TILES: {
  section: PersonalActivitySection;
  label: string;
  href: string;
  icon: LucideIcon;
}[] = [
  { section: "studies", label: "לימודים", href: "/me/studies", icon: BookOpen },
  { section: "work", label: "עבודה", href: "/me/work", icon: Briefcase },
  { section: "sport", label: "ספורט", href: "/me/sport", icon: Dumbbell },
  { section: "health", label: "בריאות", href: "/me/health", icon: HeartPulse },
];

export function PersonalLifeOverview() {
  const { household, loading: hhLoading } = useHousehold();
  const supabase = useMemo(() => createClient(), []);
  const [dayCounts, setDayCounts] = useState<Record<PersonalActivitySection, number> | null>(
    null,
  );
  const [financeBrief, setFinanceBrief] = useState<{ paid: number; total: number } | null>(
    null,
  );
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!household?.id || !household.is_personal) return;
    const start = activityWindowStart(WINDOW_DAYS);

    const [logsRes, cRes, pRes] = await Promise.all([
      supabase
        .from("personal_activity_logs")
        .select("section, occurred_at")
        .eq("household_id", household.id)
        .gte("occurred_at", start),
      supabase
        .from("personal_finance_commitments")
        .select("*")
        .eq("household_id", household.id)
        .eq("active", true),
      supabase
        .from("personal_finance_period_payments")
        .select("*")
        .eq("household_id", household.id),
    ]);

    const sets: Record<PersonalActivitySection, Set<string>> = {
      studies: new Set(),
      work: new Set(),
      sport: new Set(),
      health: new Set(),
    };

    if (!logsRes.error && logsRes.data) {
      for (const row of logsRes.data as { section: string; occurred_at: string }[]) {
        const sec = row.section as PersonalActivitySection;
        if (sec in sets) sets[sec].add(row.occurred_at);
      }
    }

    setDayCounts({
      studies: sets.studies.size,
      work: sets.work.size,
      sport: sets.sport.size,
      health: sets.health.size,
    });

    if (!cRes.error && cRes.data && !pRes.error && pRes.data) {
      const commitments = cRes.data as PersonalFinanceCommitment[];
      const payments = pRes.data as PersonalFinancePeriodPayment[];
      const now = new Date();
      let paid = 0;
      for (const c of commitments) {
        const key = financePeriodKey(c.cadence, now);
        if (payments.some((p) => p.commitment_id === c.id && p.period_key === key)) {
          paid++;
        }
      }
      setFinanceBrief({ paid, total: commitments.length });
    } else {
      setFinanceBrief(null);
    }

    setReady(true);
  }, [household?.id, household?.is_personal, supabase]);

  useEffect(() => {
    if (!household?.id || !household.is_personal) return;
    load();
  }, [household?.id, household?.is_personal, load]);

  if (!household?.is_personal) return null;

  if (hhLoading || !ready || !dayCounts) {
    return (
      <div className="animate-pulse rounded-2xl border border-dashed border-muted bg-surface/50 p-6">
        <div className="h-5 w-48 rounded bg-muted" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted/60" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-surface p-5">
      <h2 className="mb-1 font-bold">מעקב אישי — {WINDOW_DAYS} יום אחרונים</h2>
      <p className="mb-4 text-xs text-muted">
        מספר <strong className="font-medium text-foreground">ימים שיש בהם לוג</strong> בכל
        מדור (לא ספירת רשומות). להלן גם סיכום סימון תשלומים לתקופה הנוכחית.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SECTION_TILES.map(({ section, label, href, icon: Icon }) => (
          <Link
            key={section}
            href={href}
            className="flex flex-col rounded-xl border bg-background/60 p-3 transition-colors hover:border-primary/25 hover:bg-surface-dim"
          >
            <Icon className="h-4 w-4 text-primary" />
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
              {dayCounts[section]}
            </p>
            <p className="text-xs font-medium text-foreground">{label}</p>
            <p className="text-[10px] text-muted">ימים עם תיעוד</p>
          </Link>
        ))}
      </div>
      {financeBrief !== null ? (
        <Link
          href="/me/finance"
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-3 text-sm transition-colors hover:bg-primary/[0.08]"
        >
          <div className="flex items-center gap-2">
            <PiggyBank className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-medium text-foreground">התחייבויות לתקופה הנוכחית</span>
          </div>
          <span className="shrink-0 tabular-nums font-semibold text-foreground">
            {financeBrief.total === 0
              ? "אין פעילות"
              : `${financeBrief.paid}/${financeBrief.total} סומנו`}
          </span>
        </Link>
      ) : null}
    </div>
  );
}
