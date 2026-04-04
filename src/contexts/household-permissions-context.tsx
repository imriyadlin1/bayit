"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";

type PermissionsValue = ReturnType<typeof usePermissions>;

const HouseholdPermissionsContext = createContext<PermissionsValue | null>(null);

/** מופע יחיד של usePermissions לכל משק הבית — סיידבר, דשבורד והדר משתמשים באותו state */
export function HouseholdPermissionsProvider({
  householdId,
  userId,
  children,
}: {
  householdId: string | null;
  userId: string | null;
  children: ReactNode;
}) {
  const value = usePermissions(householdId, userId);
  return (
    <HouseholdPermissionsContext.Provider value={value}>
      {children}
    </HouseholdPermissionsContext.Provider>
  );
}

export function useHouseholdPermissions(): PermissionsValue {
  const ctx = useContext(HouseholdPermissionsContext);
  if (!ctx) {
    throw new Error("useHouseholdPermissions must be used within HouseholdPermissionsProvider");
  }
  return ctx;
}
