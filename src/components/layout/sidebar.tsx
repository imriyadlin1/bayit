"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  ShoppingCart,
  Package,
  Sprout,
  ListChecks,
  Wrench,
  Settings,
  Home,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "דשבורד", icon: LayoutDashboard },
  { href: "/expenses", label: "הוצאות", icon: Wallet },
  { href: "/shopping", label: "קניות", icon: ShoppingCart },
  { href: "/inventory", label: "מלאי", icon: Package },
  { href: "/plants", label: "צמחים", icon: Sprout },
  { href: "/chores", label: "מטלות", icon: ListChecks },
  { href: "/maintenance", label: "תחזוקה", icon: Wrench },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 right-0 z-50 flex h-full w-64 flex-col bg-surface border-l transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
              <Home className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">בית</span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-dim lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted hover:bg-surface-dim hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Household Info */}
        <div className="border-t p-4">
          <div className="rounded-xl bg-surface-dim p-3">
            <p className="text-xs text-muted">משק הבית</p>
            <p className="text-sm font-semibold">הדירה שלנו</p>
          </div>
        </div>
      </aside>
    </>
  );
}
