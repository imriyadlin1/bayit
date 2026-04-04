"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Household, Profile } from "@/lib/types/database";

interface HouseholdData {
  household: Household | null;
  user: Profile | null;
  userId: string | null;
  loading: boolean;
}

export function useHousehold(): HouseholdData {
  const [household, setHousehold] = useState<Household | null>(null);
  const [user, setUser] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

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

      const { data: membership } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", authUser.id)
        .limit(1)
        .single();

      if (!membership) {
        setLoading(false);
        router.push("/onboarding");
        return;
      }

      const { data: hh } = await supabase
        .from("households")
        .select("*")
        .eq("id", membership.household_id)
        .single();

      if (hh) setHousehold(hh as Household);
      setLoading(false);
    }

    load();
  }, []);

  return { household, user, userId, loading };
}
