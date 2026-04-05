"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Household, Profile } from "@/lib/types/database";

/** מפתח localStorage למרחב הפעיל — משמש גם אחרי יצירת מרחב אישי */
export const BAYIT_ACTIVE_SPACE_KEY = "bayit-active-space";

export interface HouseholdContextValue {
  household: Household | null;
  user: Profile | null;
  userId: string | null;
  loading: boolean;
  isPersonal: boolean;
  spaces: Household[];
  switchSpace: (id: string) => void;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [spaces, setSpaces] = useState<Household[]>([]);
  const [user, setUser] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

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
        .map((m: { households: unknown }) => m.households)
        .filter(Boolean)
        .map((raw) => {
          const h = raw as Household;
          return { ...h, is_personal: h.is_personal === true };
        }) as Household[];

      setSpaces(allSpaces);

      const savedId = localStorage.getItem(BAYIT_ACTIVE_SPACE_KEY);
      const targetSpace =
        allSpaces.find((s) => s.id === savedId) ||
        allSpaces.find((s) => !s.is_personal) ||
        allSpaces[0];

      if (targetSpace) {
        setHousehold(targetSpace);
        localStorage.setItem(BAYIT_ACTIVE_SPACE_KEY, targetSpace.id);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  const switchSpace = useCallback(
    (id: string) => {
      const target = spaces.find((s) => s.id === id);
      if (target) {
        setHousehold(target);
        localStorage.setItem(BAYIT_ACTIVE_SPACE_KEY, id);
        router.push("/dashboard");
      }
    },
    [router, spaces],
  );

  const value = useMemo(
    () => ({
      household,
      user,
      userId,
      loading,
      isPersonal: household?.is_personal ?? false,
      spaces,
      switchSpace,
    }),
    [household, user, userId, loading, spaces, switchSpace],
  );

  return (
    <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
  );
}

export function useHousehold(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext);
  if (!ctx) {
    throw new Error("useHousehold חייב להיות בתוך <HouseholdProvider>");
  }
  return ctx;
}
