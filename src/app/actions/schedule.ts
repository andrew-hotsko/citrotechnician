"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/**
 * Schedule a single job on a specific day, optionally reassigning the tech.
 * Advances CONFIRMED → SCHEDULED automatically; other stages keep theirs.
 */
export async function scheduleJob(
  jobId: string,
  params: { date: Date | string; techId?: string | null },
) {
  const user = await requireUser();
  if (user.role === "VIEWER") throw new Error("Viewers cannot schedule");

  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    select: {
      id: true,
      stage: true,
      scheduledDate: true,
      assignedTechId: true,
      jobNumber: true,
      property: { select: { name: true } },
    },
  });
  if (!job) throw new Error("Job not found");
  if (job.stage === "COMPLETED") {
    throw new Error("Completed jobs can't be scheduled. The next cycle is already on the board.");
  }
  if (job.stage === "DEFERRED") {
    throw new Error("Deferred jobs can't be scheduled. Move them back into the pipeline first.");
  }

  const nextDate = startOfDay(
    typeof params.date === "string" ? new Date(params.date) : params.date,
  );
  const techChanged =
    params.techId !== undefined && params.techId !== job.assignedTechId;

  const shouldAdvance =
    job.stage === "UPCOMING" || job.stage === "OUTREACH" || job.stage === "CONFIRMED";

  await prisma.$transaction([
    prisma.job.update({
      where: { id: job.id },
      data: {
        scheduledDate: nextDate,
        stage: shouldAdvance ? "SCHEDULED" : job.stage,
        ...(params.techId !== undefined ? { assignedTechId: params.techId } : {}),
      },
    }),
    prisma.activityLog.create({
      data: {
        jobId: job.id,
        userId: user.id,
        action: "scheduled",
        description: techChanged
          ? `Scheduled for ${nextDate.toISOString().slice(0, 10)} (tech reassigned)`
          : `Scheduled for ${nextDate.toISOString().slice(0, 10)}`,
        metadata: {
          scheduledDate: nextDate.toISOString(),
          techId: params.techId ?? job.assignedTechId,
        },
      },
    }),
  ]);

  revalidatePath("/calendar");
  revalidatePath("/map");
  revalidatePath("/pipeline");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * Schedule a batch of jobs as a single trip — assigns them all to one tech
 * starting on startDate, spaced one calendar day apart. Useful for the map's
 * "select nearby pins → schedule as trip" workflow.
 */
export async function scheduleTrip(
  jobIds: string[],
  params: { techId: string; startDate: Date | string },
) {
  const user = await requireUser();
  if (user.role === "VIEWER") throw new Error("Viewers cannot schedule");
  if (jobIds.length === 0) throw new Error("No jobs selected");

  const tech = await prisma.user.findUnique({
    where: { id: params.techId },
    select: { id: true, name: true, role: true },
  });
  if (!tech) throw new Error("Tech not found");
  if (tech.role !== "TECH" && tech.role !== "ADMIN") {
    throw new Error("User is not a tech");
  }

  const base = startOfDay(
    typeof params.startDate === "string"
      ? new Date(params.startDate)
      : params.startDate,
  );

  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds }, deletedAt: null },
    select: {
      id: true,
      stage: true,
      jobNumber: true,
      property: { select: { name: true, region: true } },
    },
  });
  if (jobs.length !== jobIds.length) {
    throw new Error("One or more jobs not found");
  }

  const invalid = jobs.filter(
    (j) => j.stage === "COMPLETED" || j.stage === "DEFERRED",
  );
  if (invalid.length > 0) {
    throw new Error(
      `${invalid.length} job(s) are completed or deferred and can't be added to a trip (${invalid.map((j) => j.jobNumber).join(", ")})`,
    );
  }

  // Order by jobId in given input order so ops manager's picking order sticks.
  const ordered = jobIds
    .map((id) => jobs.find((j) => j.id === id))
    .filter((j): j is (typeof jobs)[number] => !!j);

  const day = 24 * 60 * 60 * 1000;
  await prisma.$transaction(
    ordered.flatMap((j, i) => {
      const date = new Date(base.getTime() + i * day);
      const shouldAdvance =
        j.stage === "UPCOMING" ||
        j.stage === "OUTREACH" ||
        j.stage === "CONFIRMED";
      return [
        prisma.job.update({
          where: { id: j.id },
          data: {
            scheduledDate: date,
            assignedTechId: tech.id,
            stage: shouldAdvance ? "SCHEDULED" : j.stage,
          },
        }),
        prisma.activityLog.create({
          data: {
            jobId: j.id,
            userId: user.id,
            action: "scheduled_trip",
            description: `Scheduled as part of ${ordered.length}-stop trip with ${tech.name} on ${date.toISOString().slice(0, 10)}`,
            metadata: {
              tripSize: ordered.length,
              position: i + 1,
              scheduledDate: date.toISOString(),
              techId: tech.id,
            },
          },
        }),
      ];
    }),
  );

  revalidatePath("/calendar");
  revalidatePath("/map");
  revalidatePath("/pipeline");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { ok: true as const, scheduled: ordered.length };
}

export async function unscheduleJob(jobId: string) {
  const user = await requireUser();
  if (user.role === "VIEWER") throw new Error("Viewers cannot schedule");

  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    select: { id: true, scheduledDate: true, stage: true },
  });
  if (!job) throw new Error("Job not found");
  if (!job.scheduledDate) return { ok: true as const, unchanged: true };

  await prisma.$transaction([
    prisma.job.update({
      where: { id: job.id },
      data: {
        scheduledDate: null,
        stage: job.stage === "SCHEDULED" ? "CONFIRMED" : job.stage,
      },
    }),
    prisma.activityLog.create({
      data: {
        jobId: job.id,
        userId: user.id,
        action: "unscheduled",
        description: "Removed from calendar",
      },
    }),
  ]);

  revalidatePath("/calendar");
  revalidatePath("/map");
  revalidatePath("/pipeline");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${job.id}`);
  return { ok: true as const };
}
