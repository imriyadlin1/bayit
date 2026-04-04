"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { useHouseholdPermissions } from "@/contexts/household-permissions-context";
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
  UserMinus,
  Wallet,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ExpenseCategory, FeatureKey, AccessLevel } from "@/lib/types/database";
import { sortExpenseCategoriesForDisplay } from "@/lib/expense-category-sort";

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
  const { canEdit } = useHouseholdPermissions();
  const canEditExpenses = canEdit("expenses");
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
  const [removeTarget, setRemoveTarget] = useState<{ user_id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [loadingExpenseCats, setLoadingExpenseCats] = useState(false);
  const [newExpenseCatName, setNewExpenseCatName] = useState("");
  const [addingExpenseCat, setAddingExpenseCat] = useState(false);
  const [deletingExpenseCatId, setDeletingExpenseCatId] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (!household) return;
    loadMembers();
    loadPermissions();
    if (!isPersonal) loadExpenseCategories();
  }, [household, isPersonal]);

  async function loadExpenseCategories() {
    if (!household || isPersonal) return;
    setLoadingExpenseCats(true);
    const { data, error } = await supabase
      .from("expense_categories")
      .select("*")
      .eq("household_id", household.id);
    setLoadingExpenseCats(false);
    if (error || !data) return;
    setExpenseCategories(
      sortExpenseCategoriesForDisplay(data as ExpenseCategory[])
    );
  }

  async function addCustomExpenseCategory() {
    if (!household || isPersonal || !canEditExpenses) return;
    const name = newExpenseCatName.trim();
    if (!name) return;
    if (expenseCategories.some((c) => c.name === name)) {
      alert("כבר קיימת קטגוריה בשם הזה.");
      return;
    }
    setAddingExpenseCat(true);
    const maxOrder = expenseCategories.reduce(
      (m, c) => Math.max(m, c.sort_order ?? 0),
      0
    );
    const { error } = await supabase.from("expense_categories").insert({
      household_id: household.id,
      name,
      icon: "Tag",
      color: "#6366f1",
      is_default: false,
      sort_order: maxOrder + 1,
    });
    setAddingExpenseCat(false);
    if (error) {
      alert(error.message || "לא ניתן להוסיף קטגוריה.");
      return;
    }
    setNewExpenseCatName("");
    await loadExpenseCategories();
  }

  async function removeCustomExpenseCategory(cat: ExpenseCategory) {
    if (!household || isPersonal || !canEditExpenses) return;
    if (cat.is_default) return;
    const { count, error: cntErr } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("household_id", household.id)
      .eq("category_id", cat.id);
    if (cntErr) {
      alert(cntErr.message || "שגיאה בבדיקה.");
      return;
    }
    if (count && count > 0) {
      alert(
        "לא ניתן למחוק — יש הוצאות משויכות לקטגוריה. שייכו אותן לקטגוריה אחרת ונסו שוב."
      );
      return;
    }
    if (!confirm(`למחוק את הקטגוריה «${cat.name}»?`)) return;
    setDeletingExpenseCatId(cat.id);
    const { error } = await supabase
      .from("expense_categories")
      .delete()
      .eq("id", cat.id)
      .eq("household_id", household.id);
    setDeletingExpenseCatId(null);
    if (error) {
      alert(error.message || "לא ניתן למחוק.");
      return;
    }
    await loadExpenseCategories();
  }

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

  async function removeMemberFromHousehold() {
    if (!household || !removeTarget) return;
    const uid = removeTarget.user_id;
    setRemoving(true);
    const { error: permErr } = await supabase
      .from("member_permissions")
      .delete()
      .eq("household_id", household.id)
      .eq("user_id", uid);

    const { error } = await supabase
      .from("household_members")
      .delete()
      .eq("household_id", household.id)
      .eq("user_id", uid);

    setRemoving(false);
    if (permErr || error) {
      alert(
        (error || permErr)?.message || "לא ניתן להסיר את החבר. נסו שוב."
      );
      return;
    }
    setRemoveTarget(null);
    if (editingPerms === uid) setEditingPerms(null);
    await loadMembers();
    await loadPermissions();
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

      {/* Expense categories (household) */}
      {!isPersonal && household && (
        <div className="rounded-2xl border bg-surface p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold">קטגוריות הוצאות</h2>
              <p className="text-xs text-muted">
                סדר הקטגוריות הבסיסיות קבוע. אפשר להוסיף קטגוריות משלכם (למשל רפואה).
              </p>
            </div>
          </div>

          {loadingExpenseCats ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted" />
            </div>
          ) : (
            <>
              <ul className="mb-4 space-y-1.5 rounded-xl bg-background p-3">
                {expenseCategories.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: cat.color || "#737373" }}
                      />
                      <span className="truncate font-medium">{cat.name}</span>
                      {cat.is_default && (
                        <span className="shrink-0 text-[10px] text-muted">ברירת מחדל</span>
                      )}
                    </span>
                    {canEditExpenses && !cat.is_default && (
                      <button
                        type="button"
                        onClick={() => removeCustomExpenseCategory(cat)}
                        disabled={deletingExpenseCatId === cat.id}
                        className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                        title="מחיקת קטגוריה"
                        aria-label={`מחיקת ${cat.name}`}
                      >
                        {deletingExpenseCatId === cat.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {canEditExpenses && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={newExpenseCatName}
                    onChange={(e) => setNewExpenseCatName(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !addingExpenseCat && addCustomExpenseCategory()
                    }
                    placeholder="שם קטגוריה חדשה"
                    className="min-w-0 flex-1 rounded-xl border bg-surface px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addCustomExpenseCategory}
                    disabled={addingExpenseCat || !newExpenseCatName.trim()}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                  >
                    {addingExpenseCat ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    הוספה
                  </button>
                </div>
              )}
            </>
          )}
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
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background p-3">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPerms(editingPerms === member.user_id ? null : member.user_id)}
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-dim transition-colors"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        הרשאות
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget({ user_id: member.user_id, name: member.name })}
                        className="flex items-center gap-1.5 rounded-lg border border-danger/25 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/5 transition-colors"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        הסר מבית
                      </button>
                    </div>
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

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-surface p-5 shadow-xl">
            <h3 className="text-lg font-bold">הסרת חבר מבית</h3>
            <p className="mt-2 text-sm text-muted">
              להסיר את <span className="font-medium text-foreground">{removeTarget.name}</span> ממשק הבית?
              החשבון שלהם יישאר קיים, והם לא יראו יותר את הנתונים של הבית הזה.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium hover:bg-surface-dim disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={removeMemberFromHousehold}
                disabled={removing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-danger py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {removing ? "מסירים..." : "הסרה"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
