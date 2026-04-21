import Link from "next/link";
import { SearchX } from "lucide-react";
import { listJobs, listTechs, type JobListItem } from "@/lib/jobs-query";
import { JobsFilters } from "./filters";
import { NewJobDialog } from "./new-job-dialog";
import { getCurrentUser } from "@/lib/auth";
import { StageBadge, RegionBadge, ProductBadge } from "@/components/badges";
import { TechAvatar } from "@/components/tech-avatar";
import { EmptyState } from "@/components/empty-state";
import {
  formatCurrency,
  formatDate,
  formatDueIn,
  urgencyFor,
  URGENCY_TONE,
} from "@/lib/job-helpers";
import type { JobStage, Region } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

type Search = Promise<{
  q?: string;
  stage?: string;
  region?: string;
  tech?: string;
}>;

function parseList<T extends string>(raw: string | undefined): T[] | undefined {
  if (!raw) return undefined;
  return raw.split(",").filter(Boolean) as T[];
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const params = await searchParams;
  const stages = parseList<JobStage>(params.stage);
  const regions = parseList<Region>(params.region);
  const techIds = parseList(params.tech);
  const unassigned = techIds?.includes("unassigned");
  const filteredTechIds = techIds?.filter((id) => id !== "unassigned");

  const [jobs, techs, user] = await Promise.all([
    listJobs({
      q: params.q,
      stages,
      regions,
      techIds: filteredTechIds?.length ? filteredTechIds : undefined,
      unassigned,
    }),
    listTechs(),
    getCurrentUser(),
  ]);

  const canCreate = user?.role === "ADMIN" || user?.role === "OPS_MANAGER";

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-enter">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Jobs</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
          </p>
        </div>
        {canCreate ? <NewJobDialog techs={techs} /> : null}
      </div>

      <JobsFilters techs={techs} />

      <div className="mt-4 rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="text-left font-medium px-3 py-2 w-28">Job</th>
              <th className="text-left font-medium px-3 py-2">Property</th>
              <th className="text-left font-medium px-3 py-2 w-32">Stage</th>
              <th className="text-left font-medium px-3 py-2 w-24">Region</th>
              <th className="text-left font-medium px-3 py-2 w-24">Product</th>
              <th className="text-left font-medium px-3 py-2 w-24">Tech</th>
              <th className="text-left font-medium px-3 py-2 w-36">Due</th>
              <th className="text-right font-medium px-3 py-2 w-28">Value</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-0">
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
                </td>
              </tr>
            ) : (
              jobs.map((job) => <JobRow key={job.id} job={job} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobRow({ job }: { job: JobListItem }) {
  const urgency = urgencyFor(job.dueDate);
  return (
    <tr className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors">
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
      <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">
        {formatCurrency(
          job.contractValue ? Number(job.contractValue) : null,
        )}
      </td>
    </tr>
  );
}
