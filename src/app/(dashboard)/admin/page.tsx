"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoadingScreen } from "@/components/ui/loading";
import { Users, Home, Shield, Calendar } from "lucide-react";

interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  household_name: string | null;
}

interface HouseholdRow {
  id: string;
  name: string;
  invite_code: string;
  member_count: number;
  created_at: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        router.push("/dashboard");
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: allHouseholds } = await supabase
        .from("households")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: memberships } = await supabase
        .from("household_members")
        .select("user_id, household_id");

      const userHouseholdMap = new Map<string, string>();
      const householdCountMap = new Map<string, number>();

      memberships?.forEach((m) => {
        userHouseholdMap.set(m.user_id, m.household_id);
        householdCountMap.set(
          m.household_id,
          (householdCountMap.get(m.household_id) || 0) + 1
        );
      });

      const householdNameMap = new Map<string, string>();
      allHouseholds?.forEach((h) => householdNameMap.set(h.id, h.name));

      setUsers(
        (profiles || []).map((p) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          is_admin: p.is_admin || false,
          created_at: p.created_at,
          household_name:
            householdNameMap.get(userHouseholdMap.get(p.id) || "") || null,
        }))
      );

      setHouseholds(
        (allHouseholds || []).map((h) => ({
          id: h.id,
          name: h.name,
          invite_code: h.invite_code,
          member_count: householdCountMap.get(h.id) || 0,
          created_at: h.created_at,
        }))
      );

      setLoading(false);
    }

    load();
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ניהול מערכת</h1>
        <p className="text-muted mt-1">
          סקירה כללית של כל המשתמשים ומשקי הבית
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-blue-100 text-blue-600"
          value={users.length}
          label="משתמשים"
        />
        <StatCard
          icon={<Home className="h-5 w-5" />}
          iconBg="bg-green-100 text-green-600"
          value={households.length}
          label="משקי בית"
        />
        <StatCard
          icon={<Shield className="h-5 w-5" />}
          iconBg="bg-amber-100 text-amber-600"
          value={users.filter((u) => u.is_admin).length}
          label="מנהלי מערכת"
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          iconBg="bg-purple-100 text-purple-600"
          value={
            users.filter(
              (u) =>
                new Date(u.created_at) >
                new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            ).length
          }
          label="חדשים השבוע"
        />
      </div>

      {/* Users table */}
      <div className="rounded-2xl bg-surface border">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">משתמשים</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted">
                <th className="px-5 py-3 text-right font-medium">שם</th>
                <th className="px-5 py-3 text-right font-medium">אימייל</th>
                <th className="px-5 py-3 text-right font-medium">משק בית</th>
                <th className="px-5 py-3 text-right font-medium">תפקיד</th>
                <th className="px-5 py-3 text-right font-medium">הצטרפות</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="px-5 py-3 font-medium">
                    {u.full_name || "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">{u.email || "—"}</td>
                  <td className="px-5 py-3">{u.household_name || "—"}</td>
                  <td className="px-5 py-3">
                    {u.is_admin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        <Shield className="h-3 w-3" />
                        אדמין
                      </span>
                    ) : (
                      <span className="text-muted">משתמש</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {new Date(u.created_at).toLocaleDateString("he-IL")}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-muted"
                  >
                    אין משתמשים עדיין
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Households table */}
      <div className="rounded-2xl bg-surface border">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">משקי בית</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted">
                <th className="px-5 py-3 text-right font-medium">שם</th>
                <th className="px-5 py-3 text-right font-medium">
                  קוד הזמנה
                </th>
                <th className="px-5 py-3 text-right font-medium">חברים</th>
                <th className="px-5 py-3 text-right font-medium">נוצר</th>
              </tr>
            </thead>
            <tbody>
              {households.map((h) => (
                <tr key={h.id} className="border-b last:border-0">
                  <td className="px-5 py-3 font-medium">{h.name}</td>
                  <td className="px-5 py-3">
                    <code className="rounded bg-surface-dim px-2 py-0.5 text-xs">
                      {h.invite_code}
                    </code>
                  </td>
                  <td className="px-5 py-3">{h.member_count}</td>
                  <td className="px-5 py-3 text-muted">
                    {new Date(h.created_at).toLocaleDateString("he-IL")}
                  </td>
                </tr>
              ))}
              {households.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-8 text-center text-muted"
                  >
                    אין משקי בית עדיין
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-surface border p-5">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
