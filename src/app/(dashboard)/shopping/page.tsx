"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { FeatureGate } from "@/components/auth/FeatureGate";
import { LoadingScreen } from "@/components/ui/loading";
import {
  Plus,
  ShoppingCart,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ShoppingItem, ShoppingList } from "@/lib/types/database";

function ShoppingPageInner() {
  const { household, userId, loading: hhLoading } = useHousehold();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [showChecked, setShowChecked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!household) return;
    loadData();

    const channel = supabase
      .channel("shopping-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items" },
        () => loadItems()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [household]);

  async function loadData() {
    setLoading(true);

    let { data: lists } = await supabase
      .from("shopping_lists")
      .select("*")
      .eq("household_id", household!.id)
      .eq("is_active", true)
      .limit(1);

    let activeList = lists?.[0] as ShoppingList | undefined;

    if (!activeList) {
      const { data: newList } = await supabase
        .from("shopping_lists")
        .insert({
          household_id: household!.id,
          name: "רשימת קניות",
          created_by: userId,
        })
        .select()
        .single();
      activeList = newList as ShoppingList;
    }

    if (activeList) {
      setList(activeList);
      await loadItems(activeList.id);
    }
    setLoading(false);
  }

  async function loadItems(listId?: string) {
    const id = listId || list?.id;
    if (!id) return;

    const { data } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("list_id", id)
      .order("is_checked")
      .order("created_at", { ascending: false });

    if (data) setItems(data as ShoppingItem[]);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!list || !newItem.trim()) return;

    await supabase.from("shopping_items").insert({
      list_id: list.id,
      name: newItem.trim(),
      quantity: parseFloat(newQty) || 1,
      added_by: userId,
    });

    setNewItem("");
    setNewQty("1");
    inputRef.current?.focus();
    loadItems();
  }

  async function toggleCheck(item: ShoppingItem) {
    await supabase
      .from("shopping_items")
      .update({
        is_checked: !item.is_checked,
        checked_by: !item.is_checked ? userId : null,
      })
      .eq("id", item.id);

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, is_checked: !i.is_checked } : i
      )
    );
  }

  async function handleDelete(id: string) {
    await supabase.from("shopping_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function clearChecked() {
    const checkedIds = items.filter((i) => i.is_checked).map((i) => i.id);
    if (checkedIds.length === 0) return;

    await supabase.from("shopping_items").delete().in("id", checkedIds);
    setItems((prev) => prev.filter((i) => !i.is_checked));
  }

  const unchecked = items.filter((i) => !i.is_checked);
  const checked = items.filter((i) => i.is_checked);

  if (hhLoading) return <LoadingScreen />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">רשימת קניות</h1>
        <p className="text-muted">
          {unchecked.length} פריטים לקנות
          {checked.length > 0 && ` · ${checked.length} נקנו`}
        </p>
      </div>

      {/* Quick Add */}
      <form
        onSubmit={handleAdd}
        className="flex gap-2 rounded-2xl border bg-surface p-3"
      >
        <input
          ref={inputRef}
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="מה צריך לקנות?"
          className="flex-1 rounded-xl border bg-background py-3 px-4 text-sm"
        />
        <input
          type="number"
          value={newQty}
          onChange={(e) => setNewQty(e.target.value)}
          className="w-16 rounded-xl border bg-background py-3 px-2 text-center text-sm"
          min="1"
          dir="ltr"
        />
        <button
          type="submit"
          className="flex items-center gap-1 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {/* Items List */}
      {loading ? (
        <LoadingScreen />
      ) : unchecked.length === 0 && checked.length === 0 ? (
        <div className="rounded-2xl border bg-surface p-12 text-center">
          <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="font-medium">הרשימה ריקה</p>
          <p className="mt-1 text-sm text-muted">
            הוסיפו פריטים למעלה
          </p>
        </div>
      ) : (
        <>
          {/* Unchecked Items */}
          <div className="space-y-2">
            {unchecked.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border bg-surface p-3 transition-colors"
              >
                <button
                  onClick={() => toggleCheck(item)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border hover:border-primary transition-colors"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                </div>
                {Number(item.quantity) > 1 && (
                  <span className="rounded-full bg-surface-dim px-2 py-0.5 text-xs font-medium">
                    {item.quantity}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="rounded-lg p-1 text-muted hover:text-danger transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Checked Items */}
          {checked.length > 0 && (
            <div>
              <button
                onClick={() => setShowChecked(!showChecked)}
                className="flex w-full items-center justify-between rounded-xl bg-surface-dim p-3 text-sm font-medium text-muted"
              >
                <span>נקנו ({checked.length})</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearChecked();
                    }}
                    className="text-xs text-danger hover:underline"
                  >
                    נקה הכל
                  </button>
                  {showChecked ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </button>
              {showChecked && (
                <div className="mt-2 space-y-2">
                  {checked.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border bg-surface p-3 opacity-60"
                    >
                      <button
                        onClick={() => toggleCheck(item)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <p className="flex-1 text-sm line-through">{item.name}</p>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-lg p-1 text-muted hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ShoppingPage() {
  return (
    <FeatureGate feature="shopping">
      <ShoppingPageInner />
    </FeatureGate>
  );
}
