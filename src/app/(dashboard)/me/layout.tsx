"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";

export default function MeLayout({ children }: { children: React.ReactNode }) {
  const { household, loading } = useHousehold();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!household?.is_personal) {
      router.replace("/dashboard");
    }
  }, [loading, household?.is_personal, household?.id, router]);

  if (loading || !household) return <LoadingScreen />;
  if (!household.is_personal) return <LoadingScreen />;

  return <>{children}</>;
}
