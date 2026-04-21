import { prisma } from "@/lib/prisma";

function startOfDay(d = new Date()) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Top jobs needing attention, ordered by urgency:
 *   overdue first, then by soonest due date. Excludes COMPLETED / DEFERRED.
 */
export async function listNeedsAttention(take = 6) {
  return prisma.job.findMany({
    where: {
      deletedAt: null,
      stage: { notIn: ["COMPLETED", "DEFERRED"] },
    },
    include: {
      property: { select: { name: true, city: true, region: true } },
      assignedTech: {
        select: { id: true, name: true, initials: true, color: true },
      },
    },
    orderBy: { dueDate: "asc" },
    take,
  });
}

export type NeedsAttentionJob = Awaited<
  ReturnType<typeof listNeedsAttention>
>[number];

/**
 * Per-tech workload for the next 14 days. Returns each tech with the count
 * of scheduled jobs and a busy-ness percentage (capped at 1 job per day).
 */
export async function listTechWorkload() {
  const now = startOfDay();
  const horizonEnd = addDays(now, 14);

  const techs = await prisma.user.findMany({
    where: { role: "TECH", deletedAt: null, active: true },
    select: { id: true, name: true, initials: true, color: true },
    orderBy: { name: "asc" },
  });

  const counts = await prisma.job.groupBy({
    by: ["assignedTechId"],
    where: {
      deletedAt: null,
      assignedTechId: { in: techs.map((t) => t.id) },
      stage: { notIn: ["COMPLETED", "DEFERRED"] },
      scheduledDate: { gte: now, lte: horizonEnd },
    },
    _count: { _all: true },
  });

  const byId = new Map(
    counts.map((c) => [c.assignedTechId as string, c._count._all]),
  );

  // Assume capacity ~ 1 job / working day across a 2-week horizon (10 jobs).
  const CAPACITY = 10;

  return techs.map((t) => {
    const count = byId.get(t.id) ?? 0;
    return {
      ...t,
      scheduledCount: count,
      utilization: Math.min(count / CAPACITY, 1),
    };
  });
}

export type TechWorkload = Awaited<ReturnType<typeof listTechWorkload>>[number];

/**
 * Jobs scheduled for the next 7 days, returned grouped by day offset (0..6).
 */
export async function listUpcomingWeek() {
  const now = startOfDay();
  const end = addDays(now, 7);

  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      scheduledDate: { gte: now, lt: end },
    },
    include: {
      assignedTech: { select: { initials: true, color: true, name: true } },
      property: { select: { name: true, city: true } },
    },
    orderBy: { scheduledDate: "asc" },
  });

  const buckets: Record<number, typeof jobs> = {};
  for (let i = 0; i < 7; i++) buckets[i] = [];
  for (const j of jobs) {
    if (!j.scheduledDate) continue;
    const offset = Math.floor(
      (startOfDay(j.scheduledDate).getTime() - now.getTime()) /
        (24 * 60 * 60 * 1000),
    );
    if (offset >= 0 && offset < 7) buckets[offset].push(j);
  }
  return buckets;
}

export type UpcomingWeekJob = Awaited<
  ReturnType<typeof listUpcomingWeek>
>[number][number];

/** Recent activity across all jobs. */
export async function listRecentActivity(take = 8) {
  return prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { name: true, initials: true, color: true } },
      job: {
        select: {
          id: true,
          jobNumber: true,
          property: { select: { name: true } },
        },
      },
    },
  });
}

export type RecentActivity = Awaited<
  ReturnType<typeof listRecentActivity>
>[number];
