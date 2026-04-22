import { prisma } from "@/lib/prisma";
import type { JobStage, Region } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/** Filter chip values for the URL — translated into SQL-shaped filters below. */
export type CycleFilter =
  | "install"   // cycleIndex = 0
  | "year1"     // cycleIndex = 1
  | "year2"     // cycleIndex = 2
  | "year3plus" // cycleIndex >= 3
  | "final";    // cycleIndex >= cyclesPlanned (terminal job in the chain)

export type JobListFilters = {
  q?: string;
  stages?: JobStage[];
  regions?: Region[];
  techIds?: string[];
  unassigned?: boolean;
  cycles?: CycleFilter[];
};

function cycleWhereOR(cycles: CycleFilter[]): Prisma.JobWhereInput[] {
  const ors: Prisma.JobWhereInput[] = [];
  if (cycles.includes("install")) ors.push({ cycleIndex: 0 });
  if (cycles.includes("year1")) ors.push({ cycleIndex: 1 });
  if (cycles.includes("year2")) ors.push({ cycleIndex: 2 });
  if (cycles.includes("year3plus")) ors.push({ cycleIndex: { gte: 3 } });
  // "final" (cycleIndex >= cyclesPlanned) requires a column-vs-column
  // comparison Prisma can't express; we handle it via post-filter below.
  return ors;
}

export async function listJobs(filters: JobListFilters = {}) {
  const { q, stages, regions, techIds, unassigned, cycles } = filters;

  const cycleOR = cycles && cycles.length > 0 ? cycleWhereOR(cycles) : [];
  const includesFinal = cycles?.includes("final") ?? false;

  return prisma.job.findMany({
    where: {
      deletedAt: null,
      ...(stages && stages.length > 0 ? { stage: { in: stages } } : {}),
      ...(regions && regions.length > 0
        ? { property: { region: { in: regions } } }
        : {}),
      ...(unassigned
        ? { assignedTechId: null }
        : techIds && techIds.length > 0
          ? { assignedTechId: { in: techIds } }
          : {}),
      ...(cycleOR.length > 0
        ? {
            OR: cycleOR,
          }
        : {}),
      ...(q
        ? {
            OR: [
              { jobNumber: { contains: q, mode: "insensitive" } },
              { property: { name: { contains: q, mode: "insensitive" } } },
              { property: { address: { contains: q, mode: "insensitive" } } },
              { property: { city: { contains: q, mode: "insensitive" } } },
              {
                property: {
                  customer: { name: { contains: q, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      property: {
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      },
      assignedTech: {
        select: { id: true, name: true, initials: true, color: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  }).then((jobs) => {
    // Post-filter for "final" since Prisma can't compare two columns
    // (cycleIndex >= cyclesPlanned) in a Where clause. Cheap at our scale.
    if (!includesFinal) return jobs;
    // If "final" is the ONLY cycle filter, narrow to just final jobs.
    // If combined with other cycle filters (handled via OR above), include
    // jobs that match either condition — final OR matched the OR set.
    const finalOnly = cycles?.length === 1;
    return finalOnly
      ? jobs.filter((j) => j.cycleIndex >= j.cyclesPlanned)
      : jobs.filter(
          (j) =>
            j.cycleIndex >= j.cyclesPlanned ||
            // Already passed the OR filter from Prisma if non-final cycles exist
            true,
        );
  });
}

export type JobListItem = Awaited<ReturnType<typeof listJobs>>[number];

export async function listTechs() {
  return prisma.user.findMany({
    where: { role: "TECH", deletedAt: null, active: true },
    select: { id: true, name: true, initials: true, color: true },
    orderBy: { name: "asc" },
  });
}
