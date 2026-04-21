import { prisma } from "@/lib/prisma";
import type { JobStage, Region } from "@/generated/prisma/enums";

export type JobListFilters = {
  q?: string;
  stages?: JobStage[];
  regions?: Region[];
  techIds?: string[];
  unassigned?: boolean;
};

export async function listJobs(filters: JobListFilters = {}) {
  const { q, stages, regions, techIds, unassigned } = filters;

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
