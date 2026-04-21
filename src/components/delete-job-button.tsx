"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
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
import { softDeleteJob } from "@/app/actions/jobs";

/**
 * Soft-delete affordance for a job. Two-step: click the red button →
 * confirmation dialog → confirm. Soft-delete means the row stays in the
 * DB (recoverable) but disappears from every list.
 */
export function DeleteJobButton({
  jobId,
  jobNumber,
  propertyName,
}: {
  jobId: string;
  jobNumber: string;
  propertyName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirmDelete() {
    start(async () => {
      const result = await softDeleteJob(jobId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted ${jobNumber}`, {
        description: "Removed from every view. Contact an engineer if you need it back.",
      });
      setOpen(false);
      router.push("/jobs");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) setOpen(v);
      }}
    >
      <DialogTrigger
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-red-200 bg-white text-[12px] font-medium text-red-700 transition-all hover:border-red-300 hover:bg-red-50"
        title="Delete this job"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </DialogTrigger>

      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Delete {jobNumber}?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-neutral-900">{propertyName}</span>{" "}
            will be removed from the pipeline, jobs list, calendar, map, and
            dashboard. This is a soft delete — the record stays in the
            database for recovery if you need it back.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="inline-flex items-center h-9 px-3 rounded-md border border-neutral-200 bg-white text-[13px] font-medium transition-colors hover:bg-neutral-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-red-600 text-white text-[13px] font-medium transition-all hover:bg-red-700 disabled:opacity-60 shadow-elev-1"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Delete job
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
