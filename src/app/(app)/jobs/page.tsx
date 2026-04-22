import { listJobs, listTechs } from "@/lib/jobs-query";
import { JobsFilters } from "./filters";
import { NewJobDialog } from "./new-job-dialog";
import { JobsTable } from "./jobs-table";
import { getCurrentUser } from "@/lib/auth";
import type { JobStage, Region } from "@/generated/prisma/enums";

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

      <JobsTable jobs={jobs} techs={techs} canEdit={canCreate} />
    </div>
  );
}
