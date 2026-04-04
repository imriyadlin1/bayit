"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import {
  Plus,
  X,
  ListChecks,
  Check,
  RotateCcw,
  Loader2,
  Trash2,
  UserCircle,
  CalendarPlus,
} from "lucide-react";
import { googleCalendarUrl } from "@/lib/utils/calendar";
import type { Chore, ChoreCompletion, Profile } from "@/lib/types/database";

const frequencyLabels: Record<string, string> = {
  daily: "יומי",
  weekly: "שבועי",
  biweekly: "דו-שבועי",
  monthly: "חודשי",
  once: "חד פעמי",
};

export default function ChoresPage() {
  const { household, userId, user, loading: hhLoading } = useHousehold();
  const [chores, setChores] = useState<(Chore & { completions?: ChoreCompletion[]; assignee_name?: string })[]>([]);
  const [members, setMembers] = useState<{ user_id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [assignedTo, setAssignedTo] = useState("");
  const [rotate, setRotate] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!household) return;
    loadData();
  }, [household]);

  async function loadData() {
    setLoading(true);

    const { data: memberData } = await supabase
      .from("household_members")
      .select("user_id, profiles(full_name)")
      .eq("household_id", household!.id);

    const memberList =
      memberData?.map((m: any) => ({
        user_id: m.user_id,
        name: m.profiles?.full_name || "ללא שם",
      })) || [];
    setMembers(memberList);

    const { data: choreData } = await supabase
      .from("chores")
      .select("*, chore_completions(id, completed_by, completed_at)")
      .eq("household_id", household!.id)
      .order("created_at", { ascending: false });

    if (choreData) {
      const enriched = choreData.map((c: any) => ({
        ...c,
        completions: c.chore_completions || [],
        assignee_name:
          memberList.find((m) => m.user_id === c.assigned_to)?.name || "לא משויך",
      }));
      setChores(enriched);
    }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId) return;
    setSaving(true);

    await supabase.from("chores").insert({
      household_id: household.id,
      title,
      description: description || null,
      frequency,
      assigned_to: assignedTo || null,
      rotate,
      created_by: userId,
    });

    setTitle("");
    setDescription("");
    setFrequency("weekly");
    setAssignedTo("");
    setRotate(false);
    setShowForm(false);
    setSaving(false);
    loadData();
  }

  async function markDone(choreId: string) {
    await supabase.from("chore_completions").insert({
      chore_id: choreId,
      completed_by: userId,
    });

    const chore = chores.find((c) => c.id === choreId);
    if (chore?.rotate && members.length > 1) {
      const currentIdx = members.findIndex(
        (m) => m.user_id === chore.assigned_to
      );
      const nextIdx = (currentIdx + 1) % members.length;
      await supabase
        .from("chores")
        .update({ assigned_to: members[nextIdx].user_id })
        .eq("id", choreId);
    }

    loadData();
  }

  async function deleteChore(id: string) {
    await supabase.from("chores").delete().eq("id", id);
    setChores((prev) => prev.filter((c) => c.id !== id));
  }

  function isCompletedRecently(chore: Chore & { completions?: ChoreCompletion[] }): boolean {
    if (!chore.completions?.length) return false;
    const last = chore.completions.sort(
      (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    )[0];
    const lastDate = new Date(last.completed_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

    switch (chore.frequency) {
      case "daily": return hoursDiff < 20;
      case "weekly": return hoursDiff < 144;
      case "biweekly": return hoursDiff < 288;
      case "monthly": return hoursDiff < 600;
      default: return true;
    }
  }

  const pending = chores.filter((c) => !isCompletedRecently(c));
  const done = chores.filter((c) => isCompletedRecently(c));

  const myChoresCount = pending.filter((c) => c.assigned_to === userId).length;

  if (hhLoading) return <LoadingScreen />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">מטלות</h1>
          <p className="text-muted">
            {pending.length} ממתינות
            {myChoresCount > 0 && ` · ${myChoresCount} שלך`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          <Plus className="h-4 w-4" />
          מטלה חדשה
        </button>
      </div>

      {/* Stats */}
      {chores.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border bg-surface p-4 text-center">
            <p className="text-2xl font-bold text-primary">{pending.length}</p>
            <p className="text-xs text-muted">ממתינות</p>
          </div>
          <div className="rounded-2xl border bg-surface p-4 text-center">
            <p className="text-2xl font-bold text-success">{done.length}</p>
            <p className="text-xs text-muted">בוצעו</p>
          </div>
          <div className="rounded-2xl border bg-surface p-4 text-center">
            <p className="text-2xl font-bold text-accent">{myChoresCount}</p>
            <p className="text-xs text-muted">שלך</p>
          </div>
        </div>
      )}

      {/* Chores List */}
      {loading ? (
        <LoadingScreen />
      ) : chores.length === 0 ? (
        <div className="rounded-2xl border bg-surface p-12 text-center">
          <ListChecks className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="font-medium">אין מטלות עדיין</p>
          <p className="mt-1 text-sm text-muted">הוסיפו את המטלה הראשונה</p>
        </div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-muted">ממתינות</h2>
              <div className="space-y-2">
                {pending.map((chore) => (
                  <div
                    key={chore.id}
                    className={`flex items-center gap-3 rounded-xl border bg-surface p-4 transition-colors ${
                      chore.assigned_to === userId
                        ? "border-primary/30 bg-primary/5"
                        : ""
                    }`}
                  >
                    <button
                      onClick={() => markDone(chore.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border hover:border-primary hover:bg-primary/10 transition-all"
                    >
                      <Check className="h-4 w-4 text-transparent hover:text-primary" />
                    </button>
                    <div className="flex-1">
                      <p className="font-medium">{chore.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <RotateCcw className="h-3 w-3" />
                          {frequencyLabels[chore.frequency]}
                        </span>
                        <span className="flex items-center gap-1">
                          <UserCircle className="h-3 w-3" />
                          {chore.assignee_name}
                        </span>
                        {chore.rotate && (
                          <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-accent">
                            רוטציה
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <a
                        href={googleCalendarUrl({
                          title: `🏠 ${chore.title}`,
                          date: new Date().toISOString().split("T")[0],
                          details: chore.description || undefined,
                          recurrence:
                            chore.frequency === "daily" ? "DAILY"
                            : chore.frequency === "weekly" ? "WEEKLY"
                            : chore.frequency === "monthly" ? "MONTHLY"
                            : undefined,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        ליומן
                      </a>
                      <button
                        onClick={() => deleteChore(chore.id)}
                        className="rounded-lg p-1.5 text-muted hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Done */}
          {done.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-muted">בוצעו</h2>
              <div className="space-y-2">
                {done.map((chore) => (
                  <div
                    key={chore.id}
                    className="flex items-center gap-3 rounded-xl border bg-surface p-4 opacity-60"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-white">
                      <Check className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{chore.title}</p>
                      <p className="text-xs text-muted">
                        {frequencyLabels[chore.frequency]} · {chore.assignee_name}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteChore(chore.id)}
                      className="rounded-lg p-1.5 text-muted hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Chore Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">מטלה חדשה</h2>
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
                  שם המטלה
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='למשל: "לשטוף רצפה" או "להוריד זבל"'
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  תיאור (אופציונלי)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="פרטים נוספים"
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
                    <option value="daily">יומי</option>
                    <option value="weekly">שבועי</option>
                    <option value="biweekly">דו-שבועי</option>
                    <option value="monthly">חודשי</option>
                    <option value="once">חד פעמי</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    משויך ל
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  >
                    <option value="">לא משויך</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rotate}
                  onChange={(e) => setRotate(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                רוטציה אוטומטית בין חברי הבית
              </label>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "שומר..." : "הוספת מטלה"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
