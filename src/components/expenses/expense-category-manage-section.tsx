"use client";

import type { ExpenseCategory } from "@/lib/types/database";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

type Props = {
  categories: ExpenseCategory[];
  editingExpenseCatId: string | null;
  editExpenseCatDraft: string;
  onEditDraftChange: (v: string) => void;
  savingExpenseCatId: string | null;
  deletingExpenseCatId: string | null;
  newExpenseCatName: string;
  onNewNameChange: (v: string) => void;
  addingExpenseCat: boolean;
  reorderingCats: boolean;
  onReorder: (reordered: ExpenseCategory[]) => void;
  startEditExpenseCat: (c: ExpenseCategory) => void;
  cancelEditExpenseCat: () => void;
  saveEditExpenseCat: (id: string) => void;
  removeExpenseCategory: (c: ExpenseCategory) => void;
  addExpenseCategory: () => void;
};

function SortableCategoryRow({
  cat,
  dragDisabled,
  editingExpenseCatId,
  editExpenseCatDraft,
  onEditDraftChange,
  savingExpenseCatId,
  deletingExpenseCatId,
  startEditExpenseCat,
  cancelEditExpenseCat,
  saveEditExpenseCat,
  removeExpenseCategory,
}: {
  cat: ExpenseCategory;
  dragDisabled: boolean;
  editingExpenseCatId: string | null;
  editExpenseCatDraft: string;
  onEditDraftChange: (v: string) => void;
  savingExpenseCatId: string | null;
  deletingExpenseCatId: string | null;
  startEditExpenseCat: (c: ExpenseCategory) => void;
  cancelEditExpenseCat: () => void;
  saveEditExpenseCat: (id: string) => void;
  removeExpenseCategory: (c: ExpenseCategory) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id, disabled: dragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined,
    opacity: isDragging ? 0.92 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-transparent bg-surface px-2 py-1.5 text-sm shadow-sm dark:bg-background"
    >
      {editingExpenseCatId === cat.id ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: cat.color || "#737373" }}
          />
          <input
            type="text"
            value={editExpenseCatDraft}
            onChange={(e) => onEditDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEditExpenseCat(cat.id);
              if (e.key === "Escape") cancelEditExpenseCat();
            }}
            className="min-w-[8rem] flex-1 rounded-lg border bg-surface px-2 py-1 text-sm dark:bg-surface-dim"
            autoFocus
            disabled={savingExpenseCatId === cat.id}
          />
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => saveEditExpenseCat(cat.id)}
              disabled={savingExpenseCatId === cat.id}
              className="rounded-lg bg-primary p-1.5 text-white hover:bg-primary-dark disabled:opacity-50"
              title="שמירה"
            >
              {savingExpenseCatId === cat.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={cancelEditExpenseCat}
              disabled={savingExpenseCatId === cat.id}
              className="rounded-lg border p-1.5 text-muted hover:bg-surface-dim disabled:opacity-50"
              title="ביטול"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              className={`shrink-0 rounded-md p-1 text-muted hover:bg-surface-dim ${dragDisabled ? "cursor-not-allowed opacity-40" : "cursor-grab touch-none active:cursor-grabbing"}`}
              disabled={dragDisabled}
              aria-label={`גרירה לשינוי מיקום: ${cat.name}`}
              title="גרירה לשינוי סדר"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: cat.color || "#737373" }}
            />
            <span className="truncate font-medium">{cat.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => startEditExpenseCat(cat)}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-dim"
              title="עריכת שם"
              aria-label={`עריכת ${cat.name}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => removeExpenseCategory(cat)}
              disabled={deletingExpenseCatId === cat.id}
              className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
              title="מחיקת קטגוריה"
              aria-label={`מחיקת ${cat.name}`}
            >
              {deletingExpenseCatId === cat.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </>
      )}
    </li>
  );
}

export function ExpenseCategoryManageSection(props: Props) {
  const {
    categories,
    editingExpenseCatId,
    editExpenseCatDraft,
    onEditDraftChange,
    savingExpenseCatId,
    deletingExpenseCatId,
    newExpenseCatName,
    onNewNameChange,
    addingExpenseCat,
    reorderingCats,
    onReorder,
    startEditExpenseCat,
    cancelEditExpenseCat,
    saveEditExpenseCat,
    removeExpenseCategory,
    addExpenseCategory,
  } = props;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const dragDisabled =
    reorderingCats || editingExpenseCatId !== null || savingExpenseCatId !== null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(categories, oldIndex, newIndex));
  }

  return (
    <div className="rounded-2xl border bg-surface p-5">
      <h2 className="mb-1 font-bold">ניהול קטגוריות</h2>
      <p className="mb-4 text-xs text-muted">
        גרירה לפי סמל ⋮⋮ לשינוי הסדר (גם בפילטרים ובחירת קטגוריה). עריכת שם,
        מחיקה (רק בלי הוצאות משויכות), והוספה.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={categories.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="relative mb-4 space-y-1.5 rounded-xl bg-background p-3">
            {reorderingCats && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-surface/60">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            )}
            {categories.map((cat) => (
              <SortableCategoryRow
                key={cat.id}
                cat={cat}
                dragDisabled={dragDisabled}
                editingExpenseCatId={editingExpenseCatId}
                editExpenseCatDraft={editExpenseCatDraft}
                onEditDraftChange={onEditDraftChange}
                savingExpenseCatId={savingExpenseCatId}
                deletingExpenseCatId={deletingExpenseCatId}
                startEditExpenseCat={startEditExpenseCat}
                cancelEditExpenseCat={cancelEditExpenseCat}
                saveEditExpenseCat={saveEditExpenseCat}
                removeExpenseCategory={removeExpenseCategory}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={newExpenseCatName}
          onChange={(e) => onNewNameChange(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && !addingExpenseCat && void addExpenseCategory()
          }
          placeholder="שם קטגוריה חדשה"
          className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void addExpenseCategory()}
          disabled={addingExpenseCat || !newExpenseCatName.trim()}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {addingExpenseCat ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          הוספת קטגוריה
        </button>
      </div>
    </div>
  );
}
