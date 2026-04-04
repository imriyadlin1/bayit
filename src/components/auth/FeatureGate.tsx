"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHousehold } from "@/hooks/use-household";
import { useHouseholdPermissions } from "@/contexts/household-permissions-context";
import type { FeatureKey } from "@/lib/types/database";
import { LoadingScreen } from "@/components/ui/loading";

export function FeatureGate({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
}) {
  const { household, loading: hhLoading } = useHousehold();
  const { getLevel, loading: permLoading, permRevision, permsSnapshot } = useHouseholdPermissions();
  const router = useRouter();
  const level = getLevel(feature);

  useEffect(() => {
    if (hhLoading || permLoading || !household) return;
    if (level === "hidden") {
      router.replace("/dashboard");
    }
  }, [hhLoading, permLoading, household, level, router, permRevision, permsSnapshot]);

  if (hhLoading || permLoading) return <LoadingScreen />;
  if (!household) return <LoadingScreen />;
  if (level === "hidden") return <LoadingScreen />;

  return <>{children}</>;
}
