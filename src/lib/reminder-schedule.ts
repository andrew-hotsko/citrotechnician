import { type ReminderType } from "../generated/prisma/enums";

type ReminderInput = {
  jobId: string;
  type: ReminderType;
  scheduledFor: Date;
};

/**
 * Compute the T-90 / T-60 / T-30 / overdue reminder schedule for a job with
 * the given due date. Callers pass the result straight into
 * `maintenanceReminder.createMany({ data })`.
 *
 * Behavior:
 *   - Normal (future dueDate) → all four reminders scheduled.
 *   - Fully overdue (every reminder would be scheduled for the past) →
 *     collapses to a single OVERDUE reminder scheduled for `now`, so the
 *     engine fires exactly one task on next run instead of stacking four
 *     duplicate tasks for one job. This matters for CSV imports where some
 *     rows may be months past due.
 *
 * This module intentionally has no runtime dependencies (no server-only,
 * no prisma) so it can be imported from the standalone seed script.
 */
export function maintenanceReminderScheduleFor(
  jobId: string,
  dueDate: Date,
  now: Date = new Date(),
): ReminderInput[] {
  const offsetDays = (base: Date, days: number) =>
    new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  const all: ReminderInput[] = [
    { jobId, type: "NINETY_DAY", scheduledFor: offsetDays(dueDate, -90) },
    { jobId, type: "SIXTY_DAY", scheduledFor: offsetDays(dueDate, -60) },
    { jobId, type: "THIRTY_DAY", scheduledFor: offsetDays(dueDate, -30) },
    { jobId, type: "OVERDUE", scheduledFor: offsetDays(dueDate, 1) },
  ];

  if (all.every((r) => r.scheduledFor <= now)) {
    return [{ jobId, type: "OVERDUE", scheduledFor: now }];
  }

  return all;
}
