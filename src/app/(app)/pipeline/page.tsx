import {
  listJobs,
  listTechs,
  type CycleFilter,
  type DueRange,
} from "@/lib/jobs-query";
import { getCurrentUser } from "@/lib/auth";
import { PipelineBoard } from "./pipeline-board";
import { JobsFilters } from "../jobs/filters";
import { NewJobDialog } from "../jobs/new-job-dialog";
import type { JobStage, Region } from "@/generated/prisma/enums";

type Search = Promise<{
  q?: string;
  stage?: string;
  region?: string;
  tech?: string;
  cycle?: string;
  due?: string;
}>;

function parseList<T extends string>(raw: string | undefined): T[] | undefined {
  if (!raw) return undefined;
  return raw.split(",").filter(Boolean) as T[];
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const params = await searchParams;
  const stages = parseList<JobStage>(params.stage);
  const regions = parseList<Region>(params.region);
  const techIds = parseList(params.tech);
  const cycles = parseList<CycleFilter>(params.cycle);
  const dueRange = params.due as DueRange | undefined;
  const unassigned = techIds?.includes("unassigned");
  const filteredTechIds = techIds?.filter((id) => id !== "unassigned");

  const [user, jobs, techs] = await Promise.all([
    getCurrentUser(),
    listJobs({
      q: params.q,
      stages,
      regions,
      techIds: filteredTechIds?.length ? filteredTechIds : undefined,
      unassigned,
      cycles,
      dueRange,
    }),
    listTechs(),
  ]);

  const canEdit =
    user?.role === "ADMIN" || user?.role === "OPS_MANAGER";

  return (
    <div className="px-6 py-6 max-w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Pipeline</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
            {canEdit ? " · drag cards between columns to update stage" : ""}
          </p>
        </div>
        {canEdit ? <NewJobDialog techs={techs} /> : null}
      </div>

      <JobsFilters techs={techs} />

      <div className="mt-4">
        <PipelineBoard jobs={jobs} canEdit={canEdit} techs={techs} />
      </div>
    </div>
  );
}
