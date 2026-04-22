"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

async function assertCanEditTask(taskId: string) {
  const user = await requireUser();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, assignedToId: true, title: true, jobId: true },
  });
  if (!task) throw new Error("Task not found");
  // Assignee can always edit; admins can edit anyone's.
  if (user.role !== "ADMIN" && task.assignedToId !== user.id) {
    throw new Error("You aren't assigned to this task");
  }
  return { user, task };
}

export async function completeTask(taskId: string) {
  const { user, task } = await assertCanEditTask(taskId);

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { completed: true, completedAt: new Date() },
    });
    if (task.jobId) {
      await tx.activityLog.create({
        data: {
          jobId: task.jobId,
          userId: user.id,
          action: "task_completed",
          description: `Marked task "${task.title}" done`,
          metadata: { taskId },
        },
      });
    }
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (task.jobId) revalidatePath(`/jobs/${task.jobId}`);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Ad-hoc task creation. The maintenance engine auto-creates tasks at T-90/
// T-60/T-30/overdue, but ops often need a manual "remind me Friday about X"
// — this fills that gap.

export type CreateTaskInput = {
  title: string;
  description?: string;
  assignedToId: string; // required — tasks always have an owner
  dueDate?: string | null; // ISO date, optional
  jobId?: string | null; // optional link to a job
};

export async function createTask(input: CreateTaskInput) {
  const actor = await requireUser();
  if (actor.role !== "ADMIN" && actor.role !== "OPS_MANAGER") {
    throw new Error("Only admins and ops managers can create tasks");
  }

  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  // Validate assignee.
  const assignee = await prisma.user.findUnique({
    where: { id: input.assignedToId },
    select: { id: true, active: true, deletedAt: true, name: true },
  });
  if (!assignee || !assignee.active || assignee.deletedAt) {
    throw new Error("Assignee is not an active user");
  }

  // Validate linked job if provided.
  if (input.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: input.jobId, deletedAt: null },
      select: { id: true },
    });
    if (!job) throw new Error("Linked job not found");
  }

  const created = await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        title,
        description: input.description?.trim() || null,
        assignedToId: assignee.id,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        jobId: input.jobId ?? null,
      },
    });
    if (input.jobId) {
      await tx.activityLog.create({
        data: {
          jobId: input.jobId,
          userId: actor.id,
          action: "task_created",
          description: `Created task "${title}" for ${assignee.name}`,
          metadata: { taskId: task.id },
        },
      });
    }
    return task;
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (input.jobId) revalidatePath(`/jobs/${input.jobId}`);
  return { ok: true as const, taskId: created.id };
}

/**
 * Push a task's due date forward (e.g. customer asked us to call back
 * Friday). Stays open in the inbox but stops nagging until the new
 * date. Days can be negative for "pull in" though that's unusual.
 */
export async function snoozeTask(taskId: string, days: number) {
  const { user, task } = await assertCanEditTask(taskId);
  if (!Number.isFinite(days)) throw new Error("days must be a number");

  const base = new Date(); // snooze is "from now," not "from existing due"
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { dueDate: next },
    });
    if (task.jobId) {
      await tx.activityLog.create({
        data: {
          jobId: task.jobId,
          userId: user.id,
          action: "task_snoozed",
          description: `Snoozed task "${task.title}" to ${next.toISOString().slice(0, 10)}`,
          metadata: { taskId, days, snoozedUntil: next.toISOString() },
        },
      });
    }
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (task.jobId) revalidatePath(`/jobs/${task.jobId}`);
  return { ok: true as const };
}

export async function reopenTask(taskId: string) {
  const { user, task } = await assertCanEditTask(taskId);

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { completed: false, completedAt: null },
    });
    if (task.jobId) {
      await tx.activityLog.create({
        data: {
          jobId: task.jobId,
          userId: user.id,
          action: "task_reopened",
          description: `Re-opened task "${task.title}"`,
          metadata: { taskId },
        },
      });
    }
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (task.jobId) revalidatePath(`/jobs/${task.jobId}`);
  return { ok: true as const };
}
