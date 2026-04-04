"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Home, Users, Plus, ArrowLeft, Loader2 } from "lucide-react";

export default function OnboardingPage() {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error: rpcErr } = await supabase.rpc(
      "create_household_with_member",
      { household_name: name }
    );

    if (rpcErr || !data) {
      setError("שגיאה ביצירת משק הבית");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error: rpcErr } = await supabase.rpc(
      "join_household_by_code",
      { invite: code.trim().toLowerCase() }
    );

    if (rpcErr || !data) {
      setError("קוד הזמנה לא תקין");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-bl from-primary/10 via-background to-accent/5 px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-xl shadow-black/5">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
            <Home className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">ברוכים הבאים לבית!</h1>
          <p className="mt-1 text-muted">בואו נגדיר את משק הבית שלכם</p>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("create")}
              className="flex w-full items-center gap-4 rounded-xl border p-4 text-right transition-all hover:border-primary hover:bg-primary/5"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">יצירת בית חדש</p>
                <p className="text-sm text-muted">
                  אני הראשון/ה - אזמין את השאר אחר כך
                </p>
              </div>
            </button>

            <button
              onClick={() => setMode("join")}
              className="flex w-full items-center gap-4 rounded-xl border p-4 text-right transition-all hover:border-primary hover:bg-primary/5"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">הצטרפות לבית קיים</p>
                <p className="text-sm text-muted">יש לי קוד הזמנה</p>
              </div>
            </button>
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                שם הבית
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='למשל: "הדירה בפלורנטין" או "בית משפחת כהן"'
                className="w-full rounded-xl border bg-background py-3 px-4 text-sm transition-colors"
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "יוצר..." : "יצירת בית"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("choose");
                setError("");
              }}
              className="flex w-full items-center justify-center gap-1 text-sm text-muted hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3 rotate-180" />
              חזרה
            </button>
          </form>
        )}

        {mode === "join" && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                קוד הזמנה
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="הקלידו את הקוד שקיבלתם"
                className="w-full rounded-xl border bg-background py-3 px-4 text-center text-lg font-mono tracking-widest transition-colors"
                required
                dir="ltr"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "מצטרף..." : "הצטרפות"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("choose");
                setError("");
              }}
              className="flex w-full items-center justify-center gap-1 text-sm text-muted hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3 rotate-180" />
              חזרה
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
