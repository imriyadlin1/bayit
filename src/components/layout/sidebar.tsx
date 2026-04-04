"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Wallet,
  ShoppingCart,
  Package,
  Sprout,
  ListChecks,
  Wrench,
  StickyNote,
  Settings,
  Home,
  X,
  Shield,
  User,
  ChevronDown,
  Plus,
  Loader2,
} from "lucide-react";
import type { FeatureKey, AccessLevel, Household } from "@/lib/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  feature?: FeatureKey;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "דשבורד", icon: LayoutDashboard },
  { href: "/expenses", label: "הוצאות", icon: Wallet, feature: "expenses" },
  { href: "/shopping", label: "קניות", icon: ShoppingCart, feature: "shopping" },
  { href: "/inventory", label: "מלאי", icon: Package, feature: "inventory" },
  { href: "/plants", label: "צמחים", icon: Sprout, feature: "plants" },
  { href: "/chores", label: "מטלות", icon: ListChecks, feature: "chores" },
  { href: "/maintenance", label: "תחזוקה", icon: Wrench, feature: "maintenance" },
  { href: "/notes", label: "לוח הודעות", icon: StickyNote, feature: "notes" },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

export function Sidebar({
  open,
  onClose,
  spaces,
  activeSpace,
  onSwitchSpace,
}: {
  open: boolean;
  onClose: () => void;
  spaces: Household[];
  activeSpace: Household | null;
  onSwitchSpace: (id: string) => void;
}) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, AccessLevel>>({});
  const [isHouseholdAdmin, setIsHouseholdAdmin] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [creatingPersonal, setCreatingPersonal] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !activeSpace) return;

      supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.is_admin) setIsAdmin(true);
        });

      supabase
        .from("household_members")
        .select("role")
        .eq("household_id", activeSpace.id)
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          setIsHouseholdAdmin(data?.role === "admin");
        });

      supabase
        .from("member_permissions")
        .select("feature, access_level")
        .eq("household_id", activeSpace.id)
        .eq("user_id", user.id)
        .then(({ data }) => {
          const map: Record<string, AccessLevel> = {};
          data?.forEach((p: any) => { map[p.feature] = p.access_level; });
          setPermissions(map);
        });
    });
  }, [activeSpace?.id]);

  function canSee(feature?: FeatureKey): boolean {
    if (!feature) return true;
    if (isHouseholdAdmin) return true;
    const level = permissions[feature];
    if (!level || level === "edit" || level === "view") return true;
    return false;
  }

  async function createPersonalSpace() {
    setCreatingPersonal(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const spaceName = `${profile?.full_name || "אישי"} - אישי`;

    const { data } = await supabase.rpc("create_personal_space", {
      space_name: spaceName,
    });

    if (data) {
      window.location.reload();
    }
    setCreatingPersonal(false);
  }

  const hasPersonalSpace = spaces.some((s) => s.is_personal);
  const filteredNav = navItems.filter((item) => canSee(item.feature));

  return (
    <>
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
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${
              activeSpace?.is_personal ? "bg-indigo-500" : "bg-primary"
            }`}>
              {activeSpace?.is_personal ? <User className="h-5 w-5" /> : <Home className="h-5 w-5" />}
            </div>
            <span className="text-lg font-bold">
              {activeSpace?.is_personal ? "אישי" : "בית"}
            </span>
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
            {filteredNav.map((item) => {
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

            {isAdmin && (
              <li>
                <div className="my-2 border-t" />
                <Link
                  href="/admin"
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    pathname === "/admin"
                      ? "bg-amber-100 text-amber-700"
                      : "text-amber-600 hover:bg-amber-50"
                  }`}
                >
                  <Shield className="h-5 w-5" />
                  ניהול מערכת
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* Space Switcher */}
        <div className="border-t p-4">
          <div className="relative">
            <button
              onClick={() => setShowSwitcher(!showSwitcher)}
              className="flex w-full items-center justify-between rounded-xl bg-surface-dim p-3 transition-colors hover:bg-border"
            >
              <div className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${
                  activeSpace?.is_personal ? "bg-indigo-500" : "bg-primary"
                }`}>
                  {activeSpace?.is_personal ? <User className="h-3.5 w-3.5" /> : <Home className="h-3.5 w-3.5" />}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">
                    {activeSpace?.is_personal ? "מרחב אישי" : "משק הבית"}
                  </p>
                  <p className="text-sm font-semibold truncate max-w-[140px]">
                    {activeSpace?.name || "טוען..."}
                  </p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted transition-transform ${showSwitcher ? "rotate-180" : ""}`} />
            </button>

            {showSwitcher && (
              <div className="absolute bottom-full right-0 left-0 mb-2 rounded-xl border bg-surface p-2 shadow-xl">
                {spaces.map((space) => (
                  <button
                    key={space.id}
                    onClick={() => {
                      onSwitchSpace(space.id);
                      setShowSwitcher(false);
                      onClose();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      space.id === activeSpace?.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted hover:bg-surface-dim"
                    }`}
                  >
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${
                      space.is_personal ? "bg-indigo-500" : "bg-primary"
                    }`}>
                      {space.is_personal ? <User className="h-3.5 w-3.5" /> : <Home className="h-3.5 w-3.5" />}
                    </div>
                    <span className="truncate">{space.name}</span>
                  </button>
                ))}

                {!hasPersonalSpace && (
                  <button
                    onClick={createPersonalSpace}
                    disabled={creatingPersonal}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-indigo-500 transition-colors hover:bg-indigo-50"
                  >
                    {creatingPersonal ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-dashed border-indigo-300">
                        <Plus className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <span>צור מרחב אישי</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
