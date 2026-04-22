"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTask } from "@/app/actions/tasks";
import { cn } from "@/lib/utils";

type AssignableUser = {
  id: string;
  name: string;
  role: string;
};

const inputCls =
  "block w-full h-9 px-3 text-[13px] border border-neutral-200 bg-white rounded-md placeholder:text-neutral-400 transition-all focus:outline-none focus:border-neutral-900 focus:ring-[3px] focus:ring-neutral-900/8";

export function NewTaskDialog({
  assignees,
  currentUserId,
}: {
  assignees: AssignableUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState(currentUserId);
  const [dueDate, setDueDate] = useState("");

  function reset() {
    setTitle("");
    setDescription("");
    setAssignedToId(currentUserId);
    setDueDate("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      toast.error("Title is required");
      return;
    }
    start(async () => {
      try {
        await createTask({
          title: t,
          description: description.trim() || undefined,
          assignedToId,
          dueDate: dueDate || null,
        });
        toast.success("Task created");
        reset();
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) setOpen(v);
      }}
    >
      <DialogTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 text-white text-[12px] font-medium transition-all hover:bg-neutral-800 shadow-elev-1">
        <Plus className="h-3.5 w-3.5" />
        New task
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            An ad-hoc reminder, separate from the engine-generated outreach
            tasks. Pick who&apos;s responsible and when it&apos;s due.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1">
          <label className="block">
            <div className="text-[11px] font-medium text-neutral-700 mb-1.5">
              Task
            </div>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Call Tahoe customer about Friday window"
              className={inputCls}
            />
          </label>

          <label className="block">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[11px] font-medium text-neutral-700">
                Details
              </span>
              <span className="text-[10px] text-neutral-400">Optional</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Extra context…"
              className={cn(inputCls, "h-auto py-2 resize-y")}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[11px] font-medium text-neutral-700 mb-1.5">
                Assign to
              </div>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className={cn(inputCls, "pr-6")}
              >
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.id === currentUserId ? "(you)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] font-medium text-neutral-700">
                  Due
                </span>
                <span className="text-[10px] text-neutral-400">Optional</span>
              </div>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={cn(inputCls, "tabular-nums")}
              />
            </label>
          </div>

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="inline-flex items-center h-9 px-3 rounded-md border border-neutral-200 bg-white text-[13px] font-medium transition-colors hover:bg-neutral-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !title.trim()}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-neutral-900 text-white text-[13px] font-medium transition-all hover:bg-neutral-800 disabled:opacity-60 shadow-elev-1"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Create task
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
