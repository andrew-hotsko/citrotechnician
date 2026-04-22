"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type {
  CommunicationChannel,
  CommunicationDirection,
} from "@/generated/prisma/enums";

const VALID_CHANNELS: CommunicationChannel[] = [
  "PHONE",
  "EMAIL",
  "TEXT",
  "IN_PERSON",
  "OTHER",
];
const VALID_DIRECTIONS: CommunicationDirection[] = ["OUTBOUND", "INBOUND"];

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

  const job = await prisma.job.findFirst({
    where: { id: input.jobId, deletedAt: null },
    select: { id: true },
  });
  if (!job) throw new Error("Job not found");

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

  await prisma.$transaction([
    prisma.communicationLog.create({
      data: {
        jobId: input.jobId,
        userId: user.id,
        channel: input.channel,
        direction: input.direction,
        summary,
      },
    }),
    prisma.activityLog.create({
      data: {
        jobId: input.jobId,
        userId: user.id,
        action: "communication_logged",
        description: `${channelLabel[input.channel]} (${directionLabel[input.direction]}): ${
          summary.length > 60 ? summary.slice(0, 60) + "…" : summary
        }`,
        metadata: { channel: input.channel, direction: input.direction },
      },
    }),
  ]);

  revalidatePath(`/jobs/${input.jobId}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}
