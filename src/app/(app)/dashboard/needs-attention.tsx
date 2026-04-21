import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { NeedsAttentionJob } from "@/lib/dashboard-query";
import { StageBadge, RegionBadge, ProductBadge } from "@/components/badges";
import { TechAvatar } from "@/components/tech-avatar";
import {
  formatDueIn,
  urgencyFor,
  URGENCY_TONE,
} from "@/lib/job-helpers";
import { cn } from "@/lib/utils";

export function NeedsAttention({ jobs }: { jobs: NeedsAttentionJob[] }) {
  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white card-glow overflow-hidden">
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-neutral-100">
        <h2 className="text-[13px] font-semibold tracking-tight">
          Needs attention
        </h2>
        <Link
          href="/jobs?stage=UPCOMING,OUTREACH,CONFIRMED,SCHEDULED,IN_PROGRESS"
          className="group inline-flex items-center gap-0.5 text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
        >
          View all
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </header>

      {jobs.length === 0 ? (
        <p className="px-4 py-8 text-[12px] text-neutral-500 text-center">
          Nothing on fire. Good day.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {jobs.map((j) => {
            const urgency = urgencyFor(j.dueDate);
            return (
              <li key={j.id}>
                <Link
                  href={`/jobs/${j.id}`}
                  className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-50/80"
                >
                  <div className="w-16 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                        URGENCY_TONE[urgency],
                      )}
                    >
                      {formatDueIn(j.dueDate)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="font-mono text-neutral-500">
                        {j.jobNumber}
                      </span>
                      <RegionBadge region={j.property.region} />
                      <ProductBadge product={j.product} />
                    </div>
                    <div className="text-[13px] font-medium tracking-tight mt-0.5 truncate">
                      {j.property.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StageBadge stage={j.stage} />
                    <TechAvatar tech={j.assignedTech} size="sm" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
