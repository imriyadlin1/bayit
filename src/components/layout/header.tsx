"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Menu, Bell, UserCircle, Droplets, ListChecks, AlertTriangle, X } from "lucide-react";
import Link from "next/link";

interface Notification {
  id: string;
  type: "plant" | "chore" | "inventory";
  text: string;
  href: string;
}

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function loadNotifications() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!membership) return;
      const hhId = membership.household_id;
      const today = new Date().toISOString().split("T")[0];
      const items: Notification[] = [];

      const { data: plants } = await supabase
        .from("plants")
        .select("id, name")
        .eq("household_id", hhId)
        .lte("next_watering", today);

      plants?.forEach((p) =>
        items.push({
          id: `plant-${p.id}`,
          type: "plant",
          text: `${p.name} צריך השקיה`,
          href: "/plants",
        })
      );

      const { data: inventory } = await supabase
        .from("inventory_items")
        .select("id, name, expiry_date, quantity, min_quantity")
        .eq("household_id", hhId);

      inventory?.forEach((item) => {
        if (item.expiry_date && item.expiry_date <= today) {
          items.push({
            id: `inv-exp-${item.id}`,
            type: "inventory",
            text: `${item.name} פג תוקף`,
            href: "/inventory",
          });
        }
        if (item.min_quantity && Number(item.quantity) <= Number(item.min_quantity)) {
          items.push({
            id: `inv-low-${item.id}`,
            type: "inventory",
            text: `${item.name} עומד להיגמר`,
            href: "/inventory",
          });
        }
      });

      setNotifications(items);
    }

    loadNotifications();
  }, []);

  const iconMap = {
    plant: Droplets,
    chore: ListChecks,
    inventory: AlertTriangle,
  };

  const colorMap = {
    plant: "text-green-600 bg-green-100",
    chore: "text-amber-600 bg-amber-100",
    inventory: "text-red-600 bg-red-100",
  };

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
        <div className="relative">
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="relative rounded-lg p-2 text-muted hover:bg-surface-dim"
          >
            <Bell className="h-5 w-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                {notifications.length}
              </span>
            )}
          </button>

          {showPanel && (
            <div className="absolute left-0 top-full mt-2 w-80 rounded-2xl border bg-surface p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-sm">התראות</h3>
                <button
                  onClick={() => setShowPanel(false)}
                  className="rounded-lg p-1 hover:bg-surface-dim"
                >
                  <X className="h-4 w-4 text-muted" />
                </button>
              </div>
              {notifications.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">הכל בסדר, אין התראות</p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {notifications.map((n) => {
                    const Icon = iconMap[n.type];
                    return (
                      <Link
                        key={n.id}
                        href={n.href}
                        onClick={() => setShowPanel(false)}
                        className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-surface-dim"
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorMap[n.type]}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm">{n.text}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-lg p-2 text-muted hover:bg-surface-dim"
        >
          <UserCircle className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
