"use client";

import { useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";

type Result = {
  ok: boolean;
  tasksCreated?: number;
  stagesAdvanced?: number;
  remindersSkipped?: number;
  error?: string;
};

export function RunRemindersButton() {
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      try {
        const res = await fetch("/api/reminders/run", { method: "POST" });
        const json = (await res.json()) as Result;
        if (!res.ok || !json.ok) {
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        const tasks = json.tasksCreated ?? 0;
        const advanced = json.stagesAdvanced ?? 0;
        toast.success(
          `Ran the maintenance engine \u2014 ${tasks} ${tasks === 1 ? "task" : "tasks"}, ${advanced} stages advanced`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to run");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 text-white text-[12px] font-medium hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Running…
        </>
      ) : (
        <>
          <Play className="h-3 w-3" />
          Run now
        </>
      )}
    </button>
  );
}
