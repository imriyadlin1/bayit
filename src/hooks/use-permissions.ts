"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FeatureKey, AccessLevel } from "@/lib/types/database";

const ALL_FEATURES: FeatureKey[] = [
  "expenses",
  "shopping",
  "inventory",
  "plants",
  "chores",
  "maintenance",
  "notes",
];

function normalizeLevel(raw: string | null | undefined): AccessLevel | null {
  const s = (raw ?? "").toString().trim().toLowerCase();
  if (s === "hidden" || s === "view" || s === "edit") return s;
  return null;
}

function buildMemberPermMap(rows: { feature: string; access_level: string }[] | null) {
  const map: Record<string, AccessLevel> = {};
  ALL_FEATURES.forEach((f) => {
    map[f] = "edit";
  });
  rows?.forEach((p: { feature: string; access_level: string }) => {
    const level = normalizeLevel(p.access_level);
    if (level) map[p.feature] = level;
  });
  return map as Record<FeatureKey, AccessLevel>;
}

/** כשהטעינה נכשלת (RLS/רשת) — לא מגלים תוכן במצב לא ידוע */
function buildFailClosedMap(): Record<FeatureKey, AccessLevel> {
  const map: Record<string, AccessLevel> = {};
  ALL_FEATURES.forEach((f) => {
    map[f] = "hidden";
  });
  return map as Record<FeatureKey, AccessLevel>;
}

interface Permissions {
  loading: boolean;
  isHouseholdAdmin: boolean;
  can: (feature: FeatureKey, level?: AccessLevel) => boolean;
  getLevel: (feature: FeatureKey) => AccessLevel;
  visibleFeatures: FeatureKey[];
  /** משתנה בכל פעם שהרשאות נטענות מחדש — לשימוש ב-dependencies של דשבורד וכו׳ */
  permRevision: number;
  /** חתימה יציבה של מפת ההרשאות — להרצת effects כשהערכים בפועל משתנים */
  permsSnapshot: string;
}

export function usePermissions(householdId: string | null, userId: string | null): Permissions {
  const [perms, setPerms] = useState<Record<FeatureKey, AccessLevel>>({} as Record<FeatureKey, AccessLevel>);
  const [isHouseholdAdmin, setIsHouseholdAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permRevision, setPermRevision] = useState(0);
  const isHouseholdAdminRef = useRef(false);

  const loadPerms = useCallback(async () => {
    if (!householdId || !userId) return;

    const supabase = createClient();

    try {
      const { data: membership, error: memErr } = await supabase
        .from("household_members")
        .select("role")
        .eq("household_id", householdId)
        .eq("user_id", userId)
        .maybeSingle();

      if (memErr) {
        console.error("[usePermissions] household_members:", memErr.message);
      }

      const admin = membership?.role === "admin";
      isHouseholdAdminRef.current = admin;
      setIsHouseholdAdmin(admin);

      if (admin) {
        const all: Record<string, AccessLevel> = {};
        ALL_FEATURES.forEach((f) => {
          all[f] = "edit";
        });
        setPerms(all as Record<FeatureKey, AccessLevel>);
        setPermRevision((r) => r + 1);
        return;
      }

      const { data, error: permErr } = await supabase
        .from("member_permissions")
        .select("feature, access_level")
        .eq("household_id", householdId)
        .eq("user_id", userId);

      if (permErr) {
        console.error("[usePermissions] member_permissions:", permErr.message);
        setPerms(buildFailClosedMap());
        setPermRevision((r) => r + 1);
        return;
      }

      setPerms(buildMemberPermMap(data));
      setPermRevision((r) => r + 1);
    } catch (e) {
      console.error("[usePermissions]", e);
      setPerms(buildFailClosedMap());
      setPermRevision((r) => r + 1);
    } finally {
      setLoading(false);
    }
  }, [householdId, userId]);

  useEffect(() => {
    if (!householdId || !userId) {
      setLoading(false);
      setIsHouseholdAdmin(false);
      isHouseholdAdminRef.current = false;
      setPerms({} as Record<FeatureKey, AccessLevel>);
      return;
    }

    setLoading(true);
    void loadPerms();
  }, [householdId, userId, loadPerms]);

  useEffect(() => {
    if (!householdId || !userId) return;

    const poll = () => {
      if (isHouseholdAdminRef.current) return;
      void loadPerms();
    };

    const interval = setInterval(poll, 18_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void loadPerms();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const supabase = createClient();
    const channel = supabase
      .channel(`member_permissions:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "member_permissions",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          void loadPerms();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [householdId, userId, loadPerms]);

  function getLevel(feature: FeatureKey): AccessLevel {
    if (isHouseholdAdmin) return "edit";
    const v = perms[feature];
    if (v === "hidden" || v === "view" || v === "edit") return v;
    return "edit";
  }

  function can(feature: FeatureKey, level: AccessLevel = "view"): boolean {
    const current = getLevel(feature);
    if (current === "edit") return true;
    if (current === "view" && level === "view") return true;
    return false;
  }

  const visibleFeatures = ALL_FEATURES.filter((f) => can(f, "view"));

  const permsSnapshot = useMemo(() => {
    if (isHouseholdAdmin) return `admin|${householdId}|${userId}`;
    return ALL_FEATURES.map((f) => `${f}:${perms[f] ?? "?"}`).join("|");
  }, [isHouseholdAdmin, perms, householdId, userId]);

  return {
    loading,
    isHouseholdAdmin,
    can,
    getLevel,
    visibleFeatures,
    permRevision,
    permsSnapshot,
  };
}
