import { prisma } from "@/lib/prisma";

export type TaskFilter = "open" | "completed" | "all";

export async function listTasksForUser(userId: string, filter: TaskFilter) {
  return prisma.task.findMany({
    where: {
      assignedToId: userId,
      ...(filter === "open"
        ? { completed: false }
        : filter === "completed"
          ? { completed: true }
          : {}),
    },
    include: {
      job: {
        select: {
          id: true,
          jobNumber: true,
          stage: true,
          dueDate: true,
          property: {
            select: { name: true, city: true, region: true },
          },
        },
      },
    },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });
}

export type TaskItem = Awaited<ReturnType<typeof listTasksForUser>>[number];

export async function countTasksForUser(userId: string) {
  const [open, overdue] = await Promise.all([
    prisma.task.count({
      where: { assignedToId: userId, completed: false },
    }),
    prisma.task.count({
      where: {
        assignedToId: userId,
        completed: false,
        dueDate: { lt: new Date() },
      },
    }),
  ]);
  return { open, overdue };
}
