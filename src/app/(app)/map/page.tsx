import { listJobs, listTechs } from "@/lib/jobs-query";
import { getCurrentUser } from "@/lib/auth";
import { pinToneForJob } from "@/lib/map-pin";
import { MapView } from "./map-view";
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

export default async function MapPage({
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

  const [user, jobs, techs] = await Promise.all([
    getCurrentUser(),
    listJobs({
      q: params.q,
      stages,
      regions,
      techIds: filteredTechIds?.length ? filteredTechIds : undefined,
      unassigned,
    }),
    listTechs(),
  ]);

  const canEdit =
    user?.role === "ADMIN" || user?.role === "OPS_MANAGER";

  // Shape the minimum needed for the client.
  const pins = jobs.map((j) => ({
    id: j.id,
    jobNumber: j.jobNumber,
    stage: j.stage,
    product: j.product,
    latitude: j.property.latitude,
    longitude: j.property.longitude,
    propertyName: j.property.name,
    propertyAddress: j.property.address,
    propertyCity: j.property.city,
    propertyRegion: j.property.region,
    dueDate: j.dueDate.toISOString(),
    scheduledDate: j.scheduledDate?.toISOString() ?? null,
    assignedTech: j.assignedTech,
    tone: pinToneForJob(j),
  }));

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  return (
    <MapView
      pins={pins}
      techs={techs}
      canEdit={canEdit}
      apiKey={apiKey}
    />
  );
}
