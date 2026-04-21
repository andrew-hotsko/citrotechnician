"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  uploadToMediaBucket,
  deleteFromMediaBucket,
  pathFromPublicUrl,
} from "@/lib/storage";
import type { PhotoCategory } from "@/generated/prisma/enums";

const PHOTO_CATEGORIES: PhotoCategory[] = [
  "BEFORE",
  "DURING",
  "AFTER",
  "ISSUE",
];

/**
 * Assert the calling user can act on this job (assigned tech or admin).
 * Returns the job with relation fields needed for downstream logic.
 */
async function assertJobAccess(jobId: string) {
  const user = await requireUser();
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    select: {
      id: true,
      stage: true,
      assignedTechId: true,
      jobNumber: true,
      customerSignature: true,
      maintenanceIntervalMonths: true,
      propertyId: true,
      product: true,
      type: true,
      sqftTreated: true,
      contractValue: true,
    },
  });
  if (!job) throw new Error("Job not found");
  if (user.role !== "ADMIN" && job.assignedTechId !== user.id) {
    throw new Error("You aren't assigned to this job");
  }
  return { user, job };
}

/** Set a checklist item's completed state; auto-advance job to IN_PROGRESS. */
export async function setChecklistItemCompleted(
  itemId: string,
  completed: boolean,
) {
  const user = await requireUser();

  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: {
      job: {
        select: {
          id: true,
          stage: true,
          assignedTechId: true,
          startedAt: true,
        },
      },
    },
  });
  if (!item) throw new Error("Item not found");
  if (user.role !== "ADMIN" && item.job.assignedTechId !== user.id) {
    throw new Error("You aren't assigned to this job");
  }

  const updates: Promise<unknown>[] = [
    prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
        completedById: completed ? user.id : null,
      },
    }),
  ];

  // First tick moves the job from SCHEDULED/CONFIRMED to IN_PROGRESS.
  if (
    completed &&
    (item.job.stage === "SCHEDULED" ||
      item.job.stage === "CONFIRMED" ||
      item.job.stage === "UPCOMING")
  ) {
    updates.push(
      prisma.job.update({
        where: { id: item.job.id },
        data: {
          stage: "IN_PROGRESS",
          startedAt: item.job.startedAt ?? new Date(),
        },
      }),
      prisma.activityLog.create({
        data: {
          jobId: item.job.id,
          userId: user.id,
          action: "stage_changed",
          description: "Started job (first checklist item ticked)",
          metadata: { from: item.job.stage, to: "IN_PROGRESS" },
        },
      }),
    );
  }

  await Promise.all(updates);

  revalidatePath(`/tech/${item.job.id}`);
  revalidatePath(`/tech/${item.job.id}/checklist`);
  revalidatePath(`/jobs/${item.job.id}`);
  return { ok: true as const };
}

/** Upload a photo. Expects a multipart FormData with: file, category, jobId. */
export async function uploadJobPhoto(formData: FormData) {
  const jobId = formData.get("jobId") as string;
  const category = formData.get("category") as PhotoCategory;
  const file = formData.get("file") as File | null;

  if (!jobId || !category || !file) {
    throw new Error("Missing jobId, category, or file");
  }
  if (!PHOTO_CATEGORIES.includes(category)) {
    throw new Error(`Invalid category: ${category}`);
  }
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("File too large (max 8 MB — compression failed?)");
  }

  const { user, job } = await assertJobAccess(jobId);

  const ext = file.type.includes("png") ? "png" : "jpg";
  const path = `photos/${job.id}/${category.toLowerCase()}-${Date.now()}.${ext}`;
  const url = await uploadToMediaBucket(path, file, file.type || `image/${ext}`);

  const photo = await prisma.photo.create({
    data: {
      jobId: job.id,
      url,
      category,
      uploadedById: user.id,
    },
  });

  revalidatePath(`/tech/${job.id}`);
  revalidatePath(`/tech/${job.id}/photos`);
  revalidatePath(`/jobs/${job.id}`);
  return { ok: true as const, photo: { id: photo.id, url: photo.url } };
}

export async function deleteJobPhoto(photoId: string) {
  const user = await requireUser();

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { job: { select: { id: true, assignedTechId: true } } },
  });
  if (!photo) throw new Error("Photo not found");
  if (user.role !== "ADMIN" && photo.job.assignedTechId !== user.id) {
    throw new Error("You aren't assigned to this job");
  }

  const path = pathFromPublicUrl(photo.url);
  if (path) {
    await deleteFromMediaBucket(path).catch(() => {
      // Don't block DB delete if storage delete fails (object may be missing).
    });
  }
  await prisma.photo.delete({ where: { id: photoId } });

  revalidatePath(`/tech/${photo.job.id}`);
  revalidatePath(`/tech/${photo.job.id}/photos`);
  return { ok: true as const };
}

