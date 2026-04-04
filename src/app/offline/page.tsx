"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <WifiOff className="mx-auto mb-4 h-16 w-16 text-muted" />
        <h1 className="mb-2 text-2xl font-bold">אין חיבור לאינטרנט</h1>
        <p className="text-muted">
          בדקו את החיבור לרשת ונסו שוב
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          נסה שוב
        </button>
      </div>
    </div>
  );
}
