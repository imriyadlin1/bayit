"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export type AuthToastVariant = "error" | "success" | "info";

type Props = {
  message: string | null;
  variant?: AuthToastVariant;
  onDismiss: () => void;
  durationMs?: number;
};

const styles: Record<AuthToastVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-border bg-surface text-foreground",
};

const defaultDuration: Record<AuthToastVariant, number> = {
  error: 7000,
  success: 5000,
  info: 10000,
};

export function AuthToast({ message, variant = "error", onDismiss, durationMs }: Props) {
  const duration = durationMs ?? defaultDuration[variant];

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  return (
    <div className="fixed bottom-5 left-4 right-4 z-[200] max-w-md animate-[slideUp_0.3s_ease] md:left-auto md:right-8">
      <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-lg ${styles[variant]}`}>
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 opacity-70 transition hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
