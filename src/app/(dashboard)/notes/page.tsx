"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import {
  Plus,
  X,
  StickyNote,
  Pin,
  Trash2,
  Loader2,
  Pencil,
} from "lucide-react";
import type { HouseholdNote } from "@/lib/types/database";

const NOTE_COLORS = [
  { value: null, label: "ברירת מחדל", bg: "bg-surface" },
  { value: "#fef3c7", label: "צהוב", bg: "bg-amber-100" },
  { value: "#dbeafe", label: "כחול", bg: "bg-blue-100" },
  { value: "#dcfce7", label: "ירוק", bg: "bg-green-100" },
  { value: "#fce7f3", label: "ורוד", bg: "bg-pink-100" },
  { value: "#f3e8ff", label: "סגול", bg: "bg-purple-100" },
];

export default function NotesPage() {
  const { household, userId, loading: hhLoading } = useHousehold();
  const [notes, setNotes] = useState<(HouseholdNote & { author_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!household) return;
    loadNotes();
  }, [household]);

  async function loadNotes() {
    setLoading(true);
    const { data } = await supabase
      .from("household_notes")
      .select("*, profiles(full_name)")
      .eq("household_id", household!.id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (data) {
      setNotes(
        data.map((n: any) => ({
          ...n,
          author_name: n.profiles?.full_name || "ללא שם",
        }))
      );
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId) return;
    setSaving(true);

    if (editId) {
      await supabase
        .from("household_notes")
        .update({ title: title || null, content, color, updated_at: new Date().toISOString() })
        .eq("id", editId);
    } else {
      await supabase.from("household_notes").insert({
        household_id: household.id,
        title: title || null,
        content,
        color,
        created_by: userId,
      });
    }

    resetForm();
    setSaving(false);
    loadNotes();
  }

  function resetForm() {
    setTitle("");
    setContent("");
    setColor(null);
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(note: HouseholdNote) {
    setTitle(note.title || "");
    setContent(note.content);
    setColor(note.color);
    setEditId(note.id);
    setShowForm(true);
  }

  async function togglePin(note: HouseholdNote) {
    await supabase
      .from("household_notes")
      .update({ pinned: !note.pinned })
      .eq("id", note.id);
    loadNotes();
  }

  async function deleteNote(id: string) {
    await supabase.from("household_notes").delete().eq("id", id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  if (hhLoading) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">לוח הודעות</h1>
          <p className="text-muted">הודעות ופתקים לכל בני הבית</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          <Plus className="h-4 w-4" />
          הודעה חדשה
        </button>
      </div>

      {loading ? (
        <LoadingScreen />
      ) : notes.length === 0 ? (
        <div className="rounded-2xl border bg-surface p-12 text-center">
          <StickyNote className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="font-medium">אין הודעות עדיין</p>
          <p className="mt-1 text-sm text-muted">
            השאירו הודעות ופתקים לבני הבית
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="group rounded-2xl border p-5 transition-all hover:shadow-md"
              style={{ backgroundColor: note.color || undefined }}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex-1">
                  {note.title && (
                    <h3 className="font-bold">{note.title}</h3>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => togglePin(note)}
                    className={`rounded-lg p-1 ${
                      note.pinned ? "text-primary" : "text-muted hover:text-primary"
                    }`}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => startEdit(note)}
                    className="rounded-lg p-1 text-muted hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="rounded-lg p-1 text-muted hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {note.content}
              </p>

              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>{note.author_name}</span>
                <div className="flex items-center gap-2">
                  {note.pinned && <Pin className="h-3 w-3 text-primary" />}
                  <span>
                    {new Date(note.created_at).toLocaleDateString("he-IL")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editId ? "עריכת הודעה" : "הודעה חדשה"}
              </h2>
              <button
                onClick={resetForm}
                className="rounded-lg p-1.5 hover:bg-surface-dim"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  כותרת (אופציונלי)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="למשל: תזכורת, הודעה..."
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  תוכן
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="כתבו הודעה..."
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  rows={4}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">צבע</label>
                <div className="flex gap-2">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.value ?? "default"}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${c.bg} ${
                        color === c.value ? "border-primary scale-110" : "border-transparent"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "שומר..." : editId ? "שמירה" : "פרסום הודעה"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
