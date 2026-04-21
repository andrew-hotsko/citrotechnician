"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseRow, type ImportField, type ParsedRow } from "@/lib/csv-import";
import { geocodeBatch } from "@/lib/geocode";
import { maintenanceReminderScheduleFor } from "@/lib/reminders";

export type DryRunRow = ParsedRow & {
  geocodeError?: string;
  geocodedAddress?: string;
};

export type DryRunResult = {
  ok: boolean;
  rows: DryRunRow[];
  summary: {
    total: number;
    valid: number;
    errored: number;
  };
};

/**
 * Client sends the parsed CSV (rows + mapping). Server validates each row
 * and geocodes the address to produce a preview with all errors surfaced
 * BEFORE any write. Side-effect free.
 */
export async function dryRunImport(payload: {
  rows: Record<string, string>[];
  mapping: Record<string, ImportField | null>;
}): Promise<DryRunResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    throw new Error("Only admins and ops managers can import");
  }

  const parsed: DryRunRow[] = payload.rows.map((raw, i) => parseRow(raw, payload.mapping, i + 1));

  // Geocode the rows that have the minimum fields present. Use rowIndex as key.
  const geocodeInputs = parsed
    .filter(
      (r) =>
        r.values.address &&
        r.values.city &&
        r.errors.length === 0,
    )
    .map((r) => ({
      key: String(r.rowIndex),
      street: r.values.address!,
      city: r.values.city!,
      state: r.values.state ?? "CA",
      zip: r.values.zip,
    }));

  const geo = await geocodeBatch(geocodeInputs);

  for (const row of parsed) {
    const g = geo[String(row.rowIndex)];
    if (!g) continue;
    if (g.ok) {
      row.geocodedAddress = g.value.formattedAddress;
      // Stash the coordinates onto the values so 7.3's commit action can read them.
      (row.values as Record<string, unknown>).latitude = g.value.latitude;
      (row.values as Record<string, unknown>).longitude = g.value.longitude;
    } else {
      row.geocodeError = g.error;
      row.errors.push(`Geocoding failed: ${g.error}`);
    }
  }

  const valid = parsed.filter((r) => r.errors.length === 0).length;
  return {
    ok: true,
    rows: parsed,
    summary: {
      total: parsed.length,
      valid,
      errored: parsed.length - valid,
    },
  };
}

// ---------------------------------------------------------------------------
// Commit

export type ImportCommitRow = {
  rowIndex: number;
  values: ParsedRow["values"] & { latitude?: number; longitude?: number };
};

export type ImportCommitResult = {
  ok: boolean;
  summary: {
    attempted: number;
    created: number;
    skipped: number;
  };
  createdJobIds: string[];
  rowErrors: { rowIndex: number; error: string }[];
};

/** Generate the next sequential CT-NNNN job number. */
async function nextJobNumber(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<string> {
  const latest = await tx.job.findFirst({
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });
  const match = latest?.jobNumber.match(/^CT-(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;
  return `CT-${String(next).padStart(4, "0")}`;
}

/**
 * Commit the pre-validated + geocoded rows. Runs per-row transactions so a
 * bad row doesn't roll back the entire import. Returns a summary + error
 * list. Accepts the output of dryRunImport — caller is expected to have
 * stripped rows with errors already.
 */
export async function commitImport(
  rows: ImportCommitRow[],
): Promise<ImportCommitResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    throw new Error("Only admins and ops managers can import");
  }

  const createdJobIds: string[] = [];
  const rowErrors: { rowIndex: number; error: string }[] = [];

  for (const row of rows) {
    const v = row.values;
    if (
      !v.customerName ||
      !v.propertyName ||
      !v.address ||
      !v.city ||
      !v.product ||
      !v.sqft ||
      !v.lastServiceDate ||
      typeof v.latitude !== "number" ||
      typeof v.longitude !== "number"
    ) {
      rowErrors.push({
        rowIndex: row.rowIndex,
        error: "Missing required fields or coordinates",
      });
      continue;
    }

    try {
      const createdJob = await prisma.$transaction(async (tx) => {
        // Find-or-create customer by exact-match name (case-sensitive). Could
        // fuzzy-match later if duplicates become a problem.
        const customer = await tx.customer.upsert({
          where: { salesforceId: `import:${v.customerName}` },
          update: {
            email: v.customerEmail,
            phone: v.customerPhone,
          },
          create: {
            salesforceId: `import:${v.customerName}`,
            name: v.customerName!,
            email: v.customerEmail,
            phone: v.customerPhone,
          },
        });

        const property = await tx.property.create({
          data: {
            customerId: customer.id,
            name: v.propertyName!,
            address: v.address!,
            city: v.city!,
            state: v.state ?? "CA",
            zip: v.zip,
            latitude: v.latitude!,
            longitude: v.longitude!,
            region: v.region ?? "OTHER",
            sqft: v.sqft,
          },
        });

        // Pull the checklist template for the product, if any.
        const tpl = await tx.checklistTemplate.findUnique({
          where: { product: v.product! },
          include: { items: { orderBy: { order: "asc" } } },
        });

        // Compute the next-maintenance due date.
        const interval = v.intervalMonths ?? 12;
        const dueDate = new Date(v.lastServiceDate!);
        dueDate.setMonth(dueDate.getMonth() + interval);

        const jobNumber = await nextJobNumber(tx);

        const job = await tx.job.create({
          data: {
            jobNumber,
            propertyId: property.id,
            stage: dueDate < new Date() ? "OUTREACH" : "UPCOMING",
            type: "MAINTENANCE",
            product: v.product!,
            sqftTreated: v.sqft!,
            contractValue: v.contractValue,
            lastServiceDate: v.lastServiceDate,
            dueDate,
            maintenanceIntervalMonths: interval,
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
            action: "imported",
            description: `Imported from CSV (row ${row.rowIndex})`,
            metadata: { rowIndex: row.rowIndex },
          },
        });

        return job;
      });

      createdJobIds.push(createdJob.id);
    } catch (err) {
      rowErrors.push({
        rowIndex: row.rowIndex,
        error: err instanceof Error ? err.message : "Unknown insert error",
      });
    }
  }

  if (createdJobIds.length > 0) {
    revalidatePath("/dashboard");
    revalidatePath("/jobs");
    revalidatePath("/pipeline");
    revalidatePath("/map");
    revalidatePath("/calendar");
    revalidatePath("/customers");
    revalidatePath("/properties");
  }

  return {
    ok: true,
    summary: {
      attempted: rows.length,
      created: createdJobIds.length,
      skipped: rows.length - createdJobIds.length,
    },
    createdJobIds,
    rowErrors,
  };
}
