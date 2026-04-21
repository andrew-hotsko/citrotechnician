import { cn } from "@/lib/utils";
import type { JobStage, Region, Product } from "@/generated/prisma/enums";
import {
  STAGE_LABEL,
  STAGE_TONE,
  REGION_LABEL,
  PRODUCT_LABEL,
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
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
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
