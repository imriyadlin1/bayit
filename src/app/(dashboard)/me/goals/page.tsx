"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import type { PersonalGoal } from "@/lib/types/database";
import { Plus, Trash2, Check, Loader2, X, Target } from "lucide-react";

export default function MeGoalsPage() {
  const { household, userId, loading: hhLoading } = useHousehold();
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const supabase = createClient();

  useEffect(() => {
    if (!household) return;
    loadGoals();
  }, [household?.id]);

  async function loadGoals() {
    setLoading(true);
    const { data } = await supabase
      .from("personal_goals")
      .select("*")
      .eq("household_id", household!.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setGoals((data as PersonalGoal[]) || []);
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId || !title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("personal_goals").insert({
      household_id: household.id,
      title: title.trim(),
      description: description.trim() || null,
      target_date: targetDate || null,
      created_by: userId,
    });
    setSaving(false);
    if (!error) {
      setTitle("");
      setDescription("");
      setTargetDate("");
      setShowForm(false);
      loadGoals();
    }
  }

  async function toggleComplete(g: PersonalGoal) {
    const now = new Date().toISOString();
    await supabase
      .from("personal_goals")
      .update({
        completed: !g.completed,
        completed_at: !g.completed ? now : null,
        updated_at: now,
      })
      .eq("id", g.id);
    loadGoals();
  }

  async function removeGoal(id: string) {
    await supabase.from("personal_goals").delete().eq("id", id);
    loadGoals();
  }

  if (hhLoading || loading) return <LoadingScreen />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">יעדים</h1>
            <p className="text-sm text-muted">
              יעדים אישיים במרחב שלך — לא קשור למשק הבית המשותף.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "סגור" : "יעד חדש"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="space-y-4 rounded-2xl border bg-surface p-5"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium">כותרת</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="למשל: חצי אירונמן 2026"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">תיאור (אופציונלי)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[88px] w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="פירוט קצר, שלבים, הערות..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">תאריך יעד (אופציונלי)</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            שמירה
          </button>
        </form>
      )}

      {goals.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-surface/50 py-12 text-center text-sm text-muted">
          עדיין אין יעדים. הוסף את הראשון למעלה.
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => (
            <li
              key={g.id}
              className={`rounded-2xl border bg-surface p-4 transition-opacity ${
                g.completed ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleComplete(g)}
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                    g.completed
                      ? "border-primary bg-primary text-white"
                      : "border-muted hover:border-primary"
                  }`}
                  aria-label={g.completed ? "סמן כלא הושלם" : "סמן כהושלם"}
                >
                  {g.completed ? <Check className="h-4 w-4" /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-semibold ${
                      g.completed ? "text-muted line-through" : ""
                    }`}
                  >
                    {g.title}
                  </p>
                  {g.description ? (
                    <p className="mt-1 text-sm text-muted">{g.description}</p>
                  ) : null}
                  {g.target_date ? (
                    <p className="mt-2 text-xs text-muted">
                      יעד:{" "}
                      {new Date(g.target_date + "T12:00:00").toLocaleDateString(
                        "he-IL",
                      )}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeGoal(g.id)}
                  className="shrink-0 rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-600"
                  aria-label="מחק"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
