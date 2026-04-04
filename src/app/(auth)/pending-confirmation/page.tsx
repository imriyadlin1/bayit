"use client";

import Link from "next/link";
import { ExternalLink, Loader2, Mail, MailCheck } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { AuthToast, type AuthToastVariant } from "@/components/auth/AuthToast";
import { resendErrorToHebrew, isAuthRateLimitError } from "@/lib/auth/auth-errors";
import { readPendingSignup, clearPendingSignup } from "@/lib/auth/pendingSignupStorage";
import { createClient } from "@/lib/supabase/client";

const RESEND_SUCCESS_COOLDOWN_MS = 45_000;
const RESEND_RATE_LIMIT_COOLDOWN_MS = 3 * 60 * 1000;

function PendingInner() {
  const [payload, setPayload] = useState<{ email: string; next: string } | null | undefined>(undefined);
  const [toast, setToast] = useState<{ msg: string; variant: AuthToastVariant } | null>(null);
  const [resendSending, setResendSending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    setPayload(readPendingSignup() ?? null);
  }, []);

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
  const resendDisabled = resendSending || cooldownLeft > 0;

  if (payload === undefined) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-xl">
        <p className="text-sm text-muted">טוען...</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-xl">
        <h1 className="text-xl font-bold">מחכים לאישור מייל?</h1>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          כדי להגיע למסך הזה צריך קודם להירשם. אם רעננתם את הדף, חזרו להרשמה.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-flex rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          להרשמה
        </Link>
        <p className="mt-4 text-sm text-muted">
          כבר אישרתם?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            להתחברות
          </Link>
        </p>
      </div>
    );
  }

  const { email, next: nextPath } = payload;
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}&email=${encodeURIComponent(email)}`;
  const signupHref = `/register?next=${encodeURIComponent(nextPath)}`;

  async function resendConfirmation() {
    if (!email || resendDisabled) return;
    setResendSending(true);
    setToast(null);
    try {
      const supabase = createClient();
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?${new URLSearchParams({ next: nextPath }).toString()}`
          : "";

      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      });

      if (err) {
        setToast({ msg: resendErrorToHebrew(err.message), variant: "error" });
        if (isAuthRateLimitError(err)) {
          setCooldownUntil(Date.now() + RESEND_RATE_LIMIT_COOLDOWN_MS);
        }
        return;
      }
      setToast({ msg: "מייל חדש נשלח. בדקו את התיבה.", variant: "success" });
      setCooldownUntil(Date.now() + RESEND_SUCCESS_COOLDOWN_MS);
    } catch {
      setToast({ msg: "לא הצלחנו לשלוח. נסו שוב בעוד דקה.", variant: "error" });
    } finally {
      setResendSending(false);
    }
  }

  return (
    <>
      <AuthToast
        message={toast?.msg ?? null}
        variant={toast?.variant ?? "error"}
        onDismiss={() => setToast(null)}
      />

      <div className="rounded-2xl border-2 border-primary/20 bg-surface p-6 shadow-xl shadow-primary/5 md:p-8">
        {/* Hero */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-md ring-2 ring-primary/20">
            <Mail className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold">שלחנו לכם מייל</h1>
          <p className="mt-3 max-w-sm text-base font-bold leading-relaxed">
            פתחו אותו ולחצו על הקישור כדי להפעיל את החשבון
          </p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            לא מצאתם? בדקו גם בספאם או בקידומי מכירות.
          </p>
        </div>

        {/* Email box */}
        <div className="mt-6 rounded-2xl border bg-background px-5 py-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-primary">שלחנו ל</p>
          <p className="mt-1.5 break-all text-lg font-bold" dir="ltr">{email}</p>
        </div>

        {/* Open Gmail */}
        <a
          href="https://mail.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white hover:bg-primary-dark transition-colors"
        >
          <MailCheck className="h-5 w-5" />
          פתחו את Gmail
          <ExternalLink className="h-4 w-4 opacity-60" />
        </a>
        <p className="mt-2 text-center text-xs text-muted">
          לא Gmail? פתחו את תיבת הדואר שלכם.
        </p>

        {/* Steps */}
        <div className="mt-6 rounded-2xl border bg-background px-5 py-5">
          <p className="text-sm font-bold">צעד אחרי צעד</p>
          <ol className="mt-3.5 space-y-3 text-sm text-muted leading-relaxed">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">1</span>
              <span>פתחו את <strong className="text-foreground">תיבת הדואר</strong> של הכתובת למעלה.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">2</span>
              <span>לא רואים? בדקו <strong className="text-foreground">ספאם / קידומי מכירות</strong>.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">3</span>
              <span><strong className="text-foreground">לחצו על הקישור</strong> — תועברו חזרה לאתר מחוברים.</span>
            </li>
          </ol>
        </div>

        <p className="mt-5 text-center text-xs text-muted leading-relaxed">
          המייל נשלח אוטומטית מהמערכת. אם לא מגיע תוך דקה — שלחו מחדש למטה.
        </p>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={resendConfirmation}
            disabled={resendDisabled}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors hover:bg-surface-dim disabled:opacity-60"
          >
            {resendSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                שולחים...
              </>
            ) : cooldownLeft > 0 ? (
              `שליחה בעוד ${cooldownLeft} שנ׳`
            ) : (
              "שלחו שוב"
            )}
          </button>
          <Link
            href={loginHref}
            className="flex flex-1 items-center justify-center rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            אישרתי — להתחברות
          </Link>
        </div>

        <Link
          href={signupHref}
          onClick={() => clearPendingSignup()}
          className="mt-5 flex w-full justify-center text-sm text-muted hover:text-foreground"
        >
          חזרה להרשמה (אימייל אחר)
        </Link>
      </div>
    </>
  );
}

export default function PendingConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl bg-surface p-8 text-center text-muted shadow-xl">טוען...</div>
      }
    >
      <PendingInner />
    </Suspense>
  );
}
