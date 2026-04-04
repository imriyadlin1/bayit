"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHouseholdPermissions } from "@/contexts/household-permissions-context";
import { Menu, Bell, UserCircle, Droplets, ListChecks, AlertTriangle, X, Wrench } from "lucide-react";
import Link from "next/link";

interface Notification {
  id: string;
  type: "plant" | "chore" | "inventory" | "maintenance";
  text: string;
  href: string;
}

export function Header({
  onMenuClick,
  householdId,
  userId,
}: {
  onMenuClick: () => void;
  householdId?: string;
  userId?: string;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [showPanel, setShowPanel] = useState(false);
  const { getLevel, loading: permLoading } = useHouseholdPermissions();

  const readStorageKey =
    userId && householdId ? `bayit-notif-read-${userId}-${householdId}` : null;

  const skipPersistRef = useRef(true);

  useLayoutEffect(() => {
    skipPersistRef.current = true;
    if (!readStorageKey) {
      setReadIds(new Set());
      return;
    }
    try {
      const raw = sessionStorage.getItem(readStorageKey);
      setReadIds(raw ? new Set(JSON.parse(raw) as string[]) : new Set());
    } catch {
      setReadIds(new Set());
    }
  }, [readStorageKey]);

  useEffect(() => {
    if (!readStorageKey) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    try {
      sessionStorage.setItem(readStorageKey, JSON.stringify([...readIds]));
    } catch {
      /* ignore */
    }
  }, [readIds, readStorageKey]);

  const markNotificationsRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const reloadRef = useRef<(opts?: { markAllRead?: boolean }) => Promise<void>>(async () => {});
  const getLevelRef = useRef(getLevel);
  getLevelRef.current = getLevel;

  useEffect(() => {
    if (!householdId || !userId || permLoading) return;
    const supabase = createClient();
    let cancelled = false;

    async function loadNotifications(opts?: { markAllRead?: boolean }) {
      const markAllRead = opts?.markAllRead === true;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const hhId = householdId!;
      const today = new Date().toISOString().split("T")[0];
      const items: Notification[] = [];

      const canView = (feature: "plants" | "inventory" | "chores" | "maintenance") =>
        getLevelRef.current(feature) !== "hidden";

      if (canView("plants")) {
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
      }

      if (canView("inventory")) {
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
      }

      if (canView("chores")) {
        const { data: chores } = await supabase
          .from("chores")
          .select("id, title, frequency, assigned_to, chore_completions(completed_at)")
          .eq("household_id", hhId)
          .eq("assigned_to", user.id);

        const now = new Date();
        chores?.forEach((chore: any) => {
          const completions = chore.chore_completions || [];
          const lastDone = completions.length > 0
            ? new Date(Math.max(...completions.map((c: any) => new Date(c.completed_at).getTime())))
            : null;

          let pending = !lastDone;
          if (lastDone) {
            const hours = (now.getTime() - lastDone.getTime()) / (1000 * 60 * 60);
            const limits: Record<string, number> = {
              daily: 20, weekly: 144, biweekly: 288, monthly: 600,
            };
            if (limits[chore.frequency] && hours >= limits[chore.frequency]) pending = true;
          }

          if (pending) {
            items.push({
              id: `chore-${chore.id}`,
              type: "chore",
              text: `${chore.title} — משויך אליך`,
              href: "/chores",
            });
          }
        });
      }

      if (canView("maintenance")) {
        const { data: maintenance } = await supabase
          .from("maintenance_items")
          .select("id, title, next_due")
          .eq("household_id", hhId)
          .lte("next_due", today);
        maintenance?.forEach((item) => {
          items.push({
            id: `maint-${item.id}`,
            type: "maintenance",
            text: `${item.title} — באיחור`,
            href: "/maintenance",
          });
        });
      }

      if (cancelled) return;

      setReadIds((prevRead) => {
        const currentIds = new Set(items.map((i) => i.id));
        const next = new Set<string>();
        for (const id of prevRead) {
          if (currentIds.has(id)) next.add(id);
        }
        if (markAllRead) {
          items.forEach((i) => next.add(i.id));
        }
        return next;
      });
      setNotifications(items);
    }

    reloadRef.current = loadNotifications;
    void loadNotifications();

    const intervalMs = 45_000;
    const interval = setInterval(() => {
      void loadNotifications();
    }, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadNotifications();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [householdId, userId, permLoading]);

  const iconMap = {
    plant: Droplets,
    chore: ListChecks,
    inventory: AlertTriangle,
    maintenance: Wrench,
  };

  const colorMap = {
    plant: "text-green-600 bg-green-100",
    chore: "text-amber-600 bg-amber-100",
    inventory: "text-red-600 bg-red-100",
    maintenance: "text-purple-600 bg-purple-100",
  };

  const unreadNotifications = notifications.filter((n) => !readIds.has(n.id));
  const unreadCount = unreadNotifications.length;

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
            type="button"
            onClick={() => {
              if (showPanel) {
                setShowPanel(false);
              } else {
                void reloadRef.current({ markAllRead: true }).then(() =>
                  setShowPanel(true)
                );
              }
            }}
            className="relative rounded-lg p-2 text-muted hover:bg-surface-dim"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showPanel && (
            <div className="absolute left-0 top-full mt-2 w-80 rounded-2xl border bg-surface p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm">התראות</h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void reloadRef.current(undefined)}
                    className="rounded-lg px-2 py-1 text-xs text-primary hover:bg-primary/10"
                  >
                    רענון
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPanel(false)}
                    className="rounded-lg p-1 hover:bg-surface-dim"
                  >
                    <X className="h-4 w-4 text-muted" />
                  </button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">הכל בסדר, אין התראות</p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {notifications.map((n) => {
                    const Icon = iconMap[n.type];
                    const isUnread = !readIds.has(n.id);
                    return (
                      <Link
                        key={n.id}
                        href={n.href}
                        onClick={() => {
                          markNotificationsRead([n.id]);
                          setShowPanel(false);
                        }}
                        className={`flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-surface-dim ${
                          isUnread ? "bg-primary/5 font-medium" : "opacity-80"
                        }`}
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
