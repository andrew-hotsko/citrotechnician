"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { STAGE_LABEL } from "@/lib/job-helpers";
import type {
  CommunicationChannel,
  CommunicationDirection,
  JobStage,
} from "@/generated/prisma/enums";

const VALID_CHANNELS: CommunicationChannel[] = [
  "PHONE",
  "EMAIL",
  "TEXT",
  "IN_PERSON",
  "OTHER",
];
const VALID_DIRECTIONS: CommunicationDirection[] = ["OUTBOUND", "INBOUND"];

// Stages the user can advance to inline from the log dialog. We don't
// allow COMPLETED (must use the completion flow) or DEFERRED (different
// modal flow with deferral reason); reopening from COMPLETED is also
// blocked elsewhere.
const INLINE_STAGE_TARGETS: JobStage[] = [
  "OUTREACH",
  "CONFIRMED",
  "SCHEDULED",
  "IN_PROGRESS",
];

/**
 * Record a structured communication event for a job. Used by ops to keep a
 * paper trail of "called Bob, left voicemail," "replied to their email,"
 * etc. — things that were otherwise being buried in free-text office notes.
 *
 * Also writes an ActivityLog so the event shows up in the Recent Activity
 * feed on the dashboard and job detail.
 */
export async function logCommunication(input: {
  jobId: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  summary: string;
  /**
   * Optional inline stage advance — saves an extra click after a
   * productive call. Server validates the target is one of the
   * "office-side" stages; COMPLETED and DEFERRED still go through
   * their dedicated flows.
   */
  alsoAdvanceTo?: JobStage;
}) {
  const user = await requireUser();
  if (user.role === "VIEWER") {
    throw new Error("Viewers cannot log communications");
  }

  if (!VALID_CHANNELS.includes(input.channel)) {
    throw new Error(`Invalid channel: ${input.channel}`);
  }
  if (!VALID_DIRECTIONS.includes(input.direction)) {
    throw new Error(`Invalid direction: ${input.direction}`);
  }
  const summary = input.summary.trim();
  if (!summary) {
    throw new Error("Summary is required");
  }
  if (input.alsoAdvanceTo && !INLINE_STAGE_TARGETS.includes(input.alsoAdvanceTo)) {
    throw new Error(
      `Stage ${input.alsoAdvanceTo} can't be set inline — use the dedicated flow.`,
    );
  }

  const job = await prisma.job.findFirst({
    where: { id: input.jobId, deletedAt: null },
    select: { id: true, stage: true },
  });
  if (!job) throw new Error("Job not found");
  if (job.stage === "COMPLETED" && input.alsoAdvanceTo) {
    throw new Error("Completed jobs are locked.");
  }

  const channelLabel: Record<CommunicationChannel, string> = {
    PHONE: "Call",
    EMAIL: "Email",
    TEXT: "Text",
    IN_PERSON: "In-person",
    OTHER: "Other",
  };
  const directionLabel: Record<CommunicationDirection, string> = {
    OUTBOUND: "out",
    INBOUND: "in",
  };

  // Outbound = we reached out; inbound = customer reached us. Either
  // way the customer engaged, so it counts as a contact for the
  // "have we tried to reach them lately?" gauge surfaced on the job.
  const isOutbound = input.direction === "OUTBOUND";

  const stageChanged =
    input.alsoAdvanceTo && input.alsoAdvanceTo !== job.stage;

  await prisma.$transaction(async (tx) => {
    await tx.communicationLog.create({
      data: {
        jobId: input.jobId,
        userId: user.id,
        channel: input.channel,
        direction: input.direction,
        summary,
      },
    });

    // Inbound usually means we got a response — reset the chase counter.
    // Outbound increments. Either way we update lastContactAt.
    await tx.job.update({
      where: { id: input.jobId },
      data: {
        lastContactAt: new Date(),
        contactAttempts: isOutbound ? { increment: 1 } : 0,
        ...(stageChanged ? { stage: input.alsoAdvanceTo } : {}),
      },
    });

    await tx.activityLog.create({
      data: {
        jobId: input.jobId,
        userId: user.id,
        action: "communication_logged",
        description: `${channelLabel[input.channel]} (${directionLabel[input.direction]}): ${
          summary.length > 60 ? summary.slice(0, 60) + "\u2026" : summary
        }`,
        metadata: { channel: input.channel, direction: input.direction },
      },
    });

    if (stageChanged) {
      await tx.activityLog.create({
        data: {
          jobId: input.jobId,
          userId: user.id,
          action: "stage_changed",
          description: `Stage: ${STAGE_LABEL[job.stage]} \u2192 ${STAGE_LABEL[input.alsoAdvanceTo!]} (via comms log)`,
          metadata: {
            from: job.stage,
            to: input.alsoAdvanceTo,
            triggeredBy: "communication_logged",
          },
        },
      });
    }
  });

  revalidatePath(`/jobs/${input.jobId}`);
  revalidatePath("/pipeline");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { ok: true as const };
}
