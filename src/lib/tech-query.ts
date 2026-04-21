import { prisma } from "@/lib/prisma";

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

/**
 * List jobs for a tech's mobile view, bucketed by when they need attention.
 * ADMIN role gets all assigned jobs across all techs (for testing).
 */
export async function listTechJobs(techId: string, isAdmin = false) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = new Date(todayEnd);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      stage: { in: ["SCHEDULED", "IN_PROGRESS", "CONFIRMED"] },
      ...(isAdmin ? {} : { assignedTechId: techId }),
    },
    include: {
      property: {
        include: {
          customer: { select: { name: true, phone: true } },
        },
      },
      assignedTech: {
        select: { id: true, name: true, initials: true, color: true },
      },
    },
    orderBy: [
      { scheduledDate: { sort: "asc", nulls: "last" } },
      { dueDate: "asc" },
    ],
  });

  const today: typeof jobs = [];
  const thisWeek: typeof jobs = [];
  const unscheduled: typeof jobs = [];

  for (const job of jobs) {
    if (job.stage === "IN_PROGRESS") {
      today.push(job);
      continue;
    }
    if (!job.scheduledDate) {
      unscheduled.push(job);
      continue;
    }
    if (job.scheduledDate >= todayStart && job.scheduledDate <= todayEnd) {
      today.push(job);
    } else if (job.scheduledDate > todayEnd && job.scheduledDate <= weekEnd) {
      thisWeek.push(job);
    } else if (job.scheduledDate < todayStart) {
      // Past-scheduled but not yet completed — treat as today.
      today.push(job);
    } else {
      thisWeek.push(job);
    }
  }

  return { today, thisWeek, unscheduled };
}

export type TechJobList = Awaited<ReturnType<typeof listTechJobs>>;
export type TechJob = TechJobList["today"][number];
