import Link from "next/link";
import type { NeedsAttentionJob } from "@/lib/dashboard-query";
import { TechAvatar } from "@/components/tech-avatar";
import {
  formatDueIn,
  urgencyFor,
  URGENCY_TONE,
} from "@/lib/job-helpers";
import { cn } from "@/lib/utils";

export function NeedsAttention({ jobs }: { jobs: NeedsAttentionJob[] }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-neutral-100">
        <h2 className="text-[13px] font-semibold tracking-tight">
          Needs attention
        </h2>
        <Link
          href="/jobs?stage=UPCOMING,OUTREACH,CONFIRMED,SCHEDULED,IN_PROGRESS"
          className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          View all
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
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-neutral-50"
                >
                  <span
                    className={cn(
                      "inline-flex items-center shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums whitespace-nowrap min-w-[64px] justify-center",
                      URGENCY_TONE[urgency],
                    )}
                  >
                    {formatDueIn(j.dueDate)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium tracking-tight truncate">
                      {j.property.name}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                      <span className="font-mono">{j.jobNumber}</span>
                      <span className="mx-1.5 text-neutral-300">·</span>
                      {j.property.city}
                    </div>
                  </div>
                  <TechAvatar tech={j.assignedTech} size="sm" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
