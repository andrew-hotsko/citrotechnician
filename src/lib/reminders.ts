import "server-only";
import { prisma } from "@/lib/prisma";
import { type ReminderType } from "@/generated/prisma/enums";

/**
 * Converts a MaintenanceReminder into the Task title + description the ops
 * manager sees in their inbox. Kept distinct per type so the inbox reads
 * like a to-do list, not a log dump.
 */
function taskCopyFor(
  type: ReminderType,
  propertyName: string,
  jobNumber: string,
  dueDate: Date,
): { title: string; description: string } {
  const dateLabel = dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  switch (type) {
    case "NINETY_DAY":
      return {
        title: `Start outreach: ${propertyName}`,
        description: `${jobNumber} is due on ${dateLabel}. Reach out to schedule the re-application.`,
      };
    case "SIXTY_DAY":
      return {
        title: `Confirm scheduling: ${propertyName}`,
        description: `${jobNumber} is due on ${dateLabel}. Lock in a date on the calendar.`,
      };
    case "THIRTY_DAY":
      return {
        title: `Final push: ${propertyName}`,
        description: `${jobNumber} is due in ~30 days (${dateLabel}). Confirm the customer and tech are aligned.`,
      };
    case "OVERDUE":
      return {
        title: `Overdue: ${propertyName}`,
        description: `${jobNumber} was due ${dateLabel} and has not been serviced. Recover or defer.`,
      };
  }
}

/**
 * Pick the user who should receive generated tasks.
 *
 *   1. The first active OPS_MANAGER alphabetically.
 *   2. If no OPS_MANAGER exists, fall back to the first active ADMIN.
 *   3. If neither exists, caller handles (tasks are skipped for that run).
 */
async function pickTaskAssignee(): Promise<{ id: string; name: string } | null> {
  const ops = await prisma.user.findFirst({
    where: { role: "OPS_MANAGER", active: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (ops) return ops;
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return admin;
}

export type ReminderRunResult = {
  ok: boolean;
  ranAt: string; // ISO
  tasksCreated: number;
  stagesAdvanced: number;
  remindersSkipped: number; // e.g. no assignee available
  details: {
    createdTaskIds: string[];
    advancedJobIds: string[];
  };
};

/**
 * The daily maintenance engine. Idempotent: each reminder is `triggered=true`
 * as soon as its task is created, so re-running does not duplicate tasks.
 *
 * What it does, in order:
 *   1. For every MaintenanceReminder where scheduledFor <= now AND !triggered:
 *      - If the job is still active (not COMPLETED/DEFERRED, not soft-deleted),
 *        create a Task for the ops manager and mark the reminder triggered.
 *      - If the job is already done, just mark the reminder triggered and skip.
 *   2. For every active job whose dueDate is <= 60 days out AND stage=UPCOMING,
 *      advance stage to OUTREACH and log.
 */
export async function runReminders(): Promise<ReminderRunResult> {
  const ranAt = new Date();
  const sixtyDaysOut = new Date(ranAt.getTime() + 60 * 24 * 60 * 60 * 1000);

  const assignee = await pickTaskAssignee();

  // 1) Pull due reminders eagerly (include job + property for task copy).
  const dueReminders = await prisma.maintenanceReminder.findMany({
    where: {
      triggered: false,
      scheduledFor: { lte: ranAt },
    },
    include: {
      job: {
        select: {
          id: true,
          jobNumber: true,
          stage: true,
          deletedAt: true,
          dueDate: true,
          property: { select: { name: true } },
        },
      },
    },
    orderBy: { scheduledFor: "asc" },
  });

  const createdTaskIds: string[] = [];
  let remindersSkipped = 0;

  for (const reminder of dueReminders) {
    const job = reminder.job;
    const jobTerminal =
      job.deletedAt !== null ||
      job.stage === "COMPLETED" ||
      job.stage === "DEFERRED";

    if (jobTerminal) {
      // Reminder no longer meaningful; mark triggered and skip task creation.
      await prisma.maintenanceReminder.update({
        where: { id: reminder.id },
        data: { triggered: true, triggeredAt: ranAt },
      });
      continue;
    }

    if (!assignee) {
      remindersSkipped++;
      continue;
    }

    const copy = taskCopyFor(
      reminder.type,
      job.property.name,
      job.jobNumber,
      job.dueDate,
    );

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          assignedToId: assignee.id,
          jobId: job.id,
          title: copy.title,
          description: copy.description,
          dueDate: reminder.scheduledFor,
        },
      });
      await tx.maintenanceReminder.update({
        where: { id: reminder.id },
        data: { triggered: true, triggeredAt: ranAt },
      });
      await tx.activityLog.create({
        data: {
          jobId: job.id,
          userId: null, // system action
          action: "reminder_fired",
          description: `Generated task "${copy.title}" for ${assignee.name}`,
          metadata: {
            reminderType: reminder.type,
            taskId: created.id,
            assigneeId: assignee.id,
          },
        },
      });
      return created;
    });
    createdTaskIds.push(task.id);
  }

  // 2) Auto-advance UPCOMING → OUTREACH once we're within 60 days of due.
  const advanced = await prisma.job.findMany({
    where: {
      deletedAt: null,
      stage: "UPCOMING",
      dueDate: { lte: sixtyDaysOut },
    },
    select: { id: true, jobNumber: true, property: { select: { name: true } } },
  });

  for (const j of advanced) {
    await prisma.$transaction([
      prisma.job.update({
        where: { id: j.id },
        data: { stage: "OUTREACH" },
      }),
      prisma.activityLog.create({
        data: {
          jobId: j.id,
          userId: null,
          action: "stage_changed",
          description: "Auto-advanced Upcoming → Outreach (T-60 approaching)",
          metadata: { from: "UPCOMING", to: "OUTREACH", reason: "T-60 auto-advance" },
        },
      }),
    ]);
  }

  return {
    ok: true,
    ranAt: ranAt.toISOString(),
    tasksCreated: createdTaskIds.length,
    stagesAdvanced: advanced.length,
    remindersSkipped,
    details: {
      createdTaskIds,
      advancedJobIds: advanced.map((j) => j.id),
    },
  };
}
