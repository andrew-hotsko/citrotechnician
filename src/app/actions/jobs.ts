"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { STAGE_LABEL } from "@/lib/job-helpers";
import type { JobStage } from "@/generated/prisma/enums";

const VALID_STAGES: JobStage[] = [
  "UPCOMING",
  "OUTREACH",
  "CONFIRMED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "DEFERRED",
];

/**
 * Move a job to a new stage. Logs an ActivityLog entry.
 * Full completion flow (PDF, child job creation) lives in /api/jobs/[id]/complete — Phase 5.
 */
export async function updateJobStage(jobId: string, newStage: JobStage) {
  const user = await requireUser();
  if (user.role === "VIEWER") {
    throw new Error("Viewers cannot change job stage");
  }
  if (!VALID_STAGES.includes(newStage)) {
    throw new Error(`Invalid stage: ${newStage}`);
  }

  const current = await prisma.job.findUnique({
    where: { id: jobId, deletedAt: null },
    select: { id: true, stage: true, jobNumber: true },
  });
  if (!current) throw new Error("Job not found");
  if (current.stage === newStage) return { ok: true, unchanged: true };

  await prisma.$transaction([
    prisma.job.update({
      where: { id: jobId },
      data: { stage: newStage },
    }),
    prisma.activityLog.create({
      data: {
        jobId,
        userId: user.id,
        action: "stage_changed",
        description: `Stage: ${STAGE_LABEL[current.stage]} → ${STAGE_LABEL[newStage]}`,
        metadata: { from: current.stage, to: newStage },
      },
    }),
  ]);

  revalidatePath("/pipeline");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function updateJobAssignment(
  jobId: string,
  techId: string | null,
) {
  const user = await requireUser();
  if (user.role === "VIEWER") {
    throw new Error("Viewers cannot change assignments");
  }

  const current = await prisma.job.findUnique({
    where: { id: jobId, deletedAt: null },
    select: { assignedTechId: true, assignedTech: { select: { name: true } } },
  });
  if (!current) throw new Error("Job not found");

  let newTechName: string | null = null;
  if (techId) {
    const newTech = await prisma.user.findUnique({
      where: { id: techId },
      select: { id: true, name: true, role: true },
    });
    if (!newTech) throw new Error("Tech not found");
    if (newTech.role !== "TECH" && newTech.role !== "ADMIN") {
      throw new Error("User is not a tech");
    }
    newTechName = newTech.name;
  }

  await prisma.$transaction([
    prisma.job.update({
      where: { id: jobId },
      data: { assignedTechId: techId },
    }),
    prisma.activityLog.create({
      data: {
        jobId,
        userId: user.id,
        action: "assignment_changed",
        description: techId
          ? `Assigned to ${newTechName}`
          : `Unassigned (was ${current.assignedTech?.name ?? "unassigned"})`,
        metadata: { from: current.assignedTechId, to: techId },
      },
    }),
  ]);

  revalidatePath("/pipeline");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true as const };
}

export async function updateJobNotes(
  jobId: string,
  field: "officeNotes" | "techNotes",
  value: string,
) {
  const user = await requireUser();
  if (user.role === "VIEWER") throw new Error("Viewers cannot edit notes");

  await prisma.job.update({
    where: { id: jobId, deletedAt: null },
    data: { [field]: value || null },
  });

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true as const };
}
