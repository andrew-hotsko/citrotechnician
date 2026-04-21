"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { completeJob } from "@/app/actions/tech";
import { cn } from "@/lib/utils";

export function CompleteJobButton({
  jobId,
  disabled,
}: {
  jobId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      try {
        await completeJob(jobId);
        router.push("/tech");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to complete");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={disabled || pending}
        className={cn(
          "flex items-center justify-center gap-2 w-full h-14 rounded-md text-[15px] font-semibold transition-colors",
          disabled
            ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            : "bg-emerald-600 text-white active:bg-emerald-700",
          pending && "opacity-70",
        )}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Finishing up…
          </>
        ) : (
          <>
            <Check className="h-5 w-5" />
            Complete job
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-[12px] text-red-600 text-center">{error}</p>
      )}
    </>
  );
}
