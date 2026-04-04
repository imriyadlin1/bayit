"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FeatureKey, AccessLevel } from "@/lib/types/database";

const ALL_FEATURES: FeatureKey[] = [
  "expenses", "shopping", "inventory", "plants", "chores", "maintenance", "notes",
];

interface Permissions {
  loading: boolean;
  isHouseholdAdmin: boolean;
  can: (feature: FeatureKey, level?: AccessLevel) => boolean;
  getLevel: (feature: FeatureKey) => AccessLevel;
  visibleFeatures: FeatureKey[];
}

export function usePermissions(householdId: string | null, userId: string | null): Permissions {
  const [perms, setPerms] = useState<Record<FeatureKey, AccessLevel>>({} as any);
  const [isHouseholdAdmin, setIsHouseholdAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!householdId || !userId) return;
    const supabase = createClient();

    async function load() {
      const { data: membership } = await supabase
        .from("household_members")
        .select("role")
        .eq("household_id", householdId!)
        .eq("user_id", userId!)
        .single();

      const admin = membership?.role === "admin";
      setIsHouseholdAdmin(admin);

      if (admin) {
        const all: Record<string, AccessLevel> = {};
        ALL_FEATURES.forEach((f) => { all[f] = "edit"; });
        setPerms(all as Record<FeatureKey, AccessLevel>);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("member_permissions")
        .select("feature, access_level")
        .eq("household_id", householdId!)
        .eq("user_id", userId!);

      const map: Record<string, AccessLevel> = {};
      ALL_FEATURES.forEach((f) => { map[f] = "edit"; });
      data?.forEach((p: any) => { map[p.feature] = p.access_level; });
      setPerms(map as Record<FeatureKey, AccessLevel>);
      setLoading(false);
    }

    load();
  }, [householdId, userId]);

  function getLevel(feature: FeatureKey): AccessLevel {
    if (isHouseholdAdmin) return "edit";
    return perms[feature] || "edit";
  }

  function can(feature: FeatureKey, level: AccessLevel = "view"): boolean {
    const current = getLevel(feature);
    if (current === "edit") return true;
    if (current === "view" && level === "view") return true;
    return false;
  }

  const visibleFeatures = ALL_FEATURES.filter((f) => can(f, "view"));

  return { loading, isHouseholdAdmin, can, getLevel, visibleFeatures };
}
