"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { Check, RotateCcw, Clock } from "lucide-react";
import { toast } from "sonner";
import { completeTask, reopenTask, snoozeTask } from "@/app/actions/tasks";
import type { TaskItem } from "@/lib/tasks-query";
import { StageBadge, RegionBadge } from "@/components/badges";
import { urgencyFor, URGENCY_TONE, formatDueIn } from "@/lib/job-helpers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Optimistic = { id: string; completed: boolean };

export function TasksList({ tasks }: { tasks: TaskItem[] }) {
  const [optimistic, apply] = useOptimistic<TaskItem[], Optimistic>(
    tasks,
    (state, next) =>
      state.map((t) =>
        t.id === next.id
          ? {
              ...t,
              completed: next.completed,
              completedAt: next.completed ? new Date() : null,
            }
          : t,
      ),
  );
  const [, start] = useTransition();

  function toggle(task: TaskItem) {
    const nextValue = !task.completed;
    start(async () => {
      apply({ id: task.id, completed: nextValue });
      try {
        if (nextValue) {
          await completeTask(task.id);
          toast.success("Task completed");
        } else {
          await reopenTask(task.id);
          toast.success("Task re-opened");
        }
      } catch (err) {
        apply({ id: task.id, completed: task.completed });
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function snooze(task: TaskItem, days: number, label: string) {
    start(async () => {
      try {
        await snoozeTask(task.id, days);
        toast.success(`Snoozed ${label}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <ul className="mt-4 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white overflow-hidden">
      {optimistic.map((t) => {
        const urgency = t.dueDate ? urgencyFor(t.dueDate) : "none";
        return (
          <li key={t.id} className="group">
            <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-neutral-50">
              <button
                type="button"
                onClick={() => toggle(t)}
                aria-label={t.completed ? "Re-open task" : "Mark task complete"}
                className={cn(
                  "mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-all",
                  t.completed
                    ? "bg-emerald-500 border-emerald-500 hover:bg-emerald-600"
                    : "border-neutral-300 bg-white hover:border-neutral-900",
                )}
              >
                {t.completed ? (
                  <Check className="h-3 w-3 text-white" />
                ) : (
                  <RotateCcw className="h-2.5 w-2.5 text-transparent group-hover:text-neutral-400 transition-colors" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "text-[13px] font-medium tracking-tight",
                        t.completed && "text-neutral-400 line-through",
                      )}
                    >
                      {t.title}
                    </div>
                    {t.description && (
                      <p
                        className={cn(
                          "text-[12px] mt-0.5",
                          t.completed ? "text-neutral-400" : "text-neutral-500",
                        )}
                      >
                        {t.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.dueDate && !t.completed && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums whitespace-nowrap",
                          URGENCY_TONE[urgency],
                        )}
                      >
                        {formatDueIn(t.dueDate)}
                      </span>
                    )}
                    {!t.completed && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center h-6 w-6 rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-all"
                          aria-label="Snooze task"
                          title="Snooze"
                        >
                          <Clock className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                            Snooze until
                          </DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => snooze(t, 1, "to tomorrow")}>
                            Tomorrow
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => snooze(t, 3, "3 days")}>
                            In 3 days
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => snooze(t, 7, "1 week")}>
                            Next week
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => snooze(t, 14, "2 weeks")}>
                            In 2 weeks
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => snooze(t, 30, "30 days")}>
                            In 30 days
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {t.job && (
                  <div className="flex items-center gap-2 mt-2 text-[11px]">
                    <Link
                      href={`/jobs/${t.job.id}`}
                      className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-900 transition-colors"
                    >
                      <span className="font-mono">{t.job.jobNumber}</span>
                      <span className="text-neutral-300">·</span>
                      <span>{t.job.property.name}</span>
                    </Link>
                    <RegionBadge region={t.job.property.region} />
                    <StageBadge stage={t.job.stage} />
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