/** Capture the customer signature. Expects a FormData with file + jobId. */
export async function captureSignature(formData: FormData) {
  const jobId = formData.get("jobId") as string;
  const file = formData.get("file") as File | null;
  if (!jobId || !file) throw new Error("Missing jobId or file");

  const { user, job } = await assertJobAccess(jobId);

  // If replacing an existing signature, best-effort clean up the old object.
  if (job.customerSignature) {
    const oldPath = pathFromPublicUrl(job.customerSignature);
    if (oldPath) {
      await deleteFromMediaBucket(oldPath).catch(() => {});
    }
  }

  const path = `signatures/${job.id}.png`;
  const url = await uploadToMediaBucket(path, file, "image/png");

  await prisma.$transaction([
    prisma.job.update({
      where: { id: job.id },
      data: { customerSignature: url },
    }),
    prisma.activityLog.create({
      data: {
        jobId: job.id,
        userId: user.id,
        action: "signature_captured",
        description: "Customer signature captured",
      },
    }),
  ]);

  revalidatePath(`/tech/${job.id}`);
  revalidatePath(`/tech/${job.id}/signature`);
  revalidatePath(`/jobs/${job.id}`);
  return { ok: true as const, url };
}

/**
 * Finalize the job:
 *  - Validate signature captured
 *  - Mark job COMPLETED with completedAt / endedAt / completedBy
 *  - Create child maintenance Job at dueDate = completedAt + interval months
 *  - Create MaintenanceReminders at T-90, T-60, T-30
 *  - Log to ActivityLog
 * NOTE: PDF service report generation is Phase 5 (intentionally deferred).
 */
export async function completeJob(jobId: string) {
  const { user, job } = await assertJobAccess(jobId);
  if (!job.customerSignature) {
    throw new Error("Capture customer signature before completing");
  }
  if (job.stage === "COMPLETED") {
    throw new Error("Job already completed");
  }

  const now = new Date();
  const intervalMs = job.maintenanceIntervalMonths * 30 * 24 * 60 * 60 * 1000;
  const nextDue = new Date(now.getTime() + intervalMs);

  const nextJobNumber = await nextSequentialJobNumber();

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: job.id },
      data: {
        stage: "COMPLETED",
        completedAt: now,
        endedAt: now,
        completedById: user.id,
      },
    });

    const child = await tx.job.create({
      data: {
        jobNumber: nextJobNumber,
        propertyId: job.propertyId,
        product: job.product,
        type: "MAINTENANCE",
        sqftTreated: job.sqftTreated,
        contractValue: job.contractValue,
        stage: "UPCOMING",
        dueDate: nextDue,
        maintenanceIntervalMonths: job.maintenanceIntervalMonths,
        parentJobId: job.id,
        // Seed checklist from product template if one exists.
        checklistItems: {
          create: await buildChecklistFromTemplate(tx, job.product),
        },
      },
    });

    await tx.maintenanceReminder.createMany({
      data: [
        { jobId: child.id, type: "NINETY_DAY", scheduledFor: offsetDays(nextDue, -90) },
        { jobId: child.id, type: "SIXTY_DAY",  scheduledFor: offsetDays(nextDue, -60) },
        { jobId: child.id, type: "THIRTY_DAY", scheduledFor: offsetDays(nextDue, -30) },
        { jobId: child.id, type: "OVERDUE",    scheduledFor: offsetDays(nextDue, 1) },
      ],
    });

    await tx.activityLog.create({
      data: {
        jobId: job.id,
        userId: user.id,
        action: "job_completed",
        description: `Completed. Next service scheduled for ${nextDue.toISOString().slice(0, 10)} (${child.jobNumber}).`,
        metadata: { childJobId: child.id, childJobNumber: child.jobNumber },
      },
    });
  });

  revalidatePath("/tech");
  revalidatePath(`/tech/${job.id}`);
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/pipeline");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

// ---- helpers ---------------------------------------------------------------

function offsetDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

async function buildChecklistFromTemplate(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  product: TechProduct,
) {
  const tpl = await tx.checklistTemplate.findUnique({
    where: { product },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!tpl) return [];
  return tpl.items.map((i) => ({ label: i.label, order: i.order }));
}

type TechProduct = Awaited<
  ReturnType<typeof prisma.job.findUniqueOrThrow>
>["product"];

/** Generate the next CT-NNNN job number based on the current max. */
async function nextSequentialJobNumber(): Promise<string> {
  const latest = await prisma.job.findFirst({
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });
  const match = latest?.jobNumber.match(/^CT-(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;
  return `CT-${String(next).padStart(4, "0")}`;
}
