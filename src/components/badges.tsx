import { cn } from "@/lib/utils";
import type {
  JobStage,
  Region,
  Product,
  JobType,
} from "@/generated/prisma/enums";
import {
  STAGE_LABEL,
  STAGE_TONE,
  REGION_LABEL,
  PRODUCT_LABEL,
  cycleLabel,
} from "@/lib/job-helpers";

export function StageBadge({
  stage,
  className,
}: {
  stage: JobStage;
  className?: string;
}) {
  const tone = STAGE_TONE[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 h-[22px] text-[11px] font-semibold tracking-tight",
        tone.chip,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function RegionBadge({
  region,
  className,
}: {
  region: Region;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-neutral-600",
        className,
      )}
    >
      {REGION_LABEL[region]}
    </span>
  );
}

/**
 * Where the job sits in its maintenance agreement. Three visual states:
 *   - Install (orange) — the very first job for a property
 *   - Year N (neutral) — mid-agreement annual inspection
 *   - Year N final (emerald) — the last scheduled inspection; chain ends after it
 */
export function CycleBadge({
  cycleIndex,
  cyclesPlanned,
  type,
  className,
  size = "md",
}: {
  cycleIndex: number;
  cyclesPlanned: number;
  type?: JobType;
  className?: string;
  size?: "sm" | "md";
}) {
  const { label, isFinal, isInstall } = cycleLabel(
    cycleIndex,
    cyclesPlanned,
    type,
  );

  const sizeCls =
    size === "sm" ? "h-[18px] px-1.5 text-[10px]" : "h-[22px] px-2 text-[11px]";

  if (isInstall) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full font-semibold tracking-tight bg-orange-100 text-orange-900 ring-1 ring-inset ring-orange-200/60",
          sizeCls,
          className,
        )}
      >
        {label}
      </span>
    );
  }

  if (isFinal) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full font-semibold tracking-tight bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200/60",
          sizeCls,
          className,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold tracking-tight bg-neutral-100 text-neutral-800 ring-1 ring-inset ring-neutral-200/60",
        sizeCls,
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ProductBadge({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-neutral-700",
        className,
      )}
    >
      {PRODUCT_LABEL[product]}
    </span>
  );
}
