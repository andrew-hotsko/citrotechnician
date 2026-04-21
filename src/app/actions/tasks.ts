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
