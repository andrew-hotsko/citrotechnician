"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { STAGE_LABEL } from "@/lib/job-helpers";
import { geocodeAddress } from "@/lib/geocode";
import { maintenanceReminderScheduleFor } from "@/lib/reminders";
import { inferRegionFromZip } from "@/lib/csv-import";
import type {
  JobStage,
  Product,
  Region,
} from "@/generated/prisma/enums";

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

// ---------------------------------------------------------------------------
// Manual single-job creation (UI mirror of CSV import — same shape, one row).

export type CreateJobInput = {
  // Customer — find-or-create by name.
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;

  // Property — always new (a customer can have multiple properties).
  propertyName: string;
  address: string;
  city: string;
  state?: string; // default CA
  zip?: string;
  region?: Region; // inferred from ZIP if omitted

  // Job.
  product: Product;
  sqft: number;
  contractValue?: number;
  lastServiceDate?: string; // ISO yyyy-mm-dd. Omit for brand-new installs.
  intervalMonths?: number; // default 12
  assignedTechId?: string | null;
};

export type CreateJobResult =
  | { ok: true; jobId: string; jobNumber: string }
  | { ok: false; error: string; field?: keyof CreateJobInput };

/**
 * Create a single job from the "New job" dialog. Runs server-side geocoding
 * so we never expose the Maps key to the client, and creates the customer +
 * property + T-90/60/30/overdue reminder rows in one transaction. Mirror of
 * the CSV import per-row path so the two entry points stay in lockstep.
 */
export async function createJob(input: CreateJobInput): Promise<CreateJobResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    return { ok: false, error: "Only admins and ops managers can create jobs" };
  }

  // ----- Validate --------------------------------------------------------
  const customerName = input.customerName.trim();
  const propertyName = input.propertyName.trim();
  const address = input.address.trim();
  const city = input.city.trim();
  const state = (input.state?.trim() || "CA").toUpperCase();
  const zip = input.zip?.trim() || undefined;

  if (!customerName) return { ok: false, error: "Customer name is required", field: "customerName" };
  if (!propertyName) return { ok: false, error: "Property name is required", field: "propertyName" };
  if (!address) return { ok: false, error: "Street address is required", field: "address" };
  if (!city) return { ok: false, error: "City is required", field: "city" };
  if (!Number.isFinite(input.sqft) || input.sqft <= 0) {
    return { ok: false, error: "Sq ft must be a positive number", field: "sqft" };
  }

  const interval = Number.isFinite(input.intervalMonths) && input.intervalMonths!
    ? Math.max(1, Math.floor(input.intervalMonths!))
    : 12;

  const region: Region =
    input.region ?? inferRegionFromZip(zip) ?? "OTHER";

  const lastServiceDate = input.lastServiceDate
    ? new Date(input.lastServiceDate)
    : null;
  if (input.lastServiceDate && isNaN(lastServiceDate!.getTime())) {
    return { ok: false, error: "Last service date is not a valid date", field: "lastServiceDate" };
  }

  // ----- Geocode ---------------------------------------------------------
  const geo = await geocodeAddress(address, city, state, zip);
  if (!geo.ok) {
    return {
      ok: false,
      error: `Couldn't geocode the address: ${geo.error}`,
      field: "address",
    };
  }

  // ----- Compute due date + stage ----------------------------------------
  const now = new Date();
  const dueDate = lastServiceDate
    ? new Date(
        lastServiceDate.getFullYear(),
        lastServiceDate.getMonth() + interval,
        lastServiceDate.getDate(),
      )
    : new Date(now.getTime() + interval * 30 * 24 * 60 * 60 * 1000);

  // New installs go to UPCOMING. Carried-over jobs already past due go
  // directly to OUTREACH so they surface on the dashboard immediately.
  const stage: JobStage = dueDate < now ? "OUTREACH" : "UPCOMING";

  // ----- Validate tech (if any) ------------------------------------------
  if (input.assignedTechId) {
    const tech = await prisma.user.findUnique({
      where: { id: input.assignedTechId },
      select: { id: true, role: true },
    });
    if (!tech || (tech.role !== "TECH" && tech.role !== "ADMIN")) {
      return { ok: false, error: "Assigned user is not a tech", field: "assignedTechId" };
    }
  }

  // ----- Next job number -------------------------------------------------
  const latest = await prisma.job.findFirst({
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });
  const numMatch = latest?.jobNumber.match(/^CT-(\d+)$/);
  const nextSeq = numMatch ? Number(numMatch[1]) + 1 : 1;
  const jobNumber = `CT-${String(nextSeq).padStart(4, "0")}`;

  // ----- Transaction ------------------------------------------------------
  try {
    const created = await prisma.$transaction(async (tx) => {
      // Find-or-create customer by exact name (same pattern as CSV import).
      const customer = await tx.customer.upsert({
        where: { salesforceId: `import:${customerName}` },
        update: {
          email: input.customerEmail?.trim() || undefined,
          phone: input.customerPhone?.trim() || undefined,
        },
        create: {
          salesforceId: `import:${customerName}`,
          name: customerName,
          email: input.customerEmail?.trim() || null,
          phone: input.customerPhone?.trim() || null,
        },
      });

      const property = await tx.property.create({
        data: {
          customerId: customer.id,
          name: propertyName,
          address,
          city,
          state,
          zip,
          latitude: geo.value.latitude,
          longitude: geo.value.longitude,
          region,
          sqft: input.sqft,
        },
      });

      // Pull checklist template for this product, if one exists.
      const tpl = await tx.checklistTemplate.findUnique({
        where: { product: input.product },
        include: { items: { orderBy: { order: "asc" } } },
      });

      const job = await tx.job.create({
        data: {
          jobNumber,
          propertyId: property.id,
          stage,
          type: "MAINTENANCE",
          product: input.product,
          sqftTreated: input.sqft,
          contractValue: input.contractValue,
          lastServiceDate: lastServiceDate ?? undefined,
          dueDate,
          maintenanceIntervalMonths: interval,
          assignedTechId: input.assignedTechId ?? undefined,
          checklistItems: tpl
            ? {
                create: tpl.items.map((i) => ({
                  label: i.label,
                  order: i.order,
                })),
              }
            : undefined,
        },
      });

      await tx.maintenanceReminder.createMany({
        data: maintenanceReminderScheduleFor(job.id, dueDate),
      });

      await tx.activityLog.create({
        data: {
          jobId: job.id,
          userId: user.id,
          action: "created_manually",
          description: `Created via New Job form (${customerName} / ${propertyName})`,
          metadata: { source: "manual" },
        },
      });

      return job;
    });

    revalidatePath("/dashboard");
    revalidatePath("/jobs");
    revalidatePath("/pipeline");
    revalidatePath("/map");
    revalidatePath("/calendar");

    return { ok: true, jobId: created.id, jobNumber: created.jobNumber };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't create the job",
    };
  }
}

// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Edit + delete — lets ops managers fix typos, update contacts, push dates,
// correct pricing, etc. without an engineer.

export type UpdateJobDetailsInput = {
  // Customer-level changes. Applied to the customer shared across ALL of
  // their properties (deliberately — customer has one email / phone / name).
  customer?: {
    name?: string;
    email?: string | null;
    phone?: string | null;
  };
  // Property-level changes. Address changes trigger a re-geocode.
  property?: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string | null;
    region?: Region;
    sqft?: number;
  };
  // Job-level changes. Due-date changes rebuild the T-90/60/30/overdue
  // reminder schedule for any reminder that hasn't fired yet.
  job?: {
    product?: Product;
    sqftTreated?: number;
    contractValue?: number | null;
    lastServiceDate?: string | null; // ISO date
    dueDate?: string; // ISO date
    maintenanceIntervalMonths?: number;
    scheduledDate?: string | null; // ISO datetime
  };
};

export type UpdateJobDetailsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateJobDetails(
  jobId: string,
  input: UpdateJobDetailsInput,
): Promise<UpdateJobDetailsResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    return { ok: false, error: "Only admins and ops managers can edit jobs" };
  }

  const current = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: {
      property: { include: { customer: true } },
    },
  });
  if (!current) return { ok: false, error: "Job not found" };

  // ----- Re-geocode if address touched ----------------------------------
  const propIn = input.property;
  const addressChanged =
    propIn &&
    (propIn.address !== undefined ||
      propIn.city !== undefined ||
      propIn.state !== undefined ||
      propIn.zip !== undefined);

  let newCoords: { latitude: number; longitude: number } | null = null;
  if (addressChanged) {
    const geo = await geocodeAddress(
      propIn!.address ?? current.property.address,
      propIn!.city ?? current.property.city,
      (propIn!.state ?? current.property.state).toUpperCase(),
      propIn!.zip ?? current.property.zip ?? undefined,
    );
    if (!geo.ok) {
      return {
        ok: false,
        error: `Couldn't geocode the new address: ${geo.error}`,
      };
    }
    newCoords = { latitude: geo.value.latitude, longitude: geo.value.longitude };
  }

  // ----- Build changed-field diff for activity logs ---------------------
  const changedFields: string[] = [];
  if (input.customer) {
    for (const k of Object.keys(input.customer) as Array<
      keyof NonNullable<UpdateJobDetailsInput["customer"]>
    >) {
      if (
        input.customer[k] !== undefined &&
        input.customer[k] !== (current.property.customer[k] ?? null)
      ) {
        changedFields.push(`customer.${k}`);
      }
    }
  }
  if (propIn) {
    for (const k of Object.keys(propIn) as Array<
      keyof NonNullable<UpdateJobDetailsInput["property"]>
    >) {
      if (propIn[k] !== undefined) changedFields.push(`property.${k}`);
    }
  }
  if (input.job) {
    for (const k of Object.keys(input.job) as Array<
      keyof NonNullable<UpdateJobDetailsInput["job"]>
    >) {
      if (input.job[k] !== undefined) changedFields.push(`job.${k}`);
    }
  }

  if (changedFields.length === 0) {
    return { ok: true };
  }

  // ----- Transaction ----------------------------------------------------
  const newDueDate = input.job?.dueDate
    ? new Date(input.job.dueDate)
    : current.dueDate;
  const dueDateChanged =
    input.job?.dueDate !== undefined &&
    newDueDate.getTime() !== current.dueDate.getTime();

  try {
    await prisma.$transaction(async (tx) => {
      if (input.customer) {
        const c = input.customer;
        await tx.customer.update({
          where: { id: current.property.customer.id },
          data: {
            name: c.name?.trim() || undefined,
            email: c.email === null ? null : c.email?.trim() || undefined,
            phone: c.phone === null ? null : c.phone?.trim() || undefined,
          },
        });
      }

      if (propIn) {
        await tx.property.update({
          where: { id: current.property.id },
          data: {
            name: propIn.name?.trim() || undefined,
            address: propIn.address?.trim() || undefined,
            city: propIn.city?.trim() || undefined,
            state: propIn.state?.trim().toUpperCase() || undefined,
            zip: propIn.zip === null ? null : propIn.zip?.trim() || undefined,
            region: propIn.region ?? undefined,
            sqft:
              typeof propIn.sqft === "number" && propIn.sqft > 0
                ? propIn.sqft
                : undefined,
            ...(newCoords ?? {}),
          },
        });
      }

      if (input.job) {
        const j = input.job;
        await tx.job.update({
          where: { id: jobId },
          data: {
            product: j.product ?? undefined,
            sqftTreated:
              typeof j.sqftTreated === "number" && j.sqftTreated > 0
                ? j.sqftTreated
                : undefined,
            contractValue:
              j.contractValue === null
                ? null
                : j.contractValue ?? undefined,
            lastServiceDate:
              j.lastServiceDate === null
                ? null
                : j.lastServiceDate
                  ? new Date(j.lastServiceDate)
                  : undefined,
            dueDate: j.dueDate ? new Date(j.dueDate) : undefined,
            maintenanceIntervalMonths:
              typeof j.maintenanceIntervalMonths === "number" &&
              j.maintenanceIntervalMonths > 0
                ? j.maintenanceIntervalMonths
                : undefined,
            scheduledDate:
              j.scheduledDate === null
                ? null
                : j.scheduledDate
                  ? new Date(j.scheduledDate)
                  : undefined,
          },
        });
      }

      // Rebuild the reminder schedule if the due date moved. Only delete
      // untriggered rows — historical (triggered) reminders stay so the
      // activity log still references valid rows.
      if (dueDateChanged) {
        await tx.maintenanceReminder.deleteMany({
          where: { jobId, triggered: false },
        });
        await tx.maintenanceReminder.createMany({
          data: maintenanceReminderScheduleFor(jobId, newDueDate),
        });
      }

      await tx.activityLog.create({
        data: {
          jobId,
          userId: user.id,
          action: "edited",
          description: `Edited ${changedFields.length} field(s): ${changedFields.slice(0, 4).join(", ")}${changedFields.length > 4 ? `, +${changedFields.length - 4} more` : ""}`,
          metadata: { fields: changedFields, dueDateChanged },
        },
      });
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Update failed",
    };
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/pipeline");
  revalidatePath("/map");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Soft-delete a job. Sets deletedAt so the row disappears from every list,
 * but stays in the DB for audit / accidental-delete recovery. The server
 * actions and queries all filter on `deletedAt: null` so removal is
 * instantaneous across every view.
 */
export async function softDeleteJob(
  jobId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    return { ok: false, error: "Only admins and ops managers can delete jobs" };
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    select: { id: true, jobNumber: true },
  });
  if (!job) return { ok: false, error: "Job not found" };

  await prisma.$transaction([
    prisma.job.update({
      where: { id: jobId },
      data: { deletedAt: new Date() },
    }),
    prisma.activityLog.create({
      data: {
        jobId,
        userId: user.id,
        action: "deleted",
        description: `Soft-deleted ${job.jobNumber}`,
      },
    }),
  ]);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/pipeline");
  revalidatePath("/map");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}
