import { prisma } from "@/lib/prisma";

/** Jobs scheduled within the given inclusive date range. */
export async function listScheduledJobs(weekStart: Date, weekEnd: Date) {
  return prisma.job.findMany({
    where: {
      deletedAt: null,
      scheduledDate: { gte: weekStart, lte: weekEnd },
    },
    include: {
      property: {
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
          address: true,
        },
      },
      assignedTech: {
        select: { id: true, name: true, initials: true, color: true },
      },
    },
    orderBy: { scheduledDate: "asc" },
  });
}

export type ScheduledJob = Awaited<
  ReturnType<typeof listScheduledJobs>
>[number];

/** Active jobs that can be put on the calendar but aren't yet. */
export async function listUnscheduledJobs() {
  return prisma.job.findMany({
    where: {
      deletedAt: null,
      scheduledDate: null,
      stage: { in: ["OUTREACH", "CONFIRMED", "UPCOMING"] },
    },
    include: {
      property: {
        select: { id: true, name: true, city: true, region: true },
      },
      assignedTech: {
        select: { id: true, name: true, initials: true, color: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 50,
  });
}

export type UnscheduledJob = Awaited<
  ReturnType<typeof listUnscheduledJobs>
>[number];
