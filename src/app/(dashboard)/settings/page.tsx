"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { useTheme } from "@/hooks/use-theme";
import { LoadingScreen } from "@/components/ui/loading";
import {
  Copy,
  Check,
  LogOut,
  Users,
  UserCircle,
  Home,
  Pencil,
  Loader2,
  Save,
  Moon,
  Sun,
  Shield,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { FeatureKey, AccessLevel } from "@/lib/types/database";

const FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "expenses", label: "הוצאות" },
  { key: "shopping", label: "קניות" },
  { key: "inventory", label: "מלאי" },
  { key: "plants", label: "צמחים" },
  { key: "chores", label: "מטלות" },
  { key: "maintenance", label: "תחזוקה" },
  { key: "notes", label: "לוח הודעות" },
];

const ACCESS_LABELS: Record<AccessLevel, string> = {
  edit: "מלא",
  view: "צפייה",
  hidden: "מוסתר",
};

export default function SettingsPage() {
  const { household, user, userId, loading: hhLoading, isPersonal } = useHousehold();
  const { dark, toggle } = useTheme();
  const [members, setMembers] = useState<{ user_id: string; name: string; role: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [isHouseholdAdmin, setIsHouseholdAdmin] = useState(false);
  const [editingPerms, setEditingPerms] = useState<string | null>(null);
  const [memberPerms, setMemberPerms] = useState<Record<string, Record<FeatureKey, AccessLevel>>>({});
  const [savingPerms, setSavingPerms] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (!household) return;
    loadMembers();
    loadPermissions();
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
      const me = data.find((m: any) => m.user_id === userId);
      setIsHouseholdAdmin(me?.role === "admin");
    }
  }

  async function loadPermissions() {
    const { data } = await supabase
      .from("member_permissions")
      .select("user_id, feature, access_level")
      .eq("household_id", household!.id);

    const map: Record<string, Record<string, AccessLevel>> = {};
    data?.forEach((p: any) => {
      if (!map[p.user_id]) map[p.user_id] = {};
      map[p.user_id][p.feature] = p.access_level;
    });
    setMemberPerms(map as any);
  }

  function getPermLevel(uid: string, feature: FeatureKey): AccessLevel {
    return memberPerms[uid]?.[feature] || "edit";
  }

  async function setPermLevel(uid: string, feature: FeatureKey, level: AccessLevel) {
    setMemberPerms((prev) => ({
      ...prev,
      [uid]: { ...prev[uid], [feature]: level },
    }));
  }

  async function savePermissions(uid: string) {
    if (!household) return;
    setSavingPerms(true);

    await supabase
      .from("member_permissions")
      .delete()
      .eq("household_id", household.id)
      .eq("user_id", uid);

    const perms = memberPerms[uid];
    if (perms) {
      const inserts = Object.entries(perms)
        .filter(([, level]) => level !== "edit")
        .map(([feature, access_level]) => ({
          household_id: household.id,
          user_id: uid,
          feature,
          access_level,
        }));

      if (inserts.length > 0) {
        await supabase.from("member_permissions").insert(inserts);
      }
    }

    setSavingPerms(false);
    setEditingPerms(null);
  }

  async function copyInviteCode() {
    if (!household?.invite_code) return;
    await navigator.clipboard.writeText(household.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSaveName() {
    if (!userId || !newName.trim()) return;
    setSavingName(true);
    await supabase
      .from("profiles")
      .update({ full_name: newName.trim() })
      .eq("id", userId);
    setEditingName(false);
    setSavingName(false);
    window.location.reload();
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

      {/* Appearance */}
      <div className="rounded-2xl border bg-surface p-5">
        <h2 className="mb-4 font-bold">תצוגה</h2>
        <div className="flex items-center justify-between rounded-xl bg-background p-4">
          <div className="flex items-center gap-3">
            {dark ? <Moon className="h-5 w-5 text-indigo-400" /> : <Sun className="h-5 w-5 text-amber-500" />}
            <div>
              <p className="text-sm font-medium">{dark ? "מצב כהה" : "מצב בהיר"}</p>
              <p className="text-xs text-muted">החליפו בין ערכות נושא</p>
            </div>
          </div>
          <button
            onClick={toggle}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              dark ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all ${
                dark ? "left-0.5" : "left-[22px]"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Household Info */}
      {!isPersonal && (
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
                  <><Check className="h-4 w-4" />הועתק</>
                ) : (
                  <><Copy className="h-4 w-4" />העתק</>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              שתפו את הקוד עם בני הבית כדי שיוכלו להצטרף
            </p>
          </div>
        </div>
      )}

      {/* Members + Permissions */}
      {!isPersonal && (
        <div className="rounded-2xl border bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-muted" />
            <h2 className="font-bold">חברי הבית ({members.length})</h2>
          </div>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.user_id}>
                <div className="flex items-center justify-between rounded-xl bg-background p-3">
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
                  {isHouseholdAdmin && member.role !== "admin" && (
                    <button
                      onClick={() => setEditingPerms(editingPerms === member.user_id ? null : member.user_id)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-dim transition-colors"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      הרשאות
                    </button>
                  )}
                </div>

                {/* Permission Editor */}
                {editingPerms === member.user_id && (
                  <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="mb-3 text-sm font-bold">הרשאות עבור {member.name}</p>
                    <div className="space-y-2">
                      {FEATURES.map((f) => {
                        const level = getPermLevel(member.user_id, f.key);
                        return (
                          <div key={f.key} className="flex items-center justify-between">
                            <span className="text-sm">{f.label}</span>
                            <div className="flex gap-1">
                              {(["edit", "view", "hidden"] as AccessLevel[]).map((l) => (
                                <button
                                  key={l}
                                  onClick={() => setPermLevel(member.user_id, f.key, l)}
                                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                                    level === l
                                      ? l === "hidden"
                                        ? "bg-danger/10 text-danger"
                                        : l === "view"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-success/10 text-success"
                                      : "bg-surface-dim text-muted hover:bg-border"
                                  }`}
                                >
                                  {l === "edit" && <Check className="h-3 w-3" />}
                                  {l === "view" && <Eye className="h-3 w-3" />}
                                  {l === "hidden" && <EyeOff className="h-3 w-3" />}
                                  {ACCESS_LABELS[l]}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => savePermissions(member.user_id)}
                      disabled={savingPerms}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
                    >
                      {savingPerms ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {savingPerms ? "שומר..." : "שמירת הרשאות"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile */}
      <div className="rounded-2xl border bg-surface p-5">
        <h2 className="mb-4 font-bold">החשבון שלי</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-xl bg-background p-3">
            <span className="text-muted">שם</span>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-40 rounded-lg border bg-surface px-2 py-1 text-sm"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName || !newName.trim()}
                  className="rounded-lg bg-primary p-1.5 text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium">{user?.full_name || "לא הוגדר"}</span>
                <button
                  onClick={() => {
                    setNewName(user?.full_name || "");
                    setEditingName(true);
                  }}
                  className="rounded-lg p-1 text-muted hover:bg-surface-dim"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="flex justify-between rounded-xl bg-background p-3">
            <span className="text-muted">אימייל</span>
            <span className="font-medium" dir="ltr">{user?.email || "—"}</span>
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
