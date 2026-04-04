"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Home, Mail, Lock } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { AuthToast, type AuthToastVariant } from "@/components/auth/AuthToast";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { safeNextPath } from "@/lib/auth/safeNext";
import { loginErrorToHebrew } from "@/lib/auth/auth-errors";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const signupHref = `/register?next=${encodeURIComponent(next)}`;
  const emailFromUrl = params.get("email") ?? "";

  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; variant: AuthToastVariant } | null>(null);

  useEffect(() => {
    const err = params.get("error");
    if (err === "auth") {
      setToast({
        msg: "הקישור מהמייל לא יצר חיבור אוטומטי. הקלידו את הסיסמה כדי להיכנס.",
        variant: "info",
      });
    }
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setToast(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setToast({ msg: loginErrorToHebrew(err.message), variant: "error" });
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setToast({ msg: "משהו השתבש. נסו שוב בעוד רגע.", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AuthToast
        message={toast?.msg ?? null}
        variant={toast?.variant ?? "error"}
        onDismiss={() => setToast(null)}
      />

      <div className="rounded-2xl bg-surface p-8 shadow-xl shadow-black/5">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
            <Home className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">ברוכים השבים</h1>
          <p className="mt-1 text-muted">הכנסו עם האימייל והסיסמה שלכם</p>
        </div>

        <div className="mb-5 rounded-xl border bg-surface-dim px-4 py-3 text-xs font-medium leading-relaxed text-muted">
          נרשמתם לאחרונה? <strong className="text-foreground">קודם לחצו על הקישור במייל</strong> — בלי
          אישור לא ניתן להיכנס.
        </div>

        <form onSubmit={onSubmit} className="space-y-4" aria-busy={loading}>
          <div>
            <label className="mb-1.5 block text-sm font-medium">אימייל</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border bg-background py-3 pr-10 pl-4 text-sm transition-colors"
                required
                disabled={loading}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">סיסמה</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border bg-background py-3 pr-10 pl-4 text-sm transition-colors"
                required
                disabled={loading}
                dir="ltr"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                נכנסים...
              </>
            ) : (
              "כניסה"
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-surface px-3 text-muted">או</span>
          </div>
        </div>

        <GoogleLoginButton next={next} />

        <p className="mt-6 text-center text-sm text-muted">
          עדיין אין חשבון?{" "}
          <Link href={signupHref} className="font-semibold text-primary hover:underline">
            הרשמה
          </Link>
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl bg-surface p-8 text-center text-muted shadow-xl">טוען...</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
