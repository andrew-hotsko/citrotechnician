/**
 * One-time backfill: create MaintenanceReminder rows for every active job
 * that doesn't already have them. Safe to re-run — it only touches jobs
 * where `reminders` is empty.
 *
 * Run with:  npx tsx prisma/backfill-reminders.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { maintenanceReminderScheduleFor } from "../src/lib/reminder-schedule";

const connectionString =
  process.env.DIRECT_URL || process.env.DATABASE_URL || "";
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL must be set");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Pull active jobs that don't have reminders. "Active" = not completed,
  // not deferred, not soft-deleted. Those terminal stages don't need
  // follow-up.
  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      stage: { notIn: ["COMPLETED", "DEFERRED"] },
      maintenanceReminders: { none: {} },
    },
    select: { id: true, jobNumber: true, dueDate: true, stage: true },
    orderBy: { jobNumber: "asc" },
  });

  console.log(`Found ${jobs.length} active job(s) without reminders.`);
  if (jobs.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  let totalReminders = 0;
  for (const job of jobs) {
    const schedule = maintenanceReminderScheduleFor(job.id, job.dueDate);
    await prisma.maintenanceReminder.createMany({ data: schedule });
    totalReminders += schedule.length;
    console.log(
      `  ✓ ${job.jobNumber} (${job.stage}) — ${schedule.length} reminder(s)`,
    );
  }

  console.log(
    `\nBackfill complete: created ${totalReminders} reminder(s) across ${jobs.length} job(s).`,
  );
  console.log(
    "Run the maintenance engine next (Settings → Run now, or GET /api/reminders/run) to generate tasks.",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
