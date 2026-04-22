"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertTriangle } from "lucide-react";
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
import { completeJob } from "@/app/actions/tech";

/**
 * Back-office "Complete job" affordance. Used when the tech forgot the
 * signature, the customer wasn't on-site, or an admin is closing out a
 * historical job. Calls completeJob with adminOverride=true when the
 * signature is missing.
 */
export function CompleteJobButton({
  jobId,
  jobNumber,
  propertyName,
  hasSignature,
  userRole,
}: {
  jobId: string;
  jobNumber: string;
  propertyName: string;
  hasSignature: boolean;
  userRole: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const needsOverride = !hasSignature;
  const canOverride = userRole === "ADMIN";
  const blocked = needsOverride && !canOverride;

  function confirm() {
    start(async () => {
      try {
        const result = await completeJob(jobId, {
          adminOverride: needsOverride && canOverride,
        });
        if (result?.pdfError) {
          toast.warning(`Completed, but PDF failed`, {
            description: result.pdfError + " — regenerate from Service Report section.",
          });
        } else {
          toast.success(`Completed ${jobNumber}`, {
            description: "Next cycle created. Service report generated.",
          });
        }
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
      <DialogTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium transition-all hover:bg-emerald-700 shadow-elev-1">
        <Check className="h-3.5 w-3.5" />
        Complete job
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Complete {jobNumber}?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-neutral-900">{propertyName}</span>{" "}
            will be marked complete. Next year&apos;s maintenance cycle gets
            created automatically and a branded service report PDF is
            generated.
          </DialogDescription>
        </DialogHeader>

        {needsOverride && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-[12px] text-amber-900 space-y-1">
              <p className="font-medium">No customer signature on file.</p>
              {canOverride ? (
                <p>
                  As admin, you can override and complete anyway. The activity
                  log will note this was an admin override.
                </p>
              ) : (
                <p>
                  Only admins can complete without a signature. Ask the tech
                  to capture one, or escalate.
                </p>
              )}
            </div>
          </div>
        )}

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
            type="button"
            onClick={confirm}
            disabled={pending || blocked}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-emerald-600 text-white text-[13px] font-medium transition-all hover:bg-emerald-700 disabled:opacity-60 shadow-elev-1"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Completing
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                {needsOverride ? "Complete anyway (override)" : "Complete job"}
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
