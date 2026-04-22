"use client";

import Link from "next/link";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  Square,
  X,
  User,
  CalendarClock,
  Flag,
  Loader2,
  SearchX,
} from "lucide-react";
import { toast } from "sonner";
import type { JobListItem } from "@/lib/jobs-query";
import {
  StageBadge,
  RegionBadge,
  ProductBadge,
  CycleBadge,
} from "@/components/badges";
import { TechAvatar } from "@/components/tech-avatar";
import { EmptyState } from "@/components/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatDate,
  formatDueIn,
  STAGE_LABEL,
  STAGE_ORDER,
  urgencyFor,
  URGENCY_TONE,
} from "@/lib/job-helpers";
import { bulkUpdateJobs } from "@/app/actions/jobs";
import type { JobStage } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

type Tech = {
  id: string;
  name: string;
  initials: string | null;
  color: string | null;
};

export function JobsTable({
  jobs,
  techs,
  canEdit,
}: {
  jobs: JobListItem[];
  techs: Tech[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const allSelected = jobs.length > 0 && selected.size === jobs.length;
  const anySelected = selected.size > 0;

  function toggle(jobId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(
      allSelected ? new Set() : new Set(jobs.map((j) => j.id)),
    );
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function runBulk(changes: Parameters<typeof bulkUpdateJobs>[1]) {
    const ids = selectedIds;
    start(async () => {
      const result = await bulkUpdateJobs(ids, changes);
      if (result.errors.length > 0) {
        toast.error(
          `${result.updated} updated, ${result.errors.length} failed`,
          { description: result.errors[0]?.error },
        );
      } else {
        toast.success(
          `Updated ${result.updated} ${result.updated === 1 ? "job" : "jobs"}`,
        );
      }
      clearSelection();
      router.refresh();
    });
  }

  if (jobs.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <EmptyState
          icon={SearchX}
          title="No jobs match your filters"
          description="Try clearing the search term or unselecting some stage / region / tech filters above."
          action={{
            type: "link",
            href: "/jobs",
            label: "Clear all filters",
          }}
        />
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
              {canEdit && (
                <th className="text-left font-medium px-3 py-2 w-10">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="inline-flex h-4 w-4 items-center justify-center text-neutral-500 hover:text-neutral-900"
                    aria-label={allSelected ? "Deselect all" : "Select all"}
                  >
                    {allSelected ? (
                      <CheckSquare className="h-4 w-4 text-neutral-900" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
              )}
              <th className="text-left font-medium px-3 py-2 w-28">Job</th>
              <th className="text-left font-medium px-3 py-2">Property</th>
              <th className="text-left font-medium px-3 py-2 w-28">Cycle</th>
              <th className="text-left font-medium px-3 py-2 w-32">Stage</th>
              <th className="text-left font-medium px-3 py-2 w-24">Region</th>
              <th className="text-left font-medium px-3 py-2 w-24">Product</th>
              <th className="text-left font-medium px-3 py-2 w-24">Tech</th>
              <th className="text-left font-medium px-3 py-2 w-36">Due</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                selected={selected.has(job.id)}
                canEdit={canEdit}
                onToggle={() => toggle(job.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating bulk toolbar — only shows when one or more rows are
          selected. Fixed at the bottom of the viewport so it's reachable
          regardless of scroll. */}
      {canEdit && anySelected && (
        <BulkToolbar
          count={selected.size}
          techs={techs}
          pending={pending}
          onClear={clearSelection}
          onRun={runBulk}
        />
      )}
    </>
  );
}

function JobRow({
  job,
  selected,
  canEdit,
  onToggle,
}: {
  job: JobListItem;
  selected: boolean;
  canEdit: boolean;
  onToggle: () => void;
}) {
  const urgency = urgencyFor(job.dueDate);
  return (
    <tr
      className={cn(
        "border-b border-neutral-100 last:border-b-0 transition-colors",
        selected
          ? "bg-blue-50/40 hover:bg-blue-50/60"
          : "hover:bg-neutral-50",
      )}
    >
      {canEdit && (
        <td className="px-3 py-2.5">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-4 w-4 items-center justify-center text-neutral-500 hover:text-neutral-900"
            aria-label={selected ? "Deselect row" : "Select row"}
          >
            {selected ? (
              <CheckSquare className="h-4 w-4 text-neutral-900" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
        </td>
      )}
      <td className="px-3 py-2.5">
        <Link
          href={`/jobs/${job.id}`}
          className="font-mono text-[11px] font-medium text-neutral-700 hover:text-neutral-900"
        >
          {job.jobNumber}
        </Link>
      </td>
      <td className="px-3 py-2.5 min-w-0">
        <Link
          href={`/jobs/${job.id}`}
          className="flex flex-col min-w-0 hover:text-neutral-900"
        >
          <span className="font-medium text-neutral-900 truncate">
            {job.property.name}
          </span>
          <span className="text-[11px] text-neutral-500 truncate">
            {job.property.address}, {job.property.city}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <CycleBadge
          cycleIndex={job.cycleIndex}
          cyclesPlanned={job.cyclesPlanned}
          type={job.type}
          size="sm"
        />
      </td>
      <td className="px-3 py-2.5">
        <StageBadge stage={job.stage} />
      </td>
      <td className="px-3 py-2.5">
        <RegionBadge region={job.property.region} />
      </td>
      <td className="px-3 py-2.5">
        <ProductBadge product={job.product} />
      </td>
      <td className="px-3 py-2.5">
        <TechAvatar tech={job.assignedTech} size="sm" />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-col">
          <span
            className={cn(
              "inline-flex w-fit rounded px-1 py-0.5 text-[11px] font-medium",
              URGENCY_TONE[urgency],
            )}
          >
            {formatDueIn(job.dueDate)}
          </span>
          <span className="text-[10px] text-neutral-400 mt-0.5">
            {formatDate(job.dueDate)}
          </span>
        </div>
      </td>
    </tr>
  );
}

function BulkToolbar({
  count,
  techs,
  pending,
  onClear,
  onRun,
}: {
  count: number;
  techs: Tech[];
  pending: boolean;
  onClear: () => void;
  onRun: (changes: Parameters<typeof bulkUpdateJobs>[1]) => void;
}) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 animate-enter">
      <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white shadow-elev-3 px-2 py-1.5 pr-3">
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-neutral-900 text-white text-[12px] font-medium tabular-nums">
          {count} selected
        </span>

        {/* Reassign */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-neutral-200 bg-white text-[12px] font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-60"
          >
            <User className="h-3.5 w-3.5" />
            Reassign
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
              Assign to
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onRun({ assignedTechId: null })}>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 text-[10px]">
                ?
              </span>
              Unassigned
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {techs.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => onRun({ assignedTechId: t.id })}
              >
                <TechAvatar tech={t} size="sm" />
                {t.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Change stage */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-neutral-200 bg-white text-[12px] font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-60"
          >
            <Flag className="h-3.5 w-3.5" />
            Stage
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-40">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
              Move to
            </DropdownMenuLabel>
            {STAGE_ORDER.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => onRun({ stage: s as JobStage })}
                className="gap-1.5"
              >
                {STAGE_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Push due date */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-neutral-200 bg-white text-[12px] font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-60"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            Push due
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-44">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
              Shift due date
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onRun({ pushDays: 7 })}>
              +1 week
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRun({ pushDays: 14 })}>
              +2 weeks
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRun({ pushDays: 30 })}>
              +30 days
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onRun({ pushDays: -7 })}>
              −1 week (pull in)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear */}
        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-60"
          aria-label="Clear selection"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
