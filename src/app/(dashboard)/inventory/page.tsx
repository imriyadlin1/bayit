"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import {
  Plus,
  X,
  Package,
  AlertTriangle,
  Loader2,
  Trash2,
  Search,
} from "lucide-react";
import type { InventoryItem } from "@/lib/types/database";

const CATEGORIES = [
  "פירות וירקות",
  "מוצרי חלב",
  "בשר ודגים",
  "יבשים ושימורים",
  "חטיפים ומתוקים",
  "משקאות",
  "ניקיון",
  "היגיינה",
  "אחר",
];

export default function InventoryPage() {
  const { household, userId, loading: hhLoading } = useHousehold();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [minQuantity, setMinQuantity] = useState("");

  const supabase = createClient();

  useEffect(() => {
    if (!household) return;
    loadItems();
  }, [household]);

  async function loadItems() {
    setLoading(true);
    const { data } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("household_id", household!.id)
      .order("category")
      .order("name");

    if (data) setItems(data as InventoryItem[]);
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId) return;
    setSaving(true);

    await supabase.from("inventory_items").insert({
      household_id: household.id,
      name,
      quantity: parseFloat(quantity) || 1,
      unit: unit || null,
      category: category || null,
      expiry_date: expiryDate || null,
      min_quantity: minQuantity ? parseFloat(minQuantity) : null,
      added_by: userId,
    });

    setName("");
    setQuantity("1");
    setUnit("");
    setCategory("");
    setExpiryDate("");
    setMinQuantity("");
    setShowForm(false);
    setSaving(false);
    loadItems();
  }

  async function updateQuantity(item: InventoryItem, delta: number) {
    const newQty = Math.max(0, Number(item.quantity) + delta);
    await supabase
      .from("inventory_items")
      .update({ quantity: newQty })
      .eq("id", item.id);

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i))
    );
  }

  async function deleteItem(id: string) {
    await supabase.from("inventory_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function isLow(item: InventoryItem): boolean {
    if (item.min_quantity == null) return false;
    return Number(item.quantity) <= Number(item.min_quantity);
  }

  function isExpiringSoon(item: InventoryItem): boolean {
    if (!item.expiry_date) return false;
    const expiry = new Date(item.expiry_date);
    const today = new Date();
    const diff = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 3 && diff >= 0;
  }

  function isExpired(item: InventoryItem): boolean {
    if (!item.expiry_date) return false;
    return new Date(item.expiry_date) < new Date();
  }

  const filtered = items.filter((i) => {
    const matchSearch = !search || i.name.includes(search);
    const matchCat = filterCat === "all" || i.category === filterCat;
    return matchSearch && matchCat;
  });

  const lowStockCount = items.filter(isLow).length;
  const expiringCount = items.filter((i) => isExpiringSoon(i) || isExpired(i)).length;

  const usedCategories = [...new Set(items.map((i) => i.category).filter(Boolean))];

  if (hhLoading) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">מלאי</h1>
          <p className="text-muted">
            {items.length} פריטים
            {lowStockCount > 0 && (
              <span className="text-accent"> · {lowStockCount} עומדים להיגמר</span>
            )}
            {expiringCount > 0 && (
              <span className="text-danger"> · {expiringCount} פג/עומד לפוג</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          <Plus className="h-4 w-4" />
          פריט חדש
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש פריט..."
            className="w-full rounded-xl border bg-surface py-2.5 pr-10 pl-4 text-sm"
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="rounded-xl border bg-surface py-2.5 px-4 text-sm"
        >
          <option value="all">כל הקטגוריות</option>
          {usedCategories.map((cat) => (
            <option key={cat} value={cat!}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Items List */}
      {loading ? (
        <LoadingScreen />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-surface p-12 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="font-medium">
            {items.length === 0 ? "המלאי ריק" : "אין תוצאות"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {items.length === 0
              ? "הוסיפו פריטים כדי לעקוב אחרי מה שיש בבית"
              : "נסו חיפוש אחר"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const low = isLow(item);
            const expiring = isExpiringSoon(item);
            const expired = isExpired(item);
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl border bg-surface p-4 transition-colors ${
                  expired
                    ? "border-danger/30 bg-danger/5"
                    : low || expiring
                    ? "border-accent/30 bg-accent/5"
                    : ""
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{item.name}</p>
                    {(low || expired || expiring) && (
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          expired ? "text-danger" : "text-accent"
                        }`}
                      />
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
                    {item.category && <span>{item.category}</span>}
                    {item.expiry_date && (
                      <span
                        className={
                          expired ? "text-danger font-medium" : expiring ? "text-accent font-medium" : ""
                        }
                      >
                        {expired
                          ? "פג תוקף!"
                          : `תוקף: ${new Date(item.expiry_date).toLocaleDateString("he-IL")}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQuantity(item, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border text-lg hover:bg-surface-dim"
                  >
                    -
                  </button>
                  <span className="w-12 text-center font-semibold">
                    {Number(item.quantity)}
                    {item.unit ? ` ${item.unit}` : ""}
                  </span>
                  <button
                    onClick={() => updateQuantity(item, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border text-lg hover:bg-surface-dim"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => deleteItem(item.id)}
                  className="rounded-lg p-1.5 text-muted hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Item Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">פריט חדש למלאי</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 hover:bg-surface-dim"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">שם</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="למשל: חלב, ביצים, סבון כלים..."
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">כמות</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                    min="0"
                    step="0.5"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">יחידה</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder='ק"ג, ליטר...'
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">מינימום</label>
                  <input
                    type="number"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    placeholder="התראה"
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                    min="0"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">קטגוריה</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  >
                    <option value="">ללא</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">תוקף</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                    dir="ltr"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "שומר..." : "הוספת פריט"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
