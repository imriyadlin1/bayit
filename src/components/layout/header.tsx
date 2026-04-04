"use client";

import { Menu, Bell, UserCircle } from "lucide-react";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-surface/80 px-4 py-3 backdrop-blur-sm lg:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-muted hover:bg-surface-dim lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="lg:hidden" />

      <div className="flex items-center gap-2">
        <button className="relative rounded-lg p-2 text-muted hover:bg-surface-dim">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 left-1.5 h-2 w-2 rounded-full bg-accent" />
        </button>
        <button className="flex items-center gap-2 rounded-lg p-2 text-muted hover:bg-surface-dim">
          <UserCircle className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
