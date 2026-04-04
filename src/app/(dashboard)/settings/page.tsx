"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import {
  Copy,
  Check,
  LogOut,
  Users,
  UserCircle,
  Home,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { household, user, userId, loading: hhLoading } = useHousehold();
  const [members, setMembers] = useState<{ user_id: string; name: string; role: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (!household) return;
    loadMembers();
  }, [household]);

  async function loadMembers() {
    const { data } = await supabase
      .from("household_members")
      .select("user_id, role, profiles(full_name)")
      .eq("household_id", household!.id);

    if (data) {
      setMembers(
        data.map((m: any) => ({
          user_id: m.user_id,
          name: m.profiles?.full_name || "ללא שם",
          role: m.role,
        }))
      );
    }
  }

  async function copyInviteCode() {
    if (!household?.invite_code) return;
    await navigator.clipboard.writeText(household.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (hhLoading) return <LoadingScreen />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-muted">ניהול משק הבית והחשבון</p>
      </div>

      {/* Household Info */}
      <div className="rounded-2xl border bg-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold">{household?.name}</h2>
            <p className="text-xs text-muted">משק הבית שלכם</p>
          </div>
        </div>

        <div className="rounded-xl bg-background p-4">
          <p className="mb-2 text-sm font-medium">קוד הזמנה</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-surface-dim px-3 py-2 text-center font-mono text-lg tracking-widest">
              {household?.invite_code}
            </code>
            <button
              onClick={copyInviteCode}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  הועתק
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  העתק
                </>
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            שתפו את הקוד עם בני הבית כדי שיוכלו להצטרף
          </p>
        </div>
      </div>

      {/* Members */}
      <div className="rounded-2xl border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-muted" />
          <h2 className="font-bold">חברי הבית ({members.length})</h2>
        </div>
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center justify-between rounded-xl bg-background p-3"
            >
              <div className="flex items-center gap-3">
                <UserCircle className="h-8 w-8 text-muted" />
                <div>
                  <p className="text-sm font-medium">
                    {member.name}
                    {member.user_id === userId && " (אני)"}
                  </p>
                  <p className="text-xs text-muted">
                    {member.role === "admin" ? "מנהל" : "חבר"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Profile */}
      <div className="rounded-2xl border bg-surface p-5">
        <h2 className="mb-4 font-bold">החשבון שלי</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between rounded-xl bg-background p-3">
            <span className="text-muted">שם</span>
            <span className="font-medium">{user?.full_name}</span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/20 py-3 text-sm font-medium text-danger hover:bg-danger/5 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        התנתקות
      </button>
    </div>
  );
}
