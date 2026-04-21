"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setChecklistItemCompleted } from "@/app/actions/tech";

type Item = { id: string; label: string; completed: boolean };

export function ChecklistClient({
  items,
  locked,
}: {
  items: Item[];
  locked: boolean;
}) {
  const [optimistic, apply] = useOptimistic(
    items,
    (state: Item[], next: { id: string; completed: boolean }) =>
      state.map((i) =>
        i.id === next.id ? { ...i, completed: next.completed } : i,
      ),
  );
  const [, start] = useTransition();

  const doneCount = optimistic.filter((i) => i.completed).length;

  function toggle(item: Item) {
    if (locked) return;
    const next = !item.completed;
    start(async () => {
      apply({ id: item.id, completed: next });
      try {
        await setChecklistItemCompleted(item.id, next);
      } catch (err) {
        console.error(err);
        apply({ id: item.id, completed: item.completed });
        toast.error(err instanceof Error ? err.message : "Failed to update");
      }
    });
  }

  return (
    <div className="mt-4">
      <div className="h-1.5 w-full rounded-full bg-neutral-200 overflow-hidden mb-3">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-200"
          style={{ width: `${(doneCount / optimistic.length) * 100}%` }}
        />
      </div>
      <p className="text-[11px] text-neutral-500 mb-4">
        {doneCount} of {optimistic.length} done
      </p>

      <ul className="space-y-1.5">
        {optimistic.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => toggle(item)}
              disabled={locked}
              className={cn(
                "w-full flex items-start gap-3 rounded-lg border bg-white p-3 text-left transition-colors active:bg-neutral-50",
                item.completed
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-neutral-200",
                locked && "opacity-60 cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                  item.completed
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-neutral-300 bg-white",
                )}
              >
                {item.completed && <Check className="h-3.5 w-3.5 text-white" />}
              </span>
              <span
                className={cn(
                  "text-[14px] leading-snug",
                  item.completed && "text-neutral-500 line-through",
                )}
              >
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
