"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Household, Profile } from "@/lib/types/database";

const SPACE_KEY = "bayit-active-space";

interface HouseholdData {
  household: Household | null;
  user: Profile | null;
  userId: string | null;
  loading: boolean;
  isPersonal: boolean;
  spaces: Household[];
  switchSpace: (id: string) => void;
}

export function useHousehold(): HouseholdData {
  const [household, setHousehold] = useState<Household | null>(null);
  const [spaces, setSpaces] = useState<Household[]>([]);
  const [user, setUser] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const loadSpaceById = useCallback(async (authUserId: string, spaceId: string) => {
    const { data: hh } = await supabase
      .from("households")
      .select("*")
      .eq("id", spaceId)
      .single();

    if (hh) {
      setHousehold(hh as Household);
      localStorage.setItem(SPACE_KEY, hh.id);
    }
  }, []);

  useEffect(() => {
    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUserId(authUser.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (profile) setUser(profile as Profile);

      const { data: memberships } = await supabase
        .from("household_members")
        .select("household_id, households(*)")
        .eq("user_id", authUser.id);

      if (!memberships || memberships.length === 0) {
        setLoading(false);
        router.push("/onboarding");
        return;
      }

      const allSpaces = memberships
        .map((m: any) => m.households)
        .filter(Boolean) as Household[];
      setSpaces(allSpaces);

      const savedId = localStorage.getItem(SPACE_KEY);
      const targetSpace = allSpaces.find((s) => s.id === savedId)
        || allSpaces.find((s) => !s.is_personal)
        || allSpaces[0];

      if (targetSpace) {
        setHousehold(targetSpace);
        localStorage.setItem(SPACE_KEY, targetSpace.id);
      }

      setLoading(false);
    }

    load();
  }, []);

  function switchSpace(id: string) {
    const target = spaces.find((s) => s.id === id);
    if (target) {
      setHousehold(target);
      localStorage.setItem(SPACE_KEY, id);
    }
  }

  return {
    household,
    user,
    userId,
    loading,
    isPersonal: household?.is_personal ?? false,
    spaces,
    switchSpace,
  };
}
