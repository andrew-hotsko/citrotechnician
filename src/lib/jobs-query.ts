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

/** Preset date ranges for the "Due" filter. */
export type DueRange =
  | "overdue"
  | "this_week"
  | "this_month"
  | "next_30"
  | "next_60"
  | "next_90"
  | "this_quarter"
  | "this_year";

export type JobListFilters = {
  q?: string;
  stages?: JobStage[];
  regions?: Region[];
  techIds?: string[];
  unassigned?: boolean;
  cycles?: CycleFilter[];
  dueRange?: DueRange;
  /** Free-form date range (overrides dueRange if both set). */
  dueFrom?: Date;
  dueTo?: Date;
};

function rangeFor(r: DueRange): { from?: Date; to?: Date } {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  switch (r) {
    case "overdue":
      return { to: startOfDay };
    case "this_week": {
      const dow = startOfDay.getDay(); // 0 = Sun
      const monday = new Date(startOfDay);
      monday.setDate(startOfDay.getDate() - ((dow + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 7);
      return { from: monday, to: sunday };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { from: start, to: end };
    }
    case "next_30":
      return { from: startOfDay, to: new Date(startOfDay.getTime() + 30 * 86400000) };
    case "next_60":
      return { from: startOfDay, to: new Date(startOfDay.getTime() + 60 * 86400000) };
    case "next_90":
      return { from: startOfDay, to: new Date(startOfDay.getTime() + 90 * 86400000) };
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      const end = new Date(now.getFullYear(), q * 3 + 3, 1);
      return { from: start, to: end };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      return { from: start, to: end };
    }
  }
}

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
  const { q, stages, regions, techIds, unassigned, cycles, dueRange, dueFrom, dueTo } = filters;

  const cycleOR = cycles && cycles.length > 0 ? cycleWhereOR(cycles) : [];
  const includesFinal = cycles?.includes("final") ?? false;

  // Resolve dueRange preset to from/to bounds (custom from/to take precedence).
  const resolvedRange = dueRange ? rangeFor(dueRange) : {};
  const fromDate = dueFrom ?? resolvedRange.from;
  const toDate = dueTo ?? resolvedRange.to;

  const dueDateFilter: Prisma.DateTimeFilter = {};
  if (fromDate) dueDateFilter.gte = fromDate;
  if (toDate) dueDateFilter.lt = toDate;
  const dueWhere: Prisma.JobWhereInput =
    fromDate || toDate ? { dueDate: dueDateFilter } : {};

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
              {
                property: {
                  customer: { email: { contains: q, mode: "insensitive" } },
                },
              },
              {
                property: {
                  customer: { phone: { contains: q, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
      ...dueWhere,
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
