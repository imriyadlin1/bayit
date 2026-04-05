"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { HouseholdProvider, useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import { HouseholdPermissionsProvider } from "@/contexts/household-permissions-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HouseholdProvider>
      <DashboardLayoutShell>{children}</DashboardLayoutShell>
    </HouseholdProvider>
  );
}

function DashboardLayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { spaces, household, switchSpace, loading, userId } = useHousehold();

  if (loading) return <LoadingScreen />;

  const spaceAttr = household?.is_personal ? "personal" : "household";

  return (
    <HouseholdPermissionsProvider
      key={`${household?.id ?? "none"}:${userId ?? "none"}`}
      householdId={household?.id ?? null}
      userId={userId}
    >
      <div className="flex h-screen overflow-hidden" data-space={spaceAttr}>
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          spaces={spaces}
          activeSpace={household}
          onSwitchSpace={switchSpace}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            onMenuClick={() => setSidebarOpen(true)}
            householdId={household?.id}
            userId={userId ?? undefined}
          />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </HouseholdPermissionsProvider>
  );
}
