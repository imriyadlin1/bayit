"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Home, Mail, Lock, User } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { AuthToast, type AuthToastVariant } from "@/components/auth/AuthToast";
import { safeNextPath } from "@/lib/auth/safeNext";
import { isAuthRateLimitError, signupErrorToHebrew } from "@/lib/auth/auth-errors";
import { setPendingSignup } from "@/lib/auth/pendingSignupStorage";
import { createClient } from "@/lib/supabase/client";

const SIGNUP_RATE_LIMIT_COOLDOWN_MS = 3 * 60 * 1000;

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const loginHref = `/login?next=${encodeURIComponent(next)}`;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; variant: AuthToastVariant } | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!cooldownUntil) return;
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
      if (Date.now() >= cooldownUntil) {
        setCooldownUntil(null);
        window.clearInterval(id);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const cooldownLeft =
    cooldownUntil && cooldownUntil > Date.now()
      ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
      : 0;
  const formLocked = loading || cooldownLeft > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formLocked) return;
    setLoading(true);
    setToast(null);

    try {
      const supabase = createClient();
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?${new URLSearchParams({ next }).toString()}`
          : "";

      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() || undefined },
          emailRedirectTo: redirectTo || undefined,
        },
      });

      if (err) {
        setToast({ msg: signupErrorToHebrew(err.message), variant: "error" });
        if (isAuthRateLimitError(err)) {
          setCooldownUntil(Date.now() + SIGNUP_RATE_LIMIT_COOLDOWN_MS);
        }
        return;
      }

      const u = data.user;
      const emailNorm = (u?.email ?? email.trim()).trim();

      if (u && !u.email_confirmed_at) {
        if (data.session) {
          await supabase.auth.signOut();
        }
        setPendingSignup(emailNorm, next);
        router.replace("/pending-confirmation");
        return;
      }

      if (data.session) {
        router.push(next);
        router.refresh();
        return;
      }

      if (u?.email_confirmed_at) {
        setToast({ msg: "החשבון פעיל — התחברו.", variant: "info" });
        router.push(loginHref);
        return;
      }

      if (emailNorm) {
        setPendingSignup(emailNorm, next);
        router.replace("/pending-confirmation");
        return;
      }

      setToast({ msg: "משהו השתבש. נסו שוב.", variant: "error" });
    } catch {
      setToast({ msg: "לא הצלחנו ליצור את החשבון. נסו שוב.", variant: "error" });
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
          <h1 className="text-2xl font-bold">צרו חשבון</h1>
          <p className="mt-1 text-muted">הצטרפו ותתחילו לנהל את הבית</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" aria-busy={loading}>
          <div>
            <label className="mb-1.5 block text-sm font-medium">שם מלא</label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ישראל ישראלי"
                className="w-full rounded-xl border bg-background py-3 pr-10 pl-4 text-sm transition-colors"
                disabled={formLocked}
              />
            </div>
          </div>

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
                disabled={formLocked}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              סיסמה
              <span className="text-xs font-normal text-muted mr-2">לפחות 6 תווים</span>
            </label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="w-full rounded-xl border bg-background py-3 pr-10 pl-4 text-sm transition-colors"
                required
                disabled={formLocked}
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm font-medium leading-relaxed">
              אחרי ההרשמה נשלח לכם <strong className="font-bold">מייל אישור</strong>.
              צריך ללחוץ על הקישור כדי להפעיל את החשבון.
            </p>
          </div>

          <button
            type="submit"
            disabled={formLocked}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                שולחים...
              </>
            ) : cooldownLeft > 0 ? (
              `אפשר לנסות שוב בעוד ${cooldownLeft} שנ׳`
            ) : (
              "הרשמה"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          כבר יש לכם חשבון?{" "}
          <Link href={loginHref} className="font-semibold text-primary hover:underline">
            התחברות
          </Link>
        </p>
      </div>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl bg-surface p-8 text-center text-muted shadow-xl">טוען...</div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
