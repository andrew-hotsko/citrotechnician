"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STAGE_LABEL, STAGE_ORDER, STAGE_TONE } from "@/lib/job-helpers";
import { updateJobStage } from "@/app/actions/jobs";
import { cn } from "@/lib/utils";
import type { JobStage } from "@/generated/prisma/enums";

export function JobStageSelect({
  jobId,
  current,
  disabled = false,
}: {
  jobId: string;
  current: JobStage;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const tone = STAGE_TONE[current];

  function select(next: JobStage) {
    if (next === current) return;
    start(async () => {
      try {
        await updateJobStage(jobId, next);
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : "Failed to update stage");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-opacity",
          tone.chip,
          (disabled || pending) && "opacity-60 cursor-not-allowed",
          !disabled && !pending && "hover:ring-1 hover:ring-neutral-300",
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
        {STAGE_LABEL[current]}
        {!disabled && <ChevronDown className="h-3 w-3 opacity-60" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {STAGE_ORDER.map((s) => {
          const t = STAGE_TONE[s];
          return (
            <DropdownMenuItem
              key={s}
              onClick={() => select(s)}
              className="text-[12px] gap-1.5"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
              {STAGE_LABEL[s]}
              {s === current && (
                <span className="ml-auto text-[10px] text-neutral-400">
                  current
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
